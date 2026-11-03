import cors from "@fastify/cors";
import type { PrismaClient } from "@prisma/client";
import Fastify, { type FastifyError, type FastifyInstance } from "fastify";
import type { AppConfig } from "./config.js";
import { AppError } from "./http/errors.js";
import { createRateLimiter } from "./http/rateLimit.js";
import { registerAuthRoutes } from "./routes/auth.js";
import { registerGroupRoutes } from "./routes/groups.js";
import { createAuthService } from "./services/auth.js";
import { createExpenseService } from "./services/expenses.js";
import { createGroupService } from "./services/groups.js";
import { createSettlementService } from "./services/settlements.js";
import { createExpenseRepository } from "./repositories/expenses.js";
import { createGroupRepository } from "./repositories/groups.js";
import { createSettlementRepository } from "./repositories/settlements.js";
import { createUserRepository } from "./repositories/users.js";

export type ReadinessCheck = {
  query: () => Promise<unknown>;
};

export async function createApp(
  config: AppConfig,
  options: { readiness: ReadinessCheck; prisma: PrismaClient },
): Promise<FastifyInstance> {
  const app = Fastify({
    logger: {
      level: config.LOG_LEVEL,
      redact: ["req.headers.cookie", "req.headers.authorization"],
    },
  });

  await app.register(cors, {
    origin: config.FRONTEND_ORIGIN,
    credentials: true,
  });

  const users = createUserRepository(options.prisma);
  const groupRepository = createGroupRepository(options.prisma);
  const expenseRepository = createExpenseRepository(options.prisma);
  const settlementRepository = createSettlementRepository(options.prisma);
  const auth = createAuthService(users);
  const groups = createGroupService(groupRepository, expenseRepository, settlementRepository);
  const expenses = createExpenseService(groupRepository, expenseRepository);
  const settlements = createSettlementService(groupRepository, settlementRepository);
  const allow = createRateLimiter(config.AUTH_RATE_LIMIT_MAX, config.AUTH_RATE_LIMIT_WINDOW_MS);

  registerAuthRoutes(app, config, auth, allow);
  registerGroupRoutes(app, config, auth, groups, expenses, settlements);

  app.get("/health", async () => ({ status: "ok" }));

  app.get("/ready", async (_request, reply) => {
    try {
      await options.readiness.query();
      return { status: "ok" };
    } catch (err) {
      app.log.error({ err }, "readiness check failed");
      return reply.code(503).send({ status: "unavailable" });
    }
  });

  app.setNotFoundHandler((_request, reply) => {
    void reply.code(404).send({
      error: { code: "NOT_FOUND", message: "Route not found" },
    });
  });

  app.setErrorHandler((error: FastifyError, request, reply) => {
    if (error instanceof AppError) {
      void reply.code(error.statusCode).send({
        error: { code: error.code, message: error.message },
      });
      return;
    }
    request.log.error({ err: error }, "request failed");
    const statusCode = error.statusCode ?? 500;
    const publicError =
      statusCode >= 500
        ? { code: "INTERNAL", message: "Something went wrong" }
        : { code: "REQUEST_FAILED", message: error.message };
    void reply.code(statusCode).send({ error: publicError });
  });

  return app;
}
