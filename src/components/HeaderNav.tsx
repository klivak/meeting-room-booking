"use client";

import { CalendarCheck, CalendarDays } from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";

/**
 * The two top-level destinations. It is a client component only because the
 * current one has to be marked, and the path is the one thing the server layout
 * cannot hand down without re-rendering the header on every navigation.
 */
export function HeaderNav({
  roomsLabel,
  myBookingsLabel,
}: {
  roomsLabel: string;
  myBookingsLabel: string;
}) {
  const pathname = usePathname();
  // Everything that is not "my bookings" is a room view: the index lists the
  // rooms and /rooms/[id] shows one of them.
  const onMyBookings = pathname.startsWith("/my-bookings");

  return (
    <nav className="ml-3 hidden items-center gap-0.5 sm:flex">
      <NavLink href="/" active={!onMyBookings}>
        <CalendarDays aria-hidden="true" className="size-4" />
        {roomsLabel}
      </NavLink>
      <NavLink href="/my-bookings" active={onMyBookings}>
        <CalendarCheck aria-hidden="true" className="size-4" />
        {myBookingsLabel}
      </NavLink>
    </nav>
  );
}

function NavLink({
  href,
  active,
  children,
}: {
  href: string;
  active: boolean;
  children: React.ReactNode;
}) {
  return (
    <Link
      href={href}
      aria-current={active ? "page" : undefined}
      className={`focus-ring rounded-control flex items-center gap-2 px-2.5 py-1.5 text-[13px] no-underline transition ${
        active
          ? "bg-surface-muted text-text-primary font-semibold"
          : "text-text-tertiary hover:text-text-primary hover:bg-surface-muted font-medium"
      }`}
    >
      {children}
    </Link>
  );
}
