import cors from "@fastify/cors";
import Fastify, { type FastifyError, type FastifyInstance } from "fastify";
import type { AppConfig } from "./config.js";

export type ReadinessCheck = {
  query: () => Promise<unknown>;
};

export async function createApp(
  config: AppConfig,
  readiness: ReadinessCheck,
): Promise<FastifyInstance> {
  const app = Fastify({
    logger: {
      level: config.LOG_LEVEL,
    },
  });

  await app.register(cors, {
    origin: config.FRONTEND_ORIGIN,
    credentials: true,
  });

  app.get("/health", async () => ({ status: "ok" }));

  app.get("/ready", async (_request, reply) => {
    try {
      await readiness.query();
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
