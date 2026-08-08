import { expect, type Page } from "@playwright/test";

/**
 * Opens the schedule of a seeded room that has bookings this week, so the grid
 * on the screenshots is never empty. Falls back to the first room, because the
 * seed can be edited and a hard-coded id would rot.
 */
export async function openRoom(page: Page, name = "Хортиця") {
  const response = await page.request.get("/api/rooms");
  const rooms: { id: string; name: string }[] = await response.json();
  const room = rooms.find((candidate) => candidate.name === name) ?? rooms[0];

  await page.goto(`/rooms/${room.id}`);

  return room;
}

/**
 * Re-renders the page in the dark theme. The choice lives in localStorage and
 * is applied by an inline script before the first paint, so it has to be set
 * before the document loads rather than clicked afterwards.
 */
export async function useDarkTheme(page: Page) {
  await page.addInitScript(() => window.localStorage.setItem("theme", "dark"));
}

/**
 * A grid cell by its position, in whichever of the two layouts is on screen:
 * the week view has seven columns, the day view one.
 */
export function cell(page: Page, column: number, row: number) {
  return page
    .locator(
      `[data-cell="week-${column}-${row}"]:visible, [data-cell="day-0-${row}"]:visible`,
    )
    .first();
}

/**
 * Cancels anything a previous run left behind.
 *
 * The specs book real slots in the development database, and a run that fails
 * halfway leaves its booking there — where it covers the very cell the next run
 * wants to click. Cleaning up before rather than after means a crashed run
 * heals itself on the next attempt.
 */
export async function removeTestBookings(page: Page, titles: string[]) {
  const response = await page.request.get("/api/my-bookings?scope=upcoming");
  const { items }: { items: { id: string; title: string }[] } =
    await response.json();

  for (const booking of items) {
    if (titles.includes(booking.title)) {
      await page.request.delete(`/api/bookings/${booking.id}`);
    }
  }
}

/**
 * Moves the schedule to the week after the displayed one and waits for the
 * navigation to land. Clicking the link only starts it, and a drag begun on the
 * old grid would finish on the new one.
 */
export async function goToNextWeek(page: Page) {
  await page.getByLabel("Наступний тиждень").click();
  // The address is the only signal here: this is a client-side navigation, so
  // there is no load event to wait for.
  await expect(page).toHaveURL(/[?&]week=/);
}

/** Moves the phone day view forward and waits for the new day grid, not only its URL. */
export async function goToNextDay(page: Page) {
  const next = page.getByLabel("Наступний день");
  const href = await next.getAttribute("href");
  if (!href) {
    throw new Error("The next-day link has no destination");
  }

  await next.click();
  await expect(
    page.locator(`a[aria-current="page"][href="${href}"]`),
  ).toBeVisible();
}
