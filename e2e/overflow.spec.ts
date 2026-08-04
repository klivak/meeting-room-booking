import { expect, test } from "@playwright/test";

import { openRoom } from "./helpers";

/**
 * The one question on this suite's list that a unit test cannot answer: whether
 * the page is wider than the screen it is on. A sideways scrollbar on a phone is
 * never a decision anybody made — it is always a stray element, and the only way
 * to find it is to lay the page out in a real browser and measure it.
 *
 * It runs at all three widths the design is drawn for, because the causes
 * differ: at 360 it was the capacity filter bleeding past the page padding, at
 * 768 the header row being one control too long.
 */
test("no page is wider than the screen it is on", async ({ page }) => {
  const room = await openRoom(page);

  for (const path of ["/", "/my-bookings", `/rooms/${room.id}`]) {
    await page.goto(path);
    // The schedule is a streamed Suspense boundary, so the first paint is the
    // placeholder; measuring that says nothing about the real grid.
    await page.waitForTimeout(1200);

    const measured = await page.evaluate(() => ({
      width: document.documentElement.clientWidth,
      scroll: document.documentElement.scrollWidth,
    }));

    expect(measured.scroll, `${path} scrolls sideways`).toBeLessThanOrEqual(
      measured.width,
    );
  }
});
