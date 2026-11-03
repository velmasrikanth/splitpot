import type { Currency, GroupStatus, GroupType, PrismaClient } from "@prisma/client";

const groupInclude = {
  members: { orderBy: { createdAt: "asc" as const } },
};

export function createGroupRepository(prisma: PrismaClient) {
  return {
    findById(id: string) {
      return prisma.group.findUnique({ where: { id }, include: groupInclude });
    },
    findByInviteCode(inviteCode: string) {
      return prisma.group.findUnique({ where: { inviteCode }, include: groupInclude });
    },
    listForUser(userId: string) {
      return prisma.group.findMany({
        where: { members: { some: { userId } } },
        include: groupInclude,
        orderBy: { createdAt: "desc" },
      });
    },
    createWithOwner(data: {
      name: string;
      type: GroupType;
      currency: Currency;
      startDate: Date | null;
      endDate: Date | null;
      inviteCode: string;
      createdById: string;
      displayName: string;
    }) {
      return prisma.$transaction(async (tx) => {
        const group = await tx.group.create({
          data: {
            name: data.name,
            type: data.type,
            currency: data.currency,
            startDate: data.startDate,
            endDate: data.endDate,
            inviteCode: data.inviteCode,
            createdById: data.createdById,
          },
        });
        await tx.member.create({
          data: {
            groupId: group.id,
            userId: data.createdById,
            displayName: data.displayName,
          },
        });
        return tx.group.findUniqueOrThrow({ where: { id: group.id }, include: groupInclude });
      });
    },
    update(
      id: string,
      data: {
        name?: string;
        type?: GroupType;
        currency?: Currency;
        status?: GroupStatus;
        startDate?: Date | null;
        endDate?: Date | null;
      },
    ) {
      return prisma.group.update({ where: { id }, data, include: groupInclude });
    },
    addMember(data: { groupId: string; displayName: string; userId?: string | null }) {
      return prisma.member.create({ data });
    },
    findMember(id: string) {
      return prisma.member.findUnique({ where: { id } });
    },
    claimMember(id: string, userId: string) {
      return prisma.member.update({ where: { id }, data: { userId } });
    },
    deleteMember(id: string) {
      return prisma.member.delete({ where: { id } });
    },
  };
}

export type GroupRepository = ReturnType<typeof createGroupRepository>;
export type GroupRecord = NonNullable<Awaited<ReturnType<GroupRepository["findById"]>>>;
