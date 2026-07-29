import { expect, test } from "@playwright/test";

import { cell, goToNextWeek, openRoom, removeTestBookings } from "./helpers";

// The main scenario end to end: drag a range on the grid, book it, fail to book
// over it, then cancel it. It runs on the desktop layout, because dragging is a
// mouse gesture; the keyboard route to the same result is checked below it.
//
// Everything happens in the week after this one, so the "future only" rule never
// depends on what time of day the test runs. Each test puts the week back the
// way it found it.

const TITLE = "Перевірка дизайну";
const KEYBOARD_TITLE = "Перевірка з клавіатури";
const OVERLAP_TITLE = "Спроба перекрити";

test.beforeEach(async ({ page }) => {
  await removeTestBookings(page, [TITLE, KEYBOARD_TITLE, OVERLAP_TITLE]);
});

type Cell = ReturnType<typeof cell>;

/** Drags the pointer from one cell to another, which is how a range is picked. */
async function dragOver(page: import("@playwright/test").Page, from: Cell, to: Cell) {
  const start = await from.boundingBox();
  const end = await to.boundingBox();
  if (!start || !end) {
    throw new Error("A grid cell has no box, so the grid did not render");
  }

  await page.mouse.move(start.x + start.width / 2, start.y + start.height / 2);
  await page.mouse.down();
  // Through the cells in between: the selection follows pointerenter, so a jump
  // straight to the end would skip them.
  await page.mouse.move(end.x + end.width / 2, end.y + end.height / 2, { steps: 8 });
  await page.mouse.up();
}

/** Opens a booking of ours and cancels it, dialog and all. */
async function cancelBooking(page: import("@playwright/test").Page, title: string) {
  await page.getByRole("link", { name: new RegExp(title) }).first().click();
  await page
    .getByRole("dialog", { name: "Редагування бронювання" })
    .getByRole("button", { name: "Скасувати бронювання" })
    .click();
  await page.getByRole("alertdialog").getByRole("button", { name: "Так, скасувати" }).click();
  await expect(page.getByRole("status")).toContainText("Бронювання скасовано");
}

test("books a dragged range, refuses to double-book it, then cancels it", async ({
  page,
}) => {
  await openRoom(page);
  // Next week, so every slot is in the future whatever day it is today.
  await goToNextWeek(page);

  // Sunday, 13:00 to 14:30: three rows the seed never touches.
  await dragOver(page, cell(page, 6, 8), cell(page, 6, 10));

  const panel = page.getByRole("dialog", { name: "Нове бронювання" });
  await expect(panel).toBeVisible();
  // The drag decided the duration, and the panel says so in words.
  await expect(panel.getByText("1 год 30 хв", { exact: true })).toBeVisible();

  await panel.getByLabel("Назва").fill(TITLE);
  await panel.getByRole("button", { name: "Забронювати" }).click();

  await expect(page.getByRole("status")).toContainText("Бронювання створено");
  const block = page.getByRole("link", { name: new RegExp(TITLE) }).first();
  await expect(block).toBeVisible();
  // Ours, so the chip says so and the block offers a way in.
  await expect(block).toContainText("ВИ");

  // Now overlap it on purpose. The half hour before is free and back-to-back is
  // legal, so the range has to be stretched over the booking with the "End"
  // select — the client lets that be built, and the server is what says no.
  await cell(page, 6, 7).click();
  const second = page.getByRole("dialog", { name: "Нове бронювання" });
  await second.getByLabel("Кінець").selectOption({ label: "14:00 · 1 год 30 хв" });
  await second.getByLabel("Назва").fill(OVERLAP_TITLE);
  await second.getByRole("button", { name: "Забронювати" }).click();

  await expect(second.getByRole("alert")).toContainText("Цей час уже зайнятий");
  // Exactly "Закрити": the ✕ in the header is "Закрити панель", and the two must
  // not be confused with each other any more than with "Скасувати бронювання".
  await second.getByRole("button", { name: "Закрити", exact: true }).click();

  await cancelBooking(page, TITLE);
  await expect(page.getByText(TITLE, { exact: true })).toHaveCount(0);
});

test("leaves a colleague's booking inert", async ({ page }) => {
  await openRoom(page);

  // The seed puts Bohdan's "Дзвінок із клієнтом" on Monday of this week.
  const theirs = page.getByRole("note", { name: /Дзвінок із клієнтом/ }).first();

  await expect(theirs).toBeVisible();
  await expect(theirs).toContainText("БД");
  // Named for a screen reader but inert for everyone: it is neither a link nor a
  // button, and with no tabindex at all it cannot be tabbed to either.
  await expect(page.getByRole("link", { name: /Дзвінок із клієнтом/ })).toHaveCount(0);
  await expect(page.getByRole("button", { name: /Дзвінок із клієнтом/ })).toHaveCount(0);
  await expect(theirs).not.toHaveAttribute("tabindex", /.*/);
});

test("picks a range with the keyboard alone", async ({ page }) => {
  await openRoom(page);
  await goToNextWeek(page);

  // Tab reaches the grid once; the arrows do the rest. Enter books the focused
  // half hour and the "End" select turns it into any allowed duration — together
  // that is the answer to WCAG 2.5.7, which dragging alone failed.
  await cell(page, 0, 0).focus();
  for (let step = 0; step < 6; step += 1) {
    await page.keyboard.press("ArrowRight");
  }
  for (let step = 0; step < 12; step += 1) {
    await page.keyboard.press("ArrowDown");
  }
  await page.keyboard.press("Enter");

  // Sunday 15:00, half an hour, exactly where the arrows landed.
  const panel = page.getByRole("dialog", { name: "Нове бронювання" });
  await expect(panel).toBeVisible();
  await expect(panel.getByText("30 хв", { exact: true })).toBeVisible();

  await panel.getByLabel("Кінець").selectOption({ label: "17:00 · 2 год" });
  await expect(panel.getByText("2 год", { exact: true })).toBeVisible();

  await panel.getByLabel("Назва").fill(KEYBOARD_TITLE);
  await panel.getByRole("button", { name: "Забронювати" }).click();

  await expect(page.getByRole("status")).toContainText("Бронювання створено");

  await cancelBooking(page, KEYBOARD_TITLE);
});
