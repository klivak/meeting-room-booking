import { isEndingNotificationDue } from "@/lib/domain/notifications";
import { prisma } from "@/lib/server/db";
import { env } from "@/lib/server/env";

// Notifications are computed when the client asks for them rather than by a
// background timer. An in-app warning is only useful to someone who has the app
// open, and that someone is polling anyway; a timer would additionally have to
// survive restarts and be prevented from running twice per deployment.

export const BOOKING_ENDING = "BOOKING_ENDING";

export type NotificationView = {
  id: string;
  bookingId: string;
  title: string;
  roomName: string;
  endsAt: string;
};

/**
 * Creates the warnings that became due and returns the unread ones among them.
 *
 * The set is recomputed on every call rather than trusted from the table, so a
 * booking cancelled after the row was created — either the user's own or the
 * one that needed the room next — stops being announced immediately.
 */
export async function getDueNotifications(
  userId: string,
): Promise<NotificationView[]> {
  const now = new Date();
  const horizon = new Date(
    now.getTime() + env.NOTIFY_BEFORE_MINUTES * 60 * 1000,
  );

  // Only the user's own bookings that are about to end can produce a warning.
  const ending = await prisma.booking.findMany({
    where: {
      userId,
      canceledAt: null,
      endsAt: { gt: now, lte: horizon },
    },
    select: {
      id: true,
      roomId: true,
      title: true,
      endsAt: true,
      canceledAt: true,
      room: { select: { name: true } },
    },
  });

  // The bookings that take the room next are fetched in one query rather than
  // one per candidate: the polling runs every 30 seconds for every open tab.
  const followUps = await prisma.booking.findMany({
    where: {
      canceledAt: null,
      roomId: { in: ending.map((booking) => booking.roomId) },
      startsAt: { in: ending.map((booking) => booking.endsAt) },
    },
    select: { roomId: true, startsAt: true, canceledAt: true },
  });

  const followUpKey = (roomId: string, startsAt: Date) =>
    `${roomId}@${startsAt.getTime()}`;
  const followUpByKey = new Map(
    followUps.map((booking) => [
      followUpKey(booking.roomId, booking.startsAt),
      booking,
    ]),
  );

  const dueBookingIds: string[] = [];

  for (const booking of ending) {
    const due = isEndingNotificationDue({
      booking,
      nextBooking:
        followUpByKey.get(followUpKey(booking.roomId, booking.endsAt)) ?? null,
      now,
      minutesBefore: env.NOTIFY_BEFORE_MINUTES,
    });

    if (!due) {
      continue;
    }

    dueBookingIds.push(booking.id);

    // The unique index on (bookingId, type) is what makes this exactly once,
    // even if two polls arrive at the same moment.
    await prisma.notification.upsert({
      where: {
        bookingId_type: { bookingId: booking.id, type: BOOKING_ENDING },
      },
      update: {},
      create: { userId, bookingId: booking.id, type: BOOKING_ENDING },
    });
  }

  if (dueBookingIds.length === 0) {
    return [];
  }

  const unread = await prisma.notification.findMany({
    // Only bookings that are due right now: the row surviving in the table is
    // what makes the warning appear once, not what keeps it appearing.
    where: { userId, readAt: null, bookingId: { in: dueBookingIds } },
    orderBy: { createdAt: "desc" },
    select: {
      id: true,
      bookingId: true,
      booking: {
        select: { title: true, endsAt: true, room: { select: { name: true } } },
      },
    },
  });

  return unread.map((notification) => ({
    id: notification.id,
    bookingId: notification.bookingId,
    title: notification.booking.title,
    roomName: notification.booking.room.name,
    endsAt: notification.booking.endsAt.toISOString(),
  }));
}

export async function markNotificationsRead(userId: string) {
  await prisma.notification.updateMany({
    where: { userId, readAt: null },
    data: { readAt: new Date() },
  });
}
