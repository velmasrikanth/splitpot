import { AppError } from "../http/errors.js";
import { formatIsoDate } from "../http/validation.js";
import type { GroupRepository } from "../repositories/groups.js";
import type { SettlementRepository } from "../repositories/settlements.js";
import type { PublicUser } from "./auth.js";
import { requireGroup } from "./groups.js";

function presentSettlement(settlement: {
  id: string;
  groupId: string;
  fromMemberId: string;
  toMemberId: string;
  amountMinor: number;
  date: Date;
  createdAt: Date;
}) {
  return {
    id: settlement.id,
    groupId: settlement.groupId,
    fromMemberId: settlement.fromMemberId,
    toMemberId: settlement.toMemberId,
    amountMinor: settlement.amountMinor,
    date: formatIsoDate(settlement.date),
    createdAt: settlement.createdAt.toISOString(),
  };
}

export function createSettlementService(groups: GroupRepository, settlements: SettlementRepository) {
  return {
    async list(user: PublicUser, groupId: string) {
      const { group } = await requireGroup(groups, user.id, groupId, false);
      const rows = await settlements.list(group.id);
      return rows.map(presentSettlement);
    },

    async create(
      user: PublicUser,
      groupId: string,
      input: { fromMemberId: string; toMemberId: string; amountMinor: number; date: Date },
    ) {
      const { group } = await requireGroup(groups, user.id, groupId, true);
      if (input.fromMemberId === input.toMemberId) {
        throw new AppError(400, "VALIDATION", "A settlement needs two different members");
      }
      const known = new Set(group.members.map((member) => member.id));
      if (!known.has(input.fromMemberId) || !known.has(input.toMemberId)) {
        throw new AppError(400, "VALIDATION", "Both people must be members of this pot");
      }
      const created = await settlements.create({ groupId: group.id, ...input });
      return presentSettlement(created);
    },

    async remove(user: PublicUser, groupId: string, settlementId: string) {
      const { group } = await requireGroup(groups, user.id, groupId, true);
      const existing = await settlements.findInGroup(group.id, settlementId);
      if (!existing) {
        throw new AppError(404, "NOT_FOUND", "Settlement not found");
      }
      await settlements.delete(existing.id);
    },
  };
}

export type SettlementService = ReturnType<typeof createSettlementService>;
