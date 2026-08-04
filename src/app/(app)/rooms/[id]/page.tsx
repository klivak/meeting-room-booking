import { ChevronLeft, ChevronRight, Users } from "lucide-react";
import { DateTime } from "luxon";
import { getLocale, getTranslations } from "next-intl/server";
import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Suspense, cache } from "react";

import {
  BookingPanel,
  SCHEDULE_ANCHOR_ID,
} from "@/components/schedule/BookingPanel";
import {
  DAY_ROW_H,
  HEADER_REM,
  ROW_H,
  rowSpan,
} from "@/components/schedule/geometry";
import { Schedule as ScheduleGrid } from "@/components/schedule/Schedule";
import { ScheduleLegend } from "@/components/schedule/ScheduleLegend";
import { TimeZoneNotice } from "@/components/schedule/TimeZoneNotice";
import { ScheduleShortcuts } from "@/components/schedule/ScheduleShortcuts";
import { Badge } from "@/components/ui/Badge";
import { Skeleton } from "@/components/ui/Skeleton";
import { WEEK_START_DAY } from "@/lib/config";
import { getRoomAvailability } from "@/lib/domain/availability";
import { OFFICE_TZ } from "@/lib/domain/constants";
import { DAYS_IN_WEEK, SLOT_COUNT, getSlotStart, getWeekDays } from "@/lib/domain/grid";
import { getWeekStart } from "@/lib/domain/week";
import { prisma } from "@/lib/server/db";
import { getCurrentUser } from "@/lib/server/session";

const WEEK_MS = DAYS_IN_WEEK * 24 * 60 * 60 * 1000;

/** Today's office window as two instants, which is what availability compares against. */
function officeDayBounds(): { dayStart: Date; dayEnd: Date } {
  const today = DateTime.now().setZone(OFFICE_TZ).startOf("day");

  return {
    dayStart: getSlotStart(today, 0).toJSDate(),
    dayEnd: getSlotStart(today, SLOT_COUNT).toJSDate(),
  };
}

// The dot beside a room in the rail. Three states, the same three the cards on
// the home screen carry, so the two screens never disagree about a room.
const RAIL_DOTS = {
  free: "bg-accent-own-booking shadow-[0_0_0_3px_var(--color-accent-own-surface)]",
  freeFrom: "bg-now-line",
  quiet: "bg-text-tertiary",
};

/**
 * The room this page is about. Memoised per request: the title and the page
 * body both need it, and Next renders generateMetadata alongside the page.
 */
const getRoom = cache((id: string) => prisma.room.findUnique({ where: { id } }));

export async function generateMetadata({
  params,
}: {
  params: Promise<{ id: string }>;
}): Promise<Metadata> {
  const { id } = await params;
  const [room, t] = await Promise.all([getRoom(id), getTranslations("errors")]);

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
  canBook,
  weekStart,
  selectedDay,
  selectedSlot,
  selectedSlotEnd,
  selectedBookingId,
}: {
  roomId: string;
  /** Passed in rather than read again: the page already resolved the session. */
  userId?: string;
  canBook: boolean;
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
      canBook={canBook}
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

// The grid placeholder repeats the real geometry — the axis, the columns, a
// couple of blocks per day — so nothing shifts when the week arrives. It has to
// mirror both layouts: below sm the real grid is a single day of 48px rows with
// a day picker above it, above sm a seven-column week with the legend under it.
// The delay per column runs the wave the way the week is read.
async function ScheduleSkeleton() {
  const t = await getTranslations("rooms");

  return (
    <div className="flex flex-col gap-2.5">
      <p role="status" className="sr-only">
        {t("loading")}
      </p>

      <div aria-hidden className="flex flex-col gap-2 sm:hidden">
        <div className="bg-surface border-border-grid rounded-card flex items-center gap-2 border p-2">
          <Skeleton className="h-11 w-11 shrink-0" />
          <Skeleton className="h-8 flex-1" />
          <Skeleton className="h-11 w-11 shrink-0" />
        </div>

        <div className="flex gap-1">
          {Array.from({ length: DAYS_IN_WEEK }, (_, column) => (
            <Skeleton
              key={column}
              className="h-11 flex-1"
              style={{ animationDelay: `${column * 90}ms` }}
            />
          ))}
        </div>

        <div className="bg-surface border-border-grid rounded-card shadow-rest overflow-hidden border">
          <div className="flex" style={{ height: rowSpan(SLOT_COUNT, DAY_ROW_H) }}>
            <div className="border-border-grid w-14 flex-none border-r" />
            <div className="relative min-w-0 flex-1">
              <Skeleton
                className="absolute right-[3px] left-[3px]"
                style={{
                  top: rowSpan(2, DAY_ROW_H),
                  height: rowSpan(2, DAY_ROW_H),
                }}
              />
              <Skeleton
                className="absolute right-[3px] left-[3px]"
                style={{
                  top: rowSpan(10, DAY_ROW_H),
                  height: rowSpan(3, DAY_ROW_H),
                  animationDelay: "90ms",
                }}
              />
            </div>
          </div>
        </div>

        {/* Stands in for the touch hint, which wraps onto two lines on a phone. */}
        <div className="flex h-[39px] flex-col justify-center gap-1.5">
          <Skeleton className="h-3 w-full" />
          <Skeleton className="h-3 w-2/5" />
        </div>
      </div>

      <div
        aria-hidden
        className="bg-surface border-border-grid rounded-card shadow-rest hidden overflow-hidden border sm:block"
      >
        <div
          className="border-border-grid flex border-b"
          style={{ height: `${HEADER_REM}rem` }}
        >
          <div className="border-border-grid w-axis flex-none border-r" />
          {Array.from({ length: DAYS_IN_WEEK }, (_, column) => (
            <div
              key={column}
              className="border-border-grid flex min-w-[5.5rem] flex-1 items-center justify-center border-l"
            >
              <Skeleton
                className="h-2.5 w-14"
                style={{ animationDelay: `${column * 90}ms` }}
              />
            </div>
          ))}
        </div>
        <div className="flex" style={{ height: rowSpan(SLOT_COUNT, ROW_H) }}>
          <div className="border-border-grid w-axis flex-none border-r" />
          {Array.from({ length: DAYS_IN_WEEK }, (_, column) => (
            <div
              key={column}
              className="border-border-grid grid-rows-day relative min-w-[5.5rem] flex-1 border-l"
            >
              <Skeleton
                className="absolute right-[3px] left-[3px]"
                style={{
                  top: rowSpan(2 + column, ROW_H),
                  height: rowSpan(2, ROW_H),
                  animationDelay: `${column * 90}ms`,
                }}
              />
              <Skeleton
                className="absolute right-[3px] left-[3px]"
                style={{
                  top: rowSpan(10 + (column % 4), ROW_H),
                  height: rowSpan(3, ROW_H),
                  animationDelay: `${column * 90}ms`,
                }}
              />
            </div>
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
  const [t, tRooms, locale] = await Promise.all([
    getTranslations("schedule"),
    getTranslations("rooms"),
    getLocale(),
  ]);

  const { dayStart, dayEnd } = officeDayBounds();

  // Independent of each other, so they travel together rather than in a queue.
  // Today's bookings come along for the rail: it carries a free/busy dot per
  // room, and a query per room would be six round trips for six dots.
  const [room, user, rooms, todaysBookings] = await Promise.all([
    getRoom(id),
    getCurrentUser(),
    prisma.room.findMany({
      select: { id: true, name: true, floor: true, capacity: true },
      orderBy: [{ floor: "asc" }, { name: "asc" }],
    }),
    prisma.booking.findMany({
      // Half-open window, the same comparison the overlap rule uses.
      where: { canceledAt: null, startsAt: { lt: dayEnd }, endsAt: { gt: dayStart } },
      select: { roomId: true, startsAt: true, endsAt: true },
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
  const isPastWeek = weekStart < currentWeek;

  return (
    <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:gap-5">
      {/* The room list takes width, not height: that is what leaves room for all
          twenty rows on a laptop screen. Floor and capacity are visible at the
          moment of choosing, so nothing has to be remembered. Below lg it turns
          into a scrolling row of the same chips. */}
      <nav
        aria-label={tRooms("title")}
        // A long list of rooms must not decide how tall the page is — the whole
        // week fitting a laptop screen is the point. So on wide screens it gets
        // its own scroll and stays put while the grid is read.
        className="w-full shrink-0 lg:sticky lg:top-4 lg:max-h-[calc(100vh-6rem)] lg:w-rail lg:overflow-y-auto"
      >
        <p className="text-text-tertiary hidden px-2.5 pb-2.5 text-[11px] font-bold tracking-[0.06em] uppercase lg:block">
          {tRooms("title")}
        </p>
        {/* Below lg the strip runs to both edges of the screen instead of
            stopping inside the page padding: a chip cut off by the window reads
            as "scroll me", the same chip cut off 16px early reads as broken. */}
        <ul className="-mx-4 flex gap-1.5 overflow-x-auto px-4 pb-1 lg:mx-0 lg:flex-col lg:gap-[3px] lg:overflow-visible lg:px-0 lg:pb-0">
          {rooms.map((option) => {
            const isCurrent = option.id === room.id;
            const availability = getRoomAvailability(
              todaysBookings.filter((booking) => booking.roomId === option.id),
              now,
              dayStart,
              dayEnd,
            );
            const dot =
              availability.kind === "free"
                ? "free"
                : availability.kind === "freeFrom"
                  ? "freeFrom"
                  : "quiet";

            return (
              <li key={option.id} className="shrink-0 lg:shrink">
                <Link
                  href={`/rooms/${option.id}?week=${weekStart.toISODate()}`}
                  aria-current={isCurrent ? "page" : undefined}
                  className={`focus-ring rounded-control flex min-h-11 items-center justify-between gap-2.5 px-2.5 py-2 no-underline transition lg:min-h-0 ${
                    isCurrent
                      ? "bg-accent-own-surface shadow-[inset_3px_0_0_var(--color-accent-own-booking)]"
                      : "bg-surface hover:bg-surface-muted lg:bg-transparent"
                  }`}
                >
                  <span className="flex min-w-0 flex-col gap-0.5">
                    <span
                      className={`text-[13.5px] leading-tight font-bold ${
                        isCurrent ? "text-accent-own-ink" : "text-text-primary"
                      }`}
                    >
                      {option.name}
                    </span>
                    <span className="text-text-tertiary font-mono text-xs whitespace-nowrap sm:text-[11px]">
                      {tRooms("roomMeta", {
                        floor: option.floor,
                        capacity: option.capacity,
                      })}
                    </span>
                  </span>
                  {/* Free, free later, or nothing left today — the same three
                      answers the room cards give, so the rail is a shortcut and
                      never a second opinion. */}
                  <span
                    aria-hidden="true"
                    className={`size-2 shrink-0 rounded-full ${RAIL_DOTS[dot]}`}
                  />
                </Link>
              </li>
            );
          })}
        </ul>
      </nav>

      {/* Keyed by the room so React remounts this column when another room is
          picked — that is what replays the animation. The week arrows keep the
          same key, so paging through weeks stays still. */}
      <div
        key={room.id}
        className="animate-swap flex min-w-0 flex-1 flex-col gap-2.5"
      >
        <div className="flex flex-wrap items-center gap-3">
          <div className="flex min-w-0 items-center gap-2.5">
            <h1 className="truncate text-[22px] font-extrabold tracking-[-0.02em] sm:text-[24px]">
              {room.name}
            </h1>
              <span className="bg-surface-muted text-text-secondary border-border-grid hidden shrink-0 items-center gap-1.5 rounded-md border px-2 py-[3px] font-mono text-[11px] font-semibold sm:flex">
                <Users aria-hidden="true" className="size-3" />
                {tRooms("roomMeta", { floor: room.floor, capacity: room.capacity })}
              </span>
              {/* Paging back a week looks the same as paging forward, so a week
                  that is entirely over says so next to its own name. */}
            {isPastWeek ? <Badge tone="warning">{t("pastWeek")}</Badge> : null}
          </div>

          <span className="hidden flex-1 sm:block" />

          {/* Both are meta about the week on screen, so they share the line the
              name leaves free rather than each taking one of their own — at
              1366x768 a second row here costs the grid its last half hour.
              The notice decides for itself when it is worth a line. */}
          <TimeZoneNotice />

          <span className="text-text-primary hidden font-mono text-[13px] font-semibold lg:inline">
            {formatWeekRange(weekStart, locale)}
          </span>

          {/* Below sm the day view carries its own arrows and its strip of
              seven days, so a second set of week arrows would be two
              navigations for one grid. Only "Today" survives, because that is
              the one jump the day arrows cannot make. */}
          <div className="border-border-grid bg-surface-muted rounded-control flex items-center gap-0.5 border p-[3px]">
            <Link
              href={`/rooms/${room.id}?week=${previousWeek}`}
              // The arrow carries no words, so the label a screen reader gets is
              // also the one the pointer gets.
              aria-label={t("previousWeek")}
              title={t("previousWeek")}
              className="focus-ring-tight text-text-secondary hover:bg-surface hover:text-text-primary hidden size-[30px] items-center justify-center rounded-[7px] no-underline transition sm:flex"
            >
              <ChevronLeft aria-hidden="true" className="size-[18px]" />
            </Link>
            <Link
              href={`/rooms/${room.id}`}
              aria-current={isCurrentWeek ? "page" : undefined}
              className={`focus-ring-tight flex h-10 items-center rounded-[7px] px-3 text-[12.5px] font-bold no-underline transition sm:h-[30px] ${
                isCurrentWeek
                  ? "bg-accent-own-surface text-accent-own-ink"
                  : "bg-surface border-border-grid text-text-primary border"
              }`}
            >
              {t("today")}
            </Link>
            <Link
              href={`/rooms/${room.id}?week=${nextWeek}`}
              aria-label={t("nextWeek")}
              title={t("nextWeek")}
              className="focus-ring-tight text-text-secondary hover:bg-surface hover:text-text-primary hidden size-[30px] items-center justify-center rounded-[7px] no-underline transition sm:flex"
            >
              <ChevronRight aria-hidden="true" className="size-[18px]" />
            </Link>
          </div>

          {/* Both the shortcut listener and the button that says the shortcuts
              exist; it belongs next to the navigation those shortcuts are for. */}
          <ScheduleShortcuts
            previousHref={`/rooms/${room.id}?week=${previousWeek}`}
            nextHref={`/rooms/${room.id}?week=${nextWeek}`}
            todayHref={`/rooms/${room.id}`}
          />
        </div>

        {/* The legend sits outside the boundary, next to the grid rather than
            inside it: it needs no data, so it should not blink or move. */}
        {/* tabIndex -1 so the closing panel can hand the focus back here: it is
            not a tab stop of its own, only a place the focus can be put. */}
        <div
          id={SCHEDULE_ANCHOR_ID}
          tabIndex={-1}
          className="flex flex-col gap-2 focus:outline-none"
        >
          <Suspense key={weekStart.toISODate()} fallback={await ScheduleSkeleton()}>
            <Schedule
              roomId={room.id}
              userId={user?.id}
              canBook={user?.emailVerified ?? false}
              weekStart={weekStart}
              selectedDay={resolveSelectedDay(weekStart, day)}
              selectedSlot={slot}
              selectedSlotEnd={slotEnd}
              selectedBookingId={selectedBooking?.id}
            />
          </Suspense>

          <ScheduleLegend />
        </div>
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
