"use client";

import { DateTime } from "luxon";
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
  actions?: React.ReactNode;
};

/**
 * One row of the my-bookings list. Times are shown in the viewer's timezone,
 * while the link points at the office week that contains the booking — the same
 * week the grid would open.
 */
export function BookingRow({ booking, now, actions }: BookingRowProps) {
  const timeZone = useSyncExternalStore(
    noopSubscribe,
    readViewerTimeZone,
    readOfficeTimeZone,
  );

  const start = DateTime.fromISO(booking.startsAt).setZone(timeZone).setLocale("uk");
  const end = DateTime.fromISO(booking.endsAt).setZone(timeZone);
  const isRunning = booking.startsAt <= now && booking.endsAt > now;

  const week = getWeekStart(
    DateTime.fromISO(booking.startsAt).setZone(OFFICE_TZ),
    WEEK_START_DAY,
  ).toISODate();

  return (
    <li className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-slate-200 bg-white p-4">
      <Link
        href={`/rooms/${booking.room.id}?week=${week}`}
        className="min-w-0 flex-1 rounded focus-visible:ring-2 focus-visible:ring-slate-400 focus-visible:ring-offset-2 focus-visible:outline-none"
      >
        <span className="flex flex-wrap items-center gap-2">
          <span className="font-medium text-slate-900">{booking.title}</span>
          {isRunning ? <Badge tone="success">зараз</Badge> : null}
          {booking.isRecurring ? <Badge>щотижня</Badge> : null}
        </span>
        <span className="mt-1 block text-sm text-slate-600">
          {start.toFormat("ccc, d MMMM")} · {start.toFormat("HH:mm")}–
          {end.toFormat("HH:mm")} · {booking.room.name}
        </span>
      </Link>

      {actions ? <div className="flex items-center gap-2">{actions}</div> : null}
    </li>
  );
}
