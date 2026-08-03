import { NextResponse } from "next/server";
import { z } from "zod";

import { apiError, unauthorizedError, validationError } from "@/lib/server/apiError";
import { getMyBookingsPage, ownsBooking } from "@/lib/server/myBookings";
import { getCurrentUser } from "@/lib/server/session";

const querySchema = z.object({
  scope: z
    .enum(["upcoming", "past"], { message: "SCOPE_INVALID" })
    .default("upcoming"),
  cursor: z.string().optional(),
});

// The current user's own bookings, split into the two tabs of /my-bookings.
// The query itself lives in lib/server/myBookings, shared with the page that
// renders the first page on the server.
export async function GET(request: Request) {
  const user = await getCurrentUser();
  if (!user) {
    return await unauthorizedError();
  }

  const url = new URL(request.url);
  const parsed = querySchema.safeParse({
    scope: url.searchParams.get("scope") ?? undefined,
    cursor: url.searchParams.get("cursor") ?? undefined,
  });
  if (!parsed.success) {
    return await validationError(parsed.error);
  }

  const { scope, cursor } = parsed.data;
  const now = new Date();

  if (cursor && !(await ownsBooking(user.id, cursor))) {
    return await apiError(400, "VALIDATION_ERROR", "INVALID_CURSOR", {
      field: "cursor",
    });
  }

  const { items, nextCursor } = await getMyBookingsPage(user.id, scope, now, cursor);

  return NextResponse.json({
    items: items.map((booking) => ({
      ...booking,
      startsAt: booking.startsAt.toISOString(),
      endsAt: booking.endsAt.toISOString(),
    })),
    nextCursor,
  });
}
