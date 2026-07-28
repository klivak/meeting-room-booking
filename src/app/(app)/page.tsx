import Link from "next/link";
import { Suspense } from "react";

import { prisma } from "@/lib/server/db";

/** Ukrainian plural for "місце": 1 місце, 2-4 місця, 5+ місць (11-14 are the exception). */
function seatsLabel(count: number): string {
  const lastTwo = count % 100;
  const last = count % 10;

  if (lastTwo >= 11 && lastTwo <= 14) return `${count} місць`;
  if (last === 1) return `${count} місце`;
  if (last >= 2 && last <= 4) return `${count} місця`;
  return `${count} місць`;
}

function RoomsSkeleton() {
  return (
    <ul className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
      {[0, 1, 2, 3, 4, 5].map((index) => (
        <li
          key={index}
          className="h-20 animate-pulse rounded-xl border border-slate-200 bg-white"
        />
      ))}
    </ul>
  );
}

async function RoomsList() {
  // The layout above already guarantees a session, so this reads straight from
  // the database instead of going through /api/rooms over HTTP.
  const rooms = await prisma.room.findMany({
    select: { id: true, name: true, floor: true, capacity: true },
    orderBy: [{ floor: "asc" }, { name: "asc" }],
  });

  if (rooms.length === 0) {
    return (
      <p className="rounded-xl border border-slate-200 bg-white p-6 text-sm text-slate-600">
        Кімнат поки немає.
      </p>
    );
  }

  return (
    <ul className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
      {rooms.map((room) => (
        <li key={room.id}>
          <Link
            href={`/rooms/${room.id}`}
            className="block rounded-xl border border-slate-200 bg-white p-4 transition hover:border-slate-300 hover:shadow-sm"
          >
            <span className="font-medium text-slate-900">{room.name}</span>
            <span className="mt-1 block text-sm text-slate-600">
              {room.floor} поверх · {seatsLabel(room.capacity)}
            </span>
          </Link>
        </li>
      ))}
    </ul>
  );
}

// The skeleton is scoped to this page instead of living in a group-level
// loading.tsx: a Suspense boundary above /rooms/[id] would flush the response
// before notFound() runs, turning a missing room into a 200.
export default function HomePage() {
  return (
    <div className="flex flex-col gap-4">
      <h1 className="text-xl font-semibold text-slate-900">Переговорні</h1>
      <Suspense fallback={<RoomsSkeleton />}>
        <RoomsList />
      </Suspense>
    </div>
  );
}
