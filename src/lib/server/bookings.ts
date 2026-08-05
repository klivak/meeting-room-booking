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
  input: { roomId: string; startsAt: Date; endsAt: Date; excludeId?: string },
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
 * Takes the cancellation back, or returns null when someone has taken the slot
 * in the meantime — which is the whole reason this cannot be a plain update.
 * A canceled booking stops blocking its slot the instant it is canceled, so the
 * room has to be locked and the overlap checked again, exactly as for a new one.
 */
export async function restoreBooking(
  id: string,
  roomId: string,
  userId: string,
) {
  return prisma.$transaction(async (tx) => {
    await lockRoom(tx, roomId);

    // The owner is part of the filter rather than only checked in the route:
    // this function resurrects a row, and a rule that lives one call away is a
    // rule the next caller can forget.
    const booking = await tx.booking.findFirst({
      where: { id, userId, canceledAt: { not: null } },
      select: { startsAt: true, endsAt: true },
    });

    if (!booking) {
      return null;
    }

    if (await findClash(tx, { roomId, excludeId: id, ...booking })) {
      return null;
    }

    return tx.booking.update({
      where: { id },
      data: { canceledAt: null },
      select: BOOKING_FIELDS,
    });
  });
}

/** Why an edit did not happen. The two refusals need different answers. */
export type UpdateResult =
  | { booking: Awaited<ReturnType<typeof createBooking>> }
  | { refused: "clash" | "canceled" };

/**
 * Moves or renames an existing booking. The booking itself is excluded from the
 * overlap check, otherwise it would clash with itself and could not even be
 * renamed.
 */
export async function updateBooking(
  id: string,
  input: BookingWrite,
): Promise<UpdateResult> {
  return prisma.$transaction(async (tx) => {
    await lockRoom(tx, input.roomId);

    if (await findClash(tx, { ...input, excludeId: id })) {
      return { refused: "clash" };
    }

    // canceledAt belongs in the filter, not only in the check the route made
    // earlier: that read happened outside this transaction, so the same owner
    // cancelling in another tab in between would otherwise have the edit bring
    // the booking back from the dead. updateMany, because a filter matching
    // nothing has to mean "no" rather than throw.
    const { count } = await tx.booking.updateMany({
      where: { id, canceledAt: null },
      data: {
        roomId: input.roomId,
        title: input.title,
        startsAt: input.startsAt,
        endsAt: input.endsAt,
      },
    });

    if (count === 0) {
      return { refused: "canceled" };
    }

    return {
      booking: await tx.booking.findUniqueOrThrow({
        where: { id },
        select: BOOKING_FIELDS,
      }),
    };
  });
}
