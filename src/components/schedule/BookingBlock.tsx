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

// Three textures, not three shades: a fill with a jade bar for yours, diagonal
// hatching with a blue one for someone else's, and a dashed outline with a tick
// for one of yours that is over. All three survive a grayscale screenshot and
// deuteranopia, which colour alone would not.
const STATES: Record<BookingState, string> = {
  own: "bg-accent-own-fill border-accent-own-booking border-l-[3px] py-1 pr-2 pl-2.5",
  // A booking that is over gets no fill and no bar: it is still on the grid for
  // reference, but it must not compete with the day left to book.
  finished:
    "border-accent-own-past border-[1.5px] border-dashed py-1 pr-2 pl-2",
  other:
    "hatch border-booking-other-author border-l-[3px] cursor-default py-1 pr-2 pl-2.5",
};

const TIME_TONES: Record<BookingState, string> = {
  own: "text-accent-own-ink",
  finished: "text-text-tertiary",
  other: "text-booking-other-ink",
};

const TITLE_TONES: Record<BookingState, string> = {
  own: "text-text-primary",
  finished: "text-text-secondary",
  other: "text-booking-other-ink",
};

const CHIPS: Record<BookingState, string> = {
  own: "bg-accent-own-ink text-accent-own-on",
  finished: "bg-surface-muted text-text-tertiary",
  other: "bg-booking-other-surface text-booking-other-ink",
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

  const className = `focus-ring-tight rounded-booking animate-block absolute right-1 left-1 flex flex-col gap-0.5 overflow-hidden no-underline transition ${
    STATES[state]
  } ${isSelected ? "outline-focus-ring outline-2 outline-offset-1" : ""} ${
    interactive ? "" : "pointer-events-none"
  } ${onGrab ? "cursor-grab" : ""} ${
    isDragging ? "cursor-grabbing shadow-panel z-10 select-none" : ""
  } ${
    // Red only while the drag is in the air: releasing here is refused, and the
    // block says so before the release rather than after it.
    invalid ? "border-danger bg-danger-surface text-danger-ink" : ""
  }`;

  // Short bookings clip their title, so the full details live in the tooltip.
  const tooltip = `${booking.title} · ${booking.user.name} · ${range}${
    booking.isRecurring ? ` · ${t("recurring")}` : ""
  }`;

  // Two letters in the corner, so authorship sits on the block itself and not
  // only in a legend below the grid.
  const authorChip = (
    <span
      aria-hidden="true"
      className={`shrink-0 rounded-[5px] px-1.5 py-px text-[11px] leading-[1.4] font-bold sm:text-[10px] ${CHIPS[state]}`}
    >
      {booking.isMine ? t("youShort") : initials(booking.user.name)}
    </span>
  );

  const marks = (
    <span className={`flex flex-none items-center gap-1 ${TIME_TONES[state]}`}>
      {booking.isRecurring ? (
        <span title={t("recurring")} className="leading-none">
          <Repeat
            aria-hidden="true"
            className="size-[11px]"
            strokeWidth={2.4}
          />
          <span className="sr-only">{t("recurring")}</span>
        </span>
      ) : null}
      {state === "finished" ? (
        <span title={t("finished")} className="leading-none">
          <Check aria-hidden="true" className="size-3" strokeWidth={2.6} />
          <span className="sr-only">{t("finished")}</span>
        </span>
      ) : null}
    </span>
  );

  const content = compact ? (
    <span className="flex min-w-0 items-center gap-1.5">
      <span
        className={`flex-none font-mono text-xs leading-tight font-semibold sm:text-[10.5px] ${TIME_TONES[state]}`}
      >
        {start}
      </span>
      <span
        className={`min-w-0 flex-1 truncate text-xs leading-tight font-bold sm:text-[11.5px] ${TITLE_TONES[state]}`}
      >
        {booking.title}
      </span>
      {marks}
      {authorChip}
    </span>
  ) : (
    <>
      <span className="flex min-w-0 items-center gap-1.5">
        {/* Never wrapped: "10:00-11:00" broken over two lines eats the row the
            title needs and reads as two different times. */}
        <span
          className={`flex-none font-mono text-xs leading-tight font-semibold whitespace-nowrap sm:text-[10.5px] ${TIME_TONES[state]}`}
        >
          {range}
        </span>
        {marks}
        <span className="flex-1" />
        {authorChip}
      </span>
      <span
        className={`w-full min-w-0 truncate text-xs leading-[1.15] font-bold ${TITLE_TONES[state]}`}
      >
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
      className={`${className} hover:shadow-panel hover:brightness-[1.03]`}
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
    <div
      role="note"
      aria-label={label}
      className={className}
      style={style}
      title={tooltip}
    >
      {content}
    </div>
  );
}
