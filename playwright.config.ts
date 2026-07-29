import { defineConfig, devices } from "@playwright/test";

// Browser checks: they open the real application and look at it, which is the
// one thing Vitest cannot do. They run against the development server and its
// seeded database, because the point is to see the screens as they really are.
//
// Vitest still owns correctness: `npm test` is the suite that has to be green.

const BASE_URL = "http://localhost:3000";

/** Session cookie captured once by auth.setup.ts and reused by every spec. */
export const STORAGE_STATE = "e2e/.auth/user.json";

// The three widths the design is drawn for.
const DESKTOP = { width: 1366, height: 768 };
const TABLET = { width: 768, height: 1024 };
const PHONE = { width: 360, height: 780 };

export default defineConfig({
  testDir: "./e2e",
  // One development database is shared by every spec, so two of them booking
  // the same slot at the same time would be flaky for no good reason.
  workers: 1,
  fullyParallel: false,
  reporter: [["list"], ["html", { open: "never" }]],

  // The development server compiles a route the first time it is asked for, and
  // that first request is slower than anything the application does afterwards.
  // The default five seconds turns that compile into a false failure.
  timeout: 90_000,
  expect: { timeout: 20_000 },

  use: {
    baseURL: BASE_URL,
    // The office is in Kyiv, so this is the plain case: the timezone notice
    // above the grid stays hidden and the axis reads 09:00–19:00.
    timezoneId: "Europe/Kyiv",
    locale: "uk-UA",
    trace: "retain-on-failure",
  },

  webServer: {
    command: "npm run dev",
    url: `${BASE_URL}/login`,
    // A server already running by hand is reused rather than fought with.
    reuseExistingServer: true,
    timeout: 180_000,
  },

  projects: [
    { name: "setup", testMatch: /auth\.setup\.ts/ },
    {
      name: "desktop",
      use: { ...devices["Desktop Chrome"], viewport: DESKTOP, storageState: STORAGE_STATE },
      dependencies: ["setup"],
    },
    {
      name: "tablet",
      use: { ...devices["Desktop Chrome"], viewport: TABLET, storageState: STORAGE_STATE },
      dependencies: ["setup"],
      // Dragging a range is a mouse gesture, so the scenario runs once, on the
      // layout that has one.
      testIgnore: /booking\.spec\.ts/,
    },
    {
      name: "phone",
      use: {
        ...devices["Desktop Chrome"],
        viewport: PHONE,
        hasTouch: true,
        isMobile: true,
        storageState: STORAGE_STATE,
      },
      dependencies: ["setup"],
      testIgnore: /booking\.spec\.ts/,
    },
  ],
});
