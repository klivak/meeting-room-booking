import { createHmac, timingSafeEqual } from "node:crypto";

import { cache } from "react";

import { cookies } from "next/headers";

import { prisma } from "@/lib/server/db";
import { env } from "@/lib/server/env";

// Sessions live in the database, the cookie only carries the row id. That makes
// logout a row delete and lets a session survive a page reload.

const COOKIE_NAME = "session";
const SESSION_TTL_DAYS = 30;

export type CurrentUser = {
  id: string;
  name: string;
  email: string;
  /** Booking is closed until the address is confirmed. */
  emailVerified: boolean;
};

// The id is signed so a forged or tampered cookie is rejected before it ever
// reaches the database.
function sign(sessionId: string): string {
  return createHmac("sha256", env.SESSION_SECRET)
    .update(sessionId)
    .digest("base64url");
}

/** Returns the session id from a cookie value, or null if the signature does not match. */
function readSignedSessionId(cookieValue: string): string | null {
  const separator = cookieValue.lastIndexOf(".");
  if (separator <= 0) {
    return null;
  }

  const sessionId = cookieValue.slice(0, separator);
  const signature = Buffer.from(cookieValue.slice(separator + 1));
  const expected = Buffer.from(sign(sessionId));

  // timingSafeEqual throws on length mismatch, hence the explicit check.
  if (
    signature.length !== expected.length ||
    !timingSafeEqual(signature, expected)
  ) {
    return null;
  }

  return sessionId;
}

export async function createSession(userId: string): Promise<void> {
  const expiresAt = new Date(
    Date.now() + SESSION_TTL_DAYS * 24 * 60 * 60 * 1000,
  );
  const session = await prisma.session.create({ data: { userId, expiresAt } });

  const cookieStore = await cookies();
  cookieStore.set(COOKIE_NAME, `${session.id}.${sign(session.id)}`, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    expires: expiresAt,
  });
}

/**
 * Current user for the incoming request, or null for a guest.
 *
 * Memoised for the length of one request: the layout guard asks, and then the
 * page asks again, and on /my-bookings a third time. They are the same question
 * and used to be three round trips to the database before anything rendered.
 */
export const getCurrentUser = cache(
  async function getCurrentUser(): Promise<CurrentUser | null> {
    const cookieStore = await cookies();
    const cookieValue = cookieStore.get(COOKIE_NAME)?.value;
    if (!cookieValue) {
      return null;
    }

    const sessionId = readSignedSessionId(cookieValue);
    if (!sessionId) {
      return null;
    }

    const session = await prisma.session.findUnique({
      where: { id: sessionId },
      include: { user: true },
    });

    // An expired row is treated exactly like a missing one.
    if (!session || session.expiresAt <= new Date()) {
      return null;
    }

    return {
      id: session.user.id,
      name: session.user.name,
      email: session.user.email,
      emailVerified: session.user.emailVerifiedAt !== null,
    };
  },
);

/** Logout: drops the row so the cookie cannot be replayed, then clears the cookie. */
export async function destroySession(): Promise<void> {
  const cookieStore = await cookies();
  const cookieValue = cookieStore.get(COOKIE_NAME)?.value;

  if (cookieValue) {
    const sessionId = readSignedSessionId(cookieValue);
    if (sessionId) {
      await prisma.session.deleteMany({ where: { id: sessionId } });
    }
  }

  cookieStore.delete(COOKIE_NAME);
}
