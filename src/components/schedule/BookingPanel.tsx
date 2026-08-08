"use client";

import {
  ChevronDown,
  ChevronUp,
  CircleAlert,
  Clock,
  Repeat,
  X,
} from "lucide-react";
import { DateTime } from "luxon";
import { useRouter } from "next/navigation";
import { useLocale, useTranslations } from "next-intl";
import { useEffect, useRef, useState, useSyncExternalStore } from "react";

import { CancelBookingButton } from "@/components/CancelBookingButton";
import { setDraftTitle } from "@/components/schedule/draftTitle";
import { showToast } from "@/components/toast";
import { Button } from "@/components/ui/Button";
import { DatePicker } from "@/components/ui/DatePicker";
import { Input } from "@/components/ui/Input";
import { Select } from "@/components/ui/Select";
import {
  noopSubscribe,
  readOfficeTimeZone,
  readViewerTimeZone,
} from "@/components/viewerTimeZone";
import { createBookingSchema, messageKeyFor } from "@/lib/domain/bookingInput";
import { MAX_TITLE_LENGTH, validateTitle } from "@/lib/domain/bookingRules";
import {
  MAX_DURATION_MINUTES,
  OFFICE_TZ,
  SLOT_MINUTES,
} from "@/lib/domain/constants";
import { intervalsOverlap } from "@/lib/domain/overlap";
import { MAX_OCCURRENCES, MIN_OCCURRENCES } from "@/lib/domain/recurrence";
import { getWeekStart } from "@/lib/domain/week";
import { WEEK_START_DAY } from "@/lib/config";
import {
  SLOT_COUNT,
  splitDuration,
  getEndSlotBounds,
  getSlotIndex,
  getSlotLabel,
  getSlotStart,
} from "@/lib/domain/grid";

type RoomOption = { id: string; name: string; floor: number; capacity: number };

type ApiError = { code: string; message: string; field?: string };

// The panel floats beside the grid from the sm breakpoint up and covers the
// screen below it. The server cannot know which, so it renders the phone layout
// and the browser corrects it after hydration.
const WIDE_SCREEN = "(min-width: 640px)";

/** Element the floating panel is placed against. */
export const SCHEDULE_ANCHOR_ID = "schedule-section";

function subscribeToWideScreen(onChange: () => void) {
  const query = window.matchMedia(WIDE_SCREEN);
  query.addEventListener("change", onChange);

  return () => query.removeEventListener("change", onChange);
}

const readWide = () => window.matchMedia(WIDE_SCREEN).matches;
const readNotWide = () => false;

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

export type EditableBooking = {
  id: string;
  roomId: string;
  seriesId: string | null;
  title: string;
  startsAt: string;
  endsAt: string;
};

type BookingPanelProps = {
  rooms: RoomOption[];
  roomId: string;
  weekParam: string;
  /** Start of the slot picked in the grid; its presence opens the form. */
  slot?: string;
  /** End of a range dragged across the grid; a plain click leaves it out. */
  slotEnd?: string;
  /** Own booking picked in the grid; opens the same form in edit mode. */
  booking?: EditableBooking;
};

/**
 * Owns the create/edit form and the success toast. The toast lives here rather
 * than inside the form because the form is keyed by the picked slot and is
 * unmounted the moment the booking is saved.
 */
export function BookingPanel({
  rooms,
  roomId,
  weekParam,
  slot,
  slotEnd,
  booking,
}: BookingPanelProps) {
  if (!slot && !booking) {
    return null;
  }

  // The key resets the form when a different slot or booking is picked.
  return (
    <BookingForm
      // Includes the end, so dragging a different range while the form is open
      // resets the times rather than keeping the first ones.
      key={booking?.id ?? `${slot}-${slotEnd ?? ""}`}
      rooms={rooms}
      roomId={roomId}
      weekParam={weekParam}
      slot={slot}
      slotEnd={slotEnd}
      booking={booking}
    />
  );
}

function BookingForm({
  rooms,
  roomId,
  weekParam,
  slot,
  slotEnd,
  booking,
}: BookingPanelProps) {
  const router = useRouter();
  const locale = useLocale();
  const t = useTranslations("form");
  const tApi = useTranslations("api");
  const tDuration = useTranslations("duration");
  const timeZone = useSyncExternalStore(
    noopSubscribe,
    readViewerTimeZone,
    readOfficeTimeZone,
  );

  // Editing prefills from the booking; creating starts at the picked cell. A
  // dragged range brings its own end, a plain click means "this half hour".
  const start = DateTime.fromISO(booking?.startsAt ?? slot ?? "", {
    zone: OFFICE_TZ,
  });
  const initialStart = Math.min(getSlotIndex(start.toJSDate()), SLOT_COUNT - 1);
  const initialEnd = booking
    ? getSlotIndex(new Date(booking.endsAt))
    : slotEnd
      ? getSlotIndex(new Date(slotEnd))
      : initialStart + 1;

  const [selectedRoomId, setSelectedRoomId] = useState(
    booking?.roomId ?? roomId,
  );
  const [date, setDate] = useState(start.toISODate() ?? "");
  const [startIndex, setStartIndex] = useState(initialStart);
  const [endIndex, setEndIndex] = useState(initialEnd);
  const [title, setTitle] = useState(booking?.title ?? "");
  // Repetition is offered only when creating: editing changes one occurrence.
  const [repeat, setRepeat] = useState(false);
  const [repeatWeeks, setRepeatWeeks] = useState(MIN_OCCURRENCES);
  // The room the user asked to switch to while the form already held something
  // worth keeping; null when nothing is being confirmed.
  const [switchingTo, setSwitchingTo] = useState<string | null>(null);
  const [error, setError] = useState<ApiError | null>(null);
  const [pending, setPending] = useState(false);
  // Creation starts as a compact mobile sheet so the range handle remains
  // reachable. Editing opens immediately because the time was already chosen.
  const [collapsed, setCollapsed] = useState(!booking);
  const formRef = useRef<HTMLFormElement>(null);
  const sheetTouchStart = useRef<number | null>(null);
  const suppressSheetClick = useRef(false);

  // Where the panel was dragged to; null means it sits where CSS put it.
  const [position, setPosition] = useState<{ x: number; y: number } | null>(
    null,
  );
  const dragOffset = useRef<{ x: number; y: number } | null>(null);
  const isWide = useSyncExternalStore(
    subscribeToWideScreen,
    readWide,
    readNotWide,
  );

  useEffect(() => {
    if (isWide || collapsed) {
      return;
    }

    formRef.current?.querySelector<HTMLInputElement>("#title")?.focus();
  }, [collapsed, isWide]);

  useEffect(() => {
    if (isWide || !collapsed) {
      return;
    }

    const selection = Array.from(
      document.querySelectorAll<HTMLElement>("[data-selection]"),
    ).find((element) => element.getBoundingClientRect().width > 0);
    if (!selection) {
      return;
    }

    const rect = selection.getBoundingClientRect();
    // Keep the resize handle above the compact sheet instead of merely drawing
    // it underneath an element that receives the touch first.
    if (rect.bottom > window.innerHeight - 88 || rect.top < 96) {
      selection.scrollIntoView({ block: "center" });
    }
  }, [collapsed, isWide]);

  // The grid behind the panel draws the title on the range being picked. Only
  // while creating: an existing booking already carries its own name there, and
  // overwriting it as the field is edited would claim a change that is not saved.
  useEffect(() => {
    if (booking) {
      return;
    }

    setDraftTitle(title.trim());

    return () => setDraftTitle("");
  }, [title, booking]);

  const day = DateTime.fromISO(date, { zone: OFFICE_TZ });
  // The date field can be cleared or left half typed, and the slot labels do
  // not depend on which day it is — 09:00 is 09:00. Drawing them from today
  // while the field is empty keeps them readable; from an invalid DateTime
  // Luxon would print "Invalid DateTime" into all twenty options of both
  // selects. Everything that actually decides something still checks day.isValid.
  const labelDay = day.isValid ? day : DateTime.now().setZone(OFFICE_TZ);
  const endBounds = getEndSlotBounds(startIndex);
  const durationMinutes = (endIndex - startIndex) * SLOT_MINUTES;

  // Bookings of the room and week currently picked in the form, which is not
  // necessarily the room and week the grid behind the panel is showing. They are
  // read only to warn before saving: the server checks the overlap again and has
  // the final word.
  const [taken, setTaken] = useState<
    { id: string; startsAt: string; endsAt: string }[]
  >([]);
  const weekStartIso = day.isValid
    ? (getWeekStart(day, WEEK_START_DAY).toUTC().toISO() ?? "")
    : "";

  useEffect(() => {
    // A half-typed date has no week to ask about; the check below is skipped
    // for it anyway.
    if (!weekStartIso) {
      return;
    }

    // A reply that arrives after the room or the week changed again would
    // describe the wrong week, so it is dropped.
    let current = true;

    fetch(
      `/api/rooms/${selectedRoomId}/bookings?weekStart=${encodeURIComponent(weekStartIso)}`,
    )
      .then((response) => (response.ok ? response.json() : []))
      .then((items: { id: string; startsAt: string; endsAt: string }[]) => {
        if (current) {
          setTaken(items);
        }
      })
      // A warning that fails to load is not worth an error message: the save
      // itself still reports the clash.
      .catch(() => undefined);

    return () => {
      current = false;
    };
  }, [selectedRoomId, weekStartIso]);

  // Which rooms have nothing over the range currently picked. Asked of the
  // server rather than derived from what the grid holds, because the grid only
  // holds one room — and the whole point of the question is the other five.
  const [freeRoomIds, setFreeRoomIds] = useState<string[] | null>(null);
  const rangeStartIso = day.isValid
    ? (getSlotStart(day, startIndex).toUTC().toISO() ?? "")
    : "";
  const rangeEndIso = day.isValid
    ? (getSlotStart(day, endIndex).toUTC().toISO() ?? "")
    : "";

  useEffect(() => {
    if (!rangeStartIso || !rangeEndIso) {
      return;
    }

    let current = true;
    const query = new URLSearchParams({
      startsAt: rangeStartIso,
      endsAt: rangeEndIso,
      ...(booking ? { exclude: booking.id } : {}),
    });

    fetch(`/api/rooms/free?${query}`)
      .then((response) => (response.ok ? response.json() : []))
      .then((items: RoomOption[]) => {
        if (current) {
          setFreeRoomIds(items.map((item) => item.id));
        }
      })
      // A suggestion that fails to load is not worth an error message either.
      .catch(() => undefined);

    return () => {
      current = false;
    };
  }, [rangeStartIso, rangeEndIso, booking]);

  // Everything free at that time except the room already picked: offering the
  // current one back is not an answer to "where else".
  const alternatives = freeRoomIds
    ? rooms.filter(
        (room) => room.id !== selectedRoomId && freeRoomIds.includes(room.id),
      )
    : [];

  // The booking being edited is excluded, or it would clash with itself.
  const clashes =
    day.isValid &&
    taken.some(
      (other) =>
        other.id !== booking?.id &&
        intervalsOverlap(
          getSlotStart(day, startIndex).toJSDate(),
          getSlotStart(day, endIndex).toJSDate(),
          new Date(other.startsAt),
          new Date(other.endsAt),
        ),
    );

  // `saved` is what decides whether the page is refetched. Dismissing the panel
  // changed nothing on the server, and refreshing anyway made the close wait on
  // a full re-render of the room page before the panel went away.
  const close = (targetRoomId: string, saved = false) => {
    router.replace(`/rooms/${targetRoomId}?week=${weekParam}`);

    if (saved) {
      router.refresh();
    }

    // The panel took the focus when it opened, and closing it would drop the
    // focus on the body — the next Tab would then start again from the top of
    // the page. It goes back to the grid the booking is on instead.
    const schedule = document.getElementById(SCHEDULE_ANCHOR_ID);
    schedule?.focus();
  };

  /**
   * Moves the schedule behind the panel to the room now picked in it, keeping
   * the range the form holds, so "which room" is answered by the grid and not
   * only by the select. The address is what the grid reads, so this is a
   * navigation — and a navigation rebuilds the panel from the address, which is
   * why the title and the repeat settings cannot survive it.
   */
  const goToRoom = (targetRoomId: string) => {
    setSelectedRoomId(targetRoomId);
    setSwitchingTo(null);

    // A half-typed date has no week and no slot to carry over; the panel simply
    // stays where it is until the field makes sense again.
    if (!day.isValid) {
      return;
    }

    const start = getSlotStart(day, startIndex).toUTC().toISO() ?? "";
    const end = getSlotStart(day, endIndex).toUTC().toISO() ?? "";
    const week = getWeekStart(day, WEEK_START_DAY).toISODate() ?? weekParam;

    router.replace(
      `/rooms/${targetRoomId}?week=${week}&slot=${encodeURIComponent(start)}&slotEnd=${encodeURIComponent(end)}`,
      { scroll: false },
    );
  };

  // Editing never navigates: the booking stays in its own room until the change
  // is actually saved. When creating, the jump costs whatever has been typed,
  // so it is confirmed — but only when there is something to lose.
  const pickRoom = (targetRoomId: string) => {
    if (targetRoomId === selectedRoomId) {
      return;
    }

    if (booking) {
      setSelectedRoomId(targetRoomId);
      return;
    }

    if (title.trim() || repeat) {
      setSwitchingTo(targetRoomId);
      return;
    }

    goToRoom(targetRoomId);
  };

  /** Keeps the end after the start when the start moves. */
  const changeStart = (nextStart: number) => {
    setStartIndex(nextStart);
    const bounds = getEndSlotBounds(nextStart);
    setEndIndex((current) =>
      Math.min(Math.max(current, bounds.min), bounds.max),
    );
  };

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();

    const titleError = validateTitle(title);
    if (titleError) {
      // The domain names the rule; the wording is chosen here, where the
      // reader's language is known.
      setError({
        code: titleError.code,
        message: tApi(titleError.code, titleError.values),
        field: "title",
      });
      return;
    }

    // Without a date there is nothing to send: getSlotStart would build an
    // invalid DateTime and toISO() an empty string, which the server would
    // refuse with a message about the format rather than about the field.
    if (!day.isValid) {
      setError({
        code: "VALIDATION_ERROR",
        message: tApi("TIME_INVALID"),
        field: "date",
      });
      return;
    }

    const payload = {
      roomId: selectedRoomId,
      title: title.trim(),
      startsAt: getSlotStart(day, startIndex).toUTC().toISO() ?? "",
      endsAt: getSlotStart(day, endIndex).toUTC().toISO() ?? "",
      ...(booking || !repeat ? {} : { repeatWeeks }),
    };

    // Same schema the route uses; the server still has the final word.
    const parsed = createBookingSchema.safeParse(payload);
    if (!parsed.success) {
      const issue = parsed.error.issues[0];
      setError({
        code: "VALIDATION_ERROR",
        // The same key the route would pick: the form and the route read one
        // schema, so they have to treat its messages the same way.
        message: tApi(messageKeyFor(issue)),
        field: String(issue.path[0] ?? ""),
      });
      return;
    }

    setPending(true);
    setError(null);

    // Editing sends the full set of fields, so the server re-runs every rule it
    // applies on creation.
    const response = await fetch(
      booking ? `/api/bookings/${booking.id}` : "/api/bookings",
      {
        method: booking ? "PATCH" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      },
    ).catch(() => null);

    if (response?.ok) {
      showToast(booking ? t("updated") : t("created"));
      close(selectedRoomId, true);
      return;
    }

    // An expired session is not a failure to report, it is a reason to sign in again.
    if (response?.status === 401) {
      router.replace("/login");
      return;
    }

    const body = await response?.json().catch(() => null);
    setError(
      body?.error ?? {
        code: "UNKNOWN",
        message: t("failed"),
      },
    );
    setPending(false);
  }

  const fieldError = (field: string) =>
    error?.field === field ? error.message : undefined;
  // SLOT_TAKEN, OUTSIDE_WORKING_HOURS and TIME_IN_PAST belong to no single field.
  const generalError = error && !error.field ? error.message : null;

  // Only the floating panel can be moved; on a phone it fills the screen and
  // there is nowhere to move it to.
  const panelStyle =
    isWide && position
      ? { left: `${position.x}px`, top: `${position.y}px`, right: "auto" }
      : undefined;

  /**
   * Places the panel beside the schedule the first time it is shown, instead of
   * in a corner of the window: the form belongs next to the grid it is about.
   * Measuring happens in a ref callback rather than an effect, so the panel is
   * positioned before the browser paints it.
   *
   * The right edge of the schedule is where it goes by default — except when the
   * picked range is itself over there, which is what every Friday, Saturday and
   * Sunday is. Then the panel moves to the other side of that range, so the slot
   * being booked stays visible while the form about it is filled in.
   */
  function anchorToSchedule(node: HTMLDivElement | null) {
    if (!node || !isWide || position) {
      return;
    }

    const section = document.getElementById(SCHEDULE_ANCHOR_ID);
    if (!section) {
      return;
    }

    const schedule = section.getBoundingClientRect();
    const panel = node.getBoundingClientRect();
    const margin = 8;
    const lastX = window.innerWidth - panel.width - margin;

    // Against the right edge of the schedule, and never off screen.
    let x = Math.max(margin, Math.min(schedule.right - panel.width, lastX));

    // The day view marks its selection too and is merely hidden at this width,
    // so the first match can be a box of zeros. The visible one is the one with
    // a width.
    const selection = Array.from(
      document.querySelectorAll<HTMLElement>("[data-selection]"),
    )
      .map((element) => element.getBoundingClientRect())
      .find((rect) => rect.width > 0);

    // Only the horizontal overlap matters: the panel is nearly as tall as the
    // grid, so there is no "above or below it" to move to.
    if (selection && x < selection.right && x + panel.width > selection.left) {
      const toTheLeft = selection.left - panel.width - margin;
      const toTheRight = selection.right + margin;

      // Left of the picked day if it fits, right of it otherwise; if neither
      // fits the panel stays where it was and can still be dragged away.
      if (toTheLeft >= margin) {
        x = toTheLeft;
      } else if (toTheRight <= lastX) {
        x = toTheRight;
      }
    }

    setPosition({
      x,
      y: Math.max(
        margin,
        Math.min(schedule.top, window.innerHeight - panel.height - margin),
      ),
    });
  }

  function startDragging(event: React.PointerEvent<HTMLDivElement>) {
    const panel = event.currentTarget.parentElement;
    if (!isWide || !panel || (event.target as HTMLElement).closest("button")) {
      return;
    }

    const rect = panel.getBoundingClientRect();
    dragOffset.current = {
      x: event.clientX - rect.left,
      y: event.clientY - rect.top,
    };
    // Capture keeps the moves coming even when the pointer outruns the header.
    event.currentTarget.setPointerCapture(event.pointerId);
  }

  function keepDragging(event: React.PointerEvent<HTMLDivElement>) {
    const offset = dragOffset.current;
    const panel = event.currentTarget.parentElement;
    if (!offset || !panel) {
      return;
    }

    const rect = panel.getBoundingClientRect();

    // Kept inside the window, so the panel cannot be dragged out of reach.
    setPosition({
      x: Math.min(
        Math.max(event.clientX - offset.x, 0),
        Math.max(window.innerWidth - rect.width, 0),
      ),
      y: Math.min(
        Math.max(event.clientY - offset.y, 0),
        Math.max(window.innerHeight - rect.height, 0),
      ),
    });
  }

  function stopDragging(event: React.PointerEvent<HTMLDivElement>) {
    dragOffset.current = null;
    if (event.currentTarget.hasPointerCapture(event.pointerId)) {
      event.currentTarget.releasePointerCapture(event.pointerId);
    }
  }

  /** Remembers where a finger met the sheet handle so a vertical swipe can settle it. */
  function startSheetGesture(event: React.TouchEvent<HTMLButtonElement>) {
    sheetTouchStart.current = event.touches[0]?.clientY ?? null;
  }

  /** Swiping up expands and swiping down collapses; a short gesture remains a tap. */
  function finishSheetGesture(event: React.TouchEvent<HTMLButtonElement>) {
    const startY = sheetTouchStart.current;
    const endY = event.changedTouches[0]?.clientY;
    sheetTouchStart.current = null;

    if (startY === null || endY === undefined || Math.abs(endY - startY) < 28) {
      return;
    }

    suppressSheetClick.current = true;
    setCollapsed(endY > startY);
  }

  const switchingRoom = rooms.find((room) => room.id === switchingTo);

  return (
    <div
      // The collapsed phone sheet has no backdrop and lets the schedule keep
      // receiving touches. Expanded, it becomes the focused editing surface.
      className={`fixed z-50 flex items-end justify-center sm:pointer-events-none sm:inset-auto sm:top-24 sm:right-8 sm:block sm:bg-transparent sm:backdrop-blur-none ${
        collapsed
          ? "pointer-events-none inset-x-0 bottom-0"
          : "inset-0 bg-[rgb(14_22_20/0.45)] backdrop-blur-[2px]"
      }`}
      style={panelStyle}
      onClick={(event) => {
        // Only the phone overlay closes on a tap outside it.
        if (event.currentTarget === event.target) {
          close(roomId);
        }
      }}
    >
      <div
        ref={anchorToSchedule}
        role="dialog"
        aria-modal="false"
        aria-label={booking ? t("editBooking") : t("newBooking")}
        // Glass from sm up: the panel sits over the grid, and the point of it
        // is that the week stays readable underneath. On a phone it covers the
        // screen and there is nothing to see through, so it stays solid.
        // The sheet scrolls instead of pushing its buttons out of reach.
        className="rounded-sheet bg-surface border-border-grid shadow-modal animate-sheet pointer-events-auto flex max-h-[92vh] w-full flex-col overflow-hidden rounded-b-none border sm:animate-panel sm:pointer-events-auto sm:max-h-[85vh] sm:w-[364px] sm:rounded-b-[18px] sm:border-glass-edge sm:bg-glass sm:backdrop-blur-xl"
        // Escape means "Close" here as much as it does in the cancel dialog. The
        // panel is not modal, so it only answers when the focus is inside it —
        // which it is, the title field takes it as the panel opens.
        onKeyDown={(event) => {
          if (event.key === "Escape" && !pending) {
            close(roomId);
          }
        }}
      >
        <div
          // The header is the handle: dragging it moves the panel off whatever
          // part of the grid the user wants to look at. It is a fallback for the
          // rare "the slot I need is under the form", not the main mechanism.
          onPointerDown={startDragging}
          onPointerMove={keepDragging}
          onPointerUp={stopDragging}
          onPointerCancel={stopDragging}
          className="border-border-grid relative flex flex-none touch-none items-center gap-2.5 border-b px-[18px] py-3 sm:cursor-grab sm:pt-4 sm:pb-3.5 sm:active:cursor-grabbing"
        >
          <button
            type="button"
            aria-controls="booking-form-fields"
            aria-expanded={!collapsed}
            aria-label={collapsed ? t("expandPanel") : t("collapsePanel")}
            onTouchStart={startSheetGesture}
            onTouchEnd={finishSheetGesture}
            onClick={() => {
              if (suppressSheetClick.current) {
                suppressSheetClick.current = false;
                return;
              }
              setCollapsed((value) => !value);
            }}
            className="focus-ring -my-1 flex min-w-0 flex-1 items-center gap-2 rounded-lg py-1 text-start sm:hidden"
          >
            <span className="flex min-w-0 flex-1 flex-col gap-0.5">
              <span className="text-[16px] font-extrabold tracking-[-0.01em]">
                {booking ? t("editBooking") : t("newBooking")}
              </span>
              <span className="text-text-tertiary truncate font-mono text-[11px] font-semibold">
                {getSlotLabel(labelDay, startIndex, timeZone)}–
                {getSlotLabel(labelDay, endIndex, timeZone)} ·{" "}
                {durationLabel(durationMinutes, tDuration)}
              </span>
            </span>
            {collapsed ? (
              <ChevronUp aria-hidden="true" className="size-4 flex-none" />
            ) : (
              <ChevronDown aria-hidden="true" className="size-4 flex-none" />
            )}
          </button>
          {/* Two grip lines keep the desktop panel visibly draggable. */}
          <span
            aria-hidden="true"
            className="hidden w-5 flex-none flex-col gap-[3px] sm:flex"
          >
            <span className="bg-text-tertiary h-0.5 rounded-full" />
            <span className="bg-text-tertiary h-0.5 rounded-full" />
          </span>
          <h2
            id="booking-form-title"
            className="hidden flex-1 text-base font-extrabold tracking-[-0.01em] sm:block"
          >
            {booking ? t("editBooking") : t("newBooking")}
          </h2>
          <button
            type="button"
            onClick={() => close(roomId)}
            aria-label={t("closeLabel")}
            className="focus-ring text-text-tertiary hover:bg-surface-muted hover:text-text-primary rounded-control flex h-9 w-9 items-center justify-center transition sm:h-7 sm:w-7"
          >
            <X aria-hidden="true" className="size-[18px]" />
          </button>
        </div>

        <form
          id="booking-form-fields"
          ref={formRef}
          onSubmit={handleSubmit}
          className={`${collapsed ? "hidden sm:flex" : "flex"} min-h-0 flex-1 flex-col overflow-y-auto`}
          noValidate
        >
          <div className="flex flex-col gap-[13px] px-[18px] pt-4 pb-[18px]">
            {generalError ? (
              <p
                role="alert"
                className="bg-danger-surface border-danger-border text-danger-ink rounded-control flex gap-2.5 border px-3.5 py-3 text-[13px] leading-snug font-semibold"
              >
                <CircleAlert
                  aria-hidden="true"
                  className="mt-px size-4 flex-none"
                />
                {generalError}
              </p>
            ) : null}

            {booking?.seriesId ? (
              <p className="bg-warning-surface text-warning-ink rounded-control px-3.5 py-3 text-[13px] leading-snug font-semibold">
                <Repeat
                  aria-hidden="true"
                  className="mr-1.5 inline size-3.5 align-[-2px]"
                />
                {t("seriesNote")}
              </p>
            ) : null}

            {/* Floor and capacity are how a room is actually chosen; the name
                alone means memorising which is which. */}
            <Select
              id="room"
              label={t("room")}
              value={selectedRoomId}
              onChange={pickRoom}
              options={rooms.map((room) => ({
                value: room.id,
                label: t("roomOption", {
                  name: room.name,
                  floor: room.floor,
                  capacity: room.capacity,
                }),
              }))}
            />

            {/* The date takes its own line so the two time fields get half the
                panel each. Three across 364px would clip "13:30 · 30 хв" to
                "13:30 ·", and that duration is the whole reason a range can be
                picked without dragging. */}
            <div className="flex flex-wrap gap-2">
              <div className="w-full min-w-0">
                <DatePicker
                  id="date"
                  label={t("date")}
                  locale={locale}
                  value={date}
                  onChange={setDate}
                  error={fieldError("date")}
                />
              </div>

              <div className="min-w-0 flex-1">
                {/* Only durations the rules allow are listed at all, and each
                    option says how long it makes the booking — that is what
                    replaces dragging for anyone without a mouse. */}
                <Select
                  id="start"
                  label={t("start")}
                  value={String(startIndex)}
                  onChange={(value) => changeStart(Number(value))}
                  className="font-mono text-[13px]"
                  options={Array.from({ length: SLOT_COUNT }, (_, index) => ({
                    value: String(index),
                    label: getSlotLabel(labelDay, index, timeZone),
                  }))}
                />
              </div>

              <div className="min-w-0 flex-1">
                <Select
                  id="end"
                  label={t("end")}
                  value={String(endIndex)}
                  onChange={(value) => setEndIndex(Number(value))}
                  invalid={Boolean(generalError)}
                  className={`font-mono text-[13px] ${
                    generalError ? "border-danger" : ""
                  }`}
                  options={Array.from(
                    { length: endBounds.max - endBounds.min + 1 },
                    (_, offset) => endBounds.min + offset,
                  ).map((index) => ({
                    value: String(index),
                    label: `${getSlotLabel(labelDay, index, timeZone)} · ${durationLabel(
                      (index - startIndex) * SLOT_MINUTES,
                      tDuration,
                    )}`,
                  }))}
                />
              </div>
            </div>

            {/* Said while the range is still being picked, not after the save
                comes back refused. aria-live, because on a phone the panel
                covers the grid and its red block cannot be seen. */}
            {clashes ? (
              <p
                aria-live="polite"
                className="border-danger-border bg-danger-surface text-danger-ink rounded-control flex items-start gap-2.5 border px-3.5 py-3 text-[13px] leading-snug font-semibold"
              >
                <CircleAlert
                  aria-hidden="true"
                  className="mt-px size-4 flex-none"
                />
                {t("clash")}
              </p>
            ) : null}

            {/* The answer to "then where?", offered only when that question is
                actually being asked. Listing five free rooms next to a range
                nobody objected to would be noise; next to a clash it turns a
                tour of the six rooms into one click, with the day and the time
                kept as they are. */}
            {clashes && alternatives.length > 0 ? (
              <div className="flex flex-col gap-2">
                <span className="text-text-secondary text-xs font-bold">
                  {t("freeInstead")}
                </span>
                <span className="flex flex-wrap gap-2">
                  {alternatives.map((room) => (
                    <button
                      key={room.id}
                      type="button"
                      onClick={() => pickRoom(room.id)}
                      title={t("roomOption", {
                        name: room.name,
                        floor: room.floor,
                        capacity: room.capacity,
                      })}
                      className="focus-ring bg-accent-own-surface text-accent-own-ink rounded-chip flex items-center gap-1.5 px-3 py-2 text-[12.5px] font-bold transition hover:brightness-95"
                    >
                      {room.name}
                      <span className="font-mono text-[11px]">
                        {room.capacity}
                      </span>
                    </button>
                  ))}
                </span>
              </div>
            ) : null}

            {/* The one number the form is really about, said once in the
                accent colour rather than three times in grey. */}
            <p className="bg-accent-own-surface text-accent-own-ink rounded-chip flex items-center gap-2 px-3 py-2">
              <Clock aria-hidden="true" className="size-3.5 flex-none" />
              <span className="font-mono text-xs font-semibold">
                {t("duration")} {durationLabel(durationMinutes, tDuration)} ·{" "}
                {t("maxDuration", { hours: MAX_DURATION_MINUTES / 60 })}
              </span>
            </p>

            <Input
              id="title"
              label={t("titleField")}
              placeholder={t("titlePlaceholder")}
              // The panel is not modal, so nothing moves the focus into it, and
              // the title is the field the user came here to fill in. It also
              // satisfies 2.4.11: the focus lands inside the panel, never under it.
              autoFocus
              value={title}
              maxLength={MAX_TITLE_LENGTH}
              onChange={(event) => setTitle(event.target.value)}
              error={fieldError("title")}
              labelSuffix={
                <span
                  className={`font-mono text-xs sm:text-[11px] ${
                    // The counter turns red before the limit, so the point where
                    // typing stops working is not a surprise.
                    title.length > MAX_TITLE_LENGTH - 10
                      ? "text-danger-ink"
                      : "text-text-tertiary"
                  }`}
                >
                  {title.length}/{MAX_TITLE_LENGTH}
                </span>
              }
            />

            {booking ? null : (
              <div className="border-border-grid rounded-control flex items-center gap-2 border p-3">
                <label
                  htmlFor="repeat"
                  className="flex min-w-0 flex-1 items-center gap-2 text-[12.5px] font-semibold"
                >
                  <input
                    id="repeat"
                    type="checkbox"
                    checked={repeat}
                    onChange={(event) => setRepeat(event.target.checked)}
                    className="accent-accent-own-booking focus-ring size-[18px] shrink-0 rounded-[5px]"
                  />
                  <Repeat aria-hidden="true" className="size-3.5 shrink-0" />
                  <span className="truncate">{t("repeat")}</span>
                </label>

                <div className="ml-auto flex shrink-0 items-center gap-1.5">
                  <Select
                    value={String(repeatWeeks)}
                    onChange={(value) => setRepeatWeeks(Number(value))}
                    disabled={!repeat}
                    ariaLabel={t("repeatCount")}
                    className="min-h-10 w-[58px] font-mono text-[13px] sm:min-h-8 disabled:opacity-[0.45]"
                    options={Array.from(
                      { length: MAX_OCCURRENCES - MIN_OCCURRENCES + 1 },
                      (_, offset) => MIN_OCCURRENCES + offset,
                    ).map((count) => ({
                      value: String(count),
                      label: String(count),
                    }))}
                  />
                  <span className="text-text-tertiary text-xs">
                    {t("times")}
                  </span>
                </div>
              </div>
            )}
          </div>

          {/* "Close" leaves the form, "Cancel booking" destroys the booking, and
              they never share a word. Three buttons never fit one 364px row, so
              instead of letting them wrap ragged the destructive one takes a row
              of its own under the pair that ends the form. */}
          <div className="border-border-grid flex flex-none flex-col gap-2 border-t px-[18px] py-4">
            <div className="flex items-center gap-2.5">
              <Button
                type="button"
                variant="secondary"
                size="lg"
                className="min-w-0 flex-none"
                onClick={() => close(roomId)}
              >
                {t("close")}
              </Button>
              {/* Wider than "Close": of the two ways out of the form, this is
                  the one the panel was opened for. */}
              <Button
                type="submit"
                size="lg"
                disabled={pending}
                className="flex-1"
              >
                {pending ? t("saving") : booking ? t("save") : t("book")}
              </Button>
            </div>

            {booking ? (
              <CancelBookingButton
                bookingId={booking.id}
                title={booking.title}
                isRecurring={booking.seriesId !== null}
                redirectTo={`/rooms/${roomId}?week=${weekParam}`}
                disabled={pending}
                className="w-full"
              />
            ) : null}
          </div>
        </form>
      </div>

      {/* Asked only when the jump actually costs something, and it says what:
          "the calendar will move" is not a warning, "what you typed goes" is.
          A child of the panel rather than a sibling, so it needs the pointer
          events the panel gives up on a wide screen. */}
      {switchingRoom ? (
        <div
          className="pointer-events-auto fixed inset-0 z-70 flex items-center justify-center bg-[rgb(14_22_20/0.45)] p-6"
          onKeyDown={(event) => {
            if (event.key === "Escape") {
              setSwitchingTo(null);
            }
          }}
        >
          <div
            role="alertdialog"
            aria-modal="true"
            aria-labelledby="switch-room-title"
            className="rounded-panel bg-surface border-border-grid shadow-modal animate-pop w-full max-w-[400px] border p-6"
          >
            <h2
              id="switch-room-title"
              className="mb-1.5 text-[19px] leading-snug font-extrabold tracking-[-0.02em]"
            >
              {t("switchRoomTitle")}
            </h2>
            <p className="text-text-secondary mb-4 text-[13.5px] leading-relaxed">
              {t("switchRoomText", { name: switchingRoom.name })}
            </p>
            {/* The order the cancel dialog uses, so the muscle memory of a daily
                user stays correct: the way back is always on the left. */}
            <div className="flex gap-2.5">
              <Button
                autoFocus
                variant="secondary"
                size="lg"
                className="flex-1"
                onClick={() => setSwitchingTo(null)}
              >
                {t("switchRoomStay")}
              </Button>
              <Button
                size="lg"
                className="flex-1"
                onClick={() => goToRoom(switchingRoom.id)}
              >
                {t("switchRoomGo")}
              </Button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
