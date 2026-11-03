import type { FastifyInstance } from "fastify";
import type { AppConfig } from "../config.js";
import {
  createGroupSchema,
  expenseParamsSchema,
  expenseSchema,
  guestMemberSchema,
  idParamsSchema,
  joinGroupSchema,
  memberParamsSchema,
  settlementParamsSchema,
  settlementSchema,
  updateGroupSchema,
} from "../http/schemas.js";
import { parseInput, parseIsoDate } from "../http/validation.js";
import { requireUser } from "./auth.js";
import type { AuthService } from "../services/auth.js";
import type { ExpenseService } from "../services/expenses.js";
import type { ExpenseInput } from "../services/expenses.js";
import type { GroupService } from "../services/groups.js";
import type { SettlementService } from "../services/settlements.js";

function toExpenseInput(body: ReturnType<typeof expenseSchema.parse>): ExpenseInput {
  const date = parseIsoDate(body.date);
  const common = {
    description: body.description,
    amountMinor: body.amountMinor,
    category: body.category,
    date,
    paidByMemberId: body.paidByMemberId,
  };
  if (body.splitType === "equal") {
    return { ...common, split: { type: "equal", memberIds: body.memberIds } };
  }
  if (body.splitType === "exact") {
    return { ...common, split: { type: "exact", lines: body.lines } };
  }
  if (body.splitType === "percentage") {
    return { ...common, split: { type: "percentage", lines: body.lines } };
  }
  return { ...common, split: { type: "shares", lines: body.lines } };
}

export function registerGroupRoutes(
  app: FastifyInstance,
  config: AppConfig,
  auth: AuthService,
  groups: GroupService,
  expenses: ExpenseService,
  settlements: SettlementService,
): void {
  app.get("/api/groups", async (request) => {
    const user = await requireUser(config, auth, request.headers.cookie);
    return groups.list(user);
  });

  app.post("/api/groups", async (request, reply) => {
    const user = await requireUser(config, auth, request.headers.cookie);
    const body = parseInput(createGroupSchema, request.body);
    const group = await groups.create(user, {
      name: body.name,
      type: body.type,
      currency: body.currency ?? "INR",
      startDate: body.startDate ? parseIsoDate(body.startDate) : null,
      endDate: body.endDate ? parseIsoDate(body.endDate) : null,
    });
    return reply.code(201).send(group);
  });

  app.post("/api/groups/join", async (request) => {
    const user = await requireUser(config, auth, request.headers.cookie);
    const body = parseInput(joinGroupSchema, request.body);
    return groups.join(user, body.inviteCode, body.claimMemberId);
  });

  app.get("/api/groups/:id", async (request) => {
    const user = await requireUser(config, auth, request.headers.cookie);
    const params = parseInput(idParamsSchema, request.params);
    return groups.get(user, params.id);
  });

  app.patch("/api/groups/:id", async (request) => {
    const user = await requireUser(config, auth, request.headers.cookie);
    const params = parseInput(idParamsSchema, request.params);
    const body = parseInput(updateGroupSchema, request.body);
    return groups.update(user, params.id, {
      ...body,
      startDate: body.startDate === undefined ? undefined : body.startDate ? parseIsoDate(body.startDate) : null,
      endDate: body.endDate === undefined ? undefined : body.endDate ? parseIsoDate(body.endDate) : null,
    });
  });

  app.post("/api/groups/:id/members", async (request, reply) => {
    const user = await requireUser(config, auth, request.headers.cookie);
    const params = parseInput(idParamsSchema, request.params);
    const body = parseInput(guestMemberSchema, request.body);
    const group = await groups.addGuest(user, params.id, body.displayName);
    return reply.code(201).send(group);
  });

  app.delete("/api/groups/:id/members/:memberId", async (request, reply) => {
    const user = await requireUser(config, auth, request.headers.cookie);
    const params = parseInput(memberParamsSchema, request.params);
    await groups.removeMember(user, params.id, params.memberId);
    return reply.code(204).send();
  });

  app.get("/api/groups/:id/expenses", async (request) => {
    const user = await requireUser(config, auth, request.headers.cookie);
    const params = parseInput(idParamsSchema, request.params);
    return expenses.list(user, params.id);
  });

  app.post("/api/groups/:id/expenses", async (request, reply) => {
    const user = await requireUser(config, auth, request.headers.cookie);
    const params = parseInput(idParamsSchema, request.params);
    const body = parseInput(expenseSchema, request.body);
    const expense = await expenses.create(user, params.id, toExpenseInput(body));
    return reply.code(201).send(expense);
  });

  app.patch("/api/groups/:id/expenses/:expenseId", async (request) => {
    const user = await requireUser(config, auth, request.headers.cookie);
    const params = parseInput(expenseParamsSchema, request.params);
    const body = parseInput(expenseSchema, request.body);
    return expenses.update(user, params.id, params.expenseId, toExpenseInput(body));
  });

  app.delete("/api/groups/:id/expenses/:expenseId", async (request, reply) => {
    const user = await requireUser(config, auth, request.headers.cookie);
    const params = parseInput(expenseParamsSchema, request.params);
    await expenses.remove(user, params.id, params.expenseId);
    return reply.code(204).send();
  });

  app.get("/api/groups/:id/summary", async (request) => {
    const user = await requireUser(config, auth, request.headers.cookie);
    const params = parseInput(idParamsSchema, request.params);
    return groups.summary(user, params.id);
  });

  app.get("/api/groups/:id/settlements", async (request) => {
    const user = await requireUser(config, auth, request.headers.cookie);
    const params = parseInput(idParamsSchema, request.params);
    return settlements.list(user, params.id);
  });

  app.post("/api/groups/:id/settlements", async (request, reply) => {
    const user = await requireUser(config, auth, request.headers.cookie);
    const params = parseInput(idParamsSchema, request.params);
    const body = parseInput(settlementSchema, request.body);
    const settlement = await settlements.create(user, params.id, {
      fromMemberId: body.fromMemberId,
      toMemberId: body.toMemberId,
      amountMinor: body.amountMinor,
      date: parseIsoDate(body.date),
    });
    return reply.code(201).send(settlement);
  });

  app.delete("/api/groups/:id/settlements/:settlementId", async (request, reply) => {
    const user = await requireUser(config, auth, request.headers.cookie);
    const params = parseInput(settlementParamsSchema, request.params);
    await settlements.remove(user, params.id, params.settlementId);
    return reply.code(204).send();
  });
}
