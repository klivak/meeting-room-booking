"use client";

import { Check, Repeat } from "lucide-react";
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
  /**
   * Present only where the viewer may reshape the booking. It turns the block
   * into a handle for moving it and gives it two edges for resizing it; without
   * it the block is exactly the link it always was.
   */
  onGrab?: (mode: "move" | "start" | "end", event: React.PointerEvent) => void;
  /** Keyboard equivalent of the same two gestures. */
  onKeyDown?: (event: React.KeyboardEvent) => void;
  /** Swallows the click that follows a drag, which is not a click on the block. */
  onClick?: (event: React.MouseEvent) => void;
  /** True while this block is the one being dragged. */
  isDragging?: boolean;
  /** True while the dragged shape runs into another booking. */
  invalid?: boolean;
  style: React.CSSProperties;
};

// Three textures, not three shades: the fill plus a left bar for yours, diagonal
// hatching for someone else's, a dashed outline plus a tick for one of yours
// that is over. All three survive a grayscale screenshot and deuteranopia,
// which colour alone would not.
const STATES: Record<BookingState, string> = {
  own: "border-accent-own-booking bg-accent-own-surface text-accent-own-ink shadow-[inset_3px_0_0_var(--color-accent-own-booking),var(--shadow-rest)]",
  // A booking that is over gets no fill and no shadow: it is still on the grid
  // for reference, but it must not compete with the part of the day left to book.
  finished:
    "border-dashed border-accent-own-past bg-surface text-accent-own-past shadow-[inset_3px_0_0_var(--color-accent-own-past)]",
  // The left bar is a different hue from the accent, not a paler one, so that
  // "someone else booked this" never reads as "a faded version of yours".
  other:
    "border-border-grid hatch text-text-secondary cursor-default shadow-[inset_3px_0_0_var(--color-booking-other-author),var(--shadow-rest)]",
};

const CHIPS: Record<BookingState, string> = {
  own: "bg-accent-own-booking text-accent-own-on",
  finished: "bg-surface-raised text-text-tertiary",
  other: "bg-booking-other-author text-white",
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
  onGrab,
  onKeyDown,
  onClick,
  isDragging,
  invalid,
  style,
}: BookingBlockProps) {
  const t = useTranslations("schedule");

  // The block grows out of its own row rather than fading in from nowhere, so
  // the eye keeps the slot it was already looking at.
  const className = `focus-ring-tight rounded-booking animate-block origin-top absolute right-[4px] left-[4px] flex overflow-hidden border no-underline transition ${
    compact ? "flex-row items-center gap-1.5 py-0 pr-1 pl-1.5" : "flex-col gap-0.5 py-1 pr-1.5 pl-2"
  } ${STATES[state]} ${
    isSelected ? "outline-focus-ring outline-2 outline-offset-1" : ""
  } ${interactive ? "" : "pointer-events-none"} ${
    onGrab ? "cursor-grab" : ""
  } ${isDragging ? "cursor-grabbing shadow-panel z-10 select-none" : ""} ${
    // Red only while the drag is in the air: releasing here is refused, and the
    // block says so before the release rather than after it.
    invalid ? "border-danger bg-danger-surface text-danger-ink" : ""
  }`;

  // Short bookings clip their title, so the full details live in the tooltip.
  const tooltip = `${booking.title} · ${booking.user.name} · ${range}${
    booking.isRecurring ? ` · ${t("recurring")}` : ""
  }`;

  const marks = (
    <span className="flex flex-none items-center gap-1">
      {booking.isRecurring ? (
        <span title={t("recurring")} className="leading-none opacity-80">
          <Repeat aria-hidden="true" className="size-3.5" />
          <span className="sr-only">{t("recurring")}</span>
        </span>
      ) : null}
      {state === "finished" ? (
        <span title={t("finished")} className="leading-none">
          <Check aria-hidden="true" className="size-3.5" />
          <span className="sr-only">{t("finished")}</span>
        </span>
      ) : null}
      <span
        aria-hidden="true"
        className={`flex size-4 items-center justify-center rounded-full font-mono text-[9px] leading-none font-bold ${CHIPS[state]}`}
      >
        {booking.isMine ? t("youShort") : initials(booking.user.name)}
      </span>
    </span>
  );

  const content = compact ? (
    <>
      <span className="flex-none font-mono text-xs sm:text-[11px] xl:text-xs leading-tight font-semibold">
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
        <span className="font-mono text-xs sm:text-[11px] xl:text-xs leading-tight font-semibold">
          {range}
        </span>
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
  // Pointer-only affordances: a screen reader reshapes the booking with the keys
  // the block itself handles, so these two strips are noise to it.
  const handles = onGrab ? (
    <>
      <span
        aria-hidden="true"
        // Stopped here, or the block underneath would start a move as well.
        onPointerDown={(event) => {
          event.stopPropagation();
          onGrab("start", event);
        }}
        className="absolute inset-x-0 top-0 h-1.5 cursor-ns-resize"
      />
      <span
        aria-hidden="true"
        onPointerDown={(event) => {
          event.stopPropagation();
          onGrab("end", event);
        }}
        className="absolute inset-x-0 bottom-0 h-1.5 cursor-ns-resize"
      />
    </>
  ) : null;

  return href ? (
    <Link
      href={href}
      scroll={false}
      aria-label={label}
      // Only a booking you can act on lifts: the hover is the affordance, so
      // someone else's block must not have it.
      className={`${className} hover:-translate-y-px hover:shadow-panel`}
      style={style}
      title={tooltip}
      // The browser's own link dragging would fight the grab below.
      draggable={false}
      // Alt + arrow moves this booking, so the week navigation has to leave the
      // combination alone while the block has the focus.
      data-reshapable={onGrab ? true : undefined}
      // Editing has the same problem a fresh pick does: the panel must not cover
      // the booking it is about.
      data-selection={isSelected ? true : undefined}
      onPointerDown={onGrab ? (event) => onGrab("move", event) : undefined}
      onKeyDown={onKeyDown}
      onClick={onClick}
    >
      {content}
      {handles}
    </Link>
  ) : (
    <div role="note" aria-label={label} className={className} style={style} title={tooltip}>
      {content}
    </div>
  );
}
