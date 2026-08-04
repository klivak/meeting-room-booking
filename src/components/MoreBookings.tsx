"use client";

import { useTranslations } from "next-intl";
import { useRouter } from "next/navigation";
import { useState } from "react";

import { BookingRow, type MyBooking } from "@/components/BookingRow";
import { Button } from "@/components/ui/Button";

type MoreBookingsProps = {
  /** Cursor after the page the server already rendered. */
  initialCursor: string;
  now: string;
  scope: "upcoming" | "past";
  /** Rows the server rendered, so the end note can name the real total. */
  loaded: number;
};

/**
 * "Show more" for either tab. The server renders the first page; every next one
 * is fetched by cursor, which is what keeps rows from being duplicated or
 * skipped when two bookings share a start time.
 *
 * A failed page does not disturb the rows already on screen: they are still
 * true, and re-rendering them would lose the reader's place.
 */
export function MoreBookings({ initialCursor, now, scope, loaded }: MoreBookingsProps) {
  const router = useRouter();
  const t = useTranslations("myBookings");
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

    // An expired session is not a failure to report, it is a reason to sign in again.
    if (response?.status === 401) {
      router.replace("/login");
      return;
    }

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
        <ul className="flex flex-col gap-3">
          {items.map((booking) => (
            <BookingRow key={booking.id} booking={booking} now={now} />
          ))}
        </ul>
      ) : null}

      <div className="flex flex-col items-center gap-2 pt-1">
        {failed ? (
          <p role="alert" className="text-danger-ink text-[13px]">
            {t("loadFailed")}
          </p>
        ) : null}

        {cursor ? (
          <Button variant="secondary" size="lg" onClick={loadMore} disabled={pending}>
            {pending ? t("loadingMore") : failed ? t("retry") : t("showMore")}
          </Button>
        ) : (
          <p className="text-text-tertiary text-[13px]">
            {t("endOfList", { count: loaded + items.length })}
          </p>
        )}
      </div>
    </>
  );
}
