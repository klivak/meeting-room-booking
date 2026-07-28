import { PrismaPg } from "@prisma/adapter-pg";

import { PrismaClient } from "@/generated/prisma/client";

// Integration tests run against their own database so a failing test can never
// wipe the data a developer is looking at in the dev database.
export const TEST_DATABASE_URL =
  process.env.TEST_DATABASE_URL ??
  "postgresql://postgres:postgres@localhost:5432/meeting_room_booking_test?schema=public";

export const testPrisma = new PrismaClient({
  adapter: new PrismaPg({ connectionString: TEST_DATABASE_URL }),
});

/** Empties every table, so each test file starts from a known state. */
export async function resetDatabase() {
  await testPrisma.$executeRaw`TRUNCATE TABLE "Booking", "Session", "User", "Room" RESTART IDENTITY CASCADE`;
}

export async function createRoom(name: string, capacity = 6) {
  return testPrisma.room.create({ data: { name, floor: 1, capacity } });
}
