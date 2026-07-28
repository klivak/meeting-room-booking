import { DateTime } from "luxon";
import { beforeEach, describe, expect, it } from "vitest";

import { OFFICE_TZ } from "@/lib/domain/constants";
import { api, registerUser } from "../helpers/api";
import { createRoom, resetDatabase, testPrisma } from "../helpers/db";

type ErrorBody = { error: { code: string; message: string } };
type Booking = { id: string; seriesId: string | null };

let roomId: string;
let alice: { id: string; cookie: string };
let bob: { id: string; cookie: string };

beforeEach(async () => {
  await resetDatabase();
  roomId = (await createRoom("Хортиця")).id;
  alice = await registerUser("alice@example.com", "Аліса");
  bob = await registerUser("bob@example.com", "Богдан");
});

/** Weekly slot far enough ahead that the whole series is in the future. */
function slot(weekOffset = 0, hour = 10) {
  const start = DateTime.now()
    .setZone(OFFICE_TZ)
    .plus({ days: 60, weeks: weekOffset })
    .startOf("day")
    .set({ hour });

  return {
    startsAt: start.toUTC().toISO() ?? "",
    endsAt: start.plus({ hours: 1 }).toUTC().toISO() ?? "",
  };
}

const book = (cookie: string, body: Record<string, unknown>) =>
  api<Booking & ErrorBody>("/api/bookings", { method: "POST", cookie, body });

describe("creating a series", () => {
  it("creates every occurrence and ties them together", async () => {
    const response = await book(alice.cookie, {
      roomId,
      title: "Щотижнева",
      ...slot(),
      repeatWeeks: 4,
    });

    expect(response.status).toBe(201);

    const bookings = await testPrisma.booking.findMany({
      where: { userId: alice.id },
      orderBy: { startsAt: "asc" },
    });
    expect(bookings).toHaveLength(4);
    expect(new Set(bookings.map((booking) => booking.seriesId)).size).toBe(1);

    // Exactly seven days apart, week after week.
    for (let index = 1; index < bookings.length; index++) {
      const days =
        (bookings[index].startsAt.getTime() - bookings[index - 1].startsAt.getTime()) /
        (24 * 60 * 60 * 1000);
      expect(days).toBe(7);
    }
  });

  it("creates nothing when a single week clashes", async () => {
    await book(bob.cookie, { roomId, title: "Богдан", ...slot(2) });

    const refused = await book(alice.cookie, {
      roomId,
      title: "Щотижнева",
      ...slot(),
      repeatWeeks: 4,
    });

    expect(refused.status).toBe(409);
    expect(refused.body.error.code).toBe("SLOT_TAKEN");
    // The clashing week is named, otherwise the refusal is unactionable.
    expect(refused.body.error.message).toMatch(/\d{2}\.\d{2}/);
    expect(await testPrisma.booking.count({ where: { userId: alice.id } })).toBe(0);
    expect(await testPrisma.bookingSeries.count()).toBe(0);
  });

  it("refuses a count outside the allowed range", async () => {
    const tooMany = await book(alice.cookie, {
      roomId,
      title: "Забагато",
      ...slot(),
      repeatWeeks: 13,
    });
    const tooFew = await book(alice.cookie, {
      roomId,
      title: "Замало",
      ...slot(),
      repeatWeeks: 1,
    });

    expect(tooMany.status).toBe(400);
    expect(tooFew.status).toBe(400);
  });

  it("leaves a single booking without a series", async () => {
    const response = await book(alice.cookie, { roomId, title: "Одинична", ...slot() });

    expect(response.body.seriesId).toBeNull();
    expect(await testPrisma.bookingSeries.count()).toBe(0);
  });
});

describe("cancelling a series", () => {
  const createSeries = () =>
    book(alice.cookie, { roomId, title: "Щотижнева", ...slot(), repeatWeeks: 4 });

  it("cancels only the chosen occurrence by default", async () => {
    const created = await createSeries();

    const canceled = await api(`/api/bookings/${created.body.id}`, {
      method: "DELETE",
      cookie: alice.cookie,
    });

    expect(canceled.status).toBe(204);
    expect(
      await testPrisma.booking.count({ where: { userId: alice.id, canceledAt: null } }),
    ).toBe(3);
  });

  it("cancels the whole series when asked", async () => {
    const created = await createSeries();

    const canceled = await api(`/api/bookings/${created.body.id}?scope=series`, {
      method: "DELETE",
      cookie: alice.cookie,
    });

    expect(canceled.status).toBe(204);
    expect(
      await testPrisma.booking.count({ where: { userId: alice.id, canceledAt: null } }),
    ).toBe(0);
  });

  it("frees every slot of a cancelled series", async () => {
    const created = await createSeries();
    await api(`/api/bookings/${created.body.id}?scope=series`, {
      method: "DELETE",
      cookie: alice.cookie,
    });

    const reused = await book(bob.cookie, { roomId, title: "Богдан", ...slot(2) });

    expect(reused.status).toBe(201);
  });

  it("leaves occurrences that already happened alone", async () => {
    const created = await createSeries();
    const series = await testPrisma.booking.findUniqueOrThrow({
      where: { id: created.body.id },
      select: { seriesId: true },
    });

    // One occurrence is moved into the past directly: the API cannot create one.
    const past = await testPrisma.booking.create({
      data: {
        roomId,
        userId: alice.id,
        seriesId: series.seriesId,
        title: "Минуле входження",
        startsAt: new Date(Date.now() - 2 * 60 * 60 * 1000),
        endsAt: new Date(Date.now() - 60 * 60 * 1000),
      },
    });

    await api(`/api/bookings/${created.body.id}?scope=series`, {
      method: "DELETE",
      cookie: alice.cookie,
    });

    // Cancelling a series must not rewrite what already took place.
    expect(
      (await testPrisma.booking.findUniqueOrThrow({ where: { id: past.id } })).canceledAt,
    ).toBeNull();
  });

  it("refuses to cancel someone else's series", async () => {
    const created = await createSeries();

    const hijacked = await api<ErrorBody>(`/api/bookings/${created.body.id}?scope=series`, {
      method: "DELETE",
      cookie: bob.cookie,
    });

    expect(hijacked.status).toBe(403);
    expect(
      await testPrisma.booking.count({ where: { userId: alice.id, canceledAt: null } }),
    ).toBe(4);
  });
});
