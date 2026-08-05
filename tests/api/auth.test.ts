import { beforeEach, describe, expect, it } from "vitest";

import { api } from "../helpers/api";
import { resetDatabase, testPrisma } from "../helpers/db";

beforeEach(async () => {
  await resetDatabase();
});

describe("register", () => {
  it("creates the account and signs the user in straight away", async () => {
    const response = await api<{ id: string; name: string; email: string }>(
      "/api/auth/register",
      {
        method: "POST",
        body: {
          name: "Аліса",
          email: "alice@example.com",
          password: "password123",
        },
      },
    );

    expect(response.status).toBe(201);
    expect(response.body.email).toBe("alice@example.com");
    expect(response.cookie).toBeDefined();

    const me = await api<{ email: string }>("/api/auth/me", {
      cookie: response.cookie,
    });
    expect(me.status).toBe(200);
    expect(me.body.email).toBe("alice@example.com");
  });

  it("stores the email normalized and refuses a second account for it", async () => {
    await api("/api/auth/register", {
      method: "POST",
      body: {
        name: "Аліса",
        email: "  Alice@Example.COM  ",
        password: "password123",
      },
    });

    const stored = await testPrisma.user.findMany({ select: { email: true } });
    expect(stored).toEqual([{ email: "alice@example.com" }]);

    const duplicate = await api<{ error: { code: string; field?: string } }>(
      "/api/auth/register",
      {
        method: "POST",
        body: {
          name: "Інша",
          email: "ALICE@example.com",
          password: "password123",
        },
      },
    );

    expect(duplicate.status).toBe(400);
    expect(duplicate.body.error.code).toBe("EMAIL_TAKEN");
    expect(duplicate.body.error.field).toBe("email");
  });

  it("refuses a password shorter than eight characters, pointing at the field", async () => {
    const response = await api<{ error: { code: string; field?: string } }>(
      "/api/auth/register",
      {
        method: "POST",
        body: { name: "Аліса", email: "alice@example.com", password: "short" },
      },
    );

    expect(response.status).toBe(400);
    expect(response.body.error.code).toBe("VALIDATION_ERROR");
    expect(response.body.error.field).toBe("password");
  });

  it("refuses a blank name and a malformed email", async () => {
    const blankName = await api("/api/auth/register", {
      method: "POST",
      body: {
        name: "   ",
        email: "alice@example.com",
        password: "password123",
      },
    });
    const badEmail = await api("/api/auth/register", {
      method: "POST",
      body: { name: "Аліса", email: "alice", password: "password123" },
    });

    expect(blankName.status).toBe(400);
    expect(badEmail.status).toBe(400);
    expect(await testPrisma.user.count()).toBe(0);
  });
});

describe("login", () => {
  beforeEach(async () => {
    await api("/api/auth/register", {
      method: "POST",
      body: {
        name: "Аліса",
        email: "alice@example.com",
        password: "password123",
      },
    });
  });

  it("accepts the email in any casing", async () => {
    const response = await api("/api/auth/login", {
      method: "POST",
      body: { email: "  ALICE@example.com ", password: "password123" },
    });

    expect(response.status).toBe(200);
    expect(response.cookie).toBeDefined();
  });

  it("answers the same way for a wrong password and an unknown email", async () => {
    const wrongPassword = await api<{
      error: { code: string; message: string };
    }>("/api/auth/login", {
      method: "POST",
      body: { email: "alice@example.com", password: "wrong-one" },
    });
    const unknownEmail = await api<{
      error: { code: string; message: string };
    }>("/api/auth/login", {
      method: "POST",
      body: { email: "nobody@example.com", password: "password123" },
    });

    expect(wrongPassword.status).toBe(401);
    expect(unknownEmail.status).toBe(401);
    // Telling them apart would reveal which addresses are registered.
    expect(wrongPassword.body.error).toEqual(unknownEmail.body.error);
  });

  it("throttles guessing without locking the owner out of their own account", async () => {
    // One more than the limit, so the counter is certainly over it.
    for (let attempt = 0; attempt < 11; attempt += 1) {
      await api("/api/auth/login", {
        method: "POST",
        body: { email: "alice@example.com", password: `wrong-${attempt}` },
      });
    }

    const guess = await api<{ error: { code: string } }>("/api/auth/login", {
      method: "POST",
      body: { email: "alice@example.com", password: "another-guess" },
    });
    expect(guess.status).toBe(429);
    expect(guess.body.error.code).toBe("TOO_MANY_ATTEMPTS");

    // The whole point: anyone can spend someone else's counter, so spending it
    // must not be a way to keep them out.
    const owner = await api("/api/auth/login", {
      method: "POST",
      body: { email: "alice@example.com", password: "password123" },
    });
    expect(owner.status).toBe(200);
    expect(owner.cookie).toBeDefined();
  });
});

describe("session", () => {
  it("survives as long as the row exists and dies with logout", async () => {
    const registered = await api("/api/auth/register", {
      method: "POST",
      body: {
        name: "Аліса",
        email: "alice@example.com",
        password: "password123",
      },
    });
    const cookie = registered.cookie;

    expect(await testPrisma.session.count()).toBe(1);
    expect((await api("/api/auth/me", { cookie })).status).toBe(200);

    const loggedOut = await api("/api/auth/logout", { method: "POST", cookie });
    expect(loggedOut.status).toBe(204);
    expect(await testPrisma.session.count()).toBe(0);

    // Replaying the old cookie must not work either.
    expect((await api("/api/auth/me", { cookie })).status).toBe(401);
  });

  it("rejects a tampered cookie", async () => {
    const registered = await api("/api/auth/register", {
      method: "POST",
      body: {
        name: "Аліса",
        email: "alice@example.com",
        password: "password123",
      },
    });

    const tampered = `${registered.cookie}x`;
    expect((await api("/api/auth/me", { cookie: tampered })).status).toBe(401);
  });

  it("refuses an expired session", async () => {
    const registered = await api("/api/auth/register", {
      method: "POST",
      body: {
        name: "Аліса",
        email: "alice@example.com",
        password: "password123",
      },
    });

    await testPrisma.session.updateMany({
      data: { expiresAt: new Date(Date.now() - 1000) },
    });

    expect(
      (await api("/api/auth/me", { cookie: registered.cookie })).status,
    ).toBe(401);
  });
});

describe("guests", () => {
  it("are turned away from every endpoint that is not auth", async () => {
    const room = await testPrisma.room.create({
      data: { name: "Гостьова", floor: 1, capacity: 4 },
    });

    const calls = [
      api("/api/auth/me"),
      api("/api/rooms"),
      api("/api/my-bookings"),
      api(`/api/rooms/${room.id}/bookings?weekStart=2026-08-24T00:00:00.000Z`),
      api("/api/bookings", { method: "POST", body: {} }),
      api("/api/bookings/whatever", { method: "PATCH", body: {} }),
      api("/api/bookings/whatever", { method: "DELETE" }),
    ];

    for (const response of await Promise.all(calls)) {
      expect(response.status).toBe(401);
    }
  });
});
