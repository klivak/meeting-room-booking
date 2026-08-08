import { expect, test } from "@playwright/test";

import { cell, goToNextDay, openRoom } from "./helpers";

test("resizes a tapped range before expanding the mobile sheet", async ({
  page,
}, testInfo) => {
  test.skip(testInfo.project.name !== "phone", "phone interaction only");

  await openRoom(page);
  // The default mobile day may be yesterday when today is a weekend. Two
  // steps make the chosen day strictly future in either case.
  await goToNextDay(page);
  await goToNextDay(page);
  await cell(page, 0, 8).tap();

  const panel = page.getByRole("dialog", { name: "Нове бронювання" });
  const expand = panel.getByRole("button", {
    name: "Розгорнути панель бронювання",
  });
  await expect(expand).toHaveAttribute("aria-expanded", "false");
  await expect(panel.getByLabel("Назва")).toBeHidden();

  const handle = page.locator(
    '[data-selection] button[aria-label="Змінити тривалість вибраного часу"]',
  );
  await expect(handle).toBeVisible();
  const handleBox = await handle.boundingBox();
  if (!handleBox) {
    throw new Error("The mobile resize handle has no box");
  }

  const client = await page.context().newCDPSession(page);
  const x = handleBox.x + handleBox.width / 2;
  const y = handleBox.y + handleBox.height / 2;
  await client.send("Input.dispatchTouchEvent", {
    type: "touchStart",
    touchPoints: [{ x, y }],
  });
  await client.send("Input.dispatchTouchEvent", {
    type: "touchMove",
    touchPoints: [{ x, y: y + 30 }],
  });
  await client.send("Input.dispatchTouchEvent", {
    type: "touchEnd",
    touchPoints: [],
  });

  await expect(panel.getByText(/13:00–14:00 · 1 год/)).toBeVisible();

  await expand.click();
  const collapse = panel.getByRole("button", {
    name: "Згорнути панель бронювання",
  });
  await expect(collapse).toHaveAttribute("aria-expanded", "true");
  await expect(panel.getByLabel("Назва")).toBeVisible();

  // The recurrence controls stay on one row even at 360px.
  const repeat = panel.getByLabel("Повторювати щотижня");
  const count = panel.getByRole("button", { name: /Кількість повторень/ });
  const times = panel.getByText("разів", { exact: true });
  const [repeatBox, countBox, timesBox] = await Promise.all([
    repeat.boundingBox(),
    count.boundingBox(),
    times.boundingBox(),
  ]);
  if (!repeatBox || !countBox || !timesBox) {
    throw new Error("The recurrence controls have no boxes");
  }
  const repeatCenter = repeatBox.y + repeatBox.height / 2;
  const countCenter = countBox.y + countBox.height / 2;
  const timesCenter = timesBox.y + timesBox.height / 2;
  expect(Math.abs(repeatCenter - countCenter)).toBeLessThan(5);
  expect(Math.abs(countCenter - timesCenter)).toBeLessThan(5);

  // A downward swipe returns to the compact state without closing the choice.
  const collapseBox = await collapse.boundingBox();
  if (!collapseBox) {
    throw new Error("The mobile sheet handle has no box");
  }
  const sheetX = collapseBox.x + collapseBox.width / 2;
  const sheetY = collapseBox.y + collapseBox.height / 2;
  await client.send("Input.dispatchTouchEvent", {
    type: "touchStart",
    touchPoints: [{ x: sheetX, y: sheetY }],
  });
  await client.send("Input.dispatchTouchEvent", {
    type: "touchMove",
    touchPoints: [{ x: sheetX, y: sheetY + 60 }],
  });
  await client.send("Input.dispatchTouchEvent", {
    type: "touchEnd",
    touchPoints: [],
  });
  await expect(expand).toHaveAttribute("aria-expanded", "false");
});
