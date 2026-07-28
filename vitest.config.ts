import { defineConfig } from "vitest/config";
import { fileURLToPath } from "node:url";

export default defineConfig({
  test: {
    environment: "node",
    // Only the tests that live next to the code. The API tests under tests/
    // need a running application and have their own config.
    include: ["src/**/*.test.ts"],
  },
  resolve: {
    // Mirrors the "@/*" alias from tsconfig.json.
    alias: {
      "@": fileURLToPath(new URL("./src", import.meta.url)),
    },
  },
});
