import { NextResponse } from "next/server";

import { tooManyAttemptsError, unauthorizedError } from "@/lib/server/apiError";
import { recordAttempt } from "@/lib/server/rateLimit";
import { getCurrentUser } from "@/lib/server/session";
import { sendVerificationLink } from "@/lib/server/verification";

const MAX_RESENDS = 5;
const RESEND_WINDOW_MS = 60 * 60 * 1000;

/** Issues a fresh confirmation link, which in development means printing it. */
export async function POST() {
  const user = await getCurrentUser();
  if (!user) {
    return await unauthorizedError();
  }

  // Each request invalidates the previous link, so an unlimited button would be
  // a way to keep anyone from ever confirming.
  const key = `verification:${user.id}`;
  if (recordAttempt(key, MAX_RESENDS, RESEND_WINDOW_MS)) {
    return await tooManyAttemptsError();
  }

  // Nothing to do for a confirmed address, and saying so is not worth an error.
  if (!user.emailVerified) {
    await sendVerificationLink(user.id);
  }

  return new NextResponse(null, { status: 204 });
}
