import { beforeAll, describe, expect, it } from "vitest";

let security: typeof import("./security.js");

beforeAll(async () => {
  process.env.DATABASE_URL = "postgres://unused";
  process.env.AUTH_PEPPER = "test-pepper-that-is-at-least-thirty-two-bytes";
  security = await import("./security.js");
});

describe("authentication security helpers", () => {
  it("normalizes lookup emails without changing internal characters", () => {
    expect(security.normalizeEmail("  Demo.User@Example.COM ")).toBe(
      "demo.user@example.com",
    );
  });

  it("creates stable, separated authentication verifiers", () => {
    const first = security.authVerifier("first-login-secret");
    const repeat = security.authVerifier("first-login-secret");
    const second = security.authVerifier("second-login-secret");
    expect(security.secureEqual(first, repeat)).toBe(true);
    expect(security.secureEqual(first, second)).toBe(false);
    expect(first).toHaveLength(32);
  });

  it("hashes session tokens before persistence", () => {
    expect(security.tokenHash("session-token")).toHaveLength(32);
    expect(security.tokenHash("session-token").toString("hex")).not.toContain(
      "session-token",
    );
  });
});
