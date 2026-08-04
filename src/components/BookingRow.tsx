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
    // A card per row rather than rules between rows: the list is short, the
    // rows are tall, and the next meeting has to be able to lift out of it.
    <li
      className={`bg-surface rounded-card relative flex flex-wrap items-center gap-3 px-5 py-4 sm:flex-nowrap sm:gap-[18px] ${
        highlight
          ? "shadow-[0_0_0_1.5px_var(--color-accent-own-booking),0_12px_30px_-16px_var(--color-accent-glow)]"
          : "border-border-grid shadow-rest border"
      }`}
    >
      {/* The one row worth finding on this page says so, in a tag that sits on
          its edge instead of taking a line of its own. */}
      {highlight ? (
        <span className="bg-accent-own-ink absolute -top-2 left-5 rounded-md px-2 py-0.5 text-[10px] font-bold text-white">
          {t("nextMeeting")}
        </span>
      ) : null}
      <Link
        href={`/rooms/${booking.room.id}?week=${week}`}
        className="focus-ring min-w-0 flex-1 rounded text-inherit no-underline"
      >
        <span className="flex min-w-0 flex-wrap items-center gap-2">
          <span className="truncate text-base font-bold tracking-[-0.01em]">
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
        <span className="text-text-tertiary mt-1 block text-[13px]">
          {booking.room.name}
        </span>
      </Link>

      {/* Time and date in their own column: what this page is really scanned for
          is the clock, so it lines up rather than sitting inside a sentence. */}
      <span className="flex flex-none flex-col items-start sm:w-[168px] sm:items-end">
        <span className="font-mono text-[15px] font-semibold">
          {start.toFormat("HH:mm")} – {end.toFormat("HH:mm")}
        </span>
        <span className="text-text-secondary font-mono text-[13px]">
          {start.toFormat("ccc, dd.MM")}
        </span>
      </span>

      {actions ? <span className="flex flex-none gap-2">{actions}</span> : null}
    </li>
  );
}
