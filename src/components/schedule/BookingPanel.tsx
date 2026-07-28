"use client";

import { DateTime } from "luxon";
import { useRouter } from "next/navigation";
import { useRef, useState, useSyncExternalStore } from "react";

import { CancelBookingButton } from "@/components/CancelBookingButton";
import { showToast } from "@/components/toast";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import {
  noopSubscribe,
  readOfficeTimeZone,
  readViewerTimeZone,
} from "@/components/viewerTimeZone";
import { createBookingSchema } from "@/lib/domain/bookingInput";
import { MAX_TITLE_LENGTH, validateTitle } from "@/lib/domain/bookingRules";
import { OFFICE_TZ } from "@/lib/domain/constants";
import { MAX_OCCURRENCES, MIN_OCCURRENCES } from "@/lib/domain/recurrence";
import {
  SLOT_COUNT,
  getEndSlotBounds,
  getSlotIndex,
  getSlotLabel,
  getSlotStart,
} from "@/lib/domain/grid";

type RoomOption = { id: string; name: string };

type ApiError = { code: string; message: string; field?: string };

// The panel floats beside the grid from the sm breakpoint up and covers the
// screen below it. The server cannot know which, so it renders the phone layout
// and the browser corrects it after hydration.
const WIDE_SCREEN = "(min-width: 640px)";

function subscribeToWideScreen(onChange: () => void) {
  const query = window.matchMedia(WIDE_SCREEN);
  query.addEventListener("change", onChange);

  return () => query.removeEventListener("change", onChange);
}

const readWide = () => window.matchMedia(WIDE_SCREEN).matches;
const readNotWide = () => false;

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
  const timeZone = useSyncExternalStore(
    noopSubscribe,
    readViewerTimeZone,
    readOfficeTimeZone,
  );

  // Editing prefills from the booking; creating starts at the picked cell. A
  // dragged range brings its own end, a plain click means "this half hour".
  const start = DateTime.fromISO(booking?.startsAt ?? slot ?? "", { zone: OFFICE_TZ });
  const initialStart = Math.min(getSlotIndex(start.toJSDate()), SLOT_COUNT - 1);
  const initialEnd = booking
    ? getSlotIndex(new Date(booking.endsAt))
    : slotEnd
      ? getSlotIndex(new Date(slotEnd))
      : initialStart + 1;

  const [selectedRoomId, setSelectedRoomId] = useState(booking?.roomId ?? roomId);
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
  const [position, setPosition] = useState<{ x: number; y: number } | null>(null);
  const dragOffset = useRef<{ x: number; y: number } | null>(null);
  const isWide = useSyncExternalStore(subscribeToWideScreen, readWide, readNotWide);

  const day = DateTime.fromISO(date, { zone: OFFICE_TZ });
  const endBounds = getEndSlotBounds(startIndex);

  const close = (targetRoomId: string) => {
    router.replace(`/rooms/${targetRoomId}?week=${weekParam}`);
    router.refresh();
  };

  /** Keeps the end after the start when the start moves. */
  const changeStart = (nextStart: number) => {
    setStartIndex(nextStart);
    const bounds = getEndSlotBounds(nextStart);
    setEndIndex((current) => Math.min(Math.max(current, bounds.min), bounds.max));
  };

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();

    const titleError = validateTitle(title);
    if (titleError) {
      setError({ ...titleError, field: "title" });
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
        message: issue.message,
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
      showToast(booking ? "Зміни збережено" : "Бронювання створено");
      close(selectedRoomId);
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
        message: "Не вдалося зберегти бронювання. Спробуйте ще раз",
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

  function startDragging(event: React.PointerEvent<HTMLDivElement>) {
    const panel = event.currentTarget.parentElement;
    if (!isWide || !panel) {
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
      className="fixed inset-0 z-40 flex items-stretch justify-center bg-slate-900/40 sm:pointer-events-none sm:inset-auto sm:top-20 sm:right-6 sm:block sm:bg-transparent"
      style={panelStyle}
      onClick={(event) => {
        // Only the phone overlay closes on a tap outside it.
        if (event.currentTarget === event.target) {
          close(roomId);
        }
      }}
    >
      <div
        role="dialog"
        aria-modal="false"
        aria-labelledby="booking-form-title"
        // The sheet scrolls instead of pushing its buttons out of reach.
        className="w-full overflow-y-auto bg-white p-5 shadow-xl sm:pointer-events-auto sm:max-h-[85vh] sm:w-96 sm:rounded-xl sm:border sm:border-slate-200"
      >
        <div
          // The header is the handle: dragging it moves the panel off whatever
          // part of the grid the user wants to look at.
          onPointerDown={startDragging}
          onPointerMove={keepDragging}
          onPointerUp={stopDragging}
          onPointerCancel={stopDragging}
          className="mb-4 flex touch-none items-center justify-between gap-4 sm:cursor-grab sm:active:cursor-grabbing"
        >
          <h2 id="booking-form-title" className="text-lg font-semibold text-slate-900">
            {booking ? "Редагувати бронювання" : "Нове бронювання"}
          </h2>
          <button
            type="button"
            onClick={() => close(roomId)}
            aria-label="Закрити"
            className="rounded-lg px-2 py-1 text-slate-500 transition hover:bg-slate-100"
          >
            ✕
          </button>
        </div>

        <form onSubmit={handleSubmit} className="flex flex-col gap-4" noValidate>
          {generalError ? (
            <p
              role="alert"
              className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700"
            >
              {generalError}
            </p>
          ) : null}

          <div className="flex flex-col gap-1.5">
            <label htmlFor="room" className="text-sm font-medium text-slate-700">
              Кімната
            </label>
            <select
              id="room"
              value={selectedRoomId}
              onChange={(event) => setSelectedRoomId(event.target.value)}
              className="min-h-11 rounded-lg border border-slate-300 px-3 py-2 text-slate-900 sm:min-h-0"
            >
              {rooms.map((room) => (
                <option key={room.id} value={room.id}>
                  {room.name}
                </option>
              ))}
            </select>
          </div>

          <Input
            id="date"
            type="date"
            label="Дата"
            value={date}
            onChange={(event) => setDate(event.target.value)}
            error={fieldError("startsAt")}
          />

          <div className="grid grid-cols-2 gap-3">
            <div className="flex flex-col gap-1.5">
              <label htmlFor="start" className="text-sm font-medium text-slate-700">
                Початок
              </label>
              <select
                id="start"
                value={startIndex}
                onChange={(event) => changeStart(Number(event.target.value))}
                className="min-h-11 rounded-lg border border-slate-300 px-3 py-2 text-slate-900 sm:min-h-0"
              >
                {Array.from({ length: SLOT_COUNT }, (_, index) => (
                  <option key={index} value={index}>
                    {getSlotLabel(day, index, timeZone)}
                  </option>
                ))}
              </select>
            </div>

            <div className="flex flex-col gap-1.5">
              <label htmlFor="end" className="text-sm font-medium text-slate-700">
                Кінець
              </label>
              <select
                id="end"
                value={endIndex}
                onChange={(event) => setEndIndex(Number(event.target.value))}
                className="min-h-11 rounded-lg border border-slate-300 px-3 py-2 text-slate-900 sm:min-h-0"
              >
                {/* Only durations the rules allow are listed at all. */}
                {Array.from(
                  { length: endBounds.max - endBounds.min + 1 },
                  (_, offset) => endBounds.min + offset,
                ).map((index) => (
                  <option key={index} value={index}>
                    {getSlotLabel(day, index, timeZone)}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div>
            <Input
              id="title"
              label="Назва"
              value={title}
              maxLength={MAX_TITLE_LENGTH}
              onChange={(event) => setTitle(event.target.value)}
              error={fieldError("title")}
            />
            <p className="mt-1 text-right text-xs text-slate-500">
              {title.trim().length}/{MAX_TITLE_LENGTH}
            </p>
          </div>

          {booking ? (
            booking.seriesId ? (
              <p className="rounded-lg bg-slate-100 px-3 py-2 text-sm text-slate-600">
                Це входження щотижневої серії. Зміни торкнуться лише його.
              </p>
            ) : null
          ) : (
            <div className="flex flex-col gap-2">
              <label className="flex items-center gap-2 text-sm text-slate-700">
                <input
                  type="checkbox"
                  checked={repeat}
                  onChange={(event) => setRepeat(event.target.checked)}
                  className="h-4 w-4"
                />
                Повторювати щотижня
              </label>

              {repeat ? (
                <label className="flex items-center gap-2 text-sm text-slate-700">
                  Кількість
                  <select
                    value={repeatWeeks}
                    onChange={(event) => setRepeatWeeks(Number(event.target.value))}
                    className="min-h-11 rounded-lg border border-slate-300 px-3 py-2 text-slate-900 sm:min-h-0"
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
                </label>
              ) : null}
            </div>
          )}

          <div className="flex flex-wrap items-center justify-end gap-2">
            {booking ? (
              <div className="mr-auto">
                <CancelBookingButton
                  bookingId={booking.id}
                  title={booking.title}
                  isRecurring={booking.seriesId !== null}
                  redirectTo={`/rooms/${roomId}?week=${weekParam}`}
                />
              </div>
            ) : null}

            <Button type="button" variant="ghost" onClick={() => close(roomId)}>
              Закрити
            </Button>
            <Button type="submit" disabled={pending}>
              {pending ? "Зберігаємо…" : booking ? "Зберегти" : "Забронювати"}
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
}
