import type { ExpenseCategory, SplitType } from "@prisma/client";
import { calculateSplits, SplitError, type SplitRequest } from "../domain/splits.js";
import { AppError } from "../http/errors.js";
import { formatIsoDate } from "../http/validation.js";
import type { ExpenseRepository, StoredExpense } from "../repositories/expenses.js";
import type { GroupRecord, GroupRepository } from "../repositories/groups.js";
import type { PublicUser } from "./auth.js";
import { requireGroup } from "./groups.js";

export type ExpenseInput = {
  description: string;
  amountMinor: number;
  category: ExpenseCategory;
  date: Date;
  paidByMemberId: string;
  split: SplitRequest;
};

function presentExpense(expense: StoredExpense) {
  return {
    id: expense.id,
    groupId: expense.groupId,
    description: expense.description,
    amountMinor: expense.amountMinor,
    category: expense.category,
    date: formatIsoDate(expense.date),
    paidByMemberId: expense.paidByMemberId,
    splitType: expense.splitType,
    createdBy: expense.createdBy,
    createdAt: expense.createdAt.toISOString(),
    updatedAt: expense.updatedAt.toISOString(),
    splits: expense.splits.map((split) => ({ memberId: split.memberId, shareMinor: split.shareMinor })),
  };
}

function splitTypeOf(split: SplitRequest): SplitType {
  return split.type;
}

function memberIdsFor(split: SplitRequest): string[] {
  if (split.type === "equal") {
    return split.memberIds;
  }
  return split.lines.map((line) => line.memberId);
}

function resolveSplits(group: GroupRecord, input: ExpenseInput) {
  const known = new Set(group.members.map((member) => member.id));
  if (!known.has(input.paidByMemberId)) {
    throw new AppError(400, "VALIDATION", "The payer must be a member of this pot");
  }
  const memberIds = memberIdsFor(input.split);
  if (memberIds.some((memberId) => !known.has(memberId))) {
    throw new AppError(400, "VALIDATION", "Every split must use a member of this pot");
  }
  try {
    return calculateSplits(input.amountMinor, input.split);
  } catch (error) {
    if (error instanceof SplitError) {
      throw new AppError(400, "VALIDATION", error.message);
    }
    throw error;
  }
}

function assertCanChange(group: GroupRecord, userId: string, createdById: string): void {
  if (createdById !== userId && group.createdById !== userId) {
    throw new AppError(403, "FORBIDDEN", "Only the person who added this expense or the group owner can change it");
  }
}

export function createExpenseService(groups: GroupRepository, expenses: ExpenseRepository) {
  return {
    async list(user: PublicUser, groupId: string) {
      const { group } = await requireGroup(groups, user.id, groupId, false);
      const rows = await expenses.list(group.id);
      return rows.map(presentExpense);
    },

    async create(user: PublicUser, groupId: string, input: ExpenseInput) {
      const { group } = await requireGroup(groups, user.id, groupId, true);
      const splits = resolveSplits(group, input);
      const created = await expenses.create({
        groupId: group.id,
        description: input.description,
        amountMinor: input.amountMinor,
        category: input.category,
        date: input.date,
        paidByMemberId: input.paidByMemberId,
        splitType: splitTypeOf(input.split),
        createdById: user.id,
        splits,
      });
      return presentExpense(created);
    },

    async update(user: PublicUser, groupId: string, expenseId: string, input: ExpenseInput) {
      const { group } = await requireGroup(groups, user.id, groupId, true);
      const existing = await expenses.findInGroup(group.id, expenseId);
      if (!existing) {
        throw new AppError(404, "NOT_FOUND", "Expense not found");
      }
      assertCanChange(group, user.id, existing.createdById);
      const splits = resolveSplits(group, input);
      const updated = await expenses.replace(existing.id, {
        description: input.description,
        amountMinor: input.amountMinor,
        category: input.category,
        date: input.date,
        paidByMemberId: input.paidByMemberId,
        splitType: splitTypeOf(input.split),
        splits,
      });
      return presentExpense(updated);
    },

    async remove(user: PublicUser, groupId: string, expenseId: string) {
      const { group } = await requireGroup(groups, user.id, groupId, true);
      const existing = await expenses.findInGroup(group.id, expenseId);
      if (!existing) {
        throw new AppError(404, "NOT_FOUND", "Expense not found");
      }
      assertCanChange(group, user.id, existing.createdById);
      await expenses.delete(existing.id);
    },
  };
}

export type ExpenseService = ReturnType<typeof createExpenseService>;
