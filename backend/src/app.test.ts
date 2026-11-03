import type { PrismaClient } from "@prisma/client";
import { afterEach, describe, expect, it } from "vitest";
import type { FastifyInstance } from "fastify";
import { createApp } from "./app.js";
import { loadConfig } from "./config.js";

const config = loadConfig({
  NODE_ENV: "test",
  HOST: "127.0.0.1",
  PORT: "3000",
  DATABASE_URL: "postgresql://splitpot:splitpot@db:5432/splitpot_test",
  FRONTEND_ORIGIN: "http://localhost:5173",
  JWT_SECRET: "test-secret-value",
  LOG_LEVEL: "silent",
});

const prisma = {} as PrismaClient;

describe("health endpoints", () => {
  let app: FastifyInstance | undefined;

  afterEach(async () => {
    await app?.close();
  });

  it("GET /health returns ok without touching the database", async () => {
    app = await createApp(config, {
      readiness: { query: () => Promise.reject(new Error("database should not be called")) },
      prisma,
    });
    const response = await app.inject({ method: "GET", url: "/health" });
    expect(response.statusCode).toBe(200);
    expect(response.json()).toEqual({ status: "ok" });
  });

  it("GET /ready returns ok when the database answers", async () => {
    app = await createApp(config, { readiness: { query: async () => 1 }, prisma });
    const response = await app.inject({ method: "GET", url: "/ready" });
    expect(response.statusCode).toBe(200);
    expect(response.json()).toEqual({ status: "ok" });
  });

  it("GET /ready returns 503 when the database check fails", async () => {
    app = await createApp(config, {
      readiness: { query: () => Promise.reject(new Error("connection refused")) },
      prisma,
    });
    const response = await app.inject({ method: "GET", url: "/ready" });
    expect(response.statusCode).toBe(503);
    expect(response.json()).toEqual({ status: "unavailable" });
  });

  it("unknown routes use the shared error shape", async () => {
    app = await createApp(config, { readiness: { query: async () => 1 }, prisma });
    const response = await app.inject({ method: "GET", url: "/missing" });
    expect(response.statusCode).toBe(404);
    expect(response.json()).toEqual({
      error: { code: "NOT_FOUND", message: "Route not found" },
    });
  });
});
