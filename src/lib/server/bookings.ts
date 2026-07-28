import type { Prisma } from "@/generated/prisma/client";
import { prisma } from "@/lib/server/db";

// Writing a booking is check-then-insert, which is exactly the shape that
// breaks under concurrency: two requests can both find the slot free and both
// insert. The lock below closes that window.

type BookingWrite = {
  roomId: string;
  title: string;
  startsAt: Date;
  endsAt: Date;
};

const BOOKING_FIELDS = {
  id: true,
  roomId: true,
  seriesId: true,
  title: true,
  startsAt: true,
  endsAt: true,
} satisfies Prisma.BookingSelect;

/**
 * Serializes concurrent writes for one room.
 *
 * pg_advisory_xact_lock holds the lock until the transaction ends, so the
 * overlap check and the insert cannot interleave with another request for the
 * same room. The key is derived from the room id, so bookings in different
 * rooms never wait for each other.
 *
 * Chosen over the alternatives because it needs no schema change and stays
 * readable: an exclusion constraint over a tstzrange would push the rule into
 * the database and out of the domain layer, and SERIALIZABLE would make the
 * second request fail with a retryable error the API would have to translate.
 */
async function lockRoom(tx: Prisma.TransactionClient, roomId: string) {
  await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${`room-${roomId}`}))`;
}

/** Active booking of the room that overlaps [startsAt, endsAt), if any. */
async function findClash(
  tx: Prisma.TransactionClient,
  input: BookingWrite & { excludeId?: string },
) {
  return tx.booking.findFirst({
    // Same comparison as intervalsOverlap, expressed as a query. Canceled rows
    // are skipped, so a canceled booking stops blocking its slot.
    where: {
      roomId: input.roomId,
      canceledAt: null,
      startsAt: { lt: input.endsAt },
      endsAt: { gt: input.startsAt },
      ...(input.excludeId ? { id: { not: input.excludeId } } : {}),
    },
    select: { id: true },
  });
}

/** Creates a booking, or returns null when the slot is already taken. */
export async function createBooking(input: BookingWrite & { userId: string }) {
  return prisma.$transaction(async (tx) => {
    await lockRoom(tx, input.roomId);

    if (await findClash(tx, input)) {
      return null;
    }

    return tx.booking.create({
      data: {
        roomId: input.roomId,
        userId: input.userId,
        title: input.title,
        startsAt: input.startsAt,
        endsAt: input.endsAt,
      },
      select: BOOKING_FIELDS,
    });
  });
}

export type SeriesResult =
  | { created: Awaited<ReturnType<typeof createBooking>>[]; conflicts: [] }
  | { created: null; conflicts: Date[] };

/**
 * Creates every occurrence of a weekly series, or none of them.
 *
 * All the occurrences are checked before anything is written, and the whole
 * thing runs in one transaction: a series that is half booked would be worse
 * than one that was refused, because the user cannot see which weeks made it.
 */
export async function createBookingSeries(
  input: { roomId: string; userId: string; title: string },
  occurrences: { startsAt: Date; endsAt: Date }[],
): Promise<SeriesResult> {
  return prisma.$transaction(async (tx) => {
    await lockRoom(tx, input.roomId);

    const conflicts: Date[] = [];
    for (const occurrence of occurrences) {
      if (await findClash(tx, { ...input, ...occurrence })) {
        conflicts.push(occurrence.startsAt);
      }
    }

    if (conflicts.length > 0) {
      return { created: null, conflicts };
    }

    const series = await tx.bookingSeries.create({
      data: { userId: input.userId },
      select: { id: true },
    });

    const created = [];
    for (const occurrence of occurrences) {
      created.push(
        await tx.booking.create({
          data: {
            roomId: input.roomId,
            userId: input.userId,
            seriesId: series.id,
            title: input.title,
            startsAt: occurrence.startsAt,
            endsAt: occurrence.endsAt,
          },
          select: BOOKING_FIELDS,
        }),
      );
    }

    return { created, conflicts: [] };
  });
}

/**
 * Moves or renames an existing booking, or returns null when the target slot is
 * taken. The booking itself is excluded from the check, otherwise it would
 * clash with itself and could not even be renamed.
 */
export async function updateBooking(id: string, input: BookingWrite) {
  return prisma.$transaction(async (tx) => {
    await lockRoom(tx, input.roomId);

    if (await findClash(tx, { ...input, excludeId: id })) {
      return null;
    }

    return tx.booking.update({
      where: { id },
      data: {
        roomId: input.roomId,
        title: input.title,
        startsAt: input.startsAt,
        endsAt: input.endsAt,
      },
      select: BOOKING_FIELDS,
    });
  });
}
