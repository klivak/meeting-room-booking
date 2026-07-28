import { NextResponse } from "next/server";
import { z } from "zod";

import { unauthorizedError, validationError } from "@/lib/server/apiError";
import { prisma } from "@/lib/server/db";
import { getCurrentUser } from "@/lib/server/session";

const querySchema = z.object({
  // "Seats at least N": omitted means no filter at all.
  capacityMin: z.coerce.number().int().positive().optional(),
});

// The schedule is visible to signed-in users only, so even the room list is
// closed to guests.
export async function GET(request: Request) {
  const user = await getCurrentUser();
  if (!user) {
    return unauthorizedError();
  }

  const url = new URL(request.url);
  const parsed = querySchema.safeParse({
    capacityMin: url.searchParams.get("capacityMin") ?? undefined,
  });
  if (!parsed.success) {
    return validationError(parsed.error);
  }

  const { capacityMin } = parsed.data;

  const rooms = await prisma.room.findMany({
    where: capacityMin ? { capacity: { gte: capacityMin } } : {},
    select: { id: true, name: true, floor: true, capacity: true },
    orderBy: [{ floor: "asc" }, { name: "asc" }],
  });

  return NextResponse.json(rooms);
}
