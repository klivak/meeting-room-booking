"use client";

import { Trash2 } from "lucide-react";
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
  /**
   * Short trigger label. The panel has room for "Скасувати бронювання"; a row
   * in a list does not, and the booking it belongs to is named beside it.
   */
  short?: boolean;
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
  short = false,
}: CancelBookingButtonProps) {
  const router = useRouter();
  const t = useTranslations("cancel");
  const [confirming, setConfirming] = useState(false);
  const [pending, setPending] = useState(false);
  const [failed, setFailed] = useState(false);
  // What "yes" means for a series. Asked as a choice rather than as two
  // destructive buttons: picking is a separate act from confirming, and only
  // one of the two should be able to destroy eight bookings.
  const [scope, setScope] = useState<"occurrence" | "series">("occurrence");
  // The dialog takes the focus, so it has to give it back when it closes.
  const trigger = useRef<HTMLButtonElement>(null);

  function closeDialog() {
    setConfirming(false);
    setFailed(false);
    setScope("occurrence");
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
        {short ? t("cancelShort") : t("cancel")}
      </Button>

      {confirming ? (
        <div
          className="fixed inset-0 z-70 flex items-center justify-center bg-[rgb(14_22_20/0.45)] p-6"
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

            // The dialog is modal, so Tab has to stay inside it: its own
            // controls are the only answers, and the page behind is not one.
            const focusable = Array.from(
              event.currentTarget.querySelectorAll<HTMLElement>(
                "button:not(:disabled), input:not(:disabled)",
              ),
            );
            const edge = event.shiftKey
              ? focusable[0]
              : focusable[focusable.length - 1];

            if (document.activeElement === edge) {
              event.preventDefault();
              (event.shiftKey
                ? focusable[focusable.length - 1]
                : focusable[0]
              )?.focus();
            }
          }}
        >
          <div
            role="alertdialog"
            aria-modal="true"
            aria-labelledby="cancel-booking-title"
            className="rounded-panel bg-surface border-border-grid shadow-modal animate-pop w-full max-w-[400px] border p-6"
          >
            {/* The badge says "destructive" before the sentence is read; the
                wording then says exactly what is about to be destroyed. */}
            <span
              aria-hidden="true"
              className="bg-danger-surface text-danger rounded-panel mb-4 flex size-[46px] items-center justify-center"
            >
              <Trash2 className="size-[22px]" />
            </span>
            <h2
              id="cancel-booking-title"
              className="mb-1.5 text-[19px] leading-snug font-extrabold tracking-[-0.02em]"
            >
              {t("question", { title })}
            </h2>
            <p className="text-text-secondary mb-4 text-[13.5px] leading-relaxed">
              {isRecurring ? t("seriesExplanation") : t("explanation")}
            </p>

            {isRecurring ? (
              <div className="mb-5 flex flex-col gap-2">
                {(["occurrence", "series"] as const).map((option) => (
                  <label
                    key={option}
                    className={`rounded-control flex items-center gap-2.5 border p-3 transition ${
                      scope === option
                        ? "border-accent-own-booking bg-accent-own-surface border-[1.5px]"
                        : "border-border-grid hover:border-border-control"
                    }`}
                  >
                    <input
                      type="radio"
                      name="cancel-scope"
                      value={option}
                      checked={scope === option}
                      onChange={() => setScope(option)}
                      disabled={pending}
                      className="accent-accent-own-booking focus-ring size-4"
                    />
                    <span
                      className={`text-[13.5px] ${
                        scope === option
                          ? "text-text-primary font-bold"
                          : "text-text-secondary font-semibold"
                      }`}
                    >
                      {option === "occurrence"
                        ? t("onlyThis")
                        : t("wholeSeries")}
                    </span>
                  </label>
                ))}
              </div>
            ) : null}

            {failed ? (
              <p
                role="alert"
                className="bg-danger-surface border-danger-border text-danger-ink rounded-control mb-4 border px-3.5 py-3 text-[13px] leading-snug font-semibold"
              >
                {t("failed")}
              </p>
            ) : null}

            {/* The order never changes and the destructive choice is always on
                the right, so the muscle memory of a daily user stays correct. */}
            <div className="flex gap-2.5">
              <Button
                autoFocus
                variant="secondary"
                size="lg"
                className="flex-1"
                onClick={closeDialog}
                disabled={pending}
              >
                {t("no")}
              </Button>
              <Button
                variant="dangerSolid"
                size="lg"
                className="flex-1"
                onClick={() => cancel(isRecurring ? scope : "occurrence")}
                disabled={pending}
              >
                {pending ? t("canceling") : t("yes")}
              </Button>
            </div>
          </div>
        </div>
      ) : null}
    </>
  );
}
