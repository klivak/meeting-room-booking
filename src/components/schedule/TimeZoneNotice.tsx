"use client";

import { DateTime } from "luxon";
import { useTranslations } from "next-intl";
import { useSyncExternalStore } from "react";

import {
  noopSubscribe,
  readOfficeTimeZone,
  readViewerTimeZone,
} from "@/components/viewerTimeZone";
import { OFFICE_TZ, WORK_DAY_END, WORK_DAY_START } from "@/lib/domain/constants";
import { showsSameClock } from "@/lib/domain/timezone";

/**
 * Says whose clock the grid is showing. It appears only when the viewer is not
 * in Kyiv, because that is the only case where "09:00" on the axis is not
 * 09:00 for the rooms — in Berlin the office day reads 08:00–18:00.
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
  if (showsSameClock(timeZone, OFFICE_TZ, new Date())) {
    return null;
  }

  return (
    <p className="bg-warning-surface border-warning-border text-warning-ink rounded-control flex max-w-[280px] items-center gap-1.5 border px-2.5 py-1 text-xs leading-snug">
      <span className="font-mono font-semibold">
        {DateTime.now().setZone(timeZone).toFormat("ZZZZ")}
      </span>
      <span>
        {t("timezoneNotice", {
          from: WORK_DAY_START,
          to: WORK_DAY_END,
          officeZone: OFFICE_TZ,
        })}
      </span>
    </p>
  );
}
