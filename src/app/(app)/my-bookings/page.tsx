import Link from "next/link";
import { redirect } from "next/navigation";
import { Suspense } from "react";

import { BookingRow } from "@/components/BookingRow";
import { MoreBookings } from "@/components/MoreBookings";
import { prisma } from "@/lib/server/db";
import { getCurrentUser } from "@/lib/server/session";

const PAGE_SIZE = 20;

type Tab = "upcoming" | "past";

const TABS: { value: Tab; label: string }[] = [
  { value: "upcoming", label: "Майбутні" },
  { value: "past", label: "Минулі" },
];

async function BookingList({ tab }: { tab: Tab }) {
  const user = await getCurrentUser();
  if (!user) {
    redirect("/login");
  }

  const now = new Date();

  // A booking that has started but not ended still counts as upcoming: it is
  // over only once it ends.
  // One extra row is read purely to learn whether another page exists.
  const page = await prisma.booking.findMany({
    where: {
      userId: user.id,
      canceledAt: null,
      ...(tab === "upcoming" ? { endsAt: { gt: now } } : { endsAt: { lte: now } }),
    },
    orderBy: [
      { startsAt: tab === "upcoming" ? "asc" : "desc" },
      { id: tab === "upcoming" ? "asc" : "desc" },
    ],
    take: PAGE_SIZE + 1,
    select: {
      id: true,
      title: true,
      startsAt: true,
      endsAt: true,
      room: { select: { id: true, name: true } },
    },
  });

  const hasMore = page.length > PAGE_SIZE;
  const bookings = hasMore ? page.slice(0, PAGE_SIZE) : page;
  const nextCursor = hasMore ? bookings[bookings.length - 1].id : null;

  if (bookings.length === 0) {
    return (
      <div className="flex flex-col items-start gap-3 rounded-xl border border-slate-200 bg-white p-6">
        <p className="text-sm text-slate-600">
          {tab === "upcoming"
            ? "У вас поки немає майбутніх бронювань."
            : "Минулих бронювань поки немає."}
        </p>
        <Link
          href="/"
          className="rounded-lg bg-slate-900 px-4 py-2 text-sm font-medium text-white transition hover:bg-slate-800"
        >
          Відкрити розклад
        </Link>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-2">
      <ul className="flex flex-col gap-2">
        {bookings.map((booking) => (
          <BookingRow
            key={booking.id}
            now={now.toISOString()}
            booking={{
              id: booking.id,
              title: booking.title,
              startsAt: booking.startsAt.toISOString(),
              endsAt: booking.endsAt.toISOString(),
              room: booking.room,
            }}
          />
        ))}
      </ul>

      {nextCursor ? (
        <MoreBookings
          initialCursor={nextCursor}
          now={now.toISOString()}
          scope={tab}
        />
      ) : null}
    </div>
  );
}

function ListSkeleton() {
  return (
    <ul className="flex flex-col gap-2">
      {[0, 1, 2].map((index) => (
        <li
          key={index}
          className="h-20 animate-pulse rounded-xl border border-slate-200 bg-white"
        />
      ))}
    </ul>
  );
}

export default async function MyBookingsPage({
  searchParams,
}: {
  searchParams: Promise<{ tab?: string }>;
}) {
  const { tab: tabParam } = await searchParams;
  const tab: Tab = tabParam === "past" ? "past" : "upcoming";

  return (
    <div className="flex flex-col gap-4">
      <h1 className="text-xl font-semibold text-slate-900">Мої бронювання</h1>

      {/* The active tab lives in the URL, so the page can be linked and reloaded. */}
      <nav className="flex gap-2">
        {TABS.map((option) => (
          <Link
            key={option.value}
            href={option.value === "upcoming" ? "/my-bookings" : "/my-bookings?tab=past"}
            aria-current={option.value === tab ? "page" : undefined}
            className={`rounded-lg border px-3 py-1.5 text-sm transition ${
              option.value === tab
                ? "border-slate-900 bg-slate-900 text-white"
                : "border-slate-300 text-slate-700 hover:bg-slate-100"
            }`}
          >
            {option.label}
          </Link>
        ))}
      </nav>

      <Suspense key={tab} fallback={<ListSkeleton />}>
        <BookingList tab={tab} />
      </Suspense>
    </div>
  );
}
