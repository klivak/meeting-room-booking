import { expect, test } from "@playwright/test";

import { cell, openRoom, useDarkTheme } from "./helpers";

// Every screen of the application, at every width the design is drawn for and in
// both themes. The assertions are deliberately thin — they only prove the page
// rendered the thing it is named after. The value is in the screenshots, which
// land in e2e/screenshots/<project>/ for a human to look at.

for (const theme of ["light", "dark"] as const) {
  test.describe(`${theme} theme`, () => {
    test.beforeEach(async ({ page }) => {
      if (theme === "dark") {
        await useDarkTheme(page);
      }
    });

    /**
     * A shot named after the screen and the theme.
     *
     * Overlays are captured viewport-only: a fixed panel in a full-page capture
     * is painted at its viewport position and stitched onto the top of a much
     * taller image, which shows a sheet floating over the wrong part of the page.
     */
    const shot = async (
      page: import("@playwright/test").Page,
      testInfo: import("@playwright/test").TestInfo,
      name: string,
      { fullPage = true }: { fullPage?: boolean } = {},
    ) => {
      // Parts of the grid — the "now" line and the shading over the past — exist
      // only once the client has taken over, and there is no event to wait for.
      // A short settle is honest here: this is a picture, not an assertion.
      await page.waitForTimeout(500);

      await page.screenshot({
        path: `e2e/screenshots/${testInfo.project.name}/${name}-${theme}.png`,
        fullPage,
        // Otherwise a full-page capture can catch a panel halfway through its
        // 200ms fade and photograph it half transparent.
        animations: "disabled",
      });
    };

    test("room list", async ({ page }, testInfo) => {
      await page.goto("/");

      await expect(page.getByRole("heading", { name: "Переговорні" })).toBeVisible();
      // The card answers "can I go there now" without opening the room.
      await expect(page.getByText(/Вільна|вільного часу|Робочий день/).first()).toBeVisible();

      await shot(page, testInfo, "rooms");
    });

    test("week schedule", async ({ page }, testInfo) => {
      await openRoom(page);

      // Twenty half-hour rows in the week view, twenty in the day view; only one
      // of the two is on screen at a time.
      await expect(cell(page, 0, 0)).toBeVisible();
      await expect(cell(page, 0, 19)).toBeVisible();

      if (testInfo.project.name === "desktop") {
        // The density promise of the whole design: a full working week on a
        // 1366×768 laptop without the page scrolling. Every 8px of padding
        // added anywhere above comes out of the grid, so it is asserted rather
        // than trusted.
        const scrolls = await page.evaluate(
          () => document.documentElement.scrollHeight > window.innerHeight,
        );
        expect(scrolls, "the whole week must fit 1366×768").toBe(false);
      }

      await shot(page, testInfo, "schedule");
    });

    test("booking panel", async ({ page }, testInfo) => {
      await openRoom(page);
      // 13:00 on a day the seed leaves free.
      await cell(page, 6, 8).click();

      const panel = page.getByRole("dialog", { name: "Нове бронювання" });
      await expect(panel).toBeVisible();
      await expect(panel.getByText("Тривалість:")).toBeVisible();

      await shot(page, testInfo, "panel", { fullPage: false });
    });

    test("my bookings", async ({ page }, testInfo) => {
      await page.goto("/my-bookings");

      await expect(page.getByRole("heading", { name: "Мої бронювання" })).toBeVisible();

      await shot(page, testInfo, "my-bookings");
    });

    test("notifications panel", async ({ page }, testInfo) => {
      await page.goto("/");
      await page.getByRole("button", { name: /Сповіщен/ }).click();

      await expect(page.getByText("Сповіщення", { exact: true })).toBeVisible();

      await shot(page, testInfo, "notifications", { fullPage: false });
    });

    test("sign in", async ({ page }, testInfo) => {
      // Guests only: the stored session would redirect straight to the app.
      await page.context().clearCookies();
      await page.goto("/login");

      await expect(page.getByRole("heading", { name: "З поверненням" })).toBeVisible();

      await shot(page, testInfo, "login");
    });

    test("register", async ({ page }, testInfo) => {
      await page.context().clearCookies();
      await page.goto("/register");

      await expect(page.getByRole("heading", { name: "Реєстрація" })).toBeVisible();

      await shot(page, testInfo, "register");
    });

    test("not found", async ({ page }, testInfo) => {
      await page.goto("/no-such-page");

      await expect(page.getByRole("heading", { name: "Такої сторінки немає" })).toBeVisible();

      await shot(page, testInfo, "not-found");
    });

    test("free week", async ({ page }, testInfo) => {
      const room = await openRoom(page);
      // Far enough ahead that the seed cannot have put anything there.
      await page.goto(`/rooms/${room.id}?week=2027-03-01`);

      // An empty week has to read as an opportunity, not as a failure.
      await expect(page.getByText("Весь тиждень вільний")).toBeVisible();

      await shot(page, testInfo, "free-week");
    });
  });
}
