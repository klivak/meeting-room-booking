"use client";

import { DateTime } from "luxon";
import { useTranslations } from "next-intl";
import { useSyncExternalStore } from "react";

import {
  noopSubscribe,
  readOfficeTimeZone,
  readViewerTimeZone,
} from "@/components/viewerTimeZone";
import {
  OFFICE_TZ,
  WORK_DAY_END,
  WORK_DAY_START,
} from "@/lib/domain/constants";
import { showsSameClock } from "@/lib/domain/timezone";

/**
 * The line under the room name that says whose clock the grid is showing.
 *
 * It is always there, because "09:00-19:00 in Kyiv" is a rule of the room and
 * not a detail of one viewer's setup. It only turns warm when the viewer sits
 * somewhere else, which is the case the grid actually shifts under: in Berlin
 * the office day reads 08:00-18:00.
 */
export function TimeZoneNotice() {
  const t = useTranslations("schedule");
  const timeZone = useSyncExternalStore(
    noopSubscribe,
    readViewerTimeZone,
    readOfficeTimeZone,
  );

  // By the clock, not by the name: browsers still report "Europe/Kiev" for the
  // office's own zone, and telling someone in Kyiv that their timezone differs
  // from Kyiv would be worse than saying nothing.
  const shifted = !showsSameClock(timeZone, OFFICE_TZ, new Date());
  const offset = DateTime.now().setZone(timeZone).toFormat("ZZZZ");
  const values = {
    from: WORK_DAY_START,
    to: WORK_DAY_END,
    officeZone: OFFICE_TZ,
  };

  return (
    <p
      // A viewer sitting in another zone has to be told on every screen size:
      // the grid really is shifted under them. The matching case says nothing
      // they do not already know, so it waits for a screen wide enough to
      // spend a line on it.
      className={`font-mono text-xs ${
        shifted
          ? "text-warning-ink font-semibold"
          : "text-text-tertiary hidden lg:block"
      }`}
    >
      {offset} ·{" "}
      {shifted ? t("timezoneNotice", values) : t("officeHours", values)}
    </p>
  );
}
