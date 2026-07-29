"use client";

import { useTranslations } from "next-intl";
import { useRouter } from "next/navigation";
import { useRef, useState } from "react";

import { showToast } from "@/components/toast";
import { Button } from "@/components/ui/Button";

type CancelBookingButtonProps = {
  bookingId: string;
  title: string;
  /** True when the booking is one occurrence of a weekly series. */
  isRecurring?: boolean;
  /** Where to go after cancelling; by default the current page is refreshed. */
  redirectTo?: string;
  disabled?: boolean;
  /** Extra classes for the trigger, so a caller can size it to its own row. */
  className?: string;
};

/**
 * Cancels a booking after an explicit confirmation, and offers to take it back.
 *
 * The dialog comes first and stays: the moment the slot is free someone else can
 * take it, so an undo is a shortcut and never a guarantee. That is also why the
 * undo asks the server rather than assuming — if the slot went in those few
 * seconds, it says so instead of quietly doing nothing.
 *
 * A whole series gets no undo. Restoring one occurrence is a question with one
 * answer; restoring eight of them, some of which may have been taken while the
 * toast was on screen, is not something a single button can honestly promise.
 */
export function CancelBookingButton({
  bookingId,
  title,
  isRecurring = false,
  redirectTo,
  disabled = false,
  className,
}: CancelBookingButtonProps) {
  const router = useRouter();
  const t = useTranslations("cancel");
  const [confirming, setConfirming] = useState(false);
  const [pending, setPending] = useState(false);
  const [failed, setFailed] = useState(false);
  // The dialog takes the focus, so it has to give it back when it closes.
  const trigger = useRef<HTMLButtonElement>(null);

  function closeDialog() {
    setConfirming(false);
    setFailed(false);
    trigger.current?.focus();
  }

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
      // The dialog stays open: the booking is still there, and so is the choice.
      setFailed(true);
      setPending(false);
      return;
    }

    if (scope === "series") {
      showToast(t("seriesDone"));
    } else {
      showToast(t("done"), { label: t("undo"), run: restore });
    }

    if (redirectTo) {
      router.replace(redirectTo);
    }
    router.refresh();
  }

  /** Asks for the cancellation back; the slot may be gone, and then it says so. */
  async function restore() {
    const response = await fetch(`/api/bookings/${bookingId}/restore`, {
      method: "POST",
    }).catch(() => null);

    if (response?.status === 401) {
      router.replace("/login");
      return;
    }

    if (!response?.ok) {
      const body = await response?.json().catch(() => null);
      showToast(body?.error?.message ?? t("undoFailed"));
      return;
    }

    showToast(t("undone"));

    // The row is gone from "upcoming" after the cancel, so coming back is a
    // navigation as much as a refresh; whichever page called this shows it again.
    router.refresh();
  }

  return (
    <>
      <Button
        ref={trigger}
        variant="danger"
        onClick={() => setConfirming(true)}
        disabled={disabled}
        className={className}
      >
        {t("cancel")}
      </Button>

      {confirming ? (
        <div
          className="fixed inset-0 z-70 flex items-center justify-center bg-[oklch(0.24_0.02_264/0.45)] p-6"
          onClick={(event) => {
            if (event.currentTarget === event.target && !pending) {
              closeDialog();
            }
          }}
          onKeyDown={(event) => {
            // Escape means the same as "No", which is why it is allowed at all.
            if (event.key === "Escape" && !pending) {
              closeDialog();
              return;
            }

            if (event.key !== "Tab") {
              return;
            }

            // The dialog is modal, so Tab has to stay inside it: the three
            // buttons are the only answers, and the page behind is not one.
            const buttons = Array.from(
              event.currentTarget.querySelectorAll<HTMLButtonElement>(
                "button:not(:disabled)",
              ),
            );
            const edge = event.shiftKey ? buttons[0] : buttons[buttons.length - 1];

            if (document.activeElement === edge) {
              event.preventDefault();
              (event.shiftKey ? buttons[buttons.length - 1] : buttons[0])?.focus();
            }
          }}
        >
          <div
            role="alertdialog"
            aria-modal="true"
            aria-labelledby="cancel-booking-title"
            className="rounded-panel bg-surface border-border-control shadow-modal animate-rise w-full max-w-[420px] overflow-hidden border"
          >
            <div className="flex flex-col gap-2 px-5 pt-4.5 pb-3.5">
              <h2
                id="cancel-booking-title"
                className="text-[17px] leading-snug font-semibold tracking-tight"
              >
                {t("question", { title })}
              </h2>
              <p className="text-text-secondary text-sm leading-relaxed">
                {isRecurring ? t("seriesExplanation") : t("explanation")}
              </p>

              {failed ? (
                <p
                  role="alert"
                  className="bg-danger-surface border-danger text-danger-ink rounded-control mt-1 border px-3 py-2.5 text-[13px] leading-snug"
                >
                  {t("failed")}
                </p>
              ) : null}
            </div>

            {/* The order never changes and the most destructive choice is always
                on the right, so the muscle memory of a daily user stays correct. */}
            <div className="flex flex-wrap justify-end gap-2 px-5 pt-1 pb-4">
              <Button
                autoFocus
                variant="secondary"
                onClick={closeDialog}
                disabled={pending}
              >
                {t("no")}
              </Button>
              {isRecurring ? (
                <Button
                  variant="danger"
                  onClick={() => cancel("occurrence")}
                  disabled={pending}
                >
                  {t("onlyThis")}
                </Button>
              ) : null}
              <Button
                variant="dangerSolid"
                onClick={() => cancel(isRecurring ? "series" : "occurrence")}
                disabled={pending}
              >
                {pending ? t("canceling") : isRecurring ? t("wholeSeries") : t("yes")}
              </Button>
            </div>
          </div>
        </div>
      ) : null}
    </>
  );
}
