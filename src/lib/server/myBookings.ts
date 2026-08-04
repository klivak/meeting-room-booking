import { prisma } from "@/lib/server/db";

// Two entry points read the same list: /my-bookings renders the first page on
// the server, /api/my-bookings answers "show more". The paging rules live here
// once, because a page size or a time filter that drifted between the two would
// not fail — it would quietly repeat rows or skip them.

export const PAGE_SIZE = 20;

export type BookingScope = "upcoming" | "past";

// Named apart from the MyBooking that BookingRow exports: that one carries
// ISO strings for the browser, this one the Date objects Prisma returns.
export type MyBookingRecord = {
  id: string;
  title: string;
  startsAt: Date;
  endsAt: Date;
  room: { id: string; name: string };
  /** Whether the booking repeats; the series id itself is of no use to a client. */
  isRecurring: boolean;
};

/**
 * One page of the user's own bookings.
 *
 * "Upcoming" counts a running booking as upcoming: it is over only once it
 * ends. The id breaks ties so two bookings starting at the same moment keep a
 * stable order, which is what makes the cursor reliable across pages.
 */
export async function getMyBookingsPage(
  userId: string,
  scope: BookingScope,
  now: Date,
  cursor?: string,
): Promise<{ items: MyBookingRecord[]; nextCursor: string | null }> {
  const direction = scope === "upcoming" ? "asc" : "desc";

  const rows = await prisma.booking.findMany({
    where: {
      userId,
      canceledAt: null,
      ...(scope === "upcoming" ? { endsAt: { gt: now } } : { endsAt: { lte: now } }),
    },
    orderBy: [{ startsAt: direction }, { id: direction }],
    // One extra row is read purely to learn whether another page exists.
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

  const hasMore = rows.length > PAGE_SIZE;
  const page = hasMore ? rows.slice(0, PAGE_SIZE) : rows;

  return {
    items: page.map(({ seriesId, ...booking }) => ({
      ...booking,
      isRecurring: seriesId !== null,
    })),
    nextCursor: hasMore ? page[page.length - 1].id : null,
  };
}

/**
 * Whether the cursor points at a booking of this user. A cursor pointing at
 * someone else's booking, or at nothing, would silently produce an empty page;
 * saying so is more honest than pretending the list ended.
 */
export async function ownsBooking(userId: string, bookingId: string): Promise<boolean> {
  const owned = await prisma.booking.findFirst({
    where: { id: bookingId, userId },
    select: { id: true },
  });

  return owned !== null;
}

/**
 * How many bookings each tab holds. The tabs carry the numbers, and a count is
 * cheaper than a page: this asks the database to count rather than reading
 * twenty rows to measure them.
 */
export async function countMyBookings(
  userId: string,
  now: Date,
): Promise<Record<BookingScope, number>> {
  const [upcoming, past] = await Promise.all([
    prisma.booking.count({
      where: { userId, canceledAt: null, endsAt: { gt: now } },
    }),
    prisma.booking.count({
      where: { userId, canceledAt: null, endsAt: { lte: now } },
    }),
  ]);

  return { upcoming, past };
}
