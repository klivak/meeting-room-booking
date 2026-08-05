import { NextResponse } from "next/server";
import { z } from "zod";

import { unauthorizedError, validationError } from "@/lib/server/apiError";
import { prisma } from "@/lib/server/db";
import { getCurrentUser } from "@/lib/server/session";

const querySchema = z
  .object({
    // Dictionary keys, not sentences: see the note in bookingInput.
    startsAt: z.iso.datetime({ offset: true, message: "TIME_INVALID" }),
    endsAt: z.iso.datetime({ offset: true, message: "TIME_INVALID" }),
    /** The booking being edited, which must not count as occupying its own room. */
    exclude: z.string().optional(),
  })
  // A backwards range overlaps nothing, so without this check every room would
  // come back free — the opposite of the truth, and the one answer this route
  // must never give.
  // Parsed rather than compared as text: the two strings may carry different
  // offsets, and then their alphabetical order is not their order in time.
  .refine((query) => new Date(query.startsAt) < new Date(query.endsAt), {
    message: "END_BEFORE_START",
    path: ["endsAt"],
  });

/**
 * Rooms with nothing booked over [startsAt, endsAt).
 *
 * The form asks this while a range is being picked, so "this time is taken" can
 * be followed by "these rooms are not" instead of leaving the user to try the
 * six rooms one at a time. It answers about availability only — booking still
 * goes through POST /api/bookings and all of its rules.
 */
export async function GET(request: Request) {
  const user = await getCurrentUser();
  if (!user) {
    return await unauthorizedError();
  }

  const url = new URL(request.url);
  const parsed = querySchema.safeParse({
    startsAt: url.searchParams.get("startsAt"),
    endsAt: url.searchParams.get("endsAt"),
    exclude: url.searchParams.get("exclude") ?? undefined,
  });
  if (!parsed.success) {
    return await validationError(parsed.error);
  }

  const startsAt = new Date(parsed.data.startsAt);
  const endsAt = new Date(parsed.data.endsAt);

  // "No active booking overlapping the range", written as the same half-open
  // comparison the overlap rule uses, negated by `none`.
  const rooms = await prisma.room.findMany({
    where: {
      bookings: {
        none: {
          canceledAt: null,
          startsAt: { lt: endsAt },
          endsAt: { gt: startsAt },
          ...(parsed.data.exclude ? { id: { not: parsed.data.exclude } } : {}),
        },
      },
    },
    select: { id: true, name: true, floor: true, capacity: true },
    orderBy: [{ floor: "asc" }, { name: "asc" }],
  });

  return NextResponse.json(rooms);
}
