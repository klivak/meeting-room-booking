"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

import { showToast } from "@/components/toast";
import { Button } from "@/components/ui/Button";

type CancelBookingButtonProps = {
  bookingId: string;
  title: string;
  /** True when the booking is one occurrence of a weekly series. */
  isRecurring?: boolean;
  /** Where to go after cancelling; by default the current page is refreshed. */
  redirectTo?: string;
};

/**
 * Cancels a booking after an explicit confirmation. Cancelling is a soft delete
 * on the server, but for the user it is destructive, so it never happens on a
 * single click.
 */
export function CancelBookingButton({
  bookingId,
  title,
  isRecurring = false,
  redirectTo,
}: CancelBookingButtonProps) {
  const router = useRouter();
  const [confirming, setConfirming] = useState(false);
  const [pending, setPending] = useState(false);
  const [failed, setFailed] = useState(false);

  async function cancel(scope: "occurrence" | "series") {
    setPending(true);
    setFailed(false);

    const response = await fetch(
      scope === "series"
        ? `/api/bookings/${bookingId}?scope=series`
        : `/api/bookings/${bookingId}`,
      { method: "DELETE" },
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

    showToast(scope === "series" ? "Серію скасовано" : "Бронювання скасовано");

    if (redirectTo) {
      router.replace(redirectTo);
    }
    router.refresh();
  }

  return (
    <>
      <Button variant="ghost" onClick={() => setConfirming(true)}>
        Скасувати
      </Button>

      {confirming ? (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 p-4"
          onClick={() => (pending ? null : setConfirming(false))}
        >
          <div
            role="alertdialog"
            aria-modal="true"
            aria-labelledby="cancel-booking-title"
            className="w-full max-w-sm rounded-xl bg-white p-5 shadow-xl"
            onClick={(event) => event.stopPropagation()}
          >
            <h2
              id="cancel-booking-title"
              className="text-base font-semibold text-slate-900"
            >
              Скасувати бронювання «{title}»?
            </h2>
            <p className="mt-2 text-sm text-slate-600">
              {isRecurring
                ? "Це частина щотижневої серії. Оберіть, що саме скасувати — час стане вільним для інших."
                : "Бронювання зникне з розкладу, а час стане вільним для інших."}
            </p>

            {failed ? (
              <p role="alert" className="mt-3 text-sm text-red-600">
                Не вдалося скасувати. Спробуйте ще раз.
              </p>
            ) : null}

            <div className="mt-4 flex flex-wrap justify-end gap-2">
              <Button
                variant="ghost"
                onClick={() => setConfirming(false)}
                disabled={pending}
              >
                Ні
              </Button>
              <Button
                variant="danger"
                onClick={() => cancel("occurrence")}
                disabled={pending}
              >
                {pending ? "Скасовуємо…" : isRecurring ? "Лише це" : "Так, скасувати"}
              </Button>
              {isRecurring ? (
                <Button
                  variant="danger"
                  onClick={() => cancel("series")}
                  disabled={pending}
                >
                  Всю серію
                </Button>
              ) : null}
            </div>
          </div>
        </div>
      ) : null}
    </>
  );
}
