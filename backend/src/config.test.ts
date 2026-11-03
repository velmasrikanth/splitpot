import { describe, expect, it } from "vitest";
import { loadConfig } from "./config.js";

const validEnv = {
  NODE_ENV: "test",
  HOST: "0.0.0.0",
  PORT: "3000",
  DATABASE_URL: "postgresql://splitpot:splitpot@db:5432/splitpot_test",
  FRONTEND_ORIGIN: "http://localhost:5173",
  LOG_LEVEL: "silent",
};

describe("loadConfig", () => {
  it("parses a valid environment", () => {
    const config = loadConfig(validEnv);
    expect(config.NODE_ENV).toBe("test");
    expect(config.PORT).toBe(3000);
    expect(config.FRONTEND_ORIGIN).toBe("http://localhost:5173");
  });

  it("rejects a missing database url", () => {
    const env = { ...validEnv };
    delete env.DATABASE_URL;
    expect(() => loadConfig(env)).toThrow(/DATABASE_URL/);
  });

  it("rejects an origin that is not a url", () => {
    expect(() => loadConfig({ ...validEnv, FRONTEND_ORIGIN: "localhost" })).toThrow(
      /FRONTEND_ORIGIN/,
    );
  });
});
