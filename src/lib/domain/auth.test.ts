import { describe, expect, it } from "vitest";

import { loginSchema, normalizeEmail, registerSchema } from "./auth";

describe("normalizeEmail", () => {
  it("trims and lowercases, so case and spacing cannot create a second account", () => {
    expect(normalizeEmail(" Ivan@X.com ")).toBe("ivan@x.com");
    expect(normalizeEmail("IVAN@X.COM")).toBe(normalizeEmail("ivan@x.com"));
  });
});

describe("registerSchema", () => {
  const valid = { name: "Іван", email: "ivan@x.com", password: "password123" };

  it("normalizes the email while parsing", () => {
    const parsed = registerSchema.parse({ ...valid, email: " Ivan@X.com " });

    expect(parsed.email).toBe("ivan@x.com");
  });

  it("trims the name and rejects a blank one", () => {
    expect(registerSchema.parse({ ...valid, name: "  Іван  " }).name).toBe("Іван");
    expect(registerSchema.safeParse({ ...valid, name: "   " }).success).toBe(false);
    expect(
      registerSchema.safeParse({ ...valid, name: "я".repeat(101) }).success,
    ).toBe(false);
    expect(registerSchema.safeParse({ ...valid, name: "я".repeat(100) }).success).toBe(
      true,
    );
  });

  it("accepts passwords of 8..72 characters and rejects the neighbours", () => {
    const withPassword = (length: number) =>
      registerSchema.safeParse({ ...valid, password: "a".repeat(length) }).success;

    expect(withPassword(7)).toBe(false);
    expect(withPassword(8)).toBe(true);
    expect(withPassword(72)).toBe(true);
    expect(withPassword(73)).toBe(false);
  });

  it("rejects a malformed email", () => {
    expect(registerSchema.safeParse({ ...valid, email: "ivan" }).success).toBe(false);
  });

  it("reports the offending field so the form can place the message", () => {
    const result = registerSchema.safeParse({ ...valid, password: "short" });

    expect(result.success).toBe(false);
    expect(result.error?.issues[0].path).toEqual(["password"]);
  });
});

describe("loginSchema", () => {
  it("normalizes the email and only requires a non-empty password", () => {
    const parsed = loginSchema.parse({ email: " Ivan@X.com ", password: "x" });

    expect(parsed.email).toBe("ivan@x.com");
  });

  it("rejects an empty password", () => {
    expect(loginSchema.safeParse({ email: "ivan@x.com", password: "" }).success).toBe(
      false,
    );
  });
});
