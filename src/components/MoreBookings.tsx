"use client";

import { useState } from "react";

import { BookingRow, type MyBooking } from "@/components/BookingRow";
import { Button } from "@/components/ui/Button";

type MoreBookingsProps = {
  /** Cursor after the page the server already rendered. */
  initialCursor: string;
  now: string;
  scope: "upcoming" | "past";
};

/**
 * "Show more" for either tab. The server renders the first page; every next one
 * is fetched by cursor, which is what keeps rows from being duplicated or
 * skipped when two bookings share a start time.
 */
export function MoreBookings({ initialCursor, now, scope }: MoreBookingsProps) {
  const [items, setItems] = useState<MyBooking[]>([]);
  const [cursor, setCursor] = useState<string | null>(initialCursor);
  const [pending, setPending] = useState(false);
  const [failed, setFailed] = useState(false);

  async function loadMore() {
    setPending(true);
    setFailed(false);

    const response = await fetch(
      `/api/my-bookings?scope=${scope}&cursor=${encodeURIComponent(cursor ?? "")}`,
    ).catch(() => null);

    if (!response?.ok) {
      setFailed(true);
      setPending(false);
      return;
    }

    const body = await response.json();
    setItems((current) => [...current, ...body.items]);
    setCursor(body.nextCursor);
    setPending(false);
  }

  return (
    <>
      {items.length > 0 ? (
        <ul className="flex flex-col gap-2">
          {items.map((booking) => (
            <BookingRow key={booking.id} booking={booking} now={now} />
          ))}
        </ul>
      ) : null}

      {cursor ? (
        <div className="flex flex-col items-start gap-2">
          {failed ? (
            <p role="alert" className="text-sm text-red-600">
              Не вдалося завантажити. Спробуйте ще раз.
            </p>
          ) : null}
          <Button variant="ghost" onClick={loadMore} disabled={pending}>
            {pending ? "Завантажуємо…" : "Показати ще"}
          </Button>
        </div>
      ) : null}
    </>
  );
}
