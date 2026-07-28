import { DateTime } from "luxon";
import { beforeEach, describe, expect, it } from "vitest";

import { OFFICE_TZ } from "@/lib/domain/constants";
import { BASE_URL, api, registerUnverifiedUser } from "../helpers/api";
import { createRoom, resetDatabase, testPrisma } from "../helpers/db";

type ErrorBody = { error: { code: string } };

let roomId: string;

beforeEach(async () => {
  await resetDatabase();
  roomId = (await createRoom("Акваріум")).id;
});

/** A valid free slot, so only the verification rule can refuse the booking. */
function slot() {
  const start = DateTime.now()
    .setZone(OFFICE_TZ)
    .plus({ days: 40 })
    .startOf("day")
    .set({ hour: 10 });

  return {
    startsAt: start.toUTC().toISO() ?? "",
    endsAt: start.plus({ hours: 1 }).toUTC().toISO() ?? "",
  };
}

const book = (cookie: string) =>
  api<ErrorBody & { id: string }>("/api/bookings", {
    method: "POST",
    cookie,
    body: { roomId, title: "Зустріч", ...slot() },
  });

/** Follows the confirmation link the way a person would, without redirects. */
const openVerificationLink = (token: string) =>
  fetch(`${BASE_URL}/api/auth/verify?token=${token}`, { redirect: "manual" });

describe("email verification", () => {
  it("registers an unconfirmed user and issues one token", async () => {
    const user = await registerUnverifiedUser("fresh@example.com");

    const stored = await testPrisma.user.findUniqueOrThrow({ where: { id: user.id } });
    expect(stored.emailVerifiedAt).toBeNull();
    expect(await testPrisma.verificationToken.count({ where: { userId: user.id } })).toBe(1);
  });

  it("refuses booking until the address is confirmed, then allows it", async () => {
    const user = await registerUnverifiedUser("fresh@example.com");

    const refused = await book(user.cookie);
    expect(refused.status).toBe(403);
    expect(refused.body.error.code).toBe("EMAIL_NOT_VERIFIED");

    const { token } = await testPrisma.verificationToken.findFirstOrThrow({
      where: { userId: user.id },
    });
    const visit = await openVerificationLink(token);
    expect(visit.status).toBe(307);
    expect(visit.headers.get("location")).toContain("verified=1");

    const allowed = await book(user.cookie);
    expect(allowed.status).toBe(201);
  });

  it("spends the token: a second visit does not confirm anything", async () => {
    const user = await registerUnverifiedUser("fresh@example.com");
    const { token } = await testPrisma.verificationToken.findFirstOrThrow({
      where: { userId: user.id },
    });

    await openVerificationLink(token);
    await testPrisma.user.update({
      where: { id: user.id },
      data: { emailVerifiedAt: null },
    });

    const replay = await openVerificationLink(token);
    expect(replay.headers.get("location")).toContain("verified=0");

    const stored = await testPrisma.user.findUniqueOrThrow({ where: { id: user.id } });
    expect(stored.emailVerifiedAt).toBeNull();
  });

  it("refuses an expired token", async () => {
    const user = await registerUnverifiedUser("fresh@example.com");
    const { token } = await testPrisma.verificationToken.findFirstOrThrow({
      where: { userId: user.id },
    });
    await testPrisma.verificationToken.update({
      where: { token },
      data: { expiresAt: new Date(Date.now() - 1000) },
    });

    const visit = await openVerificationLink(token);

    expect(visit.headers.get("location")).toContain("verified=0");
    expect(
      (await testPrisma.user.findUniqueOrThrow({ where: { id: user.id } }))
        .emailVerifiedAt,
    ).toBeNull();
  });

  it("refuses a token that was never issued", async () => {
    const visit = await openVerificationLink("made-up-token");

    expect(visit.headers.get("location")).toContain("verified=0");
  });

  it("replaces the old token when a new link is requested", async () => {
    const user = await registerUnverifiedUser("fresh@example.com");
    const first = await testPrisma.verificationToken.findFirstOrThrow({
      where: { userId: user.id },
    });

    const resent = await api("/api/auth/verification", {
      method: "POST",
      cookie: user.cookie,
    });
    expect(resent.status).toBe(204);

    const tokens = await testPrisma.verificationToken.findMany({
      where: { userId: user.id },
    });
    expect(tokens).toHaveLength(1);
    expect(tokens[0].token).not.toBe(first.token);

    // The superseded link must stop working.
    const oldLink = await openVerificationLink(first.token);
    expect(oldLink.headers.get("location")).toContain("verified=0");
  });

  it("lets an unconfirmed user cancel a booking they already have", async () => {
    const user = await registerUnverifiedUser("fresh@example.com");
    const booking = await testPrisma.booking.create({
      data: {
        roomId,
        userId: user.id,
        title: "Стара зустріч",
        startsAt: new Date(Date.now() + 60 * 60 * 1000),
        endsAt: new Date(Date.now() + 2 * 60 * 60 * 1000),
      },
    });

    // Cancelling only frees a slot, so the rule does not trap anyone.
    const canceled = await api(`/api/bookings/${booking.id}`, {
      method: "DELETE",
      cookie: user.cookie,
    });

    expect(canceled.status).toBe(204);
  });
});
