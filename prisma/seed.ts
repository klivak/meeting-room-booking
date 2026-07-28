import "dotenv/config";

import { DateTime } from "luxon";

import { normalizeEmail } from "../src/lib/domain/auth";
import { OFFICE_TZ } from "../src/lib/domain/constants";
import { getWeekStart } from "../src/lib/domain/week";
import { prisma } from "../src/lib/server/db";
import { hashPassword } from "../src/lib/server/password";

// Demo data for a fresh checkout. Every write is an upsert on a unique key, so
// running the seed twice does not duplicate anything.

const ROOMS = [
  { name: "Акваріум", floor: 2, capacity: 8 },
  { name: "Марс", floor: 2, capacity: 4 },
  { name: "Гагарін", floor: 3, capacity: 12 },
  { name: "Кіото", floor: 3, capacity: 2 },
  { name: "Атлантида", floor: 1, capacity: 6 },
  { name: "Оберіг", floor: 1, capacity: 4 },
];

const USERS = [
  { name: "Аліса Тест", email: "alice@example.com", password: "password123" },
  { name: "Богдан Демо", email: "bob@example.com", password: "password123" },
];

// Demo bookings, positioned relative to the current week so the data never
// goes stale. dayOffset counts days from Monday of this week: 0-4 land on the
// current week, 7-11 on the next one. Fixed ids make the upsert idempotent,
// since a booking has no natural unique key.
const DEMO_BOOKINGS = [
  { id: "seed-booking-01", room: "Акваріум", email: "alice@example.com", dayOffset: 0, start: "10:00", minutes: 60, title: "Синхронізація команди" },
  // Starts exactly when the previous one ends: back-to-back is legal.
  { id: "seed-booking-02", room: "Акваріум", email: "bob@example.com", dayOffset: 0, start: "11:00", minutes: 30, title: "Дзвінок із клієнтом" },
  { id: "seed-booking-03", room: "Марс", email: "bob@example.com", dayOffset: 1, start: "14:00", minutes: 120, title: "Планування спринту" },
  { id: "seed-booking-04", room: "Гагарін", email: "alice@example.com", dayOffset: 2, start: "09:00", minutes: 90, title: "Ретроспектива" },
  { id: "seed-booking-05", room: "Кіото", email: "bob@example.com", dayOffset: 3, start: "16:00", minutes: 60, title: "Співбесіда" },
  { id: "seed-booking-06", room: "Атлантида", email: "alice@example.com", dayOffset: 4, start: "12:00", minutes: 30, title: "Зустріч з партнерами" },
  { id: "seed-booking-07", room: "Акваріум", email: "alice@example.com", dayOffset: 7, start: "09:30", minutes: 60, title: "Демо для замовника" },
  { id: "seed-booking-08", room: "Гагарін", email: "bob@example.com", dayOffset: 8, start: "13:00", minutes: 120, title: "Воркшоп із дизайну" },
  { id: "seed-booking-09", room: "Оберіг", email: "alice@example.com", dayOffset: 9, start: "15:00", minutes: 60, title: "Один на один" },
  // The longest booking the rules allow.
  { id: "seed-booking-10", room: "Марс", email: "bob@example.com", dayOffset: 10, start: "10:00", minutes: 240, title: "Технічна сесія" },
];

async function seedBookings() {
  const rooms = await prisma.room.findMany({ select: { id: true, name: true } });
  const users = await prisma.user.findMany({ select: { id: true, email: true } });
  const roomIdByName = new Map(rooms.map((room) => [room.name, room.id]));
  const userIdByEmail = new Map(users.map((user) => [user.email, user.id]));

  const weekStart = getWeekStart(DateTime.now().setZone(OFFICE_TZ), 1);

  for (const demo of DEMO_BOOKINGS) {
    const roomId = roomIdByName.get(demo.room);
    const userId = userIdByEmail.get(normalizeEmail(demo.email));
    if (!roomId || !userId) {
      continue;
    }

    const [hour, minute] = demo.start.split(":").map(Number);
    // Built in office time, stored in UTC: 10:00 stays 10:00 in Kyiv on both
    // sides of a DST switch.
    const startsAt = weekStart.plus({ days: demo.dayOffset }).set({ hour, minute });
    const endsAt = startsAt.plus({ minutes: demo.minutes });

    const data = {
      roomId,
      userId,
      title: demo.title,
      startsAt: startsAt.toUTC().toJSDate(),
      endsAt: endsAt.toUTC().toJSDate(),
      canceledAt: null,
    };

    await prisma.booking.upsert({
      where: { id: demo.id },
      update: data,
      create: { id: demo.id, ...data },
    });
  }
}

async function main() {
  for (const room of ROOMS) {
    await prisma.room.upsert({
      where: { name: room.name },
      update: { floor: room.floor, capacity: room.capacity },
      create: room,
    });
  }

  for (const user of USERS) {
    const email = normalizeEmail(user.email);

    // The hash is only computed for a new user: re-running the seed must not
    // invalidate a password the tester may have already changed.
    const existing = await prisma.user.findUnique({ where: { email } });
    if (existing) {
      continue;
    }

    await prisma.user.create({
      data: {
        name: user.name,
        email,
        passwordHash: await hashPassword(user.password),
      },
    });
  }

  await seedBookings();

  console.info(
    `Seed done: ${await prisma.room.count()} rooms, ${await prisma.user.count()} users, ${await prisma.booking.count()} bookings`,
  );
}

main()
  .then(() => prisma.$disconnect())
  .catch(async (error) => {
    console.error(error);
    await prisma.$disconnect();
    process.exit(1);
  });
