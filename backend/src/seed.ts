import { PrismaClient } from "@prisma/client";
import argon2 from "argon2";
import { calculateSplits } from "./domain/splits.js";

const prisma = new PrismaClient();

async function main(): Promise<void> {
  const existing = await prisma.user.findUnique({ where: { email: "anu@example.com" } });
  if (existing) {
    console.log(JSON.stringify({ message: "seed already applied" }));
    return;
  }

  const passwordHash = await argon2.hash("password123");
  const anu = await prisma.user.create({
    data: { email: "anu@example.com", name: "Anu", passwordHash },
  });
  const ravi = await prisma.user.create({
    data: { email: "ravi@example.com", name: "Ravi", passwordHash },
  });
  const group = await prisma.group.create({
    data: {
      name: "Goa weekend",
      type: "trip",
      currency: "INR",
      startDate: new Date("2026-12-01T00:00:00.000Z"),
      endDate: new Date("2026-12-05T00:00:00.000Z"),
      inviteCode: "goa-weekend-dev",
      createdById: anu.id,
    },
  });
  const anuMember = await prisma.member.create({
    data: { groupId: group.id, userId: anu.id, displayName: "Anu" },
  });
  const raviMember = await prisma.member.create({
    data: { groupId: group.id, userId: ravi.id, displayName: "Ravi" },
  });
  const priya = await prisma.member.create({
    data: { groupId: group.id, displayName: "Priya" },
  });

  const expenses: {
    description: string;
    amountMinor: number;
    category: "food" | "stay" | "transport" | "drinks" | "activities" | "shopping";
    date: string;
    paidByMemberId: string;
    splitType: "equal" | "exact" | "percentage" | "shares";
    createdById: string;
    request: Parameters<typeof calculateSplits>[1];
  }[] = [
    {
      description: "Beach dinner",
      amountMinor: 240000,
      category: "food",
      date: "2026-12-01",
      paidByMemberId: anuMember.id,
      splitType: "equal",
      createdById: anu.id,
      request: { type: "equal", memberIds: [anuMember.id, raviMember.id, priya.id] },
    },
    {
      description: "Hotel",
      amountMinor: 800000,
      category: "stay",
      date: "2026-12-01",
      paidByMemberId: raviMember.id,
      splitType: "exact",
      createdById: ravi.id,
      request: {
        type: "exact",
        lines: [
          { memberId: anuMember.id, amountMinor: 400000 },
          { memberId: raviMember.id, amountMinor: 300000 },
          { memberId: priya.id, amountMinor: 100000 },
        ],
      },
    },
    {
      description: "Airport cab",
      amountMinor: 180000,
      category: "transport",
      date: "2026-12-02",
      paidByMemberId: anuMember.id,
      splitType: "percentage",
      createdById: anu.id,
      request: {
        type: "percentage",
        lines: [
          { memberId: anuMember.id, basisPoints: 5000 },
          { memberId: raviMember.id, basisPoints: 2500 },
          { memberId: priya.id, basisPoints: 2500 },
        ],
      },
    },
    {
      description: "Drinks",
      amountMinor: 90000,
      category: "drinks",
      date: "2026-12-02",
      paidByMemberId: raviMember.id,
      splitType: "shares",
      createdById: ravi.id,
      request: {
        type: "shares",
        lines: [
          { memberId: anuMember.id, shares: 2 },
          { memberId: raviMember.id, shares: 1 },
          { memberId: priya.id, shares: 1 },
        ],
      },
    },
    {
      description: "Fort tickets",
      amountMinor: 45000,
      category: "activities",
      date: "2026-12-03",
      paidByMemberId: anuMember.id,
      splitType: "equal",
      createdById: anu.id,
      request: { type: "equal", memberIds: [anuMember.id, raviMember.id] },
    },
    {
      description: "Market",
      amountMinor: 120000,
      category: "shopping",
      date: "2026-12-03",
      paidByMemberId: priya.id,
      splitType: "exact",
      createdById: anu.id,
      request: {
        type: "exact",
        lines: [
          { memberId: anuMember.id, amountMinor: 20000 },
          { memberId: raviMember.id, amountMinor: 50000 },
          { memberId: priya.id, amountMinor: 50000 },
        ],
      },
    },
  ];

  for (const expense of expenses) {
    const splits = calculateSplits(expense.amountMinor, expense.request);
    await prisma.expense.create({
      data: {
        groupId: group.id,
        description: expense.description,
        amountMinor: expense.amountMinor,
        category: expense.category,
        date: new Date(`${expense.date}T00:00:00.000Z`),
        paidByMemberId: expense.paidByMemberId,
        splitType: expense.splitType,
        createdById: expense.createdById,
        splits: { create: splits },
      },
    });
  }

  console.log(JSON.stringify({ message: "seeded", groupId: group.id, inviteCode: group.inviteCode }));
}

main()
  .catch((error: unknown) => {
    console.error(JSON.stringify({ message: "seed failed" }));
    throw error;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
