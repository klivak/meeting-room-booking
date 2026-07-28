"use client";

import { DateTime } from "luxon";
import { useRouter } from "next/navigation";
import { useState, useSyncExternalStore } from "react";

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
import {
  SLOT_COUNT,
  getEndSlotBounds,
  getSlotIndex,
  getSlotLabel,
  getSlotStart,
} from "@/lib/domain/grid";

type RoomOption = { id: string; name: string };

type ApiError = { code: string; message: string; field?: string };

export type EditableBooking = {
  id: string;
  roomId: string;
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
  booking,
}: BookingPanelProps) {
  const [toast, setToast] = useState<string | null>(null);

  const showToast = (message: string) => {
    setToast(message);
    setTimeout(() => setToast(null), 4000);
  };

  return (
    <>
      {slot || booking ? (
        // The key resets the form when a different slot or booking is picked.
        <BookingForm
          key={booking?.id ?? slot}
          rooms={rooms}
          roomId={roomId}
          weekParam={weekParam}
          slot={slot}
          booking={booking}
          onSaved={showToast}
        />
      ) : null}

      {toast ? (
        <p
          role="status"
          className="fixed right-4 bottom-4 z-50 rounded-lg bg-slate-900 px-4 py-2 text-sm text-white shadow-lg"
        >
          {toast}
        </p>
      ) : null}
    </>
  );
}

function BookingForm({
  rooms,
  roomId,
  weekParam,
  slot,
  booking,
  onSaved,
}: BookingPanelProps & { onSaved: (message: string) => void }) {
  const router = useRouter();
  const timeZone = useSyncExternalStore(
    noopSubscribe,
    readViewerTimeZone,
    readOfficeTimeZone,
  );

  // Editing prefills from the booking; creating starts at the clicked cell and
  // a click means "this half hour", so the end is one slot later.
  const start = DateTime.fromISO(booking?.startsAt ?? slot ?? "", { zone: OFFICE_TZ });
  const initialStart = Math.min(getSlotIndex(start.toJSDate()), SLOT_COUNT - 1);
  const initialEnd = booking
    ? getSlotIndex(new Date(booking.endsAt))
    : initialStart + 1;

  const [selectedRoomId, setSelectedRoomId] = useState(booking?.roomId ?? roomId);
  const [date, setDate] = useState(start.toISODate() ?? "");
  const [startIndex, setStartIndex] = useState(initialStart);
  const [endIndex, setEndIndex] = useState(initialEnd);
  const [title, setTitle] = useState(booking?.title ?? "");
  const [error, setError] = useState<ApiError | null>(null);
  const [pending, setPending] = useState(false);

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
      onSaved(booking ? "Зміни збережено" : "Бронювання створено");
      close(selectedRoomId);
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

  return (
    <div
      className="fixed inset-0 z-40 flex items-end justify-center bg-slate-900/40 p-4 sm:items-center"
      onClick={() => close(roomId)}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="booking-form-title"
        className="w-full max-w-md rounded-xl bg-white p-5 shadow-xl"
        onClick={(event) => event.stopPropagation()}
      >
        <div className="mb-4 flex items-center justify-between gap-4">
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
              className="rounded-lg border border-slate-300 px-3 py-2 text-slate-900"
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
                className="rounded-lg border border-slate-300 px-3 py-2 text-slate-900"
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
                className="rounded-lg border border-slate-300 px-3 py-2 text-slate-900"
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

          <div className="flex justify-end gap-2">
            <Button type="button" variant="ghost" onClick={() => close(roomId)}>
              Скасувати
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
