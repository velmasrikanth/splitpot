import { describe, expect, it } from "vitest";
import { signSession, verifySession } from "./jwt.js";

describe("session jwt", () => {
  const secret = "test-secret-value";

  it("round-trips a user id", () => {
    const token = signSession("user-1", secret, 60, 1_000);
    expect(verifySession(token, secret, 1_030)).toEqual({ sub: "user-1", exp: 1_060 });
  });

  it("rejects a tampered token and an expired token", () => {
    const token = signSession("user-1", secret, 60, 1_000);
    const [header, payload, signature] = token.split(".");
    expect(verifySession(`${header}.${payload}.${signature}x`, secret, 1_000)).toBeNull();
    expect(verifySession(token, secret, 1_060)).toBeNull();
  });
});
