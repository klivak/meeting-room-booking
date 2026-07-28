"use client";

import { DateTime } from "luxon";
import { useSyncExternalStore } from "react";

import { OFFICE_TZ, WORK_DAY_END, WORK_DAY_START } from "@/lib/domain/constants";
import {
  DAYS_IN_WEEK,
  SLOT_COUNT,
  getNowMarker,
  getSlotLabels,
  getWeekDays,
  placeBooking,
} from "@/lib/domain/grid";

export type BookingView = {
  id: string;
  title: string;
  startsAt: string;
  endsAt: string;
  user: { id: string; name: string };
  isMine: boolean;
};

type WeekGridProps = {
  /** Office-time midnight of the first day of the week, as an ISO string. */
  weekStart: string;
  bookings: BookingView[];
};

const ROW_HEIGHT_REM = 2.25;

// The viewer's timezone exists only in the browser. The server render, and with
// it the first client render, falls back to office time and swaps afterwards,
// which keeps hydration consistent.
const noopSubscribe = () => () => {};
const readTimeZone = () => Intl.DateTimeFormat().resolvedOptions().timeZone;
const readOfficeTimeZone = () => OFFICE_TZ;

// The "now" line ticks once a minute; it only moves half a row per half hour,
// so anything finer would be wasted work. The snapshot is cached because
// useSyncExternalStore needs a stable value between ticks.
let nowSnapshot = Date.now();

function subscribeToMinuteTick(onChange: () => void) {
  const timer = setInterval(() => {
    nowSnapshot = Date.now();
    onChange();
  }, 60_000);

  return () => clearInterval(timer);
}

const readNow = () => nowSnapshot;
const readNoNow = () => null;

export function WeekGrid({ weekStart, bookings }: WeekGridProps) {
  const timeZone = useSyncExternalStore(
    noopSubscribe,
    readTimeZone,
    readOfficeTimeZone,
  );
  const now = useSyncExternalStore(subscribeToMinuteTick, readNow, readNoNow);

  const weekStartDateTime = DateTime.fromISO(weekStart, { zone: OFFICE_TZ });
  const days = getWeekDays(weekStartDateTime);
  const labels = getSlotLabels(days[0], timeZone);
  const nowMarker = now ? getNowMarker(new Date(now), weekStartDateTime) : null;
  const todayIso = DateTime.now().setZone(OFFICE_TZ).toISODate();

  const formatBookingRange = (booking: BookingView) => {
    const start = DateTime.fromISO(booking.startsAt).setZone(timeZone);
    const end = DateTime.fromISO(booking.endsAt).setZone(timeZone);

    return `${start.toFormat("HH:mm")}–${end.toFormat("HH:mm")}`;
  };

  return (
    <div className="flex flex-col gap-3">
      {timeZone === OFFICE_TZ ? null : (
        <p className="rounded-lg bg-amber-50 px-3 py-2 text-sm text-amber-900">
          Час показано у вашому поясі ({timeZone}). Офіс працює {WORK_DAY_START}–
          {WORK_DAY_END} за {OFFICE_TZ}.
        </p>
      )}

      <div className="overflow-x-auto">
        <div
          className="grid min-w-[48rem]"
          style={{
            gridTemplateColumns: `4rem repeat(${DAYS_IN_WEEK}, minmax(6rem, 1fr))`,
            gridTemplateRows: `auto repeat(${SLOT_COUNT}, ${ROW_HEIGHT_REM}rem)`,
          }}
        >
          {/* Corner above the time axis */}
          <div className="sticky left-0 z-20 border-b border-slate-200 bg-white" />

          {days.map((day) => {
            const isToday = day.toISODate() === todayIso;

            return (
              <div
                key={day.toISODate()}
                className={`border-b border-l border-slate-200 px-2 py-2 text-center text-sm ${
                  isToday ? "bg-indigo-50 font-semibold text-indigo-900" : "text-slate-600"
                }`}
              >
                <div>{day.setLocale("uk").toFormat("ccc")}</div>
                <div className="text-xs text-slate-500">{day.toFormat("dd.MM")}</div>
              </div>
            );
          })}

          {labels.map((label, rowIndex) => (
            <div
              key={label + rowIndex}
              className="sticky left-0 z-20 -mt-2 bg-white pr-2 text-right text-xs text-slate-500"
              style={{ gridColumn: 1, gridRow: rowIndex + 2 }}
            >
              {label}
            </div>
          ))}

          {days.map((day, dayIndex) => {
            const isToday = day.toISODate() === todayIso;

            return Array.from({ length: SLOT_COUNT }, (_, rowIndex) => (
              <div
                key={`${day.toISODate()}-${rowIndex}`}
                className={`border-l border-slate-200 ${
                  // A lighter line inside the hour, a full one between hours.
                  rowIndex % 2 === 0 ? "border-t border-t-slate-200" : "border-t border-t-slate-100"
                } ${isToday ? "bg-indigo-50/40" : ""}`}
                style={{ gridColumn: dayIndex + 2, gridRow: rowIndex + 2 }}
              />
            ));
          })}

          {bookings.map((booking) => {
            const placement = placeBooking(
              {
                startsAt: new Date(booking.startsAt),
                endsAt: new Date(booking.endsAt),
              },
              weekStartDateTime,
            );
            if (!placement) {
              return null;
            }

            const range = formatBookingRange(booking);

            return (
              <div
                key={booking.id}
                className="z-10 m-0.5 overflow-hidden rounded-md px-1.5 py-1 text-xs leading-tight"
                style={{
                  gridColumn: placement.dayIndex + 2,
                  gridRow: `${placement.rowStart + 2} / span ${placement.rowSpan}`,
                  backgroundColor: booking.isMine ? "var(--color-indigo-600)" : "var(--color-slate-200)",
                  color: booking.isMine ? "white" : "var(--color-slate-700)",
                }}
                // Short bookings clip their text, so the full details live in the tooltip.
                title={`${booking.title} · ${booking.user.name} · ${range}`}
              >
                <div className="truncate font-medium">{booking.title}</div>
                <div className="truncate opacity-80">{booking.user.name}</div>
              </div>
            );
          })}

          {nowMarker ? (
            <div
              className="pointer-events-none relative z-20"
              style={{
                gridColumn: nowMarker.dayIndex + 2,
                gridRow: `2 / span ${SLOT_COUNT}`,
              }}
            >
              <div
                className="absolute right-0 left-0 border-t-2 border-red-500"
                style={{ top: `${nowMarker.ratio * 100}%` }}
              >
                <span className="absolute -top-1 -left-1 block h-2 w-2 rounded-full bg-red-500" />
              </div>
            </div>
          ) : null}
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-4 text-xs text-slate-600">
        <span className="flex items-center gap-1.5">
          <span className="h-3 w-3 rounded bg-indigo-600" /> Ваші бронювання
        </span>
        <span className="flex items-center gap-1.5">
          <span className="h-3 w-3 rounded bg-slate-200" /> Бронювання колег
        </span>
        <span className="flex items-center gap-1.5">
          <span className="h-3 w-0.5 bg-red-500" /> Зараз
        </span>
      </div>
    </div>
  );
}
