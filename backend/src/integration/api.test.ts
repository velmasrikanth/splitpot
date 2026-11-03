import type { PrismaClient } from "@prisma/client";
import { PrismaClient as PrismaClientConstructor } from "@prisma/client";
import type { FastifyInstance } from "fastify";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { createApp } from "../app.js";
import { loadConfig } from "../config.js";

const prisma = new PrismaClientConstructor();
const config = loadConfig({
  NODE_ENV: "test",
  HOST: "127.0.0.1",
  PORT: "3000",
  DATABASE_URL: process.env.DATABASE_URL ?? "postgresql://splitpot:splitpot@db:5432/splitpot_test",
  FRONTEND_ORIGIN: "http://localhost:5173",
  JWT_SECRET: "test-secret-value",
  LOG_LEVEL: "silent",
  AUTH_RATE_LIMIT_MAX: "10000",
});

type Member = { id: string; displayName: string; userId: string | null };
type GroupBody = { id: string; inviteCode: string; members: Member[] };
type SummaryBody = {
  totalMinor: number;
  settled: boolean;
  members: { memberId: string; displayName: string; paidMinor: number; shareMinor: number; netMinor: number }[];
  transfers: { fromMemberId: string; toMemberId: string; amountMinor: number }[];
};

function cookieFrom(setCookie: string | string[] | undefined): string {
  const header = Array.isArray(setCookie) ? setCookie[0] : setCookie;
  if (!header) {
    throw new Error("expected a session cookie");
  }
  return header.split(";")[0] ?? "";
}

async function signup(app: FastifyInstance, name: string, email: string) {
  const response = await app.inject({
    method: "POST",
    url: "/api/auth/signup",
    payload: { name, email, password: "password123" },
  });
  expect(response.statusCode).toBe(201);
  expect(response.json()).not.toHaveProperty("passwordHash");
  return cookieFrom(response.headers["set-cookie"]);
}

describe("api", () => {
  let app: FastifyInstance;

  beforeAll(async () => {
    app = await createApp(config, {
      readiness: { query: () => prisma.$queryRaw`SELECT 1` },
      prisma: prisma as PrismaClient,
    });
  });

  beforeEach(async () => {
    await prisma.$executeRawUnsafe(
      'TRUNCATE TABLE "Settlement", "ExpenseSplit", "Expense", "Member", "Group", "User" CASCADE',
    );
  });

  afterAll(async () => {
    await app.close();
    await prisma.$disconnect();
  });

  it("signs up, logs in, returns the current user, and logs out", async () => {
    const cookie = await signup(app, "Anu", "anu@example.com");
    const me = await app.inject({ method: "GET", url: "/api/auth/me", headers: { cookie } });
    expect(me.statusCode).toBe(200);
    expect(me.json()).toMatchObject({ email: "anu@example.com", name: "Anu" });

    const duplicate = await app.inject({
      method: "POST",
      url: "/api/auth/signup",
      payload: { name: "Anu", email: "anu@example.com", password: "password123" },
    });
    expect(duplicate.statusCode).toBe(409);

    const loggedOut = await app.inject({ method: "POST", url: "/api/auth/logout", headers: { cookie } });
    expect(loggedOut.statusCode).toBe(204);
    expect(String(loggedOut.headers["set-cookie"])).toContain("Max-Age=0");
    const after = await app.inject({ method: "GET", url: "/api/auth/me" });
    expect(after.statusCode).toBe(401);

    const login = await app.inject({
      method: "POST",
      url: "/api/auth/login",
      payload: { email: "anu@example.com", password: "password123" },
    });
    expect(login.statusCode).toBe(200);
    expect(String(login.headers["set-cookie"])).toContain("HttpOnly");
    expect(String(login.headers["set-cookie"])).toContain("SameSite=Lax");

    const wrong = await app.inject({
      method: "POST",
      url: "/api/auth/login",
      payload: { email: "anu@example.com", password: "not-the-password" },
    });
    expect(wrong.statusCode).toBe(401);
    expect(wrong.json()).toEqual({
      error: { code: "INVALID_CREDENTIALS", message: "Invalid email or password" },
    });
  });

  it("hides a group from someone who is not a member", async () => {
    const owner = await signup(app, "Anu", "anu@example.com");
    const stranger = await signup(app, "Ravi", "ravi@example.com");
    const created = await app.inject({
      method: "POST",
      url: "/api/groups",
      headers: { cookie: owner },
      payload: { name: "Trip", type: "trip" },
    });
    expect(created.statusCode).toBe(201);
    const groupId = created.json().id as string;

    for (const url of [`/api/groups/${groupId}`, `/api/groups/${groupId}/summary`, `/api/groups/${groupId}/expenses`]) {
      const response = await app.inject({ method: "GET", url, headers: { cookie: stranger } });
      expect(response.statusCode).toBe(404);
    }
    const write = await app.inject({
      method: "POST",
      url: `/api/groups/${groupId}/expenses`,
      headers: { cookie: stranger },
      payload: {
        description: "Dinner",
        amountMinor: 1000,
        date: "2026-01-01",
        category: "food",
        paidByMemberId: "missing",
        splitType: "equal",
        memberIds: ["missing"],
      },
    });
    expect(write.statusCode).toBe(404);
  });

  it("rejects an exact split that does not add up and keeps the saved shares exact", async () => {
    const cookie = await signup(app, "Anu", "anu@example.com");
    const created = await app.inject({
      method: "POST",
      url: "/api/groups",
      headers: { cookie },
      payload: { name: "Party", type: "party", currency: "INR" },
    });
    const group = created.json() as GroupBody;
    const memberId = group.members[0]?.id;
    expect(memberId).toBeTruthy();

    const invalid = await app.inject({
      method: "POST",
      url: `/api/groups/${group.id}/expenses`,
      headers: { cookie },
      payload: {
        description: "Snacks",
        amountMinor: 1500,
        date: "2026-01-02",
        category: "food",
        paidByMemberId: memberId,
        splitType: "exact",
        lines: [{ memberId, amountMinor: 1000 }],
      },
    });
    expect(invalid.statusCode).toBe(400);
    expect(invalid.json().error.code).toBe("VALIDATION");

    const valid = await app.inject({
      method: "POST",
      url: `/api/groups/${group.id}/expenses`,
      headers: { cookie },
      payload: {
        description: "Snacks",
        amountMinor: 100,
        date: "2026-01-02",
        category: "food",
        paidByMemberId: memberId,
        splitType: "equal",
        memberIds: [memberId],
      },
    });
    expect(valid.statusCode).toBe(201);
    const saved = valid.json() as { amountMinor: number; splits: { shareMinor: number }[]; createdBy: { name: string } };
    expect(saved.splits.reduce((sum, split) => sum + split.shareMinor, 0)).toBe(saved.amountMinor);
    expect(saved.createdBy.name).toBe("Anu");

    const list = await app.inject({
      method: "GET",
      url: `/api/groups/${group.id}/expenses`,
      headers: { cookie },
    });
    expect(list.json()).toHaveLength(1);
  });

  it("settles the A B C D example and records the payments", async () => {
    const cookies = {
      A: await signup(app, "A", "a@example.com"),
      B: await signup(app, "B", "b@example.com"),
      C: await signup(app, "C", "c@example.com"),
      D: await signup(app, "D", "d@example.com"),
    };
    const created = await app.inject({
      method: "POST",
      url: "/api/groups",
      headers: { cookie: cookies.A },
      payload: { name: "Acceptance", type: "trip", currency: "INR" },
    });
    const group = created.json() as GroupBody;
    for (const name of ["B", "C", "D"] as const) {
      const joined = await app.inject({
        method: "POST",
        url: "/api/groups/join",
        headers: { cookie: cookies[name] },
        payload: { inviteCode: group.inviteCode },
      });
      expect(joined.statusCode).toBe(200);
    }
    const loaded = await app.inject({
      method: "GET",
      url: `/api/groups/${group.id}`,
      headers: { cookie: cookies.A },
    });
    const members = Object.fromEntries((loaded.json() as GroupBody).members.map((member) => [member.displayName, member.id]));
    const payer = members.A;
    const all = [members.A, members.B, members.C, members.D];
    expect(all.every(Boolean)).toBe(true);

    const expenses = [
      {
        description: "A pays 4000",
        amountMinor: 4000,
        paidByMemberId: members.A,
        splitType: "equal",
        memberIds: all,
        date: "2026-02-01",
        category: "food",
      },
      {
        description: "B pays 1500",
        amountMinor: 1500,
        paidByMemberId: members.B,
        splitType: "equal",
        memberIds: [members.B, members.C],
        date: "2026-02-02",
        category: "transport",
      },
      {
        description: "C pays 600",
        amountMinor: 600,
        paidByMemberId: members.C,
        splitType: "equal",
        memberIds: [members.A, members.C, members.D],
        date: "2026-02-03",
        category: "activities",
      },
    ];
    for (const expense of expenses) {
      const response = await app.inject({
        method: "POST",
        url: `/api/groups/${group.id}/expenses`,
        headers: { cookie: cookies.A },
        payload: expense,
      });
      expect(response.statusCode).toBe(201);
    }

    const summaryResponse = await app.inject({
      method: "GET",
      url: `/api/groups/${group.id}/summary`,
      headers: { cookie: cookies.A },
    });
    expect(summaryResponse.statusCode).toBe(200);
    const summary = summaryResponse.json() as SummaryBody;
    expect(summary.totalMinor).toBe(6100);
    expect(summary.members.reduce((sum, member) => sum + member.netMinor, 0)).toBe(0);
    const nets = Object.fromEntries(summary.members.map((member) => [member.displayName, member.netMinor]));
    expect(nets).toEqual({ A: 2800, B: -250, C: -1350, D: -1200 });
    expect(summary.transfers).toEqual([
      { fromMemberId: members.C, toMemberId: members.A, amountMinor: 1350 },
      { fromMemberId: members.D, toMemberId: members.A, amountMinor: 1200 },
      { fromMemberId: members.B, toMemberId: members.A, amountMinor: 250 },
    ]);

    const strangerEdit = await app.inject({
      method: "PATCH",
      url: `/api/groups/${group.id}/expenses/not-real`,
      headers: { cookie: cookies.B },
      payload: expenses[0],
    });
    expect(strangerEdit.statusCode).toBe(404);

    for (const transfer of summary.transfers) {
      const paid = await app.inject({
        method: "POST",
        url: `/api/groups/${group.id}/settlements`,
        headers: { cookie: cookies.A },
        payload: { ...transfer, date: "2026-02-04" },
      });
      expect(paid.statusCode).toBe(201);
    }
    const settled = await app.inject({
      method: "GET",
      url: `/api/groups/${group.id}/summary`,
      headers: { cookie: cookies.B },
    });
    const settledBody = settled.json() as SummaryBody;
    expect(settledBody.settled).toBe(true);
    expect(settledBody.transfers).toEqual([]);
    expect(settledBody.members.every((member) => member.netMinor === 0)).toBe(true);

    const closed = await app.inject({
      method: "PATCH",
      url: `/api/groups/${group.id}`,
      headers: { cookie: cookies.A },
      payload: { status: "closed" },
    });
    expect(closed.statusCode).toBe(200);
    const blocked = await app.inject({
      method: "POST",
      url: `/api/groups/${group.id}/expenses`,
      headers: { cookie: cookies.A },
      payload: expenses[0],
    });
    expect(blocked.statusCode).toBe(409);
    expect(blocked.json().error.code).toBe("GROUP_CLOSED");
    const stillVisible = await app.inject({
      method: "GET",
      url: `/api/groups/${group.id}/summary`,
      headers: { cookie: cookies.D },
    });
    expect(stillVisible.statusCode).toBe(200);
    expect(payer).toBe(members.A);
  });

  it("lets a registered user claim a guest and blocks member removal after an expense", async () => {
    const owner = await signup(app, "Anu", "anu@example.com");
    const created = await app.inject({
      method: "POST",
      url: "/api/groups",
      headers: { cookie: owner },
      payload: { name: "Dinner", type: "party" },
    });
    const group = created.json() as GroupBody;
    const withGuest = await app.inject({
      method: "POST",
      url: `/api/groups/${group.id}/members`,
      headers: { cookie: owner },
      payload: { displayName: "Priya" },
    });
    expect(withGuest.statusCode).toBe(201);
    const guest = (withGuest.json() as GroupBody).members.find((member) => member.displayName === "Priya");
    expect(guest?.userId).toBeNull();

    const priya = await signup(app, "Priya Account", "priya@example.com");
    const claimed = await app.inject({
      method: "POST",
      url: "/api/groups/join",
      headers: { cookie: priya },
      payload: { inviteCode: group.inviteCode, claimMemberId: guest?.id },
    });
    expect(claimed.statusCode).toBe(200);
    const claimedMember = (claimed.json() as GroupBody).members.find((member) => member.id === guest?.id);
    expect(claimedMember?.userId).toBeTruthy();
    expect(claimedMember?.displayName).toBe("Priya");

    const ownerMember = group.members[0];
    const expense = await app.inject({
      method: "POST",
      url: `/api/groups/${group.id}/expenses`,
      headers: { cookie: owner },
      payload: {
        description: "Tea",
        amountMinor: 200,
        date: "2026-03-01",
        category: "drinks",
        paidByMemberId: ownerMember?.id,
        splitType: "equal",
        memberIds: [ownerMember?.id, guest?.id],
      },
    });
    expect(expense.statusCode).toBe(201);
    const expenseId = expense.json().id as string;

    const remove = await app.inject({
      method: "DELETE",
      url: `/api/groups/${group.id}/members/${guest?.id}`,
      headers: { cookie: owner },
    });
    expect(remove.statusCode).toBe(409);

    const removedExpense = await app.inject({
      method: "DELETE",
      url: `/api/groups/${group.id}/expenses/${expenseId}`,
      headers: { cookie: owner },
    });
    expect(removedExpense.statusCode).toBe(204);
    const removedMember = await app.inject({
      method: "DELETE",
      url: `/api/groups/${group.id}/members/${guest?.id}`,
      headers: { cookie: owner },
    });
    expect(removedMember.statusCode).toBe(204);
  });

  it("rate limits repeated signup attempts", async () => {
    const limited = await createApp(
      loadConfig({
        NODE_ENV: "test",
        HOST: "127.0.0.1",
        PORT: "3000",
        DATABASE_URL: config.DATABASE_URL,
        FRONTEND_ORIGIN: "http://localhost:5173",
        JWT_SECRET: "test-secret-value",
        LOG_LEVEL: "silent",
        AUTH_RATE_LIMIT_MAX: "1",
        AUTH_RATE_LIMIT_WINDOW_MS: "60000",
      }),
      {
        readiness: { query: async () => 1 },
        prisma: prisma as PrismaClient,
      },
    );
    const first = await limited.inject({
      method: "POST",
      url: "/api/auth/signup",
      payload: { name: "One", email: "one@example.com", password: "password123" },
    });
    const second = await limited.inject({
      method: "POST",
      url: "/api/auth/signup",
      payload: { name: "Two", email: "two@example.com", password: "password123" },
    });
    expect(first.statusCode).toBe(201);
    expect(second.statusCode).toBe(429);
    expect(second.json().error.code).toBe("RATE_LIMITED");
    await limited.close();
  });
});
