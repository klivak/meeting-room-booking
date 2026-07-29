import { DateTime } from "luxon";
import { getTranslations } from "next-intl/server";
import type { Metadata } from "next";
import Link from "next/link";
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

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("myBookings");

  return { title: t("title") };
}

const PAGE_SIZE = 20;

type Tab = "upcoming" | "past";

const TABS: Tab[] = ["upcoming", "past"];

/** Office week that contains the booking, which is the week the grid opens. */
function weekOf(startsAt: Date): string {
  return (
    getWeekStart(DateTime.fromJSDate(startsAt).setZone(OFFICE_TZ), WEEK_START_DAY)
      .toISODate() ?? ""
  );
}

async function BookingList({ tab }: { tab: Tab }) {
  const t = await getTranslations("myBookings");
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
        title={tab === "upcoming" ? t("emptyUpcoming") : t("emptyPast")}
        description={tab === "upcoming" ? t("emptyUpcomingText") : t("emptyPastText")}
        action={
          tab === "upcoming" ? (
            <LinkButton href="/" variant="primary">
              {t("openSchedule")}
            </LinkButton>
          ) : undefined
        }
      />
    );
  }

  return (
    <div className="border-border-grid bg-surface rounded-card overflow-hidden border">
      <ul className="flex flex-col">
        {bookings.map((booking, index) => (
          <BookingRow
            key={booking.id}
            now={now.toISOString()}
            // The first upcoming row is the answer to "when is my next meeting",
            // which is the second most common reason this app is opened.
            highlight={tab === "upcoming" && index === 0}
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
                    {t("edit")}
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
          loaded={bookings.length}
        />
      ) : (
        <p className="border-border-grid bg-surface-muted text-text-tertiary border-t p-4 text-center text-[13px]">
          {t("endOfList", { count: bookings.length })}
        </p>
      )}
    </div>
  );
}

// Same shape as a loaded row (title, time column, two buttons) with a per-row
// delay, so the wave runs down the list instead of blinking as one block.
async function ListSkeleton() {
  const t = await getTranslations("myBookings");

  return (
    <>
      <p role="status" className="sr-only">
        {t("loading")}
      </p>
      <ul
        aria-hidden
        className="border-border-grid bg-surface rounded-card flex flex-col overflow-hidden border"
      >
        {[0, 1, 2].map((index) => (
          // Same padding, wrapping and column widths as a loaded row, and the
          // bars stand as tall as the two lines of text they replace, so the
          // list keeps its height when the data arrives.
          <li
            key={index}
            className="border-border-grid-half flex flex-wrap items-center gap-3 border-b px-4 py-3.5 last:border-b-0 sm:flex-nowrap sm:gap-4 sm:px-5"
          >
            <div className="flex min-w-0 flex-1 flex-col gap-1">
              <Skeleton
                className="h-6 w-1/2"
                style={{ animationDelay: `${index * 140}ms` }}
              />
              <Skeleton className="h-4 w-1/3" />
            </div>
            <span className="flex flex-none flex-col gap-1 sm:w-[170px] sm:items-end">
              <Skeleton className="h-6 w-[90px]" />
              <Skeleton className="h-4 w-[70px]" />
            </span>
            {/* Two bars the size of the two buttons: on a phone they take the
                same second line the real ones wrap onto. */}
            <span className="flex flex-none gap-2">
              <Skeleton className="h-11 w-[104px] sm:h-[38px]" />
              <Skeleton className="h-11 w-[110px] sm:h-[38px]" />
            </span>
          </li>
        ))}
      </ul>
    </>
  );
}

export default async function MyBookingsPage({
  searchParams,
}: {
  searchParams: Promise<{ tab?: string }>;
}) {
  const { tab: tabParam } = await searchParams;
  const tab: Tab = tabParam === "past" ? "past" : "upcoming";
  const t = await getTranslations("myBookings");

  return (
    <div className="mx-auto flex w-full max-w-4xl flex-col gap-4">
      <div className="flex flex-wrap items-end gap-4">
        <h1 className="text-[22px] font-semibold tracking-tight">{t("title")}</h1>

        <span className="hidden flex-1 sm:block" />

        {/* The active tab lives in the URL, so the page can be linked and
            reloaded. An underline rather than two filled buttons: these are two
            views of one list, not two actions. */}
        <nav className="border-border-grid -mb-px flex border-b">
          {TABS.map((option) => (
            <Link
              key={option}
              href={option === "upcoming" ? "/my-bookings" : "/my-bookings?tab=past"}
              aria-current={option === tab ? "page" : undefined}
              className={`focus-ring -mb-px border-b-2 px-3.5 py-2.5 text-sm no-underline transition ${
                option === tab
                  ? "border-b-accent-own-booking text-text-primary font-semibold"
                  : "text-text-tertiary hover:text-text-secondary border-b-transparent font-medium"
              }`}
            >
              {t(option)}
            </Link>
          ))}
        </nav>
      </div>

      <Suspense key={tab} fallback={await ListSkeleton()}>
        <BookingList tab={tab} />
      </Suspense>
    </div>
  );
}
