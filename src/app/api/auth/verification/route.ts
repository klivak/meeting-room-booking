import { NextResponse } from "next/server";

import { unauthorizedError } from "@/lib/server/apiError";
import { getCurrentUser } from "@/lib/server/session";
import { sendVerificationLink } from "@/lib/server/verification";

/** Issues a fresh confirmation link, which in development means printing it. */
export async function POST(request: Request) {
  const user = await getCurrentUser();
  if (!user) {
    return unauthorizedError();
  }

  // Nothing to do for a confirmed address, and saying so is not worth an error.
  if (!user.emailVerified) {
    await sendVerificationLink(user.id, new URL(request.url).origin);
  }

  return new NextResponse(null, { status: 204 });
}
