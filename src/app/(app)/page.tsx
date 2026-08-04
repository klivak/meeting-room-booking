import { Users } from "lucide-react";
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
          // 156px is what the loaded card measures: name, floor line, and the
          // availability strip under its divider.
          <li
            key={index}
            className="border-border-grid bg-surface rounded-card shadow-card flex h-[156px] flex-col gap-3 border p-[22px]"
          >
            <Skeleton
              className={`h-5 ${card.name}`}
              style={{ animationDelay: `${index * 110}ms` }}
            />
            <Skeleton className={`h-3 ${card.meta}`} />
            <Skeleton className="mt-auto h-9 w-full" />
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
      {rooms.map((room, index) => {
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
                target for the most common action on this screen. The cards
                arrive one after another rather than all at once, so the eye
                reads the grid in the order it is laid out. */}
            <Link
              href={`/rooms/${room.id}`}
              style={{ animationDelay: `${index * 60}ms` }}
              className="focus-ring border-border-grid bg-surface rounded-card shadow-card hover:border-accent-own-booking hover:shadow-panel animate-block relative flex flex-col overflow-hidden border p-[22px] text-inherit no-underline transition hover:-translate-y-0.5"
            >
              {/* The capacity again, as a watermark: it gives the card a scale
                  and a face without another line of text. Drawn by a pseudo
                  element rather than as a text node — at 6% it is a texture, and
                  a contrast checker is right to call that unreadable prose. */}
              <span
                aria-hidden="true"
                data-capacity={room.capacity}
                className="text-accent-own-booking/[0.06] pointer-events-none absolute -top-8 -right-2.5 font-mono text-[120px] leading-none font-bold after:content-[attr(data-capacity)]"
              />

              <span className="flex items-start justify-between gap-3">
                <span className="flex flex-col gap-1">
                  <span className="text-[21px] font-extrabold tracking-[-0.02em]">
                    {room.name}
                  </span>
                  <span className="text-text-tertiary font-mono text-xs font-semibold">
                    {t("floor", { floor: room.floor })}
                  </span>
                </span>
                <span className="bg-surface-muted text-text-secondary border-border-grid relative flex shrink-0 items-center gap-1.5 rounded-lg border px-2.5 py-[5px] font-mono text-xs font-bold">
                  <Users aria-hidden="true" className="size-[13px]" />
                  {t("seats", { count: room.capacity })}
                </span>
              </span>

              <span className="bg-border-grid mt-[18px] mb-3.5 h-px" />

              <RoomAvailability availability={view} />
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
  const capacityMin =
    Number.isInteger(parsed) && parsed > 0 ? parsed : undefined;

  return (
    <div className="mx-auto flex w-full max-w-6xl flex-col gap-6">
      <div className="flex flex-wrap items-end justify-between gap-5">
        <div className="flex flex-col gap-1.5">
          <h1 className="text-[28px] font-extrabold tracking-[-0.03em] sm:text-[38px]">
            {t("title")}
          </h1>
          <p className="text-text-secondary text-sm">{t("subtitle")}</p>
        </div>

        {/* Links rather than a select: the filter stays in the URL, is shareable
            and needs no client-side JavaScript. */}
        <nav aria-label={t("capacity")} className="flex items-center gap-2">
          <span className="text-text-tertiary mr-1 hidden text-xs font-bold sm:inline">
            {t("capacity")}
          </span>
          <span className="-mx-4 flex gap-1.5 overflow-x-auto px-4 sm:mx-0 sm:flex-wrap sm:px-0">
            {CAPACITY_OPTIONS.map((option) => (
              <LinkButton
                key={option.label}
                href={option.value ? `/?capacityMin=${option.value}` : "/"}
                active={option.value === capacityMin}
                className="min-w-0 shrink-0 px-3.5 sm:min-h-9"
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
