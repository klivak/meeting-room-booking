import { expect, test as setup } from "@playwright/test";

import { STORAGE_STATE } from "../playwright.config";

// Signs in once and hands the session to every other spec. Doing it per test
// would add a full round trip to each of them and prove nothing new.
//
// The account comes from prisma/seed.ts, so `npx tsx prisma/seed.ts` has to have
// run against the development database at least once.
const EMAIL = "alice@example.com";
const PASSWORD = "password123";

setup("sign in as the seeded user", async ({ page }) => {
  await page.goto("/login");

  await page.getByLabel("Пошта").fill(EMAIL);
  await page.getByLabel("Пароль").fill(PASSWORD);
  await page.getByRole("button", { name: "Увійти" }).click();

  // The room list is the screen a successful sign-in lands on.
  await expect(page.getByRole("heading", { name: "Переговорні" })).toBeVisible();

  await page.context().storageState({ path: STORAGE_STATE });
});
