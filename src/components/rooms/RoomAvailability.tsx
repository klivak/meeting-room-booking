"use client";

import { ChevronRight } from "lucide-react";
import { DateTime } from "luxon";
import { useTranslations } from "next-intl";
import { useSyncExternalStore } from "react";

import {
  noopSubscribe,
  readOfficeTimeZone,
  readViewerTimeZone,
} from "@/components/viewerTimeZone";
import type { RoomAvailability as Availability } from "@/lib/domain/availability";

/** The same answer as the domain type, with the instant already serialised. */
export type RoomAvailabilityView =
  | { kind: Exclude<Availability["kind"], "freeFrom"> }
  | { kind: "freeFrom"; at: string };

// Three tones, not two: "вільна з 17:00" is neither the green "go now" nor the
// grey "not today", and the middle answer is the one worth acting on fast.
const TONES = {
  free: "bg-success-surface text-success-ink",
  freeFrom: "bg-warning-surface text-warning-ink",
  quiet: "bg-surface-muted text-text-secondary",
};

const DOTS = {
  free: "bg-accent-own-booking shadow-[0_0_0_3px_var(--color-accent-own-surface)]",
  freeFrom: "bg-now-line",
  quiet: "bg-text-tertiary",
};

/**
 * The bottom line of a room card: can I go there now, and if not, when. It
 * removes the most common wasted step — opening a room only to find it taken.
 * The time is shown in the viewer's timezone, like every other time here.
 */
export function RoomAvailability({ availability }: { availability: RoomAvailabilityView }) {
  const t = useTranslations("rooms");
  const timeZone = useSyncExternalStore(
    noopSubscribe,
    readViewerTimeZone,
    readOfficeTimeZone,
  );

  const tone =
    availability.kind === "free"
      ? "free"
      : availability.kind === "freeFrom"
        ? "freeFrom"
        : "quiet";

  const text =
    availability.kind === "free"
      ? t("freeNow")
      : availability.kind === "freeFrom"
        ? t("freeFrom", {
            time: DateTime.fromISO(availability.at).setZone(timeZone).toFormat("HH:mm"),
          })
        : availability.kind === "busyToday"
          ? t("busyToday")
          : t("dayOver");

  return (
    // A tinted strip rather than a line of coloured text: it is the answer the
    // card exists for, and at the bottom of a white card a bare sentence gets
    // lost under the name.
    <span
      className={`rounded-chip flex items-center gap-2 px-3 py-2 text-[13px] font-bold ${TONES[tone]}`}
    >
      {/* The dot is a second, redundant signal, not the only one: the sentence
          next to it already says everything. */}
      <span aria-hidden="true" className={`size-2 shrink-0 rounded-full ${DOTS[tone]}`} />
      {text}
      <ChevronRight
        aria-hidden="true"
        className="ml-auto size-4 shrink-0"
        strokeWidth={2.2}
      />
    </span>
  );
}
