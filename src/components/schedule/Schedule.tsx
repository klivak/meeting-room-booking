"use client";

import { DateTime } from "luxon";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState, useSyncExternalStore } from "react";

import { BookingBlock, type BookingView } from "@/components/schedule/BookingBlock";
import { SwipeArea } from "@/components/schedule/SwipeArea";
import {
  noopSubscribe,
  readOfficeTimeZone,
  readViewerTimeZone,
} from "@/components/viewerTimeZone";
import { WEEK_START_DAY } from "@/lib/config";
import {
  OFFICE_TZ,
  SLOT_MINUTES,
  WORK_DAY_END,
  WORK_DAY_START,
} from "@/lib/domain/constants";
import {
  DAYS_IN_WEEK,
  SLOT_COUNT,
  formatDuration,
  getNowMarker,
  getSelectionRows,
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
  /** End of the picked range, so a dragged selection stays highlighted whole. */
  selectedSlotEnd?: string;
  /** Id of the own booking picked in the URL, if any. */
  selectedBookingId?: string;
};

const ROW_HEIGHT_REM = 2.25;
// Taller rows on a phone: a half-hour slot is a tap target, not just a line.
const DAY_ROW_HEIGHT_REM = 3;

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
  selectedSlotEnd,
  selectedBookingId,
}: ScheduleProps) {
  const router = useRouter();
  const timeZone = useSyncExternalStore(
    noopSubscribe,
    readViewerTimeZone,
    readOfficeTimeZone,
  );
  const now = useSyncExternalStore(subscribeToMinuteTick, readNow, readNoNow);

  // Rows being dragged over right now; null when nothing is being selected.
  const [drag, setDrag] = useState<{
    dayIndex: number;
    anchorRow: number;
    focusRow: number;
  } | null>(null);

  const weekStartDateTime = DateTime.fromISO(weekStart, { zone: OFFICE_TZ });
  const days = getWeekDays(weekStartDateTime);
  const labels = getSlotLabels(days[0], timeZone);
  const nowMarker = now ? getNowMarker(new Date(now), weekStartDateTime) : null;
  const todayIso = DateTime.now().setZone(OFFICE_TZ).toISODate();
  const weekParam = weekStartDateTime.toISODate();

  const selectedSlotStart = selectedSlot ? DateTime.fromISO(selectedSlot) : null;
  const selectedSlotEndTime = selectedSlotEnd
    ? DateTime.fromISO(selectedSlotEnd)
    : null;

  // Which pointer started the last interaction, so a mouse click is not handled
  // twice: once by the drag and once by the click that follows it.
  const lastPointerType = useRef<string | null>(null);
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

  /** Opens the booking form for a row range of one day. */
  const openForm = (formDay: DateTime, rowStart: number, rowEnd: number) => {
    const start = getSlotStart(formDay, rowStart).toUTC().toISO() ?? "";
    const end = getSlotStart(formDay, rowEnd).toUTC().toISO() ?? "";

    router.push(
      `/rooms/${roomId}?week=${weekParam}&slot=${encodeURIComponent(start)}&slotEnd=${encodeURIComponent(end)}`,
      { scroll: false },
    );
  };

  /**
   * One empty half hour. A click books that slot, dragging across several picks
   * the whole range.
   *
   * Dragging is bound to the mouse only: on a touch screen a horizontal drag is
   * how the day view is swiped, and a vertical one is how the page scrolls, so
   * a finger keeps the plain tap.
   */
  const renderCell = (
    cellDay: DateTime,
    rowIndex: number,
    dayIndex: number,
    gridColumn: number,
    keyPrefix: string,
  ) => {
    const start = getSlotStart(cellDay, rowIndex);
    // A click selects one cell, a dragged range selects everything up to its end.
    const isSelected =
      selectedSlotStart?.isValid === true &&
      +start >= +selectedSlotStart &&
      (selectedSlotEndTime?.isValid === true
        ? +start < +selectedSlotEndTime
        : +start === +selectedSlotStart);
    const isToday = cellDay.toISODate() === todayIso;
    const isInDrag =
      drag?.dayIndex === dayIndex &&
      rowIndex >= getSelectionRows(drag.anchorRow, drag.focusRow).rowStart &&
      rowIndex < getSelectionRows(drag.anchorRow, drag.focusRow).rowEnd;

    return (
      <button
        key={`${keyPrefix}-${cellDay.toISODate()}-${rowIndex}`}
        type="button"
        onPointerDown={(event) => {
          lastPointerType.current = event.pointerType;
          if (event.pointerType !== "mouse") {
            return;
          }
          // Keeps the browser from selecting text across the cells.
          event.preventDefault();
          setDrag({ dayIndex, anchorRow: rowIndex, focusRow: rowIndex });
        }}
        onPointerEnter={() => {
          if (drag && drag.dayIndex === dayIndex) {
            setDrag({ ...drag, focusRow: rowIndex });
          }
        }}
        onClick={(event) => {
          // A mouse release is handled by the drag, so this is a touch or a
          // keyboard activation.
          if (event.detail !== 0 && lastPointerType.current === "mouse") {
            return;
          }
          openForm(cellDay, rowIndex, rowIndex + 1);
        }}
        aria-label={`Забронювати ${cellDay.setLocale("uk").toFormat("ccc dd.MM")}, ${
          labels[rowIndex]
        }`}
        className={`border-l border-slate-200 transition hover:bg-indigo-100/60 focus-visible:z-20 focus-visible:ring-2 focus-visible:ring-indigo-500 focus-visible:ring-inset focus-visible:outline-none ${
          // A lighter line inside the hour, a full one between hours.
          rowIndex % 2 === 0 ? "border-t border-t-slate-200" : "border-t border-t-slate-100"
        } ${isToday ? "bg-indigo-50/40" : ""} ${
          isInDrag ? "bg-indigo-200/70" : ""
        } ${isSelected ? "z-10 bg-indigo-100 ring-2 ring-indigo-500 ring-inset" : ""}`}
        style={{ gridColumn, gridRow: rowIndex + 2 }}
      />
    );
  };

  // The release can happen anywhere, including outside the grid, so the whole
  // window is listened to rather than the cells.
  useEffect(() => {
    if (!drag) {
      return;
    }

    const finish = () => {
      const { rowStart, rowEnd } = getSelectionRows(drag.anchorRow, drag.focusRow);
      setDrag(null);
      openForm(days[drag.dayIndex], rowStart, rowEnd);
    };

    window.addEventListener("pointerup", finish);
    return () => window.removeEventListener("pointerup", finish);
  });

  /** Shows what the current drag would book, with its duration. */
  const renderDragPreview = (dayIndex: number, gridColumn: number) => {
    if (!drag || drag.dayIndex !== dayIndex) {
      return null;
    }

    const { rowStart, rowEnd } = getSelectionRows(drag.anchorRow, drag.focusRow);
    const previewDay = days[dayIndex];
    const from = getSlotStart(previewDay, rowStart).setZone(timeZone).toFormat("HH:mm");
    const to = getSlotStart(previewDay, rowEnd).setZone(timeZone).toFormat("HH:mm");

    return (
      <div
        className="pointer-events-none z-20 m-0.5 flex items-center justify-center rounded-md bg-indigo-600 px-1.5 text-center text-xs leading-tight font-medium text-white"
        style={{
          gridColumn,
          gridRow: `${rowStart + 2} / span ${rowEnd - rowStart}`,
        }}
      >
        {from}–{to} · {formatDuration((rowEnd - rowStart) * SLOT_MINUTES)}
      </div>
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

  /**
   * The "now" line, drawn across every day and labelled with the time, the way a
   * calendar does it. It only exists inside the office day: outside 09:00-19:00
   * there is nothing on the grid for it to point at.
   */
  const nowLine = (columnSpan: number) => {
    if (!nowMarker || now === null) {
      return null;
    }

    return (
      <div
        className="pointer-events-none relative z-30"
        style={{ gridColumn: `1 / span ${columnSpan}`, gridRow: `2 / span ${SLOT_COUNT}` }}
      >
        <div
          className="absolute right-0 left-0 border-t-2 border-red-500"
          style={{ top: `${nowMarker.ratio * 100}%` }}
        >
          <span className="absolute -top-2 left-0 rounded-sm bg-red-500 px-1 text-[10px] leading-4 font-medium text-white">
            {DateTime.fromMillis(now).setZone(timeZone).toFormat("HH:mm")}
          </span>
        </div>
      </div>
    );
  };

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
            className="flex min-h-11 min-w-11 items-center justify-center rounded-lg border border-slate-300 text-slate-700 focus-visible:ring-2 focus-visible:ring-slate-400 focus-visible:outline-none"
          >
            ←
          </Link>
          <span className="text-sm font-medium text-slate-900">
            {day.setLocale("uk").toFormat("cccc, d MMMM")}
          </span>
          <Link
            href={dayHref(day.plus({ days: 1 }))}
            aria-label="Наступний день"
            className="flex min-h-11 min-w-11 items-center justify-center rounded-lg border border-slate-300 text-slate-700 focus-visible:ring-2 focus-visible:ring-slate-400 focus-visible:outline-none"
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
                className={`flex min-h-11 shrink-0 items-center rounded-lg border px-3 text-xs ${
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

        <SwipeArea
          prevHref={dayHref(day.minus({ days: 1 }))}
          nextHref={dayHref(day.plus({ days: 1 }))}
        >
          <div
            className="grid"
            style={{
              gridTemplateColumns: "4rem minmax(0, 1fr)",
              gridTemplateRows: `auto repeat(${SLOT_COUNT}, ${DAY_ROW_HEIGHT_REM}rem)`,
            }}
          >
            <div className="border-b border-slate-200" />
            <div className="border-b border-l border-slate-200" />

            {timeAxis("day")}
            {Array.from({ length: SLOT_COUNT }, (_, rowIndex) =>
              renderCell(day, rowIndex, dayIndex, 2, "day"),
            )}
            {placements
              .filter((entry) => entry.placement!.dayIndex === dayIndex)
              .map((entry) => renderBooking(entry.booking, entry.placement!, 2, "day"))}
            {renderDragPreview(dayIndex, 2)}
            {nowMarker?.dayIndex === dayIndex ? nowLine(2) : null}
          </div>
        </SwipeArea>
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
              renderCell(option, rowIndex, index, index + 2, "week"),
            ),
          )}

          {placements.map((entry) =>
            renderBooking(entry.booking, entry.placement!, entry.placement!.dayIndex + 2, "week"),
          )}

          {days.map((_, index) => renderDragPreview(index, index + 2))}

          {nowLine(DAYS_IN_WEEK + 1)}
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
