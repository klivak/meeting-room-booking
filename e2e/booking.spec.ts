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
const MOVE_TITLE = "Перевірка перетягування";

test.beforeEach(async ({ page }) => {
  await removeTestBookings(page, [
    TITLE,
    KEYBOARD_TITLE,
    OVERLAP_TITLE,
    MOVE_TITLE,
  ]);
});

type Cell = ReturnType<typeof cell>;

/** Drags the pointer from one cell to another, which is how a range is picked. */
async function dragOver(
  page: import("@playwright/test").Page,
  from: Cell,
  to: Cell,
) {
  const start = await from.boundingBox();
  const end = await to.boundingBox();
  if (!start || !end) {
    throw new Error("A grid cell has no box, so the grid did not render");
  }

  await page.mouse.move(start.x + start.width / 2, start.y + start.height / 2);
  await page.mouse.down();
  // Through the cells in between: the selection follows pointerenter, so a jump
  // straight to the end would skip them.
  await page.mouse.move(end.x + end.width / 2, end.y + end.height / 2, {
    steps: 8,
  });
  await page.mouse.up();
}

/** Opens a booking of ours and cancels it, dialog and all. */
async function cancelBooking(
  page: import("@playwright/test").Page,
  title: string,
) {
  await page
    .getByRole("link", { name: new RegExp(title) })
    .first()
    .click();
  await page
    .getByRole("dialog", { name: "Редагування бронювання" })
    .getByRole("button", { name: "Скасувати бронювання" })
    .click();
  await page
    .getByRole("alertdialog")
    .getByRole("button", { name: "Скасувати", exact: true })
    .click();
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
  await expect(panel.getByText(/Тривалість: 1 год 30 хв/)).toBeVisible();

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
  await second
    .getByLabel("Кінець")
    .selectOption({ label: "14:00 · 1 год 30 хв" });

  // The clash is named while the range is still being picked, and it comes with
  // the rooms that are free at exactly that time — one click away from the tour
  // of all six.
  await expect(
    second.getByText("Цей час уже зайнятий іншим бронюванням"),
  ).toBeVisible();
  await expect(second.getByRole("button", { name: /Говерла/ })).toBeVisible();

  await second.getByLabel("Назва").fill(OVERLAP_TITLE);
  await second.getByRole("button", { name: "Забронювати" }).click();

  await expect(second.getByRole("alert")).toContainText("Цей час уже зайнятий");
  // Exactly "Закрити": the ✕ in the header is "Закрити панель", and the two must
  // not be confused with each other any more than with "Скасувати бронювання".
  await second.getByRole("button", { name: "Закрити", exact: true }).click();

  await cancelBooking(page, TITLE);
  await expect(page.getByText(TITLE, { exact: true })).toHaveCount(0);
});

test("moves and resizes an own booking on the grid itself", async ({
  page,
}) => {
  await openRoom(page);
  await goToNextWeek(page);

  // Sunday, 13:00 to 14:30 again: the same three rows the seed never touches.
  await dragOver(page, cell(page, 6, 8), cell(page, 6, 10));
  const panel = page.getByRole("dialog", { name: "Нове бронювання" });
  await panel.getByLabel("Назва").fill(MOVE_TITLE);
  await panel.getByRole("button", { name: "Забронювати" }).click();
  await expect(page.getByRole("status")).toContainText("Бронювання створено");

  const booked = page
    .getByRole("link", { name: new RegExp(MOVE_TITLE) })
    .first();
  await expect(booked).toBeVisible();

  // An hour earlier by dragging the block itself. One row is one half hour, so
  // two rows up is 12:00, and the duration comes along unchanged.
  const rowHeight = (await cell(page, 6, 0).boundingBox())!.height;
  const box = (await booked.boundingBox())!;
  await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
  await page.mouse.down();
  await page.mouse.move(
    box.x + box.width / 2,
    box.y + box.height / 2 - 2 * rowHeight,
    {
      steps: 6,
    },
  );
  await page.mouse.up();

  await expect(page.getByRole("status")).toContainText("Бронювання перенесено");
  await expect(
    page.getByRole("link", { name: new RegExp(`12:00–13:30, ${MOVE_TITLE}`) }),
  ).toBeVisible();

  // The same two gestures from the keyboard: Alt moves it, Shift changes how
  // long it runs. Dragging must not be the only way to reshape a booking.
  await page
    .getByRole("link", { name: new RegExp(MOVE_TITLE) })
    .first()
    .focus();
  await page.keyboard.press("Alt+ArrowDown");
  await expect(
    page.getByRole("link", { name: new RegExp(`12:30–14:00, ${MOVE_TITLE}`) }),
  ).toBeVisible();

  await page
    .getByRole("link", { name: new RegExp(MOVE_TITLE) })
    .first()
    .focus();
  await page.keyboard.press("Shift+ArrowDown");
  await expect(
    page.getByRole("link", { name: new RegExp(`12:30–14:30, ${MOVE_TITLE}`) }),
  ).toBeVisible();

  await cancelBooking(page, MOVE_TITLE);
});

test("navigates the weeks and explains itself from the keyboard", async ({
  page,
}) => {
  await openRoom(page);

  // Alt + arrow walks the weeks, T comes back to this one. "Сьогодні" marks
  // itself as the current page exactly while the current week is shown, so it
  // is what tells the two apart.
  const today = page.getByRole("link", { name: "Сьогодні" });
  await expect(today).toHaveAttribute("aria-current", "page");

  await page.keyboard.press("Alt+ArrowRight");
  await expect(today).not.toHaveAttribute("aria-current", "page");

  await page.keyboard.press("T");
  await expect(today).toHaveAttribute("aria-current", "page");

  // "?" is the shortcut that has to be findable without knowing the shortcuts,
  // so it is the one printed under the grid.
  await page.keyboard.press("?");
  const help = page.getByRole("dialog", { name: "Клавіатурні скорочення" });
  await expect(help).toBeVisible();
  await expect(help).toContainText("Перенести своє бронювання");

  await page.keyboard.press("Escape");
  await expect(help).toHaveCount(0);
});

test("keeps the picked slot visible wherever in the week it is", async ({
  page,
}) => {
  await openRoom(page);
  await goToNextWeek(page);

  const panel = page.getByRole("dialog", { name: "Нове бронювання" });
  // The day view marks its selection as well and is merely hidden at this
  // width, so the visible one is the one to measure.
  const selection = page.locator("[data-selection]:visible").first();

  /** True when the panel stands in front of the range being picked. */
  async function panelCoversThePick() {
    const form = (await panel.boundingBox())!;
    const pick = (await selection.boundingBox())!;

    return form.x < pick.x + pick.width && form.x + form.width > pick.x;
  }

  // Monday: the panel's usual place at the right edge of the grid is nowhere
  // near it.
  await cell(page, 0, 8).click();
  await expect(panel).toBeVisible();
  expect(await panelCoversThePick()).toBe(false);

  // Escape first: an open panel stands in front of the columns underneath it,
  // and a cell behind it cannot be clicked — which is what "Закрити" is for.
  await page.keyboard.press("Escape");
  await expect(panel).toHaveCount(0);

  // Friday, which is exactly where the panel would otherwise stand.
  await cell(page, 4, 8).click();
  await expect(panel).toBeVisible();
  expect(await panelCoversThePick()).toBe(false);
});

test("leaves a colleague's booking inert", async ({ page }) => {
  await openRoom(page);

  // The seed puts Bohdan's "Дзвінок із клієнтом" on Monday of this week.
  const theirs = page
    .getByRole("note", { name: /Дзвінок із клієнтом/ })
    .first();

  await expect(theirs).toBeVisible();
  await expect(theirs).toContainText("БД");
  // Named for a screen reader but inert for everyone: it is neither a link nor a
  // button, and with no tabindex at all it cannot be tabbed to either.
  await expect(
    page.getByRole("link", { name: /Дзвінок із клієнтом/ }),
  ).toHaveCount(0);
  await expect(
    page.getByRole("button", { name: /Дзвінок із клієнтом/ }),
  ).toHaveCount(0);
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
  await expect(panel.getByText(/Тривалість: 30 хв/)).toBeVisible();

  await panel.getByLabel("Кінець").selectOption({ label: "17:00 · 2 год" });
  await expect(panel.getByText(/Тривалість: 2 год/)).toBeVisible();

  await panel.getByLabel("Назва").fill(KEYBOARD_TITLE);
  await panel.getByRole("button", { name: "Забронювати" }).click();

  await expect(page.getByRole("status")).toContainText("Бронювання створено");

  await cancelBooking(page, KEYBOARD_TITLE);
});
