import { fileURLToPath } from "node:url";

import { defineConfig } from "vitest/config";

import { TEST_DATABASE_URL } from "./tests/helpers/testDatabaseUrl";

// Integration tests need a database and a running application, so they live in
// their own run: `npm run test:unit` stays fast during development.
export default defineConfig({
  test: {
    environment: "node",
    // The race test drives lib/server/bookings directly rather than over HTTP,
    // but it needs the same real Postgres the API tests do, so it runs here.
    include: ["tests/api/**/*.test.ts", "src/**/*.race.test.ts"],
    // The prisma singleton reads DATABASE_URL when its module loads, so the
    // test database has to be named before any test imports it. Without this
    // the race test would write into whatever database .env points at, which is
    // the one the developer is looking at.
    env: { DATABASE_URL: TEST_DATABASE_URL },
    globalSetup: ["tests/setup/globalSetup.ts"],
    // The first request to each route compiles it, which is slower than a unit test.
    testTimeout: 30_000,
    hookTimeout: 120_000,
    // One database is shared by all files, so they must not run at the same time.
    fileParallelism: false,
  },
  resolve: {
    alias: {
      "@": fileURLToPath(new URL("./src", import.meta.url)),
    },
  },
});
