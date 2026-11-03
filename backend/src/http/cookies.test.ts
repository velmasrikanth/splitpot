import { describe, expect, it } from "vitest";
import { cookieIsSecure } from "./cookies.js";

describe("cookieIsSecure", () => {
  it("stays unset outside production", () => {
    expect(cookieIsSecure("dev", "https")).toBe(false);
    expect(cookieIsSecure("test", undefined)).toBe(false);
  });

  it("follows the proxy protocol in production", () => {
    expect(cookieIsSecure("prod", "http")).toBe(false);
    expect(cookieIsSecure("prod", "https")).toBe(true);
    expect(cookieIsSecure("prod", "https,http")).toBe(true);
    expect(cookieIsSecure("prod", undefined)).toBe(true);
  });
});
