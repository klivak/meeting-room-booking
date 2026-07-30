"use client";

import { Repeat } from "lucide-react";
import { DateTime } from "luxon";
import { useLocale, useTranslations } from "next-intl";
import Link from "next/link";
import { useSyncExternalStore } from "react";

import { Badge } from "@/components/ui/Badge";
import {
  noopSubscribe,
  readOfficeTimeZone,
  readViewerTimeZone,
} from "@/components/viewerTimeZone";
import { WEEK_START_DAY } from "@/lib/config";
import { OFFICE_TZ } from "@/lib/domain/constants";
import { getWeekStart } from "@/lib/domain/week";

export type MyBooking = {
  id: string;
  title: string;
  startsAt: string;
  endsAt: string;
  room: { id: string; name: string };
  isRecurring: boolean;
};

type BookingRowProps = {
  booking: MyBooking;
  /** Server time, so the "running now" badge is decided once, not per render. */
  now: string;
  /** The next meeting, marked because "when is it" is why this page is opened. */
  highlight?: boolean;
  actions?: React.ReactNode;
};

/**
 * One row of the my-bookings list. Times are shown in the viewer's timezone,
 * while the link points at the office week that contains the booking — the same
 * week the grid would open.
 */
export function BookingRow({ booking, now, highlight = false, actions }: BookingRowProps) {
  const t = useTranslations("myBookings");
  const tSchedule = useTranslations("schedule");
  // Month names and weekday names follow the chosen language, not the office.
  const locale = useLocale();
  const timeZone = useSyncExternalStore(
    noopSubscribe,
    readViewerTimeZone,
    readOfficeTimeZone,
  );

  const start = DateTime.fromISO(booking.startsAt).setZone(timeZone).setLocale(locale);
  const end = DateTime.fromISO(booking.endsAt).setZone(timeZone);
  const isRunning = booking.startsAt <= now && booking.endsAt > now;

  const week = getWeekStart(
    DateTime.fromISO(booking.startsAt).setZone(OFFICE_TZ),
    WEEK_START_DAY,
  ).toISODate();

  return (
    <li
      className={`border-border-grid-half flex flex-wrap items-center gap-3 border-b px-4 py-3.5 last:border-b-0 sm:flex-nowrap sm:gap-4 sm:px-5 ${
        highlight
          ? "bg-accent-own-surface shadow-[inset_3px_0_0_var(--color-accent-own-booking)]"
          : ""
      }`}
    >
      <Link
        href={`/rooms/${booking.room.id}?week=${week}`}
        className="focus-ring min-w-0 flex-1 rounded text-inherit no-underline"
      >
        <span className="flex min-w-0 flex-wrap items-center gap-1.5">
          <span className="truncate text-[15px] font-semibold tracking-tight">
            {booking.title}
          </span>
          {isRunning ? <Badge tone="success">{t("running")}</Badge> : null}
          {booking.isRecurring ? (
            <Badge>
              <Repeat aria-hidden="true" className="mr-1 size-3" />
              {tSchedule("recurring")}
            </Badge>
          ) : null}
        </span>
        <span className="text-text-tertiary mt-0.5 block text-[13px]">
          {booking.room.name}
        </span>
      </Link>

      {/* Time and date in their own column: what this page is really scanned for
          is the clock, so it lines up rather than sitting inside a sentence. */}
      <span className="flex flex-none flex-col items-start sm:w-[170px] sm:items-end">
        <span className="font-mono text-sm font-semibold">
          {start.toFormat("HH:mm")} – {end.toFormat("HH:mm")}
        </span>
        <span className="text-text-tertiary text-xs">{start.toFormat("ccc, dd.MM")}</span>
      </span>

      {actions ? <span className="flex flex-none gap-2">{actions}</span> : null}
    </li>
  );
}
