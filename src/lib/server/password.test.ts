import { describe, expect, it } from "vitest";

import { hashPassword, verifyPassword } from "./password";

describe("password hashing", () => {
  it("verifies the right password and rejects a wrong one", async () => {
    const hash = await hashPassword("password123");

    expect(hash).not.toBe("password123");
    expect(await verifyPassword("password123", hash)).toBe(true);
    expect(await verifyPassword("password124", hash)).toBe(false);
  });

  it("produces a different hash for the same password", async () => {
    // bcrypt salts every hash, so two identical passwords are not linkable in the database.
    const [first, second] = await Promise.all([
      hashPassword("password123"),
      hashPassword("password123"),
    ]);

    expect(first).not.toBe(second);
  });
});
