import { DateTime } from "luxon";
import { beforeEach, describe, expect, it } from "vitest";

import { OFFICE_TZ } from "@/lib/domain/constants";
import { getWeekStart } from "@/lib/domain/week";
import { api, registerUser } from "../helpers/api";
import { createRoom, resetDatabase, testPrisma } from "../helpers/db";

type ErrorBody = { error: { code: string; message: string; field?: string } };
type Booking = { id: string; roomId: string; title: string };

let roomId: string;
let otherRoomId: string;
let alice: { id: string; cookie: string };
let bob: { id: string; cookie: string };

beforeEach(async () => {
  await resetDatabase();

  roomId = (await createRoom("Акваріум")).id;
  otherRoomId = (await createRoom("Марс")).id;
  alice = await registerUser("alice@example.com", "Аліса");
  bob = await registerUser("bob@example.com", "Богдан");
});

/**
 * Office-time slot on a weekday far enough ahead to always be in the future.
 * Times are built in Kyiv and sent as UTC, exactly like the form does.
 */
function slot(hour: number, minutes = 60, dayOffset = 30) {
  const day = DateTime.now().setZone(OFFICE_TZ).plus({ days: dayOffset }).startOf("day");
  const start = day.set({ hour });

  return {
    startsAt: start.toUTC().toISO() ?? "",
    endsAt: start.plus({ minutes }).toUTC().toISO() ?? "",
  };
}

const book = (cookie: string, body: Record<string, unknown>) =>
  api<Booking & ErrorBody>("/api/bookings", { method: "POST", cookie, body });

describe("creating a booking", () => {
  it("accepts a free slot", async () => {
    const response = await book(alice.cookie, {
      roomId,
      title: "Планерка",
      ...slot(10),
    });

    expect(response.status).toBe(201);
    expect(await testPrisma.booking.count()).toBe(1);
  });

  it("accepts a booking that starts exactly when another ends", async () => {
    await book(alice.cookie, { roomId, title: "Перша", ...slot(10) });

    const backToBack = await book(bob.cookie, { roomId, title: "Друга", ...slot(11) });

    expect(backToBack.status).toBe(201);
    expect(await testPrisma.booking.count()).toBe(2);
  });

  it("refuses an overlapping slot", async () => {
    await book(alice.cookie, { roomId, title: "Перша", ...slot(10, 120) });

    const overlapping = await book(bob.cookie, {
      roomId,
      title: "Накладка",
      ...slot(11),
    });

    expect(overlapping.status).toBe(409);
    expect(overlapping.body.error.code).toBe("SLOT_TAKEN");
  });

  it("allows the same time in a different room", async () => {
    await book(alice.cookie, { roomId, title: "Тут", ...slot(10) });

    const elsewhere = await book(bob.cookie, {
      roomId: otherRoomId,
      title: "Там",
      ...slot(10),
    });

    expect(elsewhere.status).toBe(201);
  });

  it.each([
    ["a time in the past", { ...slot(10, 60, -3) }, "TIME_IN_PAST"],
    ["a start before opening time", { ...slot(8) }, "OUTSIDE_WORKING_HOURS"],
    ["an end after closing time", { ...slot(18, 90) }, "OUTSIDE_WORKING_HOURS"],
    ["a duration over four hours", { ...slot(10, 300) }, "DURATION_INVALID"],
    // A booking shorter than half an hour cannot sit on the 30-minute grid at
    // all, so the alignment rule is what answers first. The duration rule on its
    // own is covered by the case above and by the domain tests.
    ["a duration under thirty minutes", { ...slot(10, 15) }, "TIME_NOT_ALIGNED"],
  ])("refuses %s", async (_name, times, expectedCode) => {
    const response = await book(alice.cookie, { roomId, title: "Тест", ...times });

    expect(response.status).toBe(400);
    expect(response.body.error.code).toBe(expectedCode);
    expect(await testPrisma.booking.count()).toBe(0);
  });

  it("refuses a start that is off the thirty-minute grid", async () => {
    const day = DateTime.now().setZone(OFFICE_TZ).plus({ days: 30 }).startOf("day");
    const start = day.set({ hour: 10, minute: 15 });

    const response = await book(alice.cookie, {
      roomId,
      title: "Крива",
      startsAt: start.toUTC().toISO() ?? "",
      endsAt: start.plus({ hours: 1 }).toUTC().toISO() ?? "",
    });

    expect(response.status).toBe(400);
    expect(response.body.error.code).toBe("TIME_NOT_ALIGNED");
  });

  it("refuses a blank title and an unknown room, naming the field", async () => {
    const blankTitle = await book(alice.cookie, { roomId, title: "   ", ...slot(10) });
    const unknownRoom = await book(alice.cookie, {
      roomId: "no-such-room",
      title: "Тест",
      ...slot(10),
    });

    expect(blankTitle.status).toBe(400);
    expect(blankTitle.body.error.code).toBe("TITLE_INVALID");
    expect(blankTitle.body.error.field).toBe("title");

    expect(unknownRoom.status).toBe(404);
    expect(unknownRoom.body.error.field).toBe("roomId");
  });
});

describe("editing a booking", () => {
  it("lets the author rename it without touching the time", async () => {
    const created = await book(alice.cookie, { roomId, title: "Стара", ...slot(10) });

    const renamed = await api<Booking>(`/api/bookings/${created.body.id}`, {
      method: "PATCH",
      cookie: alice.cookie,
      body: { title: "Нова" },
    });

    expect(renamed.status).toBe(200);
    expect(renamed.body.title).toBe("Нова");
  });

  it("does not let a booking clash with itself", async () => {
    const created = await book(alice.cookie, { roomId, title: "Своя", ...slot(10) });

    // Same interval again: only the excluded id keeps this from being a clash.
    const resaved = await api(`/api/bookings/${created.body.id}`, {
      method: "PATCH",
      cookie: alice.cookie,
      body: slot(10),
    });

    expect(resaved.status).toBe(200);
  });

  it("refuses a move onto a taken slot", async () => {
    const mine = await book(alice.cookie, { roomId, title: "Моя", ...slot(10) });
    await book(bob.cookie, { roomId, title: "Чужа", ...slot(12) });

    const moved = await api<ErrorBody>(`/api/bookings/${mine.body.id}`, {
      method: "PATCH",
      cookie: alice.cookie,
      body: slot(12),
    });

    expect(moved.status).toBe(409);
    expect(moved.body.error.code).toBe("SLOT_TAKEN");
  });

  it("applies the creation rules to the new values", async () => {
    const created = await book(alice.cookie, { roomId, title: "Своя", ...slot(10) });

    const outsideHours = await api<ErrorBody>(`/api/bookings/${created.body.id}`, {
      method: "PATCH",
      cookie: alice.cookie,
      body: slot(8),
    });

    expect(outsideHours.status).toBe(400);
    expect(outsideHours.body.error.code).toBe("OUTSIDE_WORKING_HOURS");
  });

  it("refuses someone else's booking, and the answer does not depend on the payload", async () => {
    const created = await book(alice.cookie, { roomId, title: "Аліси", ...slot(10) });

    const hijacked = await api<ErrorBody>(`/api/bookings/${created.body.id}`, {
      method: "PATCH",
      cookie: bob.cookie,
      body: { title: "Богдана" },
    });

    expect(hijacked.status).toBe(403);
    expect(hijacked.body.error.code).toBe("FORBIDDEN");
    expect((await testPrisma.booking.findUniqueOrThrow({ where: { id: created.body.id } })).title).toBe("Аліси");
  });
});

describe("cancelling a booking", () => {
  it("hides it and frees the slot", async () => {
    const created = await book(alice.cookie, { roomId, title: "Своя", ...slot(10) });

    const canceled = await api(`/api/bookings/${created.body.id}`, {
      method: "DELETE",
      cookie: alice.cookie,
    });
    expect(canceled.status).toBe(204);

    // Soft delete: the row stays, but it no longer blocks the slot.
    const stored = await testPrisma.booking.findUniqueOrThrow({
      where: { id: created.body.id },
    });
    expect(stored.canceledAt).not.toBeNull();

    const reused = await book(bob.cookie, { roomId, title: "Після", ...slot(10) });
    expect(reused.status).toBe(201);
  });

  it("refuses someone else's booking", async () => {
    const created = await book(alice.cookie, { roomId, title: "Аліси", ...slot(10) });

    const hijacked = await api<ErrorBody>(`/api/bookings/${created.body.id}`, {
      method: "DELETE",
      cookie: bob.cookie,
    });

    expect(hijacked.status).toBe(403);
    expect(
      (await testPrisma.booking.findUniqueOrThrow({ where: { id: created.body.id } }))
        .canceledAt,
    ).toBeNull();
  });

  it("treats an already cancelled booking as gone", async () => {
    const created = await book(alice.cookie, { roomId, title: "Своя", ...slot(10) });
    await api(`/api/bookings/${created.body.id}`, { method: "DELETE", cookie: alice.cookie });

    const again = await api<ErrorBody>(`/api/bookings/${created.body.id}`, {
      method: "DELETE",
      cookie: alice.cookie,
    });

    expect(again.status).toBe(404);
  });
});

describe("reading bookings", () => {
  it("shows other people's bookings with their author and no ownership", async () => {
    await book(bob.cookie, { roomId, title: "Богданова", ...slot(10) });

    // The same helper the page uses, so the window really contains the booking.
    const weekStart = getWeekStart(
      DateTime.now().setZone(OFFICE_TZ).plus({ days: 30 }),
      1,
    )
      .toUTC()
      .toISO();

    const week = await api<{ title: string; user: { name: string }; isMine: boolean }[]>(
      `/api/rooms/${roomId}/bookings?weekStart=${encodeURIComponent(weekStart ?? "")}`,
      { cookie: alice.cookie },
    );

    expect(week.status).toBe(200);
    const seen = week.body.find((booking) => booking.title === "Богданова");
    expect(seen?.user.name).toBe("Богдан");
    expect(seen?.isMine).toBe(false);
  });

  it("splits my bookings into upcoming and past", async () => {
    await book(alice.cookie, { roomId, title: "Майбутня", ...slot(10) });
    // A finished booking cannot be created through the API, so it is inserted directly.
    await testPrisma.booking.create({
      data: {
        roomId,
        userId: alice.id,
        title: "Минула",
        startsAt: new Date(Date.now() - 3 * 60 * 60 * 1000),
        endsAt: new Date(Date.now() - 2 * 60 * 60 * 1000),
      },
    });

    const upcoming = await api<{ items: { title: string }[] }>(
      "/api/my-bookings?scope=upcoming",
      { cookie: alice.cookie },
    );
    const past = await api<{ items: { title: string }[] }>("/api/my-bookings?scope=past", {
      cookie: alice.cookie,
    });

    expect(upcoming.body.items.map((item) => item.title)).toEqual(["Майбутня"]);
    expect(past.body.items.map((item) => item.title)).toEqual(["Минула"]);
  });

  it("does not leak other people's bookings into my list", async () => {
    await book(bob.cookie, { roomId, title: "Богданова", ...slot(10) });

    const mine = await api<{ items: unknown[] }>("/api/my-bookings", {
      cookie: alice.cookie,
    });

    expect(mine.body.items).toHaveLength(0);
  });
});
