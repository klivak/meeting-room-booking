import { DateTime } from "luxon";
import { getLocale, getTranslations } from "next-intl/server";
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { Suspense } from "react";

import {
  BookingPanel,
  SCHEDULE_ANCHOR_ID,
} from "@/components/schedule/BookingPanel";
import { Schedule as ScheduleGrid } from "@/components/schedule/Schedule";
import { WeekShortcuts } from "@/components/schedule/WeekShortcuts";
import { LinkButton } from "@/components/ui/LinkButton";
import { Skeleton } from "@/components/ui/Skeleton";
import { WEEK_START_DAY } from "@/lib/config";
import { OFFICE_TZ } from "@/lib/domain/constants";
import { DAYS_IN_WEEK, SLOT_COUNT, getWeekDays } from "@/lib/domain/grid";
import { getWeekStart } from "@/lib/domain/week";
import { prisma } from "@/lib/server/db";
import { getCurrentUser } from "@/lib/server/session";

const WEEK_MS = DAYS_IN_WEEK * 24 * 60 * 60 * 1000;

export async function generateMetadata({
  params,
}: {
  params: Promise<{ id: string }>;
}): Promise<Metadata> {
  const { id } = await params;
  const room = await prisma.room.findUnique({
    where: { id },
    select: { name: true },
  });

  const t = await getTranslations("errors");

  return { title: room ? room.name : t("appNotFoundTitle") };
}

/**
 * Week shown by the page. Any date in the ?week parameter snaps to the start of
 * its week, so a link from another page does not have to know the first weekday.
 */
function resolveWeekStart(weekParam: string | undefined): DateTime {
  const parsed = weekParam
    ? DateTime.fromISO(weekParam, { zone: OFFICE_TZ })
    : DateTime.invalid("missing");

  const base = parsed.isValid ? parsed : DateTime.now().setZone(OFFICE_TZ);

  return getWeekStart(base, WEEK_START_DAY);
}

/**
 * Day shown by the single-day view. Defaults to today when the displayed week
 * contains it, otherwise to the first day of that week, so a phone never opens
 * on an arbitrary date.
 */
function resolveSelectedDay(
  weekStart: DateTime,
  dayParam: string | undefined,
): string {
  const days = getWeekDays(weekStart).map((day) => day.toISODate());

  if (dayParam && days.includes(dayParam)) {
    return dayParam;
  }

  const today = DateTime.now().setZone(OFFICE_TZ).toISODate();

  return today && days.includes(today) ? today : (days[0] ?? "");
}

/** Month names follow the chosen language, the dates themselves the office. */
function formatWeekRange(weekStart: DateTime, locale: string): string {
  const weekEnd = weekStart.plus({ days: DAYS_IN_WEEK - 1 });
  const from = weekStart.setLocale(locale);
  const to = weekEnd.setLocale(locale);

  const sameMonth = from.month === to.month && from.year === to.year;

  return sameMonth
    ? `${from.toFormat("d")}–${to.toFormat("d MMMM yyyy")}`
    : `${from.toFormat("d MMMM")} – ${to.toFormat("d MMMM yyyy")}`;
}

async function Schedule({
  roomId,
  userId,
  weekStart,
  selectedDay,
  selectedSlot,
  selectedSlotEnd,
  selectedBookingId,
}: {
  roomId: string;
  /** Passed in rather than read again: the page already resolved the session. */
  userId?: string;
  weekStart: DateTime;
  selectedDay: string;
  selectedSlot?: string;
  selectedSlotEnd?: string;
  selectedBookingId?: string;
}) {
  const weekStartDate = weekStart.toUTC().toJSDate();
  const weekEndDate = new Date(weekStartDate.getTime() + WEEK_MS);

  // Half-open window, the same comparison the overlap rule uses.
  const bookings = await prisma.booking.findMany({
    where: {
      roomId,
      canceledAt: null,
      startsAt: { lt: weekEndDate },
      endsAt: { gt: weekStartDate },
    },
    orderBy: { startsAt: "asc" },
    select: {
      id: true,
      seriesId: true,
      title: true,
      startsAt: true,
      endsAt: true,
      user: { select: { id: true, name: true } },
    },
  });

  return (
    <ScheduleGrid
      roomId={roomId}
      selectedDay={selectedDay}
      selectedSlot={selectedSlot}
      selectedSlotEnd={selectedSlotEnd}
      selectedBookingId={selectedBookingId}
      // Rendered on the server so the client agrees on which bookings are still
      // editable and hydration matches.
      now={new Date().toISOString()}
      weekStart={weekStart.toISO() ?? ""}
      bookings={bookings.map((booking) => ({
        id: booking.id,
        title: booking.title,
        startsAt: booking.startsAt.toISOString(),
        endsAt: booking.endsAt.toISOString(),
        user: booking.user,
        isMine: booking.user.id === userId,
        isRecurring: booking.seriesId !== null,
      }))}
    />
  );
}

// The grid placeholder is split into the seven day columns of the real week view
// (plus the time gutter), so the sweep reads left to right across the week the
// way the loaded grid is read.
async function ScheduleSkeleton() {
  const t = await getTranslations("rooms");

  return (
    <div className="flex flex-col gap-2">
      <p role="status" className="sr-only">
        {t("loading")}
      </p>
      <div aria-hidden className="flex flex-col gap-2">
        <Skeleton className="h-10 w-full" />
        <div
          className="grid gap-1"
          style={{ gridTemplateColumns: "4rem repeat(7, minmax(0, 1fr))" }}
        >
          {[0, 1, 2, 3, 4, 5, 6, 7].map((column) => (
            <Skeleton
              key={column}
              style={{
                height: `${SLOT_COUNT * 2.25}rem`,
                animationDelay: `${column * 90}ms`,
              }}
            />
          ))}
        </div>
      </div>
    </div>
  );
}

export default async function RoomPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{
    week?: string;
    day?: string;
    slot?: string;
    slotEnd?: string;
    booking?: string;
  }>;
}) {
  const { id } = await params;
  const { week, day, slot, slotEnd, booking } = await searchParams;
  const [t, locale] = await Promise.all([getTranslations("schedule"), getLocale()]);

  // Independent of each other, so they travel together rather than in a queue.
  const [room, user, rooms] = await Promise.all([
    prisma.room.findUnique({ where: { id } }),
    getCurrentUser(),
    prisma.room.findMany({
      select: { id: true, name: true, floor: true, capacity: true },
      orderBy: [{ floor: "asc" }, { name: "asc" }],
    }),
  ]);

  if (!room) {
    notFound();
  }

  const now = new Date();

  // The filters live in the query, so a foreign, canceled or already finished id
  // in the URL simply yields nothing instead of being trusted. They mirror
  // checkBookingAccess, which the API applies to the request itself.
  const selectedBooking =
    booking && user
      ? await prisma.booking.findFirst({
          where: {
            id: booking,
            userId: user.id,
            canceledAt: null,
            endsAt: { gt: now },
          },
          select: {
            id: true,
            roomId: true,
            seriesId: true,
            title: true,
            startsAt: true,
            endsAt: true,
          },
        })
      : null;

  const weekStart = resolveWeekStart(week);
  const previousWeek = weekStart.minus({ days: DAYS_IN_WEEK }).toISODate();
  const nextWeek = weekStart.plus({ days: DAYS_IN_WEEK }).toISODate();
  const currentWeek = getWeekStart(
    DateTime.now().setZone(OFFICE_TZ),
    WEEK_START_DAY,
  );
  const isCurrentWeek = weekStart.toISODate() === currentWeek.toISODate();

  return (
    <div className="flex flex-col gap-4">
      <WeekShortcuts
        previousHref={`/rooms/${room.id}?week=${previousWeek}`}
        nextHref={`/rooms/${room.id}?week=${nextWeek}`}
      />

      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-xl font-semibold text-slate-900">{room.name}</h1>

        <div className="flex items-center gap-2">
          <LinkButton
            href={`/rooms/${room.id}?week=${previousWeek}`}
            aria-label={t("previousWeek")}
          >
            ←
          </LinkButton>
          <LinkButton href={`/rooms/${room.id}`} active={isCurrentWeek}>
            {t("today")}
          </LinkButton>
          <LinkButton
            href={`/rooms/${room.id}?week=${nextWeek}`}
            aria-label={t("nextWeek")}
          >
            →
          </LinkButton>
        </div>
      </div>

      <p className="text-sm text-slate-600">{formatWeekRange(weekStart, locale)}</p>

      {/* Plain links instead of a select: switching rooms keeps the week and
          needs no client-side JavaScript. */}
      <nav className="flex flex-wrap gap-2">
        {rooms.map((option) => (
          <LinkButton
            key={option.id}
            href={`/rooms/${option.id}?week=${weekStart.toISODate()}`}
            active={option.id === room.id}
          >
            {option.name}
          </LinkButton>
        ))}
      </nav>

      <div id={SCHEDULE_ANCHOR_ID}>
        <Suspense key={weekStart.toISODate()} fallback={await ScheduleSkeleton()}>
          <Schedule
            roomId={room.id}
            userId={user?.id}
            weekStart={weekStart}
            selectedDay={resolveSelectedDay(weekStart, day)}
            selectedSlot={slot}
            selectedSlotEnd={slotEnd}
            selectedBookingId={selectedBooking?.id}
          />
        </Suspense>
      </div>

      {/* Outside the Suspense boundary so the success toast survives the
          refresh that follows a save. */}
      <BookingPanel
        rooms={rooms}
        roomId={room.id}
        weekParam={weekStart.toISODate() ?? ""}
        slot={slot}
        slotEnd={slotEnd}
        booking={
          selectedBooking
            ? {
                ...selectedBooking,
                startsAt: selectedBooking.startsAt.toISOString(),
                endsAt: selectedBooking.endsAt.toISOString(),
              }
            : undefined
        }
      />
    </div>
  );
}
