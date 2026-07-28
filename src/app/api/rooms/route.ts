import { NextResponse } from "next/server";

import { unauthorizedError } from "@/lib/server/apiError";
import { prisma } from "@/lib/server/db";
import { getCurrentUser } from "@/lib/server/session";

// The schedule is visible to signed-in users only, so even the room list is
// closed to guests.
export async function GET() {
  const user = await getCurrentUser();
  if (!user) {
    return unauthorizedError();
  }

  const rooms = await prisma.room.findMany({
    select: { id: true, name: true, floor: true, capacity: true },
    orderBy: [{ floor: "asc" }, { name: "asc" }],
  });

  return NextResponse.json(rooms);
}
