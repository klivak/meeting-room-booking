import { DateTime } from "luxon";
import { beforeEach, describe, expect, it } from "vitest";

import { OFFICE_TZ } from "@/lib/domain/constants";
import { BASE_URL, api, registerUnverifiedUser } from "../helpers/api";
import { createRoom, resetDatabase, testPrisma } from "../helpers/db";
import { lastVerificationLink } from "../helpers/serverLog";

type ErrorBody = { error: { code: string } };

let roomId: string;

beforeEach(async () => {
  await resetDatabase();
  roomId = (await createRoom("Хортиця")).id;
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

/** Follows a confirmation link the way a person would, without redirects. */
const open = (link: string) => fetch(link, { redirect: "manual" });

/**
 * The link the server has just printed.
 *
 * The table holds only a hash of the token, so this is the one place a test can
 * learn the token itself — exactly as a test against a real mailer would read
 * the message rather than the database.
 */
const openLatestLink = () => open(lastVerificationLink());

describe("email verification", () => {
  it("registers an unconfirmed user and issues one token", async () => {
    const user = await registerUnverifiedUser("fresh@example.com");

    const stored = await testPrisma.user.findUniqueOrThrow({
      where: { id: user.id },
    });
    expect(stored.emailVerifiedAt).toBeNull();

    const tokens = await testPrisma.verificationToken.findMany({
      where: { userId: user.id },
    });
    expect(tokens).toHaveLength(1);

    // The token in the link is the whole credential, so the table must hold
    // only a hash of it: a database dump must not confirm anyone's address.
    const sent = new URL(lastVerificationLink()).searchParams.get("token");
    expect(sent).toBeTruthy();
    expect(tokens[0].token).not.toBe(sent);
  });

  it("refuses booking until the address is confirmed, then allows it", async () => {
    const user = await registerUnverifiedUser("fresh@example.com");

    const refused = await book(user.cookie);
    expect(refused.status).toBe(403);
    expect(refused.body.error.code).toBe("EMAIL_NOT_VERIFIED");

    const visit = await openLatestLink();
    expect(visit.status).toBe(307);
    expect(visit.headers.get("location")).toContain("verified=1");

    const allowed = await book(user.cookie);
    expect(allowed.status).toBe(201);
  });

  it("spends the token: a second visit does not confirm anything", async () => {
    const user = await registerUnverifiedUser("fresh@example.com");
    const link = lastVerificationLink();

    await open(link);
    await testPrisma.user.update({
      where: { id: user.id },
      data: { emailVerifiedAt: null },
    });

    const replay = await open(link);
    expect(replay.headers.get("location")).toContain("verified=0");

    const stored = await testPrisma.user.findUniqueOrThrow({
      where: { id: user.id },
    });
    expect(stored.emailVerifiedAt).toBeNull();
  });

  it("refuses an expired token", async () => {
    const user = await registerUnverifiedUser("fresh@example.com");
    await testPrisma.verificationToken.updateMany({
      where: { userId: user.id },
      data: { expiresAt: new Date(Date.now() - 1000) },
    });

    const visit = await openLatestLink();

    expect(visit.headers.get("location")).toContain("verified=0");
    expect(
      (await testPrisma.user.findUniqueOrThrow({ where: { id: user.id } }))
        .emailVerifiedAt,
    ).toBeNull();
  });

  it("refuses a token that was never issued", async () => {
    const visit = await open(`${BASE_URL}/api/auth/verify?token=made-up-token`);

    expect(visit.headers.get("location")).toContain("verified=0");
  });

  it("replaces the old token when a new link is requested", async () => {
    const user = await registerUnverifiedUser("fresh@example.com");
    const firstLink = lastVerificationLink();
    const firstStored = await testPrisma.verificationToken.findFirstOrThrow({
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
    expect(tokens[0].token).not.toBe(firstStored.token);

    // The superseded link must stop working.
    const oldLink = await open(firstLink);
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
