"use client";

import { DateTime } from "luxon";
import { useLocale, useTranslations } from "next-intl";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState, useSyncExternalStore } from "react";

import { showToast } from "@/components/toast";
import {
  BookingBlock,
  type BookingState,
  type BookingView,
} from "@/components/schedule/BookingBlock";
import {
  DAY_ROW_H,
  HEADER_REM,
  ROW_H,
  rowSpan,
} from "@/components/schedule/geometry";
import { SwipeArea } from "@/components/schedule/SwipeArea";
import {
  noopSubscribe,
  readOfficeTimeZone,
  readViewerTimeZone,
} from "@/components/viewerTimeZone";
import { WEEK_START_DAY } from "@/lib/config";
import { OFFICE_TZ, SLOT_MINUTES } from "@/lib/domain/constants";
import {
  DAYS_IN_WEEK,
  SLOT_COUNT,
  splitDuration,
  getNowMarker,
  getSelectionRows,
  getSlotLabels,
  getSlotStart,
  getWeekDays,
  placeBooking,
} from "@/lib/domain/grid";
import { intervalsOverlap } from "@/lib/domain/overlap";
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
  /** False until the address is confirmed; the grid then only shows, never books. */
  canBook: boolean;
};

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

/** Picks the phrasing the duration needs: minutes only, whole hours, or both. */
function durationLabel(
  totalMinutes: number,
  t: (key: string, values?: Record<string, number>) => string,
) {
  const { hours, minutes } = splitDuration(totalMinutes);

  if (hours === 0) return t("minutes", { count: minutes });
  if (minutes === 0) return t("hours", { count: hours });

  return t("hoursMinutes", { hours, minutes });
}

/** Rows of one day that are already over, used to grey out the past. */
function pastRows(day: DateTime, now: number | null): number {
  if (now === null) {
    return 0;
  }

  const moment = DateTime.fromMillis(now).setZone(OFFICE_TZ);
  const date = day.toISODate();

  if ((moment.toISODate() ?? "") > (date ?? "")) return SLOT_COUNT;
  if ((moment.toISODate() ?? "") < (date ?? "")) return 0;

  const elapsed = +moment - +getSlotStart(day, 0);

  return Math.max(0, Math.min(SLOT_COUNT, Math.floor(elapsed / (SLOT_MINUTES * 60_000))));
}

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
  canBook,
}: ScheduleProps) {
  const router = useRouter();
  const t = useTranslations("schedule");
  const tDuration = useTranslations("duration");
  // Weekday and month names follow the chosen language.
  const locale = useLocale();
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

  // The one cell that answers Tab. Everything else is reached with the arrow
  // keys, so the grid costs one stop instead of a hundred and forty.
  const [focusCell, setFocusCell] = useState({ column: 0, row: 0 });

  // The range just picked, held until the address catches up. Picking a slot is
  // a navigation, and the server needs a moment to answer it; without this the
  // grid keeps showing the previous selection for that moment, which reads as a
  // blink onto the old slot and then a jump to the new one.
  const [justPicked, setJustPicked] = useState<{
    dayIndex: number;
    rowStart: number;
    rowEnd: number;
  } | null>(null);

  // Once the address carries the new range, the local copy has done its job.
  // Adjusting state during the render is what React prescribes here: an effect
  // would show one frame of the stale selection first.
  const urlSelection = `${selectedSlot ?? ""}|${selectedSlotEnd ?? ""}`;
  const [lastUrlSelection, setLastUrlSelection] = useState(urlSelection);
  if (urlSelection !== lastUrlSelection) {
    setLastUrlSelection(urlSelection);
    setJustPicked(null);
  }

  const weekStartDateTime = DateTime.fromISO(weekStart, { zone: OFFICE_TZ });
  const days = getWeekDays(weekStartDateTime);
  const labels = getSlotLabels(days[0], timeZone);
  const nowMarker = now ? getNowMarker(new Date(now), weekStartDateTime) : null;
  const todayIso = DateTime.now().setZone(OFFICE_TZ).toISODate();
  const weekParam = weekStartDateTime.toISODate();

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

  const formatTime = (iso: string) =>
    DateTime.fromISO(iso).setZone(timeZone).toFormat("HH:mm");

  /** Opens the booking form for a row range of one day. */
  const openForm = (formDay: DateTime, rowStart: number, rowEnd: number) => {
    if (!canBook) {
      // The banner under the header already says why; the toast says it again
      // at the moment the user tried, which is when it matters.
      showToast(t("verifyFirst"));
      return;
    }

    const start = getSlotStart(formDay, rowStart).toUTC().toISO() ?? "";
    const end = getSlotStart(formDay, rowEnd).toUTC().toISO() ?? "";

    setJustPicked({
      dayIndex: days.findIndex((option) => option.hasSame(formDay, "day")),
      rowStart,
      rowEnd,
    });

    router.push(
      `/rooms/${roomId}?week=${weekParam}&slot=${encodeURIComponent(start)}&slotEnd=${encodeURIComponent(end)}`,
      { scroll: false },
    );
  };

  /**
   * Arrow keys move the focus between cells, Enter books the focused half hour.
   * This is the whole point of the roving tabindex: a time range has to be
   * pickable without a mouse, and dragging is only a shortcut for those who have one.
   */
  const moveFocus = (prefix: string, nextColumn: number, nextRow: number) => {
    const target = document.querySelector<HTMLElement>(
      `[data-cell="${prefix}-${nextColumn}-${nextRow}"]`,
    );
    if (!target) {
      return;
    }

    setFocusCell({ column: nextColumn, row: nextRow });
    target.focus();
  };

  /**
   * One empty half hour. A click books that slot, dragging across several picks
   * the whole range.
   *
   * Dragging is bound to the mouse only: on a touch screen a horizontal drag is
   * how the day view is swiped, and a vertical one is how the page scrolls, so
   * a finger keeps the plain tap.
   */
  const renderCell = ({
    cellDay,
    rowIndex,
    dayIndex: cellDayIndex,
    columnIndex,
    prefix,
    lastColumn,
    rowHeight,
  }: {
    cellDay: DateTime;
    rowIndex: number;
    /** Day of the displayed week, which is what a drag and the form are about. */
    dayIndex: number;
    /** Column within this view: the day view has one, the week view seven. */
    columnIndex: number;
    prefix: string;
    lastColumn: number;
    rowHeight: string;
  }) => {
    const isHour = rowIndex % 2 === 0;

    return (
      <button
        key={`${prefix}-${rowIndex}`}
        type="button"
        data-cell={`${prefix}-${columnIndex}-${rowIndex}`}
        // One stop for the whole grid; the arrows do the rest. It is keyed
        // to the column rather than to the weekday, so the single-column day
        // view always has one too.
        tabIndex={
          focusCell.column === columnIndex && focusCell.row === rowIndex ? 0 : -1
        }
        aria-disabled={canBook ? undefined : true}
        onFocus={() => setFocusCell({ column: columnIndex, row: rowIndex })}
        onPointerDown={(event) => {
          lastPointerType.current = event.pointerType;
          if (event.pointerType !== "mouse" || !canBook) {
            return;
          }
          // Keeps the browser from selecting text across the cells.
          event.preventDefault();
          setDrag({ dayIndex: cellDayIndex, anchorRow: rowIndex, focusRow: rowIndex });
        }}
        onPointerEnter={() => {
          if (drag && drag.dayIndex === cellDayIndex) {
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
        onKeyDown={(event) => {
          const moves: Record<string, [number, number]> = {
            ArrowUp: [columnIndex, rowIndex - 1],
            ArrowDown: [columnIndex, rowIndex + 1],
            ArrowLeft: [columnIndex - 1, rowIndex],
            ArrowRight: [columnIndex + 1, rowIndex],
            Home: [columnIndex, 0],
            End: [columnIndex, SLOT_COUNT - 1],
          };

          const move = moves[event.key];
          if (!move || event.altKey) {
            return;
          }

          const [nextColumn, nextRow] = move;
          if (
            nextColumn < 0 ||
            nextColumn > lastColumn ||
            nextRow < 0 ||
            nextRow >= SLOT_COUNT
          ) {
            return;
          }

          event.preventDefault();
          moveFocus(prefix, nextColumn, nextRow);
        }}
        aria-label={t("book", {
          day: cellDay.setLocale(locale).toFormat("cccc dd.MM"),
          time: labels[rowIndex],
        })}
        className={`focus-ring-inset group relative flex items-center justify-center border-t transition ${
          // A full line between hours, a lighter one inside them: that contrast
          // is what stops twenty equal rows from reading as a spreadsheet.
          rowIndex === 0
            ? "border-t-transparent"
            : isHour
              ? "border-t-border-grid"
              : "border-t-border-grid-half"
        } ${canBook ? "hover:bg-surface-muted cursor-pointer" : "cursor-default"}`}
        style={{ height: rowHeight }}
      >
        {/* The hovered cell names its own time: the axis is far away once the
            pointer is deep inside the week. */}
        <span className="text-text-tertiary pointer-events-none font-mono text-xs sm:text-[11px] xl:text-xs opacity-0 group-hover:opacity-100 group-focus-visible:opacity-100">
          {labels[rowIndex]}
        </span>
      </button>
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

  const placements = bookings
    .map((booking) => ({
      booking,
      placement: placeBooking(
        { startsAt: new Date(booking.startsAt), endsAt: new Date(booking.endsAt) },
        weekStartDateTime,
      ),
    }))
    .filter((entry) => entry.placement !== null);

  /** One booking, placed into whichever column is drawing it. */
  const renderBooking = (
    booking: BookingView,
    placement: { rowStart: number; rowSpan: number },
    rowHeight: string,
    keyPrefix: string,
    /** True where one row is too short for two lines, which is the week view. */
    singleRowIsTight: boolean,
  ) => {
    // A finished booking can no longer be edited or canceled, so it offers no
    // action even to its author.
    const isEditable = booking.isMine && booking.endsAt > serverNow;
    const state: BookingState = booking.isMine
      ? isEditable
        ? "own"
        : "finished"
      : "other";

    return (
      <BookingBlock
        key={`${keyPrefix}-${booking.id}`}
        booking={booking}
        state={state}
        range={`${formatTime(booking.startsAt)}–${formatTime(booking.endsAt)}`}
        start={formatTime(booking.startsAt)}
        // One row leaves a single line; from an hour up the time and the title
        // get a line each.
        compact={placement.rowSpan === 1 && singleRowIsTight}
        href={
          isEditable
            ? `/rooms/${roomId}?week=${weekParam}&booking=${booking.id}`
            : undefined
        }
        isSelected={booking.id === selectedBookingId}
        interactive={drag === null}
        style={{
          top: rowSpan(placement.rowStart, rowHeight),
          // The 2px gap plus each block's own border is what makes 10:00–11:00
          // and 11:00–12:00 read as two blocks with a visible seam.
          height: `calc(${rowSpan(placement.rowSpan, rowHeight)} - 2px)`,
        }}
      />
    );
  };

  /**
   * The range being picked, either dragged right now or already in the URL with
   * the form open. A 2px dashed outline and a centred plaque: no booking block
   * carries a dashed outline that thick, so there is nothing to confuse it with.
   */
  const selectionFor = (
    targetDay: number,
  ): { rowStart: number; rowEnd: number } | null => {
    if (drag) {
      return drag.dayIndex === targetDay
        ? getSelectionRows(drag.anchorRow, drag.focusRow)
        : null;
    }

    // Ahead of the address on purpose: see justPicked above.
    if (justPicked) {
      return justPicked.dayIndex === targetDay
        ? { rowStart: justPicked.rowStart, rowEnd: justPicked.rowEnd }
        : null;
    }

    if (!selectedSlot) {
      return null;
    }

    const start = new Date(selectedSlot);
    const end = selectedSlotEnd
      ? new Date(selectedSlotEnd)
      : new Date(+start + SLOT_MINUTES * 60_000);
    const placement = placeBooking({ startsAt: start, endsAt: end }, weekStartDateTime);

    return placement && placement.dayIndex === targetDay
      ? { rowStart: placement.rowStart, rowEnd: placement.rowStart + placement.rowSpan }
      : null;
  };

  /**
   * Whether the picked range runs into a booking that is already there. It is
   * the same half-open rule the server applies, so the grid and the API agree;
   * the server still has the final word, this only says it sooner. The booking
   * being edited is left out, or it would clash with itself.
   */
  const selectionClashes = (start: Date, end: Date): boolean =>
    bookings.some(
      (booking) =>
        booking.id !== selectedBookingId &&
        intervalsOverlap(start, end, new Date(booking.startsAt), new Date(booking.endsAt)),
    );

  const renderSelection = (
    targetDay: number,
    targetDate: DateTime,
    rowHeight: string,
  ) => {
    const rows = selectionFor(targetDay);
    if (!rows) {
      return null;
    }

    const startsAt = getSlotStart(targetDate, rows.rowStart);
    const endsAt = getSlotStart(targetDate, rows.rowEnd);
    const from = startsAt.setZone(timeZone).toFormat("HH:mm");
    const to = endsAt.setZone(timeZone).toFormat("HH:mm");
    // Red while the range is still being dragged, not only after the save is
    // refused: by then the user has already typed a title.
    const clashes = selectionClashes(startsAt.toJSDate(), endsAt.toJSDate());

    return (
      <div
        className="pointer-events-none absolute right-[3px] left-[3px] z-8"
        style={{
          top: rowSpan(rows.rowStart, rowHeight),
          height: `calc(${rowSpan(rows.rowEnd - rows.rowStart, rowHeight)} - 2px)`,
        }}
      >
        <div
          className={`rounded-booking flex h-full items-center justify-center border-2 border-dashed ${
            clashes
              ? "border-danger bg-danger-surface/75"
              : "border-accent-own-booking bg-accent-own-surface/70"
          }`}
        >
          <span
            className={`rounded-booking border px-1.5 py-0.5 font-mono text-xs sm:text-[11px] xl:text-xs font-semibold ${
              clashes
                ? "border-danger bg-surface text-danger-ink"
                : "border-accent-own-booking bg-surface text-accent-own-ink"
            }`}
          >
            {clashes ? (
              <>
                <span aria-hidden="true">✕ </span>
                {t("taken")}
              </>
            ) : (
              <>
                {from}–{to} ·{" "}
                {durationLabel((rows.rowEnd - rows.rowStart) * SLOT_MINUTES, tDuration)}
              </>
            )}
          </span>
        </div>
      </div>
    );
  };

  /** Everything before the current moment, dimmed so the eye starts at "now". */
  const renderPast = (targetDate: DateTime, rowHeight: string) => {
    const rows = pastRows(targetDate, now);
    if (rows === 0) {
      return null;
    }

    return (
      <div
        aria-hidden
        // Enough to see at a glance where "now" starts, not enough to compete
        // with the bookings sitting on top of it.
        className="bg-surface-raised pointer-events-none absolute inset-x-0 top-0 opacity-60"
        style={{ height: rowSpan(rows, rowHeight) }}
      />
    );
  };

  // Whole hours carry the weight; the half hours between them go unlabelled, so
  // the axis reads as a scale instead of forty equal numbers.
  const timeAxis = (rowHeight: string) =>
    labels.map((label, rowIndex) => (
      <div
        key={`${label}-${rowIndex}`}
        className={`flex items-start justify-end pr-2 ${
          rowIndex === 0
            ? "border-t-transparent"
            : rowIndex % 2 === 0
              ? "border-t-border-grid"
              : "border-t-transparent"
        } border-t`}
        style={{ height: rowHeight }}
      >
        {/* Lifted onto the line it marks, the way a calendar axis reads —
            except the first, which has only the header above it and would be
            clipped by the top edge of the grid. */}
        <span
          className={`font-mono text-xs sm:text-[11px] xl:text-xs leading-none ${
            rowIndex === 0 ? "" : "-translate-y-[6px]"
          } ${
            rowIndex % 2 === 0
              ? "text-text-secondary font-semibold"
              : "text-transparent"
          }`}
        >
          {label}
        </span>
      </div>
    ));

  const isWeekEmpty = placements.length === 0;

  return (
    <div className="flex flex-col gap-2.5">
      {/* Single day: a phone has no room for seven columns. */}
      <div className="flex flex-col gap-2 sm:hidden">
        <div className="bg-surface border-border-grid rounded-card flex items-center gap-2 border p-2">
          <Link
            href={dayHref(day.minus({ days: 1 }))}
            aria-label={t("previousDay")}
            title={t("previousDay")}
            className="focus-ring border-border-grid text-text-secondary rounded-control flex h-11 w-11 shrink-0 items-center justify-center border no-underline"
          >
            <span aria-hidden="true">←</span>
          </Link>
          <span className="flex min-w-0 flex-1 flex-col items-center">
            <span className="truncate text-[15px] font-semibold">
              {day.setLocale(locale).toFormat("cccc")}
            </span>
            <span className="text-text-tertiary font-mono text-xs">
              {day.toFormat("dd.MM.yyyy")}
            </span>
          </span>
          <Link
            href={dayHref(day.plus({ days: 1 }))}
            aria-label={t("nextDay")}
            title={t("nextDay")}
            className="focus-ring border-border-grid text-text-secondary rounded-control flex h-11 w-11 shrink-0 items-center justify-center border no-underline"
          >
            <span aria-hidden="true">→</span>
          </Link>
        </div>

        <div className="flex gap-1">
          {days.map((option) => {
            const isSelected = option.toISODate() === day.toISODate();

            return (
              <Link
                key={option.toISODate()}
                href={dayHref(option)}
                aria-current={isSelected ? "page" : undefined}
                className={`focus-ring rounded-control flex min-h-11 flex-1 flex-col items-center justify-center border text-xs no-underline ${
                  isSelected
                    ? "border-accent-own-booking bg-accent-own-booking text-accent-own-on font-bold"
                    : "border-border-grid bg-surface text-text-secondary"
                }`}
              >
                <span>{option.setLocale(locale).toFormat("ccc")}</span>
                <span className="font-mono font-semibold">{option.toFormat("dd")}</span>
              </Link>
            );
          })}
        </div>

        <SwipeArea
          prevHref={dayHref(day.minus({ days: 1 }))}
          nextHref={dayHref(day.plus({ days: 1 }))}
        >
          <div className="bg-surface border-border-grid rounded-card overflow-hidden border">
            <div className="relative flex">
              <div className="border-border-grid w-13 flex-none border-r">
                {timeAxis(DAY_ROW_H)}
              </div>
              <div className="relative min-w-0 flex-1">
                {Array.from({ length: SLOT_COUNT }, (_, rowIndex) =>
                  renderCell({
                    cellDay: day,
                    rowIndex,
                    dayIndex,
                    columnIndex: 0,
                    prefix: "day",
                    lastColumn: 0,
                    rowHeight: DAY_ROW_H,
                  }),
                )}
                {renderPast(day, DAY_ROW_H)}
                {placements
                  .filter((entry) => entry.placement!.dayIndex === dayIndex)
                  .map((entry) =>
                    renderBooking(
                      entry.booking,
                      entry.placement!,
                      DAY_ROW_H,
                      "day",
                      false,
                    ),
                  )}
                {renderSelection(dayIndex, day, DAY_ROW_H)}
                {now !== null && nowMarker?.dayIndex === dayIndex ? (
                  <div
                    aria-hidden
                    className="border-now-line pointer-events-none absolute inset-x-0 z-9 border-t-2"
                    style={{
                      top: rowSpan(nowMarker.ratio * SLOT_COUNT, DAY_ROW_H),
                    }}
                  >
                    <span className="bg-now-label rounded-booking absolute -top-2.5 left-1.5 px-1 py-px font-mono text-xs sm:text-[11px] xl:text-xs font-semibold text-white">
                      {DateTime.fromMillis(now).setZone(timeZone).toFormat("HH:mm")}
                    </span>
                  </div>
                ) : null}
              </div>
            </div>
          </div>
        </SwipeArea>

        <p className="text-text-tertiary text-xs leading-relaxed">{t("hintTouch")}</p>
      </div>

      {/* Whole week. Wide screens scroll it sideways; the time column stays put
          via position: sticky, so the rows never lose their labels. */}
      <div
        role="group"
        aria-label={t("weekGrid")}
        className="bg-surface border-border-grid rounded-card hidden overflow-auto border sm:block"
      >
        {/* 64px of time axis plus seven 88px days. Wider than that and the week
            no longer fits a 768px tablet, which is the width where the seven
            columns first appear and the last day used to be sliced in half. */}
        <div className="flex min-w-[42.5rem] flex-col">
          <div className="bg-surface sticky top-0 z-12 flex shadow-[0_1px_0_var(--color-border-grid)]">
            <div className="bg-surface border-border-grid sticky left-0 z-13 w-axis flex-none border-r" />
            {days.map((option) => {
              const isToday = option.toISODate() === todayIso;

              return (
                <div
                  key={option.toISODate()}
                  // items-center on the cell, items-baseline inside it: the pair
                  // shares one baseline, and the pair as a whole sits in the
                  // middle of the row. items-baseline alone hangs both labels
                  // from the top edge.
                  className={`border-border-grid-half relative flex min-w-[5.5rem] flex-1 items-center justify-center border-l px-1.5 ${
                    isToday ? "bg-today-column" : ""
                  }`}
                  style={{ height: `${HEADER_REM}rem` }}
                >
                  <span className="flex items-baseline gap-1.5">
                    <span
                      className={`text-[13px] ${
                        isToday
                          ? "text-text-primary font-bold"
                          : "text-text-secondary font-medium"
                      }`}
                    >
                      {option.setLocale(locale).toFormat("ccc")}
                    </span>
                    <span
                      className={`font-mono text-xs ${
                        isToday
                          ? "text-text-primary font-bold"
                          : "text-text-tertiary font-medium"
                      }`}
                    >
                      {option.toFormat("dd.MM")}
                    </span>
                  </span>
                  {/* Out of the flow: in the row it widened the today column's
                      label group and pushed its text off the centre the other
                      six days line up on. */}
                  {isToday ? (
                    <span
                      aria-hidden="true"
                      className="bg-now-line absolute top-1/2 right-2 h-1.5 w-1.5 -translate-y-1/2 rounded-full"
                    />
                  ) : null}
                </div>
              );
            })}
          </div>

          <div className="relative flex">
            <div className="bg-surface border-border-grid sticky left-0 z-11 w-axis flex-none border-r">
              {timeAxis(ROW_H)}
            </div>

            <div className="relative flex min-w-0 flex-1">
              {days.map((option, index) => (
                <div
                  key={option.toISODate()}
                  className={`border-border-grid-half relative flex min-w-[5.5rem] flex-1 flex-col border-l ${
                    option.toISODate() === todayIso ? "bg-today-column" : ""
                  }`}
                >
                  {Array.from({ length: SLOT_COUNT }, (_, rowIndex) =>
                    renderCell({
                      cellDay: option,
                      rowIndex,
                      dayIndex: index,
                      columnIndex: index,
                      prefix: "week",
                      lastColumn: DAYS_IN_WEEK - 1,
                      rowHeight: ROW_H,
                    }),
                  )}
                  {renderPast(option, ROW_H)}
                  {placements
                    .filter((entry) => entry.placement!.dayIndex === index)
                    .map((entry) =>
                      renderBooking(
                        entry.booking,
                        entry.placement!,
                        ROW_H,
                        "week",
                        true,
                      ),
                    )}
                  {renderSelection(index, option, ROW_H)}
                </div>
              ))}
            </div>

            {/* One line across all seven days, the way a calendar draws it, with
                the time in the gutter. It exists only inside 09:00-19:00:
                outside them there is nothing on the grid for it to point at.
                Drawn as a sibling of the axis rather than inside the day
                columns, so the label is not painted over by the sticky axis. */}
            {nowMarker && now !== null ? (
              <div
                aria-hidden
                className="pointer-events-none absolute inset-x-0 z-14"
                style={{ top: rowSpan(nowMarker.ratio * SLOT_COUNT, ROW_H) }}
              >
                <div className="border-now-line ml-axis border-t-2" />
                <span className="w-axis absolute -top-2.5 left-0 pr-1 text-right">
                  <span className="bg-now-label rounded-booking px-1 py-px font-mono text-xs sm:text-[11px] xl:text-xs font-semibold text-white">
                    {DateTime.fromMillis(now).setZone(timeZone).toFormat("HH:mm")}
                  </span>
                </span>
              </div>
            ) : null}
          </div>
        </div>
      </div>

      {/* An empty week has to read as an opportunity rather than as a failure,
          so the grid stays and a plain sentence says what it means. */}
      {isWeekEmpty ? (
        <p className="border-success bg-success-surface text-success-ink rounded-control flex flex-wrap items-center gap-2 border px-3 py-2">
          <span className="text-sm font-semibold">{t("emptyWeekTitle")}</span>
          <span className="text-[13px] leading-snug">{t("emptyWeekText")}</span>
        </p>
      ) : null}

    </div>
  );
}
