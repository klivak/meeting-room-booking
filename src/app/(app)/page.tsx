import { DateTime } from "luxon";
import { getTranslations } from "next-intl/server";
import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";

import {
  RoomAvailability,
  type RoomAvailabilityView,
} from "@/components/rooms/RoomAvailability";
import { EmptyState } from "@/components/ui/EmptyState";
import { LinkButton } from "@/components/ui/LinkButton";
import { Skeleton } from "@/components/ui/Skeleton";
import { getRoomAvailability } from "@/lib/domain/availability";
import { OFFICE_TZ } from "@/lib/domain/constants";
import { SLOT_COUNT, getSlotStart } from "@/lib/domain/grid";
import { prisma } from "@/lib/server/db";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("rooms");

  return { title: t("title") };
}

// Widths differ per card so the placeholder grid looks like a list of names of
// different lengths rather than a stack of identical bars.
const SKELETON_CARDS = [
  { name: "w-1/2", meta: "w-3/4" },
  { name: "w-2/3", meta: "w-1/2" },
  { name: "w-2/5", meta: "w-2/3" },
  { name: "w-3/5", meta: "w-3/5" },
  { name: "w-1/2", meta: "w-2/3" },
  { name: "w-3/5", meta: "w-1/2" },
];

// The placeholder repeats the real card (border, padding, three lines) so the
// switch to loaded content shifts nothing. The delay per card makes the wave run
// across the grid instead of all six blinking in lockstep.
async function RoomsSkeleton() {
  const t = await getTranslations("rooms");

  return (
    <>
      <p role="status" className="sr-only">
        {t("loading")}
      </p>
      <ul aria-hidden className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        {SKELETON_CARDS.map((card, index) => (
          // 128px is what the loaded card measures: name, floor line, and the
          // availability line under its divider.
          <li
            key={index}
            className="border-border-grid bg-surface rounded-card flex h-[128px] flex-col gap-3 border p-4"
          >
            <Skeleton
              className={`h-4 ${card.name}`}
              style={{ animationDelay: `${index * 110}ms` }}
            />
            <Skeleton className={`h-3 ${card.meta}`} />
            <Skeleton className="mt-auto h-3 w-2/5" />
          </li>
        ))}
      </ul>
    </>
  );
}

/** Today's office window as two instants, which is what availability compares against. */
function officeDayBounds(): { dayStart: Date; dayEnd: Date } {
  const today = DateTime.now().setZone(OFFICE_TZ).startOf("day");

  return {
    dayStart: getSlotStart(today, 0).toJSDate(),
    dayEnd: getSlotStart(today, SLOT_COUNT).toJSDate(),
  };
}

async function RoomsList({ capacityMin }: { capacityMin?: number }) {
  const t = await getTranslations("rooms");
  const { dayStart, dayEnd } = officeDayBounds();

  // The layout above already guarantees a session, so this reads straight from
  // the database instead of going through /api/rooms over HTTP. Today's
  // bookings come along in one query: the card's whole point is saying whether
  // the room is free, and a query per card would be six round trips.
  const [rooms, todaysBookings] = await Promise.all([
    prisma.room.findMany({
      where: capacityMin ? { capacity: { gte: capacityMin } } : {},
      select: { id: true, name: true, floor: true, capacity: true },
      orderBy: [{ floor: "asc" }, { name: "asc" }],
    }),
    prisma.booking.findMany({
      // Half-open window, the same comparison the overlap rule uses.
      where: {
        canceledAt: null,
        startsAt: { lt: dayEnd },
        endsAt: { gt: dayStart },
      },
      select: { roomId: true, startsAt: true, endsAt: true },
    }),
  ]);

  if (rooms.length === 0) {
    return capacityMin ? (
      <EmptyState
        title={t("emptyFilteredTitle", { capacity: capacityMin })}
        description={t("emptyFilteredText")}
        action={<LinkButton href="/">{t("resetFilter")}</LinkButton>}
      />
    ) : (
      <EmptyState title={t("emptyTitle")} description={t("emptyText")} />
    );
  }

  const now = new Date();

  return (
    <ul className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
      {rooms.map((room) => {
        const availability = getRoomAvailability(
          todaysBookings.filter((booking) => booking.roomId === room.id),
          now,
          dayStart,
          dayEnd,
        );

        const view: RoomAvailabilityView =
          availability.kind === "freeFrom"
            ? { kind: "freeFrom", at: availability.at.toISOString() }
            : { kind: availability.kind };

        return (
          <li key={room.id}>
            {/* The whole card is the link: the name alone would be a small
                target for the most common action on this screen. */}
            <Link
              href={`/rooms/${room.id}`}
              className="focus-ring border-border-grid bg-surface rounded-card hover:border-accent-own-booking hover:shadow-panel flex flex-col gap-2.5 border p-4 text-inherit no-underline transition"
            >
              <span className="flex items-baseline gap-2">
                <span className="text-[17px] font-semibold tracking-tight">
                  {room.name}
                </span>
                <span className="flex-1" />
                <span className="bg-surface-muted text-text-secondary rounded-booking shrink-0 px-1.5 py-0.5 font-mono text-xs font-semibold">
                  {t("seats", { count: room.capacity })}
                </span>
              </span>

              <span className="text-text-tertiary text-[13px]">
                {t("floor", { floor: room.floor })}
              </span>

              <span className="border-border-grid-half border-t pt-2">
                <RoomAvailability availability={view} />
              </span>
            </Link>
          </li>
        );
      })}
    </ul>
  );
}

/** Options for the capacity filter; undefined means no filter. */
const CAPACITY_OPTIONS: { value?: number; label: string }[] = [
  { label: "any" },
  { value: 2, label: "2+" },
  { value: 4, label: "4+" },
  { value: 6, label: "6+" },
  { value: 8, label: "8+" },
  { value: 12, label: "12+" },
];

// The skeleton is scoped to this page instead of living in a group-level
// loading.tsx: a Suspense boundary above /rooms/[id] would flush the response
// before notFound() runs, turning a missing room into a 200.
export default async function HomePage({
  searchParams,
}: {
  searchParams: Promise<{ capacityMin?: string }>;
}) {
  const { capacityMin: capacityParam } = await searchParams;
  const t = await getTranslations("rooms");

  // An unusable value is ignored rather than refused: the list is still the
  // right thing to show.
  const parsed = Number(capacityParam);
  const capacityMin = Number.isInteger(parsed) && parsed > 0 ? parsed : undefined;

  return (
    <div className="mx-auto flex w-full max-w-5xl flex-col gap-5">
      <div className="flex flex-wrap items-end gap-4">
        <h1 className="text-[22px] font-semibold tracking-tight">{t("title")}</h1>

        <span className="hidden flex-1 sm:block" />

        {/* Links rather than a select: the filter stays in the URL, is shareable
            and needs no client-side JavaScript. */}
        <nav aria-label={t("capacity")} className="flex flex-col gap-1.5">
          <span className="text-text-tertiary text-xs font-semibold">
            {t("capacity")}
          </span>
          <span className="flex flex-wrap gap-1">
            {CAPACITY_OPTIONS.map((option) => (
              <LinkButton
                key={option.label}
                href={option.value ? `/?capacityMin=${option.value}` : "/"}
                active={option.value === capacityMin}
                className="min-w-0 px-3"
              >
                {option.value ? option.label : t("any")}
              </LinkButton>
            ))}
          </span>
        </nav>
      </div>

      <Suspense key={capacityMin ?? "all"} fallback={await RoomsSkeleton()}>
        <RoomsList capacityMin={capacityMin} />
      </Suspense>
    </div>
  );
}
