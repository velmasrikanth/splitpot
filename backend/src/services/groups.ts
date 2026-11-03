import { randomBytes } from "node:crypto";
import { Prisma } from "@prisma/client";
import { paidAndShare, netBalances } from "../domain/balances.js";
import { suggestTransfers } from "../domain/settlement.js";
import { AppError } from "../http/errors.js";
import { formatIsoDate } from "../http/validation.js";
import type { ExpenseRepository } from "../repositories/expenses.js";
import type { GroupRecord, GroupRepository } from "../repositories/groups.js";
import type { SettlementRepository } from "../repositories/settlements.js";
import type { PublicUser } from "./auth.js";

export function createInviteCode(): string {
  return randomBytes(9).toString("base64url");
}

export function isUniqueConflict(error: unknown): boolean {
  return error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002";
}

export function presentMember(member: GroupRecord["members"][number]) {
  return {
    id: member.id,
    userId: member.userId,
    displayName: member.displayName,
    createdAt: member.createdAt.toISOString(),
  };
}

export function presentGroup(group: GroupRecord) {
  return {
    id: group.id,
    name: group.name,
    type: group.type,
    currency: group.currency,
    status: group.status,
    inviteCode: group.inviteCode,
    startDate: group.startDate ? formatIsoDate(group.startDate) : null,
    endDate: group.endDate ? formatIsoDate(group.endDate) : null,
    createdById: group.createdById,
    createdAt: group.createdAt.toISOString(),
    members: group.members.map(presentMember),
  };
}

export async function requireGroup(groups: GroupRepository, userId: string, groupId: string, write: boolean) {
  const group = await groups.findById(groupId);
  if (!group) {
    throw new AppError(404, "NOT_FOUND", "Group not found");
  }
  const membership = group.members.find((member) => member.userId === userId);
  if (!membership) {
    throw new AppError(404, "NOT_FOUND", "Group not found");
  }
  if (write && group.status !== "open") {
    throw new AppError(409, "GROUP_CLOSED", "This pot is closed");
  }
  return { group, membership };
}

function assertOwner(group: GroupRecord, userId: string): void {
  if (group.createdById !== userId) {
    throw new AppError(403, "FORBIDDEN", "Only the group owner can do that");
  }
}

function assertDateOrder(startDate: Date | null, endDate: Date | null): void {
  if (startDate && endDate && endDate.getTime() < startDate.getTime()) {
    throw new AppError(400, "VALIDATION", "End date must be on or after the start date");
  }
}

export function createGroupService(
  groups: GroupRepository,
  expenses: ExpenseRepository,
  settlements: SettlementRepository,
) {
  return {
    async list(user: PublicUser) {
      const records = await groups.listForUser(user.id);
      return records.map(presentGroup);
    },

    async create(
      user: PublicUser,
      input: {
        name: string;
        type: GroupRecord["type"];
        currency: GroupRecord["currency"];
        startDate: Date | null;
        endDate: Date | null;
      },
    ) {
      assertDateOrder(input.startDate, input.endDate);
      for (let attempt = 0; attempt < 5; attempt += 1) {
        try {
          const group = await groups.createWithOwner({
            ...input,
            inviteCode: createInviteCode(),
            createdById: user.id,
            displayName: user.name,
          });
          return presentGroup(group);
        } catch (error) {
          if (!isUniqueConflict(error) || attempt === 4) {
            throw error;
          }
        }
      }
      throw new AppError(500, "INTERNAL", "Something went wrong");
    },

    async get(user: PublicUser, groupId: string) {
      const { group } = await requireGroup(groups, user.id, groupId, false);
      return presentGroup(group);
    },

    async update(
      user: PublicUser,
      groupId: string,
      input: {
        name?: string;
        type?: GroupRecord["type"];
        currency?: GroupRecord["currency"];
        status?: GroupRecord["status"];
        startDate?: Date | null;
        endDate?: Date | null;
      },
    ) {
      const { group } = await requireGroup(groups, user.id, groupId, false);
      assertOwner(group, user.id);
      const changesStatusOnly =
        input.status !== undefined &&
        input.name === undefined &&
        input.type === undefined &&
        input.currency === undefined &&
        input.startDate === undefined &&
        input.endDate === undefined;
      if (group.status !== "open" && !changesStatusOnly) {
        throw new AppError(409, "GROUP_CLOSED", "This pot is closed");
      }
      if (input.currency && input.currency !== group.currency) {
        const [expenseCount, settlementCount] = await Promise.all([
          expenses.countInGroup(group.id),
          settlements.countInGroup(group.id),
        ]);
        if (expenseCount > 0 || settlementCount > 0) {
          throw new AppError(409, "CURRENCY_LOCKED", "Currency cannot change after money has been recorded");
        }
      }
      const startDate = input.startDate === undefined ? group.startDate : input.startDate;
      const endDate = input.endDate === undefined ? group.endDate : input.endDate;
      assertDateOrder(startDate, endDate);
      const updated = await groups.update(group.id, input);
      return presentGroup(updated);
    },

    async join(user: PublicUser, inviteCode: string, claimMemberId?: string) {
      const group = await groups.findByInviteCode(inviteCode);
      if (!group) {
        throw new AppError(404, "NOT_FOUND", "Invite code was not found");
      }
      const existing = group.members.find((member) => member.userId === user.id);
      if (existing) {
        return presentGroup(group);
      }
      if (group.status !== "open") {
        throw new AppError(409, "GROUP_CLOSED", "This pot is closed");
      }
      if (claimMemberId) {
        const guest = group.members.find((member) => member.id === claimMemberId);
        if (!guest) {
          throw new AppError(404, "NOT_FOUND", "Guest member was not found");
        }
        if (guest.userId) {
          throw new AppError(409, "ALREADY_CLAIMED", "That member is already linked to an account");
        }
        try {
          await groups.claimMember(guest.id, user.id);
        } catch (error) {
          if (isUniqueConflict(error)) {
            throw new AppError(409, "ALREADY_MEMBER", "You are already in this pot");
          }
          throw error;
        }
      } else {
        try {
          await groups.addMember({ groupId: group.id, userId: user.id, displayName: user.name });
        } catch (error) {
          if (!isUniqueConflict(error)) {
            throw error;
          }
        }
      }
      const refreshed = await groups.findById(group.id);
      if (!refreshed) {
        throw new AppError(404, "NOT_FOUND", "Group not found");
      }
      return presentGroup(refreshed);
    },

    async addGuest(user: PublicUser, groupId: string, displayName: string) {
      const { group } = await requireGroup(groups, user.id, groupId, true);
      await groups.addMember({ groupId: group.id, displayName, userId: null });
      const refreshed = await groups.findById(group.id);
      if (!refreshed) {
        throw new AppError(404, "NOT_FOUND", "Group not found");
      }
      return presentGroup(refreshed);
    },

    async removeMember(user: PublicUser, groupId: string, memberId: string) {
      const { group } = await requireGroup(groups, user.id, groupId, true);
      const member = group.members.find((item) => item.id === memberId);
      if (!member) {
        throw new AppError(404, "NOT_FOUND", "Member not found");
      }
      if (member.userId === group.createdById) {
        throw new AppError(409, "OWNER_REQUIRED", "The group owner cannot be removed");
      }
      const [expenseRefs, settlementRefs] = await Promise.all([
        expenses.countReferencingMember(member.id),
        settlements.countReferencingMember(member.id),
      ]);
      if (expenseRefs > 0 || settlementRefs > 0) {
        throw new AppError(409, "MEMBER_IN_USE", "Remove this member's expenses and settlements first");
      }
      await groups.deleteMember(member.id);
    },

    async summary(user: PublicUser, groupId: string) {
      const { group } = await requireGroup(groups, user.id, groupId, false);
      const [expenseRows, settlementRows] = await Promise.all([
        expenses.list(group.id),
        settlements.list(group.id),
      ]);
      const memberIds = group.members.map((member) => member.id);
      const expenseLikes = expenseRows.map((expense) => ({
        amountMinor: expense.amountMinor,
        paidByMemberId: expense.paidByMemberId,
        category: expense.category,
        splits: expense.splits.map((split) => ({ memberId: split.memberId, shareMinor: split.shareMinor })),
      }));
      const totals = paidAndShare(memberIds, expenseLikes);
      const balances = netBalances(
        memberIds,
        expenseLikes,
        settlementRows.map((settlement) => ({
          fromMemberId: settlement.fromMemberId,
          toMemberId: settlement.toMemberId,
          amountMinor: settlement.amountMinor,
        })),
      );
      const names = new Map(group.members.map((member) => [member.id, member.displayName]));
      const categoryTotals = new Map<string, number>();
      for (const expense of expenseLikes) {
        categoryTotals.set(expense.category, (categoryTotals.get(expense.category) ?? 0) + expense.amountMinor);
      }
      const totalMinor = expenseLikes.reduce((sum, expense) => sum + expense.amountMinor, 0);
      return {
        totalMinor,
        settled: balances.every((balance) => balance.netMinor === 0),
        members: totals
          .map((row) => ({
            memberId: row.memberId,
            displayName: names.get(row.memberId) ?? "",
            paidMinor: row.paidMinor,
            shareMinor: row.shareMinor,
            netMinor: balances.find((balance) => balance.memberId === row.memberId)?.netMinor ?? 0,
          }))
          .sort((left, right) => left.displayName.localeCompare(right.displayName) || left.memberId.localeCompare(right.memberId)),
        categories: [...categoryTotals.entries()]
          .map(([category, amount]) => ({ category, totalMinor: amount }))
          .sort((left, right) => right.totalMinor - left.totalMinor || left.category.localeCompare(right.category)),
        transfers: suggestTransfers(balances),
      };
    },
  };
}

export type GroupService = ReturnType<typeof createGroupService>;
