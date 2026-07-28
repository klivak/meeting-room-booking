"use client";

import { DateTime } from "luxon";
import Link from "next/link";
import { useSyncExternalStore } from "react";

import { BookingBlock, type BookingView } from "@/components/schedule/BookingBlock";
import {
  noopSubscribe,
  readOfficeTimeZone,
  readViewerTimeZone,
} from "@/components/viewerTimeZone";
import { WEEK_START_DAY } from "@/lib/config";
import { OFFICE_TZ, WORK_DAY_END, WORK_DAY_START } from "@/lib/domain/constants";
import {
  DAYS_IN_WEEK,
  SLOT_COUNT,
  getNowMarker,
  getSlotLabels,
  getSlotStart,
  getWeekDays,
  placeBooking,
} from "@/lib/domain/grid";
import { getWeekStart } from "@/lib/domain/week";

export type { BookingView };

type ScheduleProps = {
  roomId: string;
  /** Office-time midnight of the first day of the week, as an ISO string. */
  weekStart: string;
  bookings: BookingView[];
  /** Server time, so both renders agree on which bookings are still editable. */
  now: string;
  /** Office date shown by the single-day view on narrow screens. */
  selectedDay: string;
  /** Start of the free slot picked in the URL, if any. */
  selectedSlot?: string;
  /** Id of the own booking picked in the URL, if any. */
  selectedBookingId?: string;
};

const ROW_HEIGHT_REM = 2.25;

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

/**
 * The room schedule. A week of columns on a wide screen and a single day on a
 * narrow one: seven columns on a phone would be unreadable, and the two views
 * share every cell and block through the helpers below.
 */
export function Schedule({
  roomId,
  weekStart,
  bookings,
  now: serverNow,
  selectedDay,
  selectedSlot,
  selectedBookingId,
}: ScheduleProps) {
  const timeZone = useSyncExternalStore(
    noopSubscribe,
    readViewerTimeZone,
    readOfficeTimeZone,
  );
  const now = useSyncExternalStore(subscribeToMinuteTick, readNow, readNoNow);

  const weekStartDateTime = DateTime.fromISO(weekStart, { zone: OFFICE_TZ });
  const days = getWeekDays(weekStartDateTime);
  const labels = getSlotLabels(days[0], timeZone);
  const nowMarker = now ? getNowMarker(new Date(now), weekStartDateTime) : null;
  const todayIso = DateTime.now().setZone(OFFICE_TZ).toISODate();
  const weekParam = weekStartDateTime.toISODate();

  const selectedSlotStart = selectedSlot ? DateTime.fromISO(selectedSlot) : null;
  const dayIndex = Math.max(
    0,
    days.findIndex((day) => day.toISODate() === selectedDay),
  );
  const day = days[dayIndex];

  /** Link to another day, moving to the neighbouring week when it runs out. */
  const dayHref = (target: DateTime) =>
    `/rooms/${roomId}?week=${getWeekStart(target, WEEK_START_DAY).toISODate()}&day=${target.toISODate()}`;

  const formatRange = (booking: BookingView) => {
    const start = DateTime.fromISO(booking.startsAt).setZone(timeZone);
    const end = DateTime.fromISO(booking.endsAt).setZone(timeZone);

    return `${start.toFormat("HH:mm")}–${end.toFormat("HH:mm")}`;
  };

  /** One empty half hour. Clicking it picks that slot as a booking start. */
  const renderCell = (
    cellDay: DateTime,
    rowIndex: number,
    gridColumn: number,
    keyPrefix: string,
  ) => {
    const start = getSlotStart(cellDay, rowIndex);
    const startIso = start.toUTC().toISO() ?? "";
    const isSelected =
      selectedSlotStart?.isValid === true && +selectedSlotStart === +start;
    const isToday = cellDay.toISODate() === todayIso;

    return (
      <Link
        key={`${keyPrefix}-${cellDay.toISODate()}-${rowIndex}`}
        href={`/rooms/${roomId}?week=${weekParam}&slot=${encodeURIComponent(startIso)}`}
        scroll={false}
        aria-label={`Забронювати ${cellDay.setLocale("uk").toFormat("ccc dd.MM")}, ${
          labels[rowIndex]
        }`}
        className={`border-l border-slate-200 transition hover:bg-indigo-100/60 focus-visible:z-20 focus-visible:ring-2 focus-visible:ring-indigo-500 focus-visible:ring-inset focus-visible:outline-none ${
          // A lighter line inside the hour, a full one between hours.
          rowIndex % 2 === 0 ? "border-t border-t-slate-200" : "border-t border-t-slate-100"
        } ${isToday ? "bg-indigo-50/40" : ""} ${
          isSelected ? "z-10 bg-indigo-100 ring-2 ring-indigo-500 ring-inset" : ""
        }`}
        style={{ gridColumn, gridRow: rowIndex + 2 }}
      />
    );
  };

  /** One booking, placed into the given column of whichever view is drawing it. */
  const renderBooking = (
    booking: BookingView,
    placement: { rowStart: number; rowSpan: number },
    gridColumn: number,
    keyPrefix: string,
  ) => {
    // A finished booking can no longer be edited or canceled, so it offers no
    // action even to its author.
    const isEditable = booking.isMine && booking.endsAt > serverNow;

    return (
      <BookingBlock
        key={`${keyPrefix}-${booking.id}`}
        booking={booking}
        range={formatRange(booking)}
        href={
          isEditable
            ? `/rooms/${roomId}?week=${weekParam}&booking=${booking.id}`
            : undefined
        }
        isSelected={booking.id === selectedBookingId}
        style={{
          gridColumn,
          gridRow: `${placement.rowStart + 2} / span ${placement.rowSpan}`,
        }}
      />
    );
  };

  const placements = bookings
    .map((booking) => ({
      booking,
      placement: placeBooking(
        { startsAt: new Date(booking.startsAt), endsAt: new Date(booking.endsAt) },
        weekStartDateTime,
      ),
    }))
    .filter((entry) => entry.placement !== null);

  const nowLine = (gridColumn: number) => (
    <div
      className="pointer-events-none relative z-20"
      style={{ gridColumn, gridRow: `2 / span ${SLOT_COUNT}` }}
    >
      <div
        className="absolute right-0 left-0 border-t-2 border-red-500"
        style={{ top: `${(nowMarker?.ratio ?? 0) * 100}%` }}
      >
        <span className="absolute -top-1 -left-1 block h-2 w-2 rounded-full bg-red-500" />
      </div>
    </div>
  );

  const timeAxis = (keyPrefix: string) =>
    labels.map((label, rowIndex) => (
      <div
        key={`${keyPrefix}-${label}-${rowIndex}`}
        className="sticky left-0 z-20 -mt-2 bg-white pr-2 text-right text-xs text-slate-500"
        style={{ gridColumn: 1, gridRow: rowIndex + 2 }}
      >
        {label}
      </div>
    ));

  return (
    <div className="flex flex-col gap-3">
      {timeZone === OFFICE_TZ ? null : (
        <p className="rounded-lg bg-amber-50 px-3 py-2 text-sm text-amber-900">
          Час показано у вашому поясі ({timeZone}). Офіс працює {WORK_DAY_START}–
          {WORK_DAY_END} за {OFFICE_TZ}.
        </p>
      )}

      {/* Single day: a phone has no room for seven columns. */}
      <div className="flex flex-col gap-2 sm:hidden">
        <div className="flex items-center justify-between gap-2">
          <Link
            href={dayHref(day.minus({ days: 1 }))}
            aria-label="Попередній день"
            className="rounded-lg border border-slate-300 px-4 py-2 text-slate-700 focus-visible:ring-2 focus-visible:ring-slate-400 focus-visible:outline-none"
          >
            ←
          </Link>
          <span className="text-sm font-medium text-slate-900">
            {day.setLocale("uk").toFormat("cccc, d MMMM")}
          </span>
          <Link
            href={dayHref(day.plus({ days: 1 }))}
            aria-label="Наступний день"
            className="rounded-lg border border-slate-300 px-4 py-2 text-slate-700 focus-visible:ring-2 focus-visible:ring-slate-400 focus-visible:outline-none"
          >
            →
          </Link>
        </div>

        <div className="flex gap-1 overflow-x-auto pb-1">
          {days.map((option) => {
            const isSelected = option.toISODate() === day.toISODate();

            return (
              <Link
                key={option.toISODate()}
                href={dayHref(option)}
                aria-current={isSelected ? "page" : undefined}
                className={`shrink-0 rounded-lg border px-3 py-1.5 text-xs ${
                  isSelected
                    ? "border-slate-900 bg-slate-900 text-white"
                    : option.toISODate() === todayIso
                      ? "border-indigo-300 bg-indigo-50 text-indigo-900"
                      : "border-slate-300 text-slate-700"
                }`}
              >
                {option.setLocale("uk").toFormat("ccc dd.MM")}
              </Link>
            );
          })}
        </div>

        <div
          className="grid"
          style={{
            gridTemplateColumns: "4rem minmax(0, 1fr)",
            gridTemplateRows: `auto repeat(${SLOT_COUNT}, ${ROW_HEIGHT_REM}rem)`,
          }}
        >
          <div className="border-b border-slate-200" />
          <div className="border-b border-l border-slate-200" />

          {timeAxis("day")}
          {Array.from({ length: SLOT_COUNT }, (_, rowIndex) =>
            renderCell(day, rowIndex, 2, "day"),
          )}
          {placements
            .filter((entry) => entry.placement!.dayIndex === dayIndex)
            .map((entry) => renderBooking(entry.booking, entry.placement!, 2, "day"))}
          {nowMarker?.dayIndex === dayIndex ? nowLine(2) : null}
        </div>
      </div>

      {/* Whole week. Wide screens scroll it sideways; the time column stays put
          via position: sticky, so the rows never lose their labels. */}
      <div className="hidden overflow-x-auto sm:block">
        <div
          className="grid min-w-[48rem]"
          style={{
            gridTemplateColumns: `4rem repeat(${DAYS_IN_WEEK}, minmax(6rem, 1fr))`,
            gridTemplateRows: `auto repeat(${SLOT_COUNT}, ${ROW_HEIGHT_REM}rem)`,
          }}
        >
          {/* Corner above the time axis */}
          <div className="sticky left-0 z-20 border-b border-slate-200 bg-white" />

          {days.map((option) => {
            const isToday = option.toISODate() === todayIso;

            return (
              <div
                key={option.toISODate()}
                className={`border-b border-l border-slate-200 px-2 py-2 text-center text-sm ${
                  isToday ? "bg-indigo-50 font-semibold text-indigo-900" : "text-slate-600"
                }`}
              >
                <div>{option.setLocale("uk").toFormat("ccc")}</div>
                <div className="text-xs text-slate-500">{option.toFormat("dd.MM")}</div>
              </div>
            );
          })}

          {timeAxis("week")}

          {days.map((option, index) =>
            Array.from({ length: SLOT_COUNT }, (_, rowIndex) =>
              renderCell(option, rowIndex, index + 2, "week"),
            ),
          )}

          {placements.map((entry) =>
            renderBooking(entry.booking, entry.placement!, entry.placement!.dayIndex + 2, "week"),
          )}

          {nowMarker ? nowLine(nowMarker.dayIndex + 2) : null}
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
