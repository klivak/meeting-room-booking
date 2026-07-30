"use client";

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

  // Three tones, not two: "free from 17:00" is neither the green "go now" nor
  // the grey "not today", and the middle answer is the one worth acting on fast.
  const tone =
    availability.kind === "free"
      ? "text-success"
      : availability.kind === "freeFrom"
        ? "text-warning-ink"
        : "text-text-tertiary";

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
    <span className={`flex items-center gap-1.5 text-xs font-semibold ${tone}`}>
      {/* The dot is a second, redundant signal, not the only one: the sentence
          next to it already says everything. */}
      <span aria-hidden="true" className="size-1.5 shrink-0 rounded-full bg-current" />
      {text}
    </span>
  );
}
