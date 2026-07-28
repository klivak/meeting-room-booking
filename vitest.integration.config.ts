import { fileURLToPath } from "node:url";

import { defineConfig } from "vitest/config";

// Integration tests need a database and a running application, so they live in
// their own run: `npm run test:unit` stays fast during development.
export default defineConfig({
  test: {
    environment: "node",
    include: ["tests/api/**/*.test.ts"],
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
