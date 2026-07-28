import { DateTime } from "luxon";
import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { Suspense } from "react";

import { BookingRow } from "@/components/BookingRow";
import { CancelBookingButton } from "@/components/CancelBookingButton";
import { MoreBookings } from "@/components/MoreBookings";
import { EmptyState } from "@/components/ui/EmptyState";
import { LinkButton } from "@/components/ui/LinkButton";
import { Skeleton } from "@/components/ui/Skeleton";
import { WEEK_START_DAY } from "@/lib/config";
import { OFFICE_TZ } from "@/lib/domain/constants";
import { getWeekStart } from "@/lib/domain/week";
import { prisma } from "@/lib/server/db";
import { getCurrentUser } from "@/lib/server/session";

export const metadata: Metadata = { title: "Мої бронювання" };

const PAGE_SIZE = 20;

type Tab = "upcoming" | "past";

const TABS: { value: Tab; label: string }[] = [
  { value: "upcoming", label: "Майбутні" },
  { value: "past", label: "Минулі" },
];

/** Office week that contains the booking, which is the week the grid opens. */
function weekOf(startsAt: Date): string {
  return (
    getWeekStart(DateTime.fromJSDate(startsAt).setZone(OFFICE_TZ), WEEK_START_DAY)
      .toISODate() ?? ""
  );
}

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
      seriesId: true,
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
      <EmptyState
        title={
          tab === "upcoming"
            ? "У вас поки немає майбутніх бронювань."
            : "Минулих бронювань поки немає."
        }
        action={
          <LinkButton href="/" variant="primary">
            Відкрити розклад
          </LinkButton>
        }
      />
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
              isRecurring: booking.seriesId !== null,
            }}
            // A finished booking can no longer be changed, so the past tab
            // carries no actions at all.
            actions={
              tab === "upcoming" ? (
                <>
                  <LinkButton
                    href={`/rooms/${booking.room.id}?week=${weekOf(booking.startsAt)}&booking=${booking.id}`}
                  >
                    Редагувати
                  </LinkButton>
                  <CancelBookingButton
                    bookingId={booking.id}
                    title={booking.title}
                    isRecurring={booking.seriesId !== null}
                  />
                </>
              ) : null
            }
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
        <li key={index}>
          <Skeleton className="h-20 rounded-xl" />
        </li>
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
          <LinkButton
            key={option.value}
            href={option.value === "upcoming" ? "/my-bookings" : "/my-bookings?tab=past"}
            active={option.value === tab}
          >
            {option.label}
          </LinkButton>
        ))}
      </nav>

      <Suspense key={tab} fallback={<ListSkeleton />}>
        <BookingList tab={tab} />
      </Suspense>
    </div>
  );
}
