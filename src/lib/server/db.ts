import { PrismaPg } from "@prisma/adapter-pg";

import { PrismaClient } from "@/generated/prisma/client";
import { env } from "@/lib/server/env";

// Prisma 7 talks to Postgres through a driver adapter instead of a bundled
// query engine, so the connection string is passed to the adapter, not to
// PrismaClient.
// The instance is cached on globalThis because Next's dev server re-evaluates
// modules on every hot reload, which would otherwise open a new pool each time.

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined;
};

function createPrismaClient() {
  return new PrismaClient({
    adapter: new PrismaPg({ connectionString: env.DATABASE_URL }),
  });
}

export const prisma = globalForPrisma.prisma ?? createPrismaClient();

if (process.env.NODE_ENV !== "production") {
  globalForPrisma.prisma = prisma;
}
