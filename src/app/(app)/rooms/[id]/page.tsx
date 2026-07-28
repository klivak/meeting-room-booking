import { DateTime } from "luxon";
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { Suspense } from "react";

import { BookingPanel } from "@/components/schedule/BookingPanel";
import { Schedule as ScheduleGrid } from "@/components/schedule/Schedule";
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
  const room = await prisma.room.findUnique({ where: { id }, select: { name: true } });

  return { title: room ? `${room.name} — розклад` : "Кімнату не знайдено" };
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
function resolveSelectedDay(weekStart: DateTime, dayParam: string | undefined): string {
  const days = getWeekDays(weekStart).map((day) => day.toISODate());

  if (dayParam && days.includes(dayParam)) {
    return dayParam;
  }

  const today = DateTime.now().setZone(OFFICE_TZ).toISODate();

  return today && days.includes(today) ? today : (days[0] ?? "");
}

function formatWeekRange(weekStart: DateTime): string {
  const weekEnd = weekStart.plus({ days: DAYS_IN_WEEK - 1 });
  const from = weekStart.setLocale("uk");
  const to = weekEnd.setLocale("uk");

  const sameMonth = from.month === to.month && from.year === to.year;

  return sameMonth
    ? `${from.toFormat("d")}–${to.toFormat("d MMMM yyyy")}`
    : `${from.toFormat("d MMMM")} – ${to.toFormat("d MMMM yyyy")}`;
}

async function Schedule({
  roomId,
  weekStart,
  selectedDay,
  selectedSlot,
  selectedBookingId,
}: {
  roomId: string;
  weekStart: DateTime;
  selectedDay: string;
  selectedSlot?: string;
  selectedBookingId?: string;
}) {
  const user = await getCurrentUser();
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
        isMine: booking.user.id === user?.id,
        isRecurring: booking.seriesId !== null,
      }))}
    />
  );
}

function ScheduleSkeleton() {
  return (
    <div className="flex flex-col gap-2">
      <Skeleton className="h-10 w-full" />
      <Skeleton className="w-full" style={{ height: `${SLOT_COUNT * 2.25}rem` }} />
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
    booking?: string;
  }>;
}) {
  const { id } = await params;
  const { week, day, slot, booking } = await searchParams;

  const room = await prisma.room.findUnique({ where: { id } });
  if (!room) {
    notFound();
  }

  const user = await getCurrentUser();

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

  const rooms = await prisma.room.findMany({
    select: { id: true, name: true },
    orderBy: [{ floor: "asc" }, { name: "asc" }],
  });

  const weekStart = resolveWeekStart(week);
  const previousWeek = weekStart.minus({ days: DAYS_IN_WEEK }).toISODate();
  const nextWeek = weekStart.plus({ days: DAYS_IN_WEEK }).toISODate();
  const currentWeek = getWeekStart(DateTime.now().setZone(OFFICE_TZ), WEEK_START_DAY);
  const isCurrentWeek = weekStart.toISODate() === currentWeek.toISODate();

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-xl font-semibold text-slate-900">{room.name}</h1>

        <div className="flex items-center gap-2">
          <LinkButton
            href={`/rooms/${room.id}?week=${previousWeek}`}
            aria-label="Попередній тиждень"
          >
            ←
          </LinkButton>
          <LinkButton href={`/rooms/${room.id}`} active={isCurrentWeek}>
            Сьогодні
          </LinkButton>
          <LinkButton
            href={`/rooms/${room.id}?week=${nextWeek}`}
            aria-label="Наступний тиждень"
          >
            →
          </LinkButton>
        </div>
      </div>

      <p className="text-sm text-slate-600">{formatWeekRange(weekStart)}</p>

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

      <Suspense key={weekStart.toISODate()} fallback={<ScheduleSkeleton />}>
        <Schedule
          roomId={room.id}
          weekStart={weekStart}
          selectedDay={resolveSelectedDay(weekStart, day)}
          selectedSlot={slot}
          selectedBookingId={selectedBooking?.id}
        />
      </Suspense>

      {/* Outside the Suspense boundary so the success toast survives the
          refresh that follows a save. */}
      <BookingPanel
        rooms={rooms}
        roomId={room.id}
        weekParam={weekStart.toISODate() ?? ""}
        slot={slot}
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
