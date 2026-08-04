"use client";

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
    <nav className="ml-2 hidden items-center gap-1 sm:flex">
      <NavLink href="/" active={!onMyBookings}>
        {roomsLabel}
      </NavLink>
      <NavLink href="/my-bookings" active={onMyBookings}>
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
      className={`focus-ring flex items-center rounded-[8px] px-3 py-[7px] text-[13.5px] no-underline transition ${
        active
          ? "bg-accent-own-surface text-text-primary font-bold"
          : "text-text-secondary hover:text-text-primary hover:bg-surface-muted font-semibold"
      }`}
    >
      {children}
    </Link>
  );
}
