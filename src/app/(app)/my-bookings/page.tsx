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
import {
  countMyBookings,
  getMyBookingsPage,
  type BookingScope,
} from "@/lib/server/myBookings";
import { getCurrentUser } from "@/lib/server/session";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("myBookings");

  return { title: t("title") };
}

const TABS: BookingScope[] = ["upcoming", "past"];

/** Office week that contains the booking, which is the week the grid opens. */
function weekOf(startsAt: Date): string {
  return (
    getWeekStart(DateTime.fromJSDate(startsAt).setZone(OFFICE_TZ), WEEK_START_DAY)
      .toISODate() ?? ""
  );
}

async function BookingList({ tab }: { tab: BookingScope }) {
  const t = await getTranslations("myBookings");
  const user = await getCurrentUser();
  if (!user) {
    redirect("/login");
  }

  const now = new Date();

  // Same query and same paging rules the "show more" endpoint uses, so the
  // first page and every next one cannot start disagreeing.
  const { items: bookings, nextCursor } = await getMyBookingsPage(user.id, tab, now);

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
    <div className="flex flex-col gap-3">
      <ul className="flex flex-col gap-3">
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
              isRecurring: booking.isRecurring,
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
                    isRecurring={booking.isRecurring}
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
        <p className="text-text-tertiary py-2 text-center text-[13px]">
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
      <ul aria-hidden className="flex flex-col gap-3">
        {[0, 1, 2].map((index) => (
          // Same padding, wrapping and column widths as a loaded row, and the
          // bars stand as tall as the two lines of text they replace, so the
          // list keeps its height when the data arrives.
          <li
            key={index}
            className="border-border-grid bg-surface rounded-card shadow-rest flex flex-wrap items-center gap-3 border px-5 py-4 sm:flex-nowrap sm:gap-[18px]"
          >
            <div className="flex min-w-0 flex-1 flex-col gap-1">
              <Skeleton
                className="h-6 w-1/2"
                style={{ animationDelay: `${index * 140}ms` }}
              />
              <Skeleton className="h-4 w-1/3" />
            </div>
            <span className="flex flex-none flex-col gap-1 sm:w-[168px] sm:items-end">
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
  const tab: BookingScope = tabParam === "past" ? "past" : "upcoming";
  const [t, user] = await Promise.all([
    getTranslations("myBookings"),
    getCurrentUser(),
  ]);

  // Outside the Suspense boundary on purpose: the tabs are navigation, and
  // navigation that appears a beat after the page reads as a layout shift.
  const counts = user
    ? await countMyBookings(user.id, new Date())
    : { upcoming: 0, past: 0 };

  return (
    // The same measure as the room list: two pages of one application should not
    // change how wide their content is when you move between them.
    <div className="mx-auto flex w-full max-w-[940px] flex-col gap-5">
      <h1 className="text-[26px] font-extrabold tracking-[-0.03em] sm:text-[34px]">
        {t("title")}
      </h1>

      {/* The active tab lives in the URL, so the page can be linked and
          reloaded. An underline rather than two filled buttons: these are two
          views of one list, not two actions. */}
      <nav className="border-border-grid -mb-px flex gap-6 border-b">
        {TABS.map((option) => (
          <Link
            key={option}
            href={option === "upcoming" ? "/my-bookings" : "/my-bookings?tab=past"}
            aria-current={option === tab ? "page" : undefined}
            className={`focus-ring relative -mb-px px-0.5 pb-3 text-[15px] no-underline transition ${
              option === tab
                ? "text-text-primary font-bold"
                : "text-text-tertiary hover:text-text-secondary font-semibold"
            }`}
          >
            {t(option)}
            <span className="text-text-tertiary ml-[7px] font-mono text-xs">
              {counts[option]}
            </span>
            {option === tab ? (
              <span className="bg-accent-own-booking absolute inset-x-0 -bottom-px h-[2.5px] rounded-sm" />
            ) : null}
          </Link>
        ))}
      </nav>

      <Suspense key={tab} fallback={await ListSkeleton()}>
        <BookingList tab={tab} />
      </Suspense>
    </div>
  );
}
