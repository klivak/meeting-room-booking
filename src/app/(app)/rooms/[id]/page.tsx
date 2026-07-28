import { DateTime } from "luxon";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Suspense } from "react";

import { WeekGrid } from "@/components/schedule/WeekGrid";
import { WEEK_START_DAY } from "@/lib/config";
import { OFFICE_TZ } from "@/lib/domain/constants";
import { DAYS_IN_WEEK, SLOT_COUNT } from "@/lib/domain/grid";
import { getWeekStart } from "@/lib/domain/week";
import { prisma } from "@/lib/server/db";
import { getCurrentUser } from "@/lib/server/session";

const WEEK_MS = DAYS_IN_WEEK * 24 * 60 * 60 * 1000;

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

function formatWeekRange(weekStart: DateTime): string {
  const weekEnd = weekStart.plus({ days: DAYS_IN_WEEK - 1 });
  const from = weekStart.setLocale("uk");
  const to = weekEnd.setLocale("uk");

  const sameMonth = from.month === to.month && from.year === to.year;

  return sameMonth
    ? `${from.toFormat("d")}–${to.toFormat("d MMMM yyyy")}`
    : `${from.toFormat("d MMMM")} – ${to.toFormat("d MMMM yyyy")}`;
}

async function Schedule({ roomId, weekStart }: { roomId: string; weekStart: DateTime }) {
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
      title: true,
      startsAt: true,
      endsAt: true,
      user: { select: { id: true, name: true } },
    },
  });

  return (
    <WeekGrid
      weekStart={weekStart.toISO() ?? ""}
      bookings={bookings.map((booking) => ({
        id: booking.id,
        title: booking.title,
        startsAt: booking.startsAt.toISOString(),
        endsAt: booking.endsAt.toISOString(),
        user: booking.user,
        isMine: booking.user.id === user?.id,
      }))}
    />
  );
}

function ScheduleSkeleton() {
  return (
    <div className="animate-pulse rounded-xl border border-slate-200 bg-white p-4">
      <div className="h-6 w-full rounded bg-slate-100" />
      <div
        className="mt-2 w-full rounded bg-slate-50"
        style={{ height: `${SLOT_COUNT * 2.25}rem` }}
      />
    </div>
  );
}

export default async function RoomPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ week?: string }>;
}) {
  const { id } = await params;
  const { week } = await searchParams;

  const room = await prisma.room.findUnique({ where: { id } });
  if (!room) {
    notFound();
  }

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
          <Link
            href={`/rooms/${room.id}?week=${previousWeek}`}
            aria-label="Попередній тиждень"
            className="rounded-lg border border-slate-300 px-3 py-1.5 text-sm text-slate-700 transition hover:bg-slate-100"
          >
            ←
          </Link>
          <Link
            href={`/rooms/${room.id}`}
            aria-current={isCurrentWeek ? "page" : undefined}
            className={`rounded-lg border px-3 py-1.5 text-sm transition ${
              isCurrentWeek
                ? "border-slate-900 bg-slate-900 text-white"
                : "border-slate-300 text-slate-700 hover:bg-slate-100"
            }`}
          >
            Сьогодні
          </Link>
          <Link
            href={`/rooms/${room.id}?week=${nextWeek}`}
            aria-label="Наступний тиждень"
            className="rounded-lg border border-slate-300 px-3 py-1.5 text-sm text-slate-700 transition hover:bg-slate-100"
          >
            →
          </Link>
        </div>
      </div>

      <p className="text-sm text-slate-600">{formatWeekRange(weekStart)}</p>

      {/* Plain links instead of a select: switching rooms keeps the week and
          needs no client-side JavaScript. */}
      <nav className="flex flex-wrap gap-2">
        {rooms.map((option) => (
          <Link
            key={option.id}
            href={`/rooms/${option.id}?week=${weekStart.toISODate()}`}
            aria-current={option.id === room.id ? "page" : undefined}
            className={`rounded-lg border px-3 py-1.5 text-sm transition ${
              option.id === room.id
                ? "border-slate-900 bg-slate-900 text-white"
                : "border-slate-300 text-slate-700 hover:bg-slate-100"
            }`}
          >
            {option.name}
          </Link>
        ))}
      </nav>

      <Suspense key={weekStart.toISODate()} fallback={<ScheduleSkeleton />}>
        <Schedule roomId={room.id} weekStart={weekStart} />
      </Suspense>
    </div>
  );
}
