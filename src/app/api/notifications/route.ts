import { NextResponse } from "next/server";

import { unauthorizedError } from "@/lib/server/apiError";
import {
  getDueNotifications,
  markNotificationsRead,
} from "@/lib/server/notifications";
import { getCurrentUser } from "@/lib/server/session";

/** Unread warnings for the current user; polled by the bell in the header. */
export async function GET() {
  const user = await getCurrentUser();
  if (!user) {
    return await unauthorizedError();
  }

  return NextResponse.json({ items: await getDueNotifications(user.id) });
}

/** Marks everything as read, which is what opening the bell means. */
export async function POST() {
  const user = await getCurrentUser();
  if (!user) {
    return await unauthorizedError();
  }

  await markNotificationsRead(user.id);

  return new NextResponse(null, { status: 204 });
}
