import { PrismaPg } from "@prisma/adapter-pg";

import { PrismaClient } from "@/generated/prisma/client";

import { TEST_DATABASE_URL } from "./testDatabaseUrl";

export { TEST_DATABASE_URL };

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
