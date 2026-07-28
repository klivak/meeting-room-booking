import { getTranslations } from "next-intl/server";
import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";

import { EmptyState } from "@/components/ui/EmptyState";
import { LinkButton } from "@/components/ui/LinkButton";
import { Skeleton } from "@/components/ui/Skeleton";
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

// The placeholder repeats the real card (border, padding, two text lines) so the
// switch to loaded content shifts nothing. The delay per card makes the shimmer
// run across the grid as a wave instead of all six blinking in lockstep.
async function RoomsSkeleton() {
  const t = await getTranslations("rooms");

  return (
    <>
      <p role="status" className="sr-only">
        {t("loading")}
      </p>
      <ul aria-hidden className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {SKELETON_CARDS.map((card, index) => (
          <li
            key={index}
            className="animate-rise h-20 rounded-xl border border-slate-200 bg-white p-4"
            style={{ animationDelay: `${index * 50}ms` }}
          >
            <Skeleton
              className={`h-4 ${card.name}`}
              style={{ animationDelay: `${index * 120}ms` }}
            />
            <Skeleton
              className={`mt-3 h-3 ${card.meta}`}
              style={{ animationDelay: `${index * 120 + 60}ms` }}
            />
          </li>
        ))}
      </ul>
    </>
  );
}

async function RoomsList({ capacityMin }: { capacityMin?: number }) {
  const t = await getTranslations("rooms");

  // The layout above already guarantees a session, so this reads straight from
  // the database instead of going through /api/rooms over HTTP.
  const rooms = await prisma.room.findMany({
    where: capacityMin ? { capacity: { gte: capacityMin } } : {},
    select: { id: true, name: true, floor: true, capacity: true },
    orderBy: [{ floor: "asc" }, { name: "asc" }],
  });

  if (rooms.length === 0) {
    return capacityMin ? (
      <EmptyState
        title={t("emptyFiltered", { capacity: capacityMin })}
        action={<LinkButton href="/">{t("resetFilter")}</LinkButton>}
      />
    ) : (
      <EmptyState title={t("empty")} />
    );
  }

  return (
    <ul className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
      {rooms.map((room, index) => (
        // The same stagger as the placeholder, so the cards arrive in the order
        // the shimmer was running.
        <li
          key={room.id}
          className="animate-rise"
          style={{ animationDelay: `${Math.min(index, 8) * 50}ms` }}
        >
          <Link
            href={`/rooms/${room.id}`}
            className="block rounded-xl border border-slate-200 bg-white p-4 transition hover:-translate-y-0.5 hover:border-slate-300 hover:shadow-md focus-visible:ring-2 focus-visible:ring-slate-400 focus-visible:ring-offset-2 focus-visible:outline-none"
          >
            <span className="font-medium text-slate-900">{room.name}</span>
            <span className="mt-1 block text-sm text-slate-600">
              {t("floor", { floor: room.floor })} ·{" "}
              {t("seats", { count: room.capacity })}
            </span>
          </Link>
        </li>
      ))}
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
    <div className="flex flex-col gap-4">
      <h1 className="text-xl font-semibold text-slate-900">{t("title")}</h1>

      {/* Links rather than a select: the filter stays in the URL, is shareable
          and needs no client-side JavaScript. */}
      <nav aria-label={t("capacity")} className="flex flex-wrap items-center gap-2">
        <span className="text-sm text-slate-600">{t("capacity")}</span>
        {CAPACITY_OPTIONS.map((option) => (
          <LinkButton
            key={option.label}
            href={option.value ? `/?capacityMin=${option.value}` : "/"}
            active={option.value === capacityMin}
          >
            {option.value ? option.label : t("any")}
          </LinkButton>
        ))}
      </nav>

      <Suspense key={capacityMin ?? "all"} fallback={await RoomsSkeleton()}>
        <RoomsList capacityMin={capacityMin} />
      </Suspense>
    </div>
  );
}
