import type { ExpenseCategory, Prisma, PrismaClient, SplitType } from "@prisma/client";

const expenseInclude = {
  splits: { orderBy: { memberId: "asc" as const } },
  createdBy: { select: { id: true, name: true } },
} satisfies Prisma.ExpenseInclude;

export type StoredExpense = Prisma.ExpenseGetPayload<{ include: typeof expenseInclude }>;

export function createExpenseRepository(prisma: PrismaClient) {
  return {
    list(groupId: string) {
      return prisma.expense.findMany({
        where: { groupId },
        include: expenseInclude,
        orderBy: [{ date: "asc" }, { createdAt: "asc" }],
      });
    },
    findInGroup(groupId: string, expenseId: string) {
      return prisma.expense.findFirst({
        where: { id: expenseId, groupId },
        include: expenseInclude,
      });
    },
    countInGroup(groupId: string) {
      return prisma.expense.count({ where: { groupId } });
    },
    countReferencingMember(memberId: string) {
      return prisma.expense.count({
        where: {
          OR: [{ paidByMemberId: memberId }, { splits: { some: { memberId } } }],
        },
      });
    },
    create(data: {
      groupId: string;
      description: string;
      amountMinor: number;
      category: ExpenseCategory;
      date: Date;
      paidByMemberId: string;
      splitType: SplitType;
      createdById: string;
      splits: { memberId: string; shareMinor: number }[];
    }) {
      return prisma.$transaction(async (tx) => {
        const expense = await tx.expense.create({
          data: {
            groupId: data.groupId,
            description: data.description,
            amountMinor: data.amountMinor,
            category: data.category,
            date: data.date,
            paidByMemberId: data.paidByMemberId,
            splitType: data.splitType,
            createdById: data.createdById,
            splits: { create: data.splits },
          },
          include: expenseInclude,
        });
        return expense;
      });
    },
    replace(
      expenseId: string,
      data: {
        description: string;
        amountMinor: number;
        category: ExpenseCategory;
        date: Date;
        paidByMemberId: string;
        splitType: SplitType;
        splits: { memberId: string; shareMinor: number }[];
      },
    ) {
      return prisma.$transaction(async (tx) => {
        await tx.expenseSplit.deleteMany({ where: { expenseId } });
        return tx.expense.update({
          where: { id: expenseId },
          data: {
            description: data.description,
            amountMinor: data.amountMinor,
            category: data.category,
            date: data.date,
            paidByMemberId: data.paidByMemberId,
            splitType: data.splitType,
            splits: { create: data.splits },
          },
          include: expenseInclude,
        });
      });
    },
    delete(expenseId: string) {
      return prisma.expense.delete({ where: { id: expenseId } });
    },
  };
}

export type ExpenseRepository = ReturnType<typeof createExpenseRepository>;
