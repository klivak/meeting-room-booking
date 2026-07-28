import { NextResponse } from "next/server";
import { z } from "zod";

import { unauthorizedError, validationError } from "@/lib/server/apiError";
import { prisma } from "@/lib/server/db";
import { getCurrentUser } from "@/lib/server/session";

const PAGE_SIZE = 20;

const querySchema = z.object({
  scope: z.enum(["upcoming", "past"]).default("upcoming"),
  cursor: z.string().optional(),
});

// The current user's own bookings, split into the two tabs of /my-bookings.
export async function GET(request: Request) {
  const user = await getCurrentUser();
  if (!user) {
    return unauthorizedError();
  }

  const url = new URL(request.url);
  const parsed = querySchema.safeParse({
    scope: url.searchParams.get("scope") ?? undefined,
    cursor: url.searchParams.get("cursor") ?? undefined,
  });
  if (!parsed.success) {
    return validationError(parsed.error);
  }

  const { scope, cursor } = parsed.data;
  const now = new Date();

  // Upcoming counts a running booking as upcoming: it is over only once it ends.
  const timeFilter =
    scope === "upcoming" ? { endsAt: { gt: now } } : { endsAt: { lte: now } };
  const direction = scope === "upcoming" ? "asc" : "desc";

  const bookings = await prisma.booking.findMany({
    where: { userId: user.id, canceledAt: null, ...timeFilter },
    // id breaks ties so two bookings starting at the same moment keep a stable
    // order, which is what makes the cursor reliable across pages.
    orderBy: [{ startsAt: direction }, { id: direction }],
    take: PAGE_SIZE + 1,
    ...(cursor ? { cursor: { id: cursor }, skip: 1 } : {}),
    select: {
      id: true,
      seriesId: true,
      title: true,
      startsAt: true,
      endsAt: true,
      room: { select: { id: true, name: true } },
    },
  });

  // One extra row was requested purely to learn whether another page exists.
  const hasMore = bookings.length > PAGE_SIZE;
  const items = hasMore ? bookings.slice(0, PAGE_SIZE) : bookings;

  return NextResponse.json({
    // The series id itself is of no use to the client; whether the booking
    // repeats is, and it is the same shape the page renders on the server.
    items: items.map(({ seriesId, ...booking }) => ({
      ...booking,
      isRecurring: seriesId !== null,
    })),
    nextCursor: hasMore ? items[items.length - 1].id : null,
  });
}
