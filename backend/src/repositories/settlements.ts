import type { PrismaClient } from "@prisma/client";

export function createSettlementRepository(prisma: PrismaClient) {
  return {
    list(groupId: string) {
      return prisma.settlement.findMany({
        where: { groupId },
        orderBy: [{ date: "asc" }, { createdAt: "asc" }],
      });
    },
    findInGroup(groupId: string, settlementId: string) {
      return prisma.settlement.findFirst({ where: { id: settlementId, groupId } });
    },
    countInGroup(groupId: string) {
      return prisma.settlement.count({ where: { groupId } });
    },
    countReferencingMember(memberId: string) {
      return prisma.settlement.count({
        where: { OR: [{ fromMemberId: memberId }, { toMemberId: memberId }] },
      });
    },
    create(data: { groupId: string; fromMemberId: string; toMemberId: string; amountMinor: number; date: Date }) {
      return prisma.settlement.create({ data });
    },
    delete(id: string) {
      return prisma.settlement.delete({ where: { id } });
    },
  };
}

export type SettlementRepository = ReturnType<typeof createSettlementRepository>;
