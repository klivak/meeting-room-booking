import "dotenv/config";

import { DateTime } from "luxon";
import { afterAll, beforeAll, expect, it } from "vitest";

import { OFFICE_TZ } from "@/lib/domain/constants";
import { createBooking } from "@/lib/server/bookings";
import { prisma } from "@/lib/server/db";

// Needs a real database: the protection being tested is a Postgres advisory
// lock, so an in-memory fake would prove nothing.

const TEST_PREFIX = "race-test-";

let roomId: string;
let otherRoomId: string;
let userId: string;

beforeAll(async () => {
  try {
    await prisma.$queryRaw`SELECT 1`;
  } catch {
    throw new Error(
      "This test needs the database. Start it with: docker compose up -d && npx prisma migrate dev",
    );
  }

  const room = await prisma.room.upsert({
    where: { name: `${TEST_PREFIX}room` },
    update: {},
    create: { name: `${TEST_PREFIX}room`, floor: 1, capacity: 2 },
  });
  const otherRoom = await prisma.room.upsert({
    where: { name: `${TEST_PREFIX}other-room` },
    update: {},
    create: { name: `${TEST_PREFIX}other-room`, floor: 1, capacity: 2 },
  });
  const user = await prisma.user.upsert({
    where: { email: `${TEST_PREFIX}user@example.com` },
    update: {},
    create: {
      email: `${TEST_PREFIX}user@example.com`,
      name: "Race Test",
      passwordHash: "not-used-here",
    },
  });

  roomId = room.id;
  otherRoomId = otherRoom.id;
  userId = user.id;
});

afterAll(async () => {
  await prisma.booking.deleteMany({ where: { userId } });
  await prisma.user.deleteMany({
    where: { email: { startsWith: TEST_PREFIX } },
  });
  await prisma.room.deleteMany({
    where: { name: { startsWith: TEST_PREFIX } },
  });
  await prisma.$disconnect();
});

/** A slot far enough out that nothing else in the database occupies it. */
const slot = (dayOffset: number) => {
  const day = DateTime.now()
    .setZone(OFFICE_TZ)
    .plus({ days: 200 + dayOffset });

  return {
    startsAt: day
      .set({ hour: 10, minute: 0, second: 0, millisecond: 0 })
      .toJSDate(),
    endsAt: day
      .set({ hour: 11, minute: 0, second: 0, millisecond: 0 })
      .toJSDate(),
  };
};

it("creates exactly one booking when two requests race for the same slot", async () => {
  const times = slot(0);

  const results = await Promise.all([
    createBooking({ roomId, userId, title: "Перший", ...times }),
    createBooking({ roomId, userId, title: "Другий", ...times }),
  ]);

  const created = results.filter((booking) => booking !== null);
  expect(created).toHaveLength(1);

  // The database is the real check: exactly one row, not just one truthy result.
  const stored = await prisma.booking.findMany({
    where: { roomId, canceledAt: null, startsAt: times.startsAt },
  });
  expect(stored).toHaveLength(1);
});

it("survives ten simultaneous attempts at one slot", async () => {
  const times = slot(1);

  const results = await Promise.all(
    Array.from({ length: 10 }, (_, index) =>
      createBooking({ roomId, userId, title: `Спроба ${index}`, ...times }),
    ),
  );

  expect(results.filter((booking) => booking !== null)).toHaveLength(1);
  expect(
    await prisma.booking.count({
      where: { roomId, canceledAt: null, startsAt: times.startsAt },
    }),
  ).toBe(1);
});

it("does not make different rooms wait for each other", async () => {
  const times = slot(2);

  const results = await Promise.all([
    createBooking({ roomId, userId, title: "Кімната А", ...times }),
    createBooking({
      roomId: otherRoomId,
      userId,
      title: "Кімната Б",
      ...times,
    }),
  ]);

  // The lock key is derived from the room, so both succeed.
  expect(results.filter((booking) => booking !== null)).toHaveLength(2);
});
