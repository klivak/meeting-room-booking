"use client";

import { useTranslations } from "next-intl";
import Link from "next/link";

export type BookingView = {
  id: string;
  title: string;
  startsAt: string;
  endsAt: string;
  user: { id: string; name: string };
  isMine: boolean;
  /** One occurrence of a weekly series; marked so it is not mistaken for a one-off. */
  isRecurring: boolean;
};

/** Yours and still open, yours and over, or someone else's. */
export type BookingState = "own" | "finished" | "other";

type BookingBlockProps = {
  booking: BookingView;
  state: BookingState;
  /** Start and end in the viewer's timezone, already formatted. */
  range: string;
  /** Just the start; a half-hour block has no room for the whole range. */
  start: string;
  /** True for a half-hour block, which has to fit everything on one line. */
  compact: boolean;
  /** Present only for a booking the viewer may still act on. */
  href?: string;
  isSelected: boolean;
  /**
   * False while a range is being dragged. The block then lets the pointer
   * through to the cells underneath, so a drag can be pulled across an occupied
   * stretch instead of stopping dead at its edge — and the range that comes out
   * of it is shown as the clash it is.
   */
  interactive: boolean;
  style: React.CSSProperties;
};

// Three textures, not three shades: the fill plus a left bar for yours, diagonal
// hatching for someone else's, a dashed outline plus a tick for one of yours
// that is over. All three survive a grayscale screenshot and deuteranopia,
// which colour alone would not.
const STATES: Record<BookingState, string> = {
  own: "border-accent-own-booking bg-accent-own-surface text-accent-own-ink shadow-[inset_3px_0_0_var(--color-accent-own-booking)]",
  finished:
    "border-dashed border-accent-own-past bg-surface text-accent-own-past shadow-[inset_3px_0_0_var(--color-accent-own-past)]",
  other:
    "border-border-control bg-surface-muted hatch text-text-secondary cursor-default",
};

const CHIPS: Record<BookingState, string> = {
  own: "bg-accent-own-booking text-accent-own-on",
  finished: "bg-surface-raised text-text-tertiary",
  other: "bg-surface-raised text-text-secondary",
};

/**
 * Initials for the author chip: two letters is all a half-hour block can spare.
 * The full name stays in the tooltip and in the accessible label.
 */
function initials(name: string): string {
  return name
    .split(/[\s.]+/)
    .filter(Boolean)
    .map((part) => part[0])
    .slice(0, 2)
    .join("")
    .toUpperCase();
}

// One booking drawn on the grid. Shared by the week and the day view so both
// look and behave the same.
export function BookingBlock({
  booking,
  state,
  range,
  start,
  compact,
  href,
  isSelected,
  interactive,
  style,
}: BookingBlockProps) {
  const t = useTranslations("schedule");

  const className = `focus-ring-tight rounded-booking absolute right-[3px] left-[3px] flex overflow-hidden border no-underline transition ${
    compact ? "flex-row items-center gap-1.5 py-0 pr-1 pl-1.5" : "flex-col gap-0.5 py-1 pr-1.5 pl-2"
  } ${STATES[state]} ${
    isSelected ? "outline-focus-ring outline-2 outline-offset-1" : ""
  } ${interactive ? "" : "pointer-events-none"}`;

  // Short bookings clip their title, so the full details live in the tooltip.
  const tooltip = `${booking.title} · ${booking.user.name} · ${range}${
    booking.isRecurring ? ` · ${t("recurring")}` : ""
  }`;

  const marks = (
    <span className="flex flex-none items-center gap-1">
      {booking.isRecurring ? (
        <span title={t("recurring")} className="text-xs leading-none opacity-80 sm:text-[11px]">
          <span aria-hidden="true">↻</span>
          <span className="sr-only">{t("recurring")}</span>
        </span>
      ) : null}
      {state === "finished" ? (
        <span title={t("finished")} className="text-xs leading-none sm:text-[11px]">
          <span aria-hidden="true">✓</span>
          <span className="sr-only">{t("finished")}</span>
        </span>
      ) : null}
      <span
        aria-hidden="true"
        className={`rounded-booking px-[3px] py-[2px] font-mono text-[11px] leading-none sm:text-[10px] font-semibold tracking-[0.02em] ${CHIPS[state]}`}
      >
        {booking.isMine ? t("youShort") : initials(booking.user.name)}
      </span>
    </span>
  );

  const content = compact ? (
    <>
      <span className="flex-none font-mono text-xs sm:text-[11px] leading-tight font-semibold">
        {start}
      </span>
      <span className="min-w-0 flex-1 truncate text-xs leading-tight font-semibold">
        {booking.title}
      </span>
      {marks}
    </>
  ) : (
    <>
      <span className="flex w-full flex-none items-center gap-1">
        <span className="font-mono text-xs sm:text-[11px] leading-tight font-semibold">{range}</span>
        <span className="flex-1" />
        {marks}
      </span>
      <span className="w-full min-w-0 truncate text-[13px] leading-tight font-semibold">
        {booking.title}
      </span>
    </>
  );

  // The full sentence for a screen reader: the grid position that carries the
  // day and the time visually means nothing when it is read out.
  const label = `${booking.title}, ${range}, ${booking.user.name}`;

  // Without a link the booking is visible but offers no action at all, which is
  // the UI half of the ownership rule. Someone else's block also has no hover
  // state and stays out of the tab order, so it never looks pressable.
  return href ? (
    <Link
      href={href}
      scroll={false}
      aria-label={label}
      className={`${className} hover:brightness-[0.98]`}
      style={style}
      title={tooltip}
    >
      {content}
    </Link>
  ) : (
    <div role="note" aria-label={label} className={className} style={style} title={tooltip}>
      {content}
    </div>
  );
}
