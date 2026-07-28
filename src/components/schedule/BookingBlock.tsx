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

type BookingBlockProps = {
  booking: BookingView;
  /** Start and end in the viewer's timezone, already formatted. */
  range: string;
  /** Present only for a booking the viewer may still act on. */
  href?: string;
  isSelected: boolean;
  style: React.CSSProperties;
};

// One booking drawn on the grid. Shared by the week and the day view so both
// look and behave the same.
export function BookingBlock({
  booking,
  range,
  href,
  isSelected,
  style,
}: BookingBlockProps) {
  const t = useTranslations("schedule");
  const className = `z-10 m-0.5 overflow-hidden rounded-md px-1.5 py-1 text-xs leading-tight ${
    isSelected ? "ring-2 ring-slate-900 ring-offset-1" : ""
  }`;

  const blockStyle: React.CSSProperties = {
    ...style,
    backgroundColor: booking.isMine
      ? "var(--color-indigo-600)"
      : "var(--color-slate-200)",
    color: booking.isMine ? "white" : "var(--color-slate-700)",
  };

  // Short bookings clip their text, so the full details live in the tooltip.
  const tooltip = `${booking.title} · ${booking.user.name} · ${range}${
    booking.isRecurring ? ` · ${t("recurring")}` : ""
  }`;

  const content = (
    <>
      <div className="truncate font-medium">
        {booking.isRecurring ? <span aria-hidden="true">↻ </span> : null}
        {booking.title}
      </div>
      {/* The time is what the grid position only approximates, so it is spelled
          out; a half-hour block has no room for it and keeps the tooltip. */}
      <div className="truncate opacity-80">{range}</div>
      <div className="truncate opacity-80">{booking.user.name}</div>
    </>
  );

  // Without a link the booking is visible but offers no action at all, which is
  // the UI half of the ownership rule.
  return href ? (
    <Link
      href={href}
      scroll={false}
      className={`${className} transition hover:brightness-110 focus-visible:ring-2 focus-visible:ring-slate-900 focus-visible:ring-offset-1 focus-visible:outline-none`}
      style={blockStyle}
      title={tooltip}
    >
      {content}
    </Link>
  ) : (
    <div className={className} style={blockStyle} title={tooltip}>
      {content}
    </div>
  );
}
