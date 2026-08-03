import { defineConfig } from "vitest/config";
import { fileURLToPath } from "node:url";

export default defineConfig({
  test: {
    environment: "node",
    // Only the tests that live next to the code and need nothing running. The
    // API tests under tests/ need a server, and *.race.test.ts needs Postgres;
    // both belong to the integration run, which creates its own database.
    include: ["src/**/*.test.ts"],
    exclude: ["**/node_modules/**", "src/**/*.race.test.ts"],
  },
  resolve: {
    // Mirrors the "@/*" alias from tsconfig.json.
    alias: {
      "@": fileURLToPath(new URL("./src", import.meta.url)),
    },
  },
});
