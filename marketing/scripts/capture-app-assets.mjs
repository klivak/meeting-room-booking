import { chromium } from "@playwright/test";
import { mkdir } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const baseUrl = process.env.MARKETING_APP_URL ?? "http://localhost:3000";
const scriptDirectory = path.dirname(fileURLToPath(import.meta.url));
const repositoryRoot = path.resolve(scriptDirectory, "../..");
const storageState = path.join(repositoryRoot, "e2e/.auth/user.json");
const outputRoot = path.join(repositoryRoot, "marketing/public/app");

const settle = async (page) => {
  await page.waitForLoadState("domcontentloaded");
  await page.evaluate(() => document.fonts.ready);
  await page.waitForTimeout(500);
};

const openRoom = async (page) => {
  const response = await page.request.get(`${baseUrl}/api/rooms`);
  if (!response.ok()) {
    throw new Error(`Could not load rooms: ${response.status()}`);
  }

  const rooms = await response.json();
  const room = rooms.find(({ name }) => name === "Хортиця") ?? rooms[0];
  if (!room) {
    throw new Error("No rooms are available for marketing screenshots");
  }

  await page.goto(`${baseUrl}/rooms/${room.id}`);
  await settle(page);
};

const captureLocale = async (browser, locale) => {
  const outputDir = path.join(outputRoot, locale);
  await mkdir(outputDir, { recursive: true });

  const desktop = await browser.newContext({
    viewport: { width: 1366, height: 768 },
    storageState,
    locale: locale === "uk" ? "uk-UA" : "en-US",
    timezoneId: "Europe/Kyiv",
  });
  await desktop.addCookies([
    { name: "locale", value: locale, url: baseUrl, sameSite: "Lax" },
  ]);

  const desktopPage = await desktop.newPage();
  await desktopPage.goto(baseUrl);
  await settle(desktopPage);
  await desktopPage.screenshot({
    path: path.join(outputDir, "rooms-desktop.png"),
    fullPage: true,
    animations: "disabled",
  });

  await openRoom(desktopPage);
  await desktopPage.screenshot({
    path: path.join(outputDir, "schedule-desktop.png"),
    fullPage: true,
    animations: "disabled",
  });

  await desktopPage
    .locator('[data-cell^="week-"]:not([aria-disabled="true"])')
    .last()
    .click();
  await desktopPage.getByRole("dialog").waitFor();
  await desktopPage.screenshot({
    path: path.join(outputDir, "panel-desktop.png"),
    fullPage: false,
    animations: "disabled",
  });
  await desktop.close();

  const phone = await browser.newContext({
    viewport: { width: 360, height: 780 },
    storageState,
    locale: locale === "uk" ? "uk-UA" : "en-US",
    timezoneId: "Europe/Kyiv",
    hasTouch: true,
    isMobile: true,
  });
  await phone.addCookies([
    { name: "locale", value: locale, url: baseUrl, sameSite: "Lax" },
  ]);

  const phonePage = await phone.newPage();
  await phonePage.goto(baseUrl);
  await settle(phonePage);
  await phonePage.screenshot({
    path: path.join(outputDir, "rooms-phone.png"),
    fullPage: true,
    animations: "disabled",
  });

  await openRoom(phonePage);
  await phonePage
    .locator('[data-cell^="day-"]:not([aria-disabled="true"])')
    .last()
    .click();
  const panel = phonePage.getByRole("dialog");
  await panel.waitFor();
  await panel.locator('button[aria-controls="booking-form-fields"]').click();
  await phonePage.screenshot({
    path: path.join(outputDir, "panel-phone.png"),
    fullPage: false,
    animations: "disabled",
  });
  await phone.close();
};

const browser = await chromium.launch({ headless: true });

try {
  await captureLocale(browser, "uk");
  await captureLocale(browser, "en");
} finally {
  await browser.close();
}
