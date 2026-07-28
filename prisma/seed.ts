import "dotenv/config";

import { normalizeEmail } from "../src/lib/domain/auth";
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

  console.info(
    `Seed done: ${await prisma.room.count()} rooms, ${await prisma.user.count()} users`,
  );
}

main()
  .then(() => prisma.$disconnect())
  .catch(async (error) => {
    console.error(error);
    await prisma.$disconnect();
    process.exit(1);
  });
