"use client";

import { ChevronLeft, ChevronRight, Plus, X } from "lucide-react";
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
import { DayRibbon } from "@/components/schedule/DayRibbon";
import {
  DAY_ROW_H,
  HEADER_REM,
  ROW_H,
  rowSpan,
} from "@/components/schedule/geometry";
import { SwipeArea } from "@/components/schedule/SwipeArea";
import { SlotMotif } from "@/components/ui/SlotMotif";
import {
  noopSubscribe,
  readOfficeTimeZone,
  readViewerTimeZone,
} from "@/components/viewerTimeZone";
import { WEEK_START_DAY } from "@/lib/config";
import {
  MAX_DURATION_MINUTES,
  OFFICE_TZ,
  SLOT_MINUTES,
} from "@/lib/domain/constants";
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

// Shared by every day with nothing booked, so the ribbon does not allocate
// fourteen empty sets on each render.
const EMPTY_DAY: ReadonlySet<number> = new Set<number>();

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

// The longest booking the rules allow, in grid rows. Dragging is clamped to it,
// so the pointer cannot even draw a shape the server would refuse.
const MAX_ROWS = MAX_DURATION_MINUTES / SLOT_MINUTES;

/**
 * A booking being reshaped by pointer or key: which one, which gesture, and the
 * rows it covers as of the last pointer position. The block is drawn from this
 * instead of from its saved times until the save comes back.
 */
type BookingDrag = {
  id: string;
  mode: "move" | "start" | "end";
  dayIndex: number;
  rowStart: number;
  rowEnd: number;
  /** Rows between the grabbed point and the top of the block, for a move. */
  grabOffset: number;
  /** Stays false for a click that never went anywhere, which must open the form. */
  moved: boolean;
};

/** Keeps a value inside a range; the grid clamps rather than refuses. */
function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

/**
 * Rows the gesture puts the booking on. Every mode keeps the result a legal
 * shape on its own — inside the day, at least one slot long and at most four
 * hours — so the preview never shows something that cannot be saved.
 */
function dragToRows(
  drag: BookingDrag,
  row: number,
): { rowStart: number; rowEnd: number } {
  if (drag.mode === "move") {
    const span = drag.rowEnd - drag.rowStart;
    const rowStart = clamp(row - drag.grabOffset, 0, SLOT_COUNT - span);

    return { rowStart, rowEnd: rowStart + span };
  }

  if (drag.mode === "start") {
    return {
      rowStart: clamp(row, drag.rowEnd - MAX_ROWS, drag.rowEnd - 1),
      rowEnd: drag.rowEnd,
    };
  }

  return {
    rowStart: drag.rowStart,
    rowEnd: clamp(row + 1, drag.rowStart + 1, drag.rowStart + MAX_ROWS),
  };
}

/**
 * Day column and row under the pointer. Read from the document rather than from
 * pointer events on the cells: during a drag the block itself is under the
 * pointer, so the cells never see it.
 */
function cellUnderPointer(
  clientX: number,
  clientY: number,
): { dayIndex: number; row: number } | null {
  const column = document
    .elementFromPoint(clientX, clientY)
    ?.closest<HTMLElement>("[data-day-index]");

  if (!column) {
    return null;
  }

  const rect = column.getBoundingClientRect();

  return {
    dayIndex: Number(column.dataset.dayIndex),
    row: clamp(
      Math.floor((clientY - rect.top) / (rect.height / SLOT_COUNT)),
      0,
      SLOT_COUNT - 1,
    ),
  };
}

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

  // A booking being dragged, and the shape a finished drag is waiting on the
  // server to confirm. Both draw the block where the user put it rather than
  // where it is still saved, which is what makes the gesture feel immediate.
  const [bookingDrag, setBookingDrag] = useState<BookingDrag | null>(null);
  const [pendingShape, setPendingShape] = useState<{
    id: string;
    startsAt: string;
    endsAt: string;
  } | null>(null);
  // Set on a drag that actually moved something, so the click that follows the
  // release does not also open the form.
  const suppressClick = useRef(false);

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
  // Same idea for a dragged booking: the shape is held until the refreshed
  // bookings carry it, and dropped the moment they do.
  if (
    pendingShape &&
    bookings.some(
      (booking) =>
        booking.id === pendingShape.id &&
        booking.startsAt === pendingShape.startsAt &&
        booking.endsAt === pendingShape.endsAt,
    )
  ) {
    setPendingShape(null);
  }

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
  // Compared as office dates, because "already over" is a question about the
  // working day, not about the viewer's clock.
  const isPastDay = (option: DateTime) => (option.toISODate() ?? "") < (todayIso ?? "");

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
   * Saves a booking reshaped on the grid. Only the times travel: dragging is
   * about when, never about what. The server applies exactly the same rules it
   * applies to the form — this asks, it does not decide — so a refusal comes
   * back as its own message and the block returns to where it was saved.
   */
  const saveShape = async (id: string, targetDay: number, rows: {
    rowStart: number;
    rowEnd: number;
  }) => {
    const startsAt = getSlotStart(days[targetDay], rows.rowStart).toUTC().toISO() ?? "";
    const endsAt = getSlotStart(days[targetDay], rows.rowEnd).toUTC().toISO() ?? "";

    setPendingShape({ id, startsAt, endsAt });

    const response = await fetch(`/api/bookings/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ startsAt, endsAt }),
    }).catch(() => null);

    if (response?.ok) {
      showToast(t("moved"));
      router.refresh();
      return;
    }

    // Back to the saved shape at once: leaving the block where the pointer put
    // it would claim a move that did not happen.
    setPendingShape(null);

    const body = await response?.json().catch(() => null);
    showToast(body?.error?.message ?? t("moveFailed"));
  };

  /**
   * Starts a pointer gesture on one of the viewer's own bookings. Mouse only,
   * for the same reason the cells are: on a touch screen a drag across the grid
   * is how the day is swiped and how the page is scrolled.
   */
  const grabBooking = (
    booking: BookingView,
    placement: { dayIndex: number; rowStart: number; rowSpan: number },
    mode: "move" | "start" | "end",
    event: React.PointerEvent,
  ) => {
    if (event.pointerType !== "mouse" || event.button !== 0) {
      return;
    }

    const rect = event.currentTarget.getBoundingClientRect();
    const grabbedRow = Math.floor(
      (event.clientY - rect.top) / (rect.height / placement.rowSpan),
    );

    event.preventDefault();
    suppressClick.current = false;
    setBookingDrag({
      id: booking.id,
      mode,
      dayIndex: placement.dayIndex,
      rowStart: placement.rowStart,
      rowEnd: placement.rowStart + placement.rowSpan,
      grabOffset: mode === "move" ? clamp(grabbedRow, 0, placement.rowSpan - 1) : 0,
      moved: false,
    });
  };

  /**
   * The keyboard half of the same two gestures, so reshaping a booking is not a
   * mouse-only feature: Alt moves it, Shift changes how long it runs.
   */
  const nudgeBooking = (
    booking: BookingView,
    placement: { dayIndex: number; rowStart: number; rowSpan: number },
    event: React.KeyboardEvent,
  ) => {
    const vertical =
      event.key === "ArrowUp" ? -1 : event.key === "ArrowDown" ? 1 : 0;
    const horizontal =
      event.key === "ArrowLeft" ? -1 : event.key === "ArrowRight" ? 1 : 0;

    const span = placement.rowSpan;
    let dayIndex = placement.dayIndex;
    let rowStart = placement.rowStart;
    let rowEnd = placement.rowStart + span;

    if (event.altKey && (vertical !== 0 || horizontal !== 0)) {
      rowStart = clamp(rowStart + vertical, 0, SLOT_COUNT - span);
      rowEnd = rowStart + span;
      dayIndex = clamp(dayIndex + horizontal, 0, DAYS_IN_WEEK - 1);
    } else if (event.shiftKey && vertical !== 0) {
      rowEnd = clamp(rowEnd + vertical, rowStart + 1, rowStart + MAX_ROWS);
      // The last row of the day is the ceiling for the end as well.
      rowEnd = Math.min(rowEnd, SLOT_COUNT);
    } else {
      return;
    }

    if (dayIndex === placement.dayIndex && rowStart === placement.rowStart && rowEnd === placement.rowStart + span) {
      return;
    }

    // Both combinations are the browser's own scrolling otherwise.
    event.preventDefault();
    void saveShape(booking.id, dayIndex, { rowStart, rowEnd });
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
        // w-full is not decoration: a <button> sizes to its content, and every
        // child here is absolutely positioned, so without it the cell collapses
        // to zero width wherever its parent is not a flex container.
        // The row lines are painted by the column behind it, so the cell itself
        // carries no border: forty of them stacked read as a spreadsheet.
        className={`focus-ring-inset group relative flex w-full items-center justify-center transition ${
          canBook ? "cursor-pointer" : "cursor-default"
        }`}
        style={{ height: rowHeight }}
      >
        {/* The hovered cell names its own time and shows the shape of the
            booking it would make: the axis is far away once the pointer is deep
            inside the week, and a bare highlight does not say "click to book". */}
        <span
          className={`rounded-booking pointer-events-none absolute inset-x-1 inset-y-[2px] flex items-center justify-center gap-1 font-mono text-xs opacity-0 transition-opacity sm:text-[11px] ${
            canBook
              ? "border-accent-own-booking bg-accent-own-surface text-accent-own-ink border-[1.5px] border-dashed font-bold group-hover:opacity-100 group-focus-visible:opacity-100"
              : "text-text-tertiary group-focus-visible:opacity-100"
          }`}
        >
          {canBook ? <Plus aria-hidden="true" className="size-3" /> : null}
          {labels[rowIndex]}
        </span>
      </button>
    );
  };

  // The release can happen anywhere, including outside the grid, so the whole
  // window is listened to rather than the cells.
  //
  // Keyed to the gesture rather than left without dependencies: the listener
  // has to see the rows as they are now, but re-subscribing on every render
  // means doing it for the minute tick and for every unrelated state change
  // too, all the way through the drag.
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
    // openForm and days are rebuilt on every render and would defeat the point
    // of the dependency above; both are read only when the pointer is released.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [drag]);

  // The same arrangement for a booking being reshaped: the pointer is followed
  // on the window, because it leaves the block the moment the drag begins.
  useEffect(() => {
    if (!bookingDrag) {
      return;
    }

    const move = (event: PointerEvent) => {
      const cell = cellUnderPointer(event.clientX, event.clientY);
      if (!cell) {
        return;
      }

      const rows = dragToRows(bookingDrag, cell.row);
      // A move follows the pointer across the week; a resize belongs to the day
      // the booking is already on.
      const dayIndex = bookingDrag.mode === "move" ? cell.dayIndex : bookingDrag.dayIndex;

      if (
        rows.rowStart === bookingDrag.rowStart &&
        rows.rowEnd === bookingDrag.rowEnd &&
        dayIndex === bookingDrag.dayIndex
      ) {
        return;
      }

      suppressClick.current = true;
      setBookingDrag({ ...bookingDrag, ...rows, dayIndex, moved: true });
    };

    const finish = () => {
      setBookingDrag(null);

      // A grab that went nowhere is a click, and a click on a booking opens it.
      if (bookingDrag.moved) {
        void saveShape(bookingDrag.id, bookingDrag.dayIndex, bookingDrag);
      }
    };

    window.addEventListener("pointermove", move);
    window.addEventListener("pointerup", finish);

    return () => {
      window.removeEventListener("pointermove", move);
      window.removeEventListener("pointerup", finish);
    };
    // saveShape is rebuilt on every render and is read only on release.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [bookingDrag]);

  /**
   * Where a booking is being put right now, if it is being put anywhere: the
   * rows under the pointer while it is dragged, and the rows it was dropped on
   * until the server confirms them. Everything else is drawn from its saved
   * times.
   */
  const shapeOf = (booking: BookingView) => {
    if (bookingDrag?.id === booking.id) {
      return {
        dayIndex: bookingDrag.dayIndex,
        rowStart: bookingDrag.rowStart,
        rowSpan: bookingDrag.rowEnd - bookingDrag.rowStart,
      };
    }

    if (pendingShape?.id === booking.id) {
      return placeBooking(
        {
          startsAt: new Date(pendingShape.startsAt),
          endsAt: new Date(pendingShape.endsAt),
        },
        weekStartDateTime,
      );
    }

    return null;
  };

  // flatMap rather than map + filter: filter does not narrow the type, and the
  // four readers below would each need a non-null assertion.
  const placements = bookings.flatMap((booking) => {
    const placement =
      shapeOf(booking) ??
      placeBooking(
        { startsAt: new Date(booking.startsAt), endsAt: new Date(booking.endsAt) },
        weekStartDateTime,
      );

    // A booking outside the displayed week simply is not on this grid.
    return placement ? [{ booking, placement }] : [];
  });

  /** One booking, placed into whichever column is drawing it. */
  const renderBooking = (
    booking: BookingView,
    placement: { dayIndex: number; rowStart: number; rowSpan: number },
    rowHeight: string,
    keyPrefix: string,
    /** True where one row is too short for two lines, which is the week view. */
    singleRowIsTight: boolean,
    /** False in the day view, which has one column and nowhere to drag across. */
    draggable: boolean,
  ) => {
    // A finished booking can no longer be edited or canceled, so it offers no
    // action even to its author.
    const isEditable = booking.isMine && booking.endsAt > serverNow;
    const state: BookingState = booking.isMine
      ? isEditable
        ? "own"
        : "finished"
      : "other";

    // Reshaping is editing, so it needs everything editing needs: the booking
    // has to be the viewer's own, still open, and the address confirmed.
    const canReshape = isEditable && canBook && draggable;
    const isDragging = bookingDrag?.id === booking.id;

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
        onGrab={
          canReshape
            ? (mode, event) => grabBooking(booking, placement, mode, event)
            : undefined
        }
        onKeyDown={
          canReshape ? (event) => nudgeBooking(booking, placement, event) : undefined
        }
        // A release that ends a drag also fires a click on the link underneath,
        // and opening the form on top of the move just made is not what the
        // gesture asked for.
        onClick={
          canReshape
            ? (event) => {
                if (suppressClick.current) {
                  event.preventDefault();
                  suppressClick.current = false;
                }
              }
            : undefined
        }
        isDragging={isDragging}
        // The same half-open rule the selection uses, so a drag onto an occupied
        // stretch says so before it is released rather than after the server
        // refuses it.
        invalid={
          isDragging &&
          selectionClashes(
            getSlotStart(days[placement.dayIndex], placement.rowStart).toJSDate(),
            getSlotStart(
              days[placement.dayIndex],
              placement.rowStart + placement.rowSpan,
            ).toJSDate(),
            booking.id,
          )
        }
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
   * being edited or dragged is left out, or it would clash with itself.
   */
  const selectionClashes = (
    start: Date,
    end: Date,
    exceptId = selectedBookingId,
  ): boolean =>
    bookings.some(
      (booking) =>
        booking.id !== exceptId &&
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
    // The same rule creation applies on the server: the start has to be strictly
    // later than now. Said here so the range is refused before a title is typed.
    // Only once the clock is known — on the server render it is not, and a range
    // wrongly called past would be worse than one called nothing at all.
    const inPast = now !== null && +startsAt <= now;
    const refused = clashes || inPast;

    return (
      <div
        // Read by the booking panel, which has to place itself somewhere other
        // than on top of the range being picked.
        data-selection
        className="pointer-events-none absolute right-1 left-1 z-8"
        style={{
          top: rowSpan(rows.rowStart, rowHeight),
          height: `calc(${rowSpan(rows.rowEnd - rows.rowStart, rowHeight)} - 2px)`,
        }}
      >
        <div
          className={`rounded-booking h-full border-[1.5px] border-dashed ${
            refused
              ? "border-danger bg-danger-surface"
              : "border-accent-own-booking bg-accent-own-surface"
          }`}
        />
        {/* The plaque hangs off the top edge rather than sitting in the middle:
            a range one row tall has no middle, and the reading order of a
            calendar is downwards from the start. */}
        <span
          className={`rounded-booking absolute -top-2.5 left-1.5 flex items-center gap-1 px-1.5 py-0.5 font-mono text-[11px] font-bold whitespace-nowrap text-white sm:text-[10px] ${
            refused ? "bg-danger-solid" : "bg-accent-own-ink"
          }`}
        >
          {refused ? (
            <>
              <X aria-hidden="true" className="size-3" />
              {clashes ? t("taken") : t("slotPast")}
            </>
          ) : (
            <>
              {from}–{to} ·{" "}
              {durationLabel((rows.rowEnd - rows.rowStart) * SLOT_MINUTES, tDuration)}
            </>
          )}
        </span>
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
        className="bg-text-primary/[0.035] pointer-events-none absolute inset-x-0 top-0"
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
        className="flex items-start justify-end pr-2.5"
        style={{ height: rowHeight }}
      >
        {/* Lifted onto the line it marks, the way a calendar axis reads —
            except the first, which has only the header above it and would be
            clipped by the top edge of the grid. Whole hours carry the weight;
            the half hours between them go unlabelled, so the axis reads as a
            scale instead of forty equal numbers. */}
        <span
          className={`font-mono text-xs leading-none sm:text-[10.5px] ${
            rowIndex === 0 ? "" : "-translate-y-[5px]"
          } ${
            rowIndex % 2 === 0 ? "text-text-tertiary font-semibold" : "text-transparent"
          }`}
        >
          {label}
        </span>
      </div>
    ));

  const isWeekEmpty = placements.length === 0;

  /**
   * An empty week has to read as an opportunity rather than as a failure, so it
   * is said over the empty columns themselves. A strip under the grid would
   * push the legend off a 768px screen, which is the one thing this layout may
   * not do — and it is built once because only one of the two views is ever on
   * screen, and both of them need it.
   */
  const emptyWeekNote = isWeekEmpty ? (
    <div className="pointer-events-none absolute inset-0 z-10 flex flex-col items-center justify-center gap-3 px-4 text-center">
      <SlotMotif className="hidden sm:flex" />
      <SlotMotif small className="sm:hidden" />
      <span className="text-lg font-extrabold tracking-[-0.02em] sm:text-xl">
        {t("emptyWeekTitle")}
      </span>
      <span className="text-text-secondary max-w-[34ch] text-[13px] text-balance sm:text-sm">
        {t("emptyWeekText")}
      </span>
    </div>
  ) : null;

  // Which half hours of each day are taken, and by whom, for the strip in the
  // week header. Two sets rather than one: the strip repeats the ownership
  // colours of the blocks below it, so a glance at the header already says
  // whether the busy part of a day is yours.
  const busyByDay = new Map<number, { mine: Set<number>; others: Set<number> }>();
  for (const { booking, placement } of placements) {
    const day = busyByDay.get(placement.dayIndex) ?? {
      mine: new Set<number>(),
      others: new Set<number>(),
    };
    const target = booking.isMine ? day.mine : day.others;
    for (let row = placement.rowStart; row < placement.rowStart + placement.rowSpan; row += 1) {
      target.add(row);
    }
    busyByDay.set(placement.dayIndex, day);
  }

  return (
    <div className="flex flex-col gap-2">
      {/* Single day: a phone has no room for seven columns. */}
      <div className="flex flex-col gap-2 sm:hidden">
        <div className="flex items-center justify-between gap-2">
          <Link
            href={dayHref(day.minus({ days: 1 }))}
            aria-label={t("previousDay")}
            title={t("previousDay")}
            className="focus-ring border-border-grid bg-surface-muted text-text-secondary rounded-control flex h-10 w-10 shrink-0 items-center justify-center border no-underline"
          >
            <ChevronLeft aria-hidden="true" className="size-[18px]" />
          </Link>
          <span className="flex min-w-0 flex-col items-center">
            <span className="truncate text-base font-extrabold">
              {day.setLocale(locale).toFormat("cccc")}
            </span>
            <span className="text-text-tertiary font-mono text-xs">
              {day.toFormat("dd.MM")}
              {day.toISODate() === todayIso ? ` · ${t("today").toLowerCase()}` : ""}
            </span>
          </span>
          <Link
            href={dayHref(day.plus({ days: 1 }))}
            aria-label={t("nextDay")}
            title={t("nextDay")}
            className="focus-ring border-border-grid bg-surface-muted text-text-secondary rounded-control flex h-10 w-10 shrink-0 items-center justify-center border no-underline"
          >
            <ChevronRight aria-hidden="true" className="size-[18px]" />
          </Link>
        </div>

        {/* A day that is already over still opens — its bookings are worth
            reading — but nothing can be booked in it, so it says so instead of
            letting the user pick a slot and be refused by the server. */}
        {isPastDay(day) ? (
          <p className="bg-warning-surface text-warning-ink rounded-control px-3 py-2 text-[13px] leading-snug font-semibold">
            {t("pastDay")}
          </p>
        ) : null}

        <div className="flex gap-1.5">
          {days.map((option) => {
            const isSelected = option.toISODate() === day.toISODate();

            return (
              <Link
                key={option.toISODate()}
                href={dayHref(option)}
                aria-current={isSelected ? "page" : undefined}
                className={`focus-ring rounded-control flex min-h-11 flex-1 flex-col items-center justify-center gap-0.5 no-underline ${
                  isSelected
                    ? "bg-accent-own-ink text-accent-own-on"
                    : `bg-surface-muted ${
                        // A dimmer word, not a dimmer layer: opacity on the pill
                        // took its label under the contrast floor.
                        isPastDay(option) ? "text-text-tertiary" : "text-text-secondary"
                      }`
                }`}
              >
                <span className="text-xs font-bold">
                  {option.setLocale(locale).toFormat("ccc")}
                </span>
                <span className="font-mono text-xs font-bold">
                  {option.toFormat("dd")}
                </span>
              </Link>
            );
          })}
        </div>

        <SwipeArea
          prevHref={dayHref(day.minus({ days: 1 }))}
          nextHref={dayHref(day.plus({ days: 1 }))}
        >
          <div className="bg-surface border-border-grid rounded-card shadow-rest overflow-hidden border">
            <div className="relative flex">
              <div className="border-border-grid grid-rows-day-touch w-14 flex-none border-r">
                {timeAxis(DAY_ROW_H)}
              </div>
              <div className="grid-rows-day-touch relative min-w-0 flex-1">
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
                  .filter((entry) => entry.placement.dayIndex === dayIndex)
                  .map((entry) =>
                    renderBooking(
                      entry.booking,
                      entry.placement,
                      DAY_ROW_H,
                      "day",
                      false,
                      false,
                    ),
                  )}
                {renderSelection(dayIndex, day, DAY_ROW_H)}
                {emptyWeekNote}
                {now !== null && nowMarker?.dayIndex === dayIndex ? (
                  <div
                    aria-hidden
                    className="bg-now-line animate-now pointer-events-none absolute inset-x-0 z-9 h-0.5 origin-left shadow-[0_0_8px_var(--color-now-line)]"
                    style={{
                      top: rowSpan(nowMarker.ratio * SLOT_COUNT, DAY_ROW_H),
                    }}
                  >
                    <span className="bg-now-label rounded-booking absolute -top-2.5 left-1.5 px-1.5 py-px font-mono text-[11px] font-bold text-white">
                      {DateTime.fromMillis(now).setZone(timeZone).toFormat("HH:mm")}
                    </span>
                  </div>
                ) : null}
              </div>
            </div>
          </div>
        </SwipeArea>

        <p className="text-text-tertiary text-center text-xs leading-relaxed">
          {t("hintTouch")}
        </p>
      </div>

      {/* Whole week. Wide screens scroll it sideways; the time column stays put
          via position: sticky, so the rows never lose their labels. */}
      <div
        role="group"
        aria-label={t("weekGrid")}
        className="bg-surface border-border-grid rounded-card shadow-rest hidden overflow-auto border sm:block"
      >
        {/* 64px of time axis plus seven 88px days. Wider than that and the week
            no longer fits a 768px tablet, which is the width where the seven
            columns first appear and the last day used to be sliced in half. */}
        <div className="flex min-w-[42.5rem] flex-col">
          <div className="bg-surface sticky top-0 z-12 flex shadow-[0_1px_0_var(--color-border-grid)]">
            <div className="bg-surface border-border-grid sticky left-0 z-13 w-axis flex-none border-r" />
            {days.map((option, index) => {
              const isToday = option.toISODate() === todayIso;

              return (
                <div
                  key={option.toISODate()}
                  // items-center on the cell, items-baseline inside it: the pair
                  // shares one baseline, and the pair as a whole sits in the
                  // middle of the row. items-baseline alone hangs both labels
                  // from the top edge.
                  className={`border-border-grid relative flex min-w-[5.5rem] flex-1 items-center justify-center border-l px-2.5 ${
                    isToday ? "bg-today-column" : ""
                  } ${isPastDay(option) ? "[&_span]:text-text-tertiary" : ""}`}
                  style={{ height: `${HEADER_REM}rem` }}
                >
                  <span className="flex items-baseline gap-1.5">
                    <span
                      className={`text-xs font-bold ${
                        isToday ? "text-accent-own-ink" : "text-text-secondary"
                      }`}
                    >
                      {option.setLocale(locale).toFormat("ccc")}
                    </span>
                    <span
                      className={`font-mono text-xs font-bold ${
                        isToday ? "text-accent-own-ink" : "text-text-primary"
                      }`}
                    >
                      {option.toFormat("dd.MM")}
                    </span>
                    {/* Out of the flow would be tidier, but the dot belongs to
                        the pair: it is the one mark that says "today" when the
                        column tint is invisible on a printout. */}
                    {isToday ? (
                      <span
                        aria-hidden="true"
                        className="bg-now-line size-1.5 self-center rounded-full shadow-[0_0_0_3px_var(--color-warning-surface)]"
                      />
                    ) : null}
                  </span>
                  <DayRibbon
                    mine={busyByDay.get(index)?.mine ?? EMPTY_DAY}
                    others={busyByDay.get(index)?.others ?? EMPTY_DAY}
                    slotCount={SLOT_COUNT}
                    className="absolute inset-x-2.5 bottom-1"
                  />
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
                  // Read back while a booking is dragged, to say which day and
                  // which row the pointer is over.
                  data-day-index={index}
                  className={`border-border-grid grid-rows-day relative flex min-w-[5.5rem] flex-1 flex-col border-l ${
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
                    .filter((entry) => entry.placement.dayIndex === index)
                    .map((entry) =>
                      renderBooking(
                        entry.booking,
                        entry.placement,
                        ROW_H,
                        "week",
                        true,
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
            {emptyWeekNote}

            {nowMarker && now !== null ? (
              <div
                aria-hidden
                className="pointer-events-none absolute inset-x-0 z-14"
                style={{ top: rowSpan(nowMarker.ratio * SLOT_COUNT, ROW_H) }}
              >
                {/* Drawn from the axis outwards, the direction the day runs in;
                    appearing all at once would read as a border. The glow is
                    what lifts a 2px line off twenty other horizontal lines. */}
                <div className="bg-now-line ml-axis animate-now h-0.5 origin-left shadow-[0_0_8px_var(--color-now-line)]" />
                <span className="w-axis absolute -top-2 left-0 pr-1.5 text-right">
                  <span className="text-now-label bg-surface rounded px-1 font-mono text-[10.5px] font-bold">
                    {DateTime.fromMillis(now).setZone(timeZone).toFormat("HH:mm")}
                  </span>
                </span>
              </div>
            ) : null}
          </div>
        </div>
      </div>

    </div>
  );
}
