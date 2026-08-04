"use client";

import { CircleAlert, Clock, Repeat, X } from "lucide-react";
import { DateTime } from "luxon";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { useEffect, useRef, useState, useSyncExternalStore } from "react";

import { CancelBookingButton } from "@/components/CancelBookingButton";
import { showToast } from "@/components/toast";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
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

// One look for all three selects and the date field; they differ only in what
// they hold. The focus state is a 1.5px edge plus a soft ring of the same
// colour, so a focused field reads as lit rather than as suddenly heavier.
const SELECT_CLASS =
  "border-border-grid bg-surface text-text-primary rounded-control min-h-11 min-w-0 border px-2.5 text-sm font-semibold transition outline-none hover:border-border-control focus-visible:border-accent-own-booking focus-visible:border-[1.5px] focus-visible:shadow-[0_0_0_3px_var(--color-accent-own-surface)] sm:min-h-10";

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
  const [error, setError] = useState<ApiError | null>(null);
  const [pending, setPending] = useState(false);

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

  return (
    <div
      // No backdrop above the sm breakpoint: the point of the panel is that the
      // schedule stays readable while it is open. On a phone there is no room
      // for both, so it covers the screen as before.
      className="fixed inset-0 z-50 flex items-end justify-center bg-[rgb(14_22_20/0.45)] backdrop-blur-[2px] sm:pointer-events-none sm:inset-auto sm:top-24 sm:right-8 sm:block sm:bg-transparent sm:backdrop-blur-none"
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
        aria-labelledby="booking-form-title"
        // Glass from sm up: the panel sits over the grid, and the point of it
        // is that the week stays readable underneath. On a phone it covers the
        // screen and there is nothing to see through, so it stays solid.
        // The sheet scrolls instead of pushing its buttons out of reach.
        className="rounded-sheet bg-surface border-border-grid shadow-modal animate-sheet sm:animate-panel sm:bg-glass sm:border-glass-edge flex max-h-[92vh] w-full flex-col overflow-hidden rounded-b-none border sm:pointer-events-auto sm:max-h-[85vh] sm:w-[364px] sm:rounded-b-[18px] sm:backdrop-blur-xl"
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
          className="border-border-grid relative flex flex-none touch-none items-center gap-2.5 border-b px-[18px] pt-4 pb-3.5 sm:cursor-grab sm:active:cursor-grabbing"
        >
          {/* A grabber on the phone sheet, two grip lines on the desktop panel:
              the same affordance in the idiom of each. */}
          <span
            aria-hidden="true"
            className="bg-border-control absolute top-2 left-1/2 h-1 w-10 -translate-x-1/2 rounded-full sm:hidden"
          />
          <span
            aria-hidden="true"
            className="hidden w-5 flex-none flex-col gap-[3px] sm:flex"
          >
            <span className="bg-text-tertiary h-0.5 rounded-full" />
            <span className="bg-text-tertiary h-0.5 rounded-full" />
          </span>
          <h2
            id="booking-form-title"
            className="flex-1 text-[17px] font-extrabold tracking-[-0.01em] sm:text-base"
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
          onSubmit={handleSubmit}
          className="flex min-h-0 flex-1 flex-col overflow-y-auto"
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

            <div className="flex flex-col gap-1">
              <label
                htmlFor="room"
                className="text-text-secondary text-[11.5px] font-bold"
              >
                {t("room")}
              </label>
              <select
                id="room"
                value={selectedRoomId}
                onChange={(event) => setSelectedRoomId(event.target.value)}
                className={SELECT_CLASS}
              >
                {/* Floor and capacity are how a room is actually chosen; the name
                    alone means memorising which is which. */}
                {rooms.map((room) => (
                  <option key={room.id} value={room.id}>
                    {t("roomOption", {
                      name: room.name,
                      floor: room.floor,
                      capacity: room.capacity,
                    })}
                  </option>
                ))}
              </select>
            </div>

            {/* The date takes its own line so the two time fields get half the
                panel each. Three across 364px would clip "13:30 · 30 хв" to
                "13:30 ·", and that duration is the whole reason a range can be
                picked without dragging. */}
            <div className="flex flex-wrap gap-2">
              <div className="flex w-full min-w-0 flex-col gap-1">
                <label
                  htmlFor="date"
                  className="text-text-secondary text-[11.5px] font-bold"
                >
                  {t("date")}
                </label>
                <input
                  id="date"
                  type="date"
                  value={date}
                  onChange={(event) => setDate(event.target.value)}
                  aria-invalid={fieldError("date") ? true : undefined}
                  aria-describedby={
                    fieldError("date") ? "date-error" : undefined
                  }
                  className={`${SELECT_CLASS} font-mono text-[13px] ${
                    fieldError("date") ? "border-danger" : ""
                  }`}
                />
                {fieldError("date") ? (
                  <p
                    id="date-error"
                    role="alert"
                    className="text-danger-ink text-xs"
                  >
                    {fieldError("date")}
                  </p>
                ) : null}
              </div>

              <div className="flex min-w-0 flex-1 flex-col gap-1">
                <label
                  htmlFor="start"
                  className="text-text-secondary text-[11.5px] font-bold"
                >
                  {t("start")}
                </label>
                <select
                  id="start"
                  value={startIndex}
                  onChange={(event) => changeStart(Number(event.target.value))}
                  className={`${SELECT_CLASS} font-mono text-[13px]`}
                >
                  {Array.from({ length: SLOT_COUNT }, (_, index) => (
                    <option key={index} value={index}>
                      {getSlotLabel(labelDay, index, timeZone)}
                    </option>
                  ))}
                </select>
              </div>

              <div className="flex min-w-0 flex-1 flex-col gap-1">
                <label
                  htmlFor="end"
                  className="text-text-secondary text-[11.5px] font-bold"
                >
                  {t("end")}
                </label>
                <select
                  id="end"
                  value={endIndex}
                  onChange={(event) => setEndIndex(Number(event.target.value))}
                  className={`${SELECT_CLASS} font-mono text-[13px] ${
                    generalError ? "border-danger" : ""
                  }`}
                >
                  {/* Only durations the rules allow are listed at all, and each
                      option says how long it makes the booking — that is what
                      replaces dragging for anyone without a mouse. */}
                  {Array.from(
                    { length: endBounds.max - endBounds.min + 1 },
                    (_, offset) => endBounds.min + offset,
                  ).map((index) => (
                    <option key={index} value={index}>
                      {getSlotLabel(labelDay, index, timeZone)} ·{" "}
                      {durationLabel(
                        (index - startIndex) * SLOT_MINUTES,
                        tDuration,
                      )}
                    </option>
                  ))}
                </select>
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
                      onClick={() => setSelectedRoomId(room.id)}
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
              // Two lines on a phone rather than one squeezed one: side by side,
              // the label wrapped under its own checkbox and left the count
              // crushed against the edge.
              <div className="border-border-grid rounded-control flex flex-col gap-2.5 border p-3 sm:flex-row sm:items-center">
                <label
                  htmlFor="repeat"
                  className="flex flex-1 items-center gap-2.5 text-[13px] font-semibold"
                >
                  <input
                    id="repeat"
                    type="checkbox"
                    checked={repeat}
                    onChange={(event) => setRepeat(event.target.checked)}
                    className="accent-accent-own-booking focus-ring size-[18px] shrink-0 rounded-[5px]"
                  />
                  <Repeat aria-hidden="true" className="size-3.5 shrink-0" />
                  {t("repeat")}
                </label>

                <div className="flex items-center gap-2 ps-[30px] sm:ps-0">
                  <select
                    value={repeatWeeks}
                    onChange={(event) =>
                      setRepeatWeeks(Number(event.target.value))
                    }
                    disabled={!repeat}
                    aria-label={t("repeatCount")}
                    className={`${SELECT_CLASS} min-h-11 font-mono text-[13px] sm:min-h-8 disabled:opacity-[0.45]`}
                  >
                    {Array.from(
                      { length: MAX_OCCURRENCES - MIN_OCCURRENCES + 1 },
                      (_, offset) => MIN_OCCURRENCES + offset,
                    ).map((count) => (
                      <option key={count} value={count}>
                        {count}
                      </option>
                    ))}
                  </select>
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
    </div>
  );
}
