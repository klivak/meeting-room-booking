import { NextResponse } from "next/server";
import { z } from "zod";

import { apiError, unauthorizedError, validationError } from "@/lib/server/apiError";
import { prisma } from "@/lib/server/db";
import { getCurrentUser } from "@/lib/server/session";

const querySchema = z.object({
  weekStart: z.iso.datetime({ offset: true }),
});

const WEEK_MS = 7 * 24 * 60 * 60 * 1000;

// Bookings of one room for the week starting at weekStart. Other people's
// bookings are visible with their author's name; only isMine decides who may
// act on them.
export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const user = await getCurrentUser();
  if (!user) {
    return await unauthorizedError();
  }

  const { id } = await params;
  const url = new URL(request.url);
  const parsed = querySchema.safeParse({ weekStart: url.searchParams.get("weekStart") });
  if (!parsed.success) {
    return await validationError(parsed.error);
  }

  const room = await prisma.room.findUnique({ where: { id } });
  if (!room) {
    return await apiError(404, "NOT_FOUND", "ROOM_NOT_FOUND");
  }

  const weekStart = new Date(parsed.data.weekStart);
  const weekEnd = new Date(weekStart.getTime() + WEEK_MS);

  // Half-open window [weekStart, weekEnd), same comparison as the overlap rule.
  const bookings = await prisma.booking.findMany({
    where: {
      roomId: id,
      canceledAt: null,
      startsAt: { lt: weekEnd },
      endsAt: { gt: weekStart },
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

  return NextResponse.json(
    bookings.map((booking) => ({
      ...booking,
      isMine: booking.user.id === user.id,
    })),
  );
}
