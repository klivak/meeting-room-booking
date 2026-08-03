import { NextResponse } from "next/server";

import { loginSchema } from "@/lib/domain/auth";
import { apiError, tooManyAttemptsError, validationError } from "@/lib/server/apiError";
import {
  clientAddress,
  isRateLimited,
  registerFailedAttempt,
} from "@/lib/server/rateLimit";
import { prisma } from "@/lib/server/db";
import { verifyPassword } from "@/lib/server/password";
import { createSession } from "@/lib/server/session";

const MAX_FAILED_LOGINS = 10;
const LOGIN_WINDOW_MS = 5 * 60 * 1000;

export async function POST(request: Request) {
  const body = await request.json().catch(() => null);

  const parsed = loginSchema.safeParse(body);
  if (!parsed.success) {
    return await validationError(parsed.error);
  }

  const { email, password } = parsed.data;

  // Keyed by address and caller: guessing one account from many machines and
  // many accounts from one machine both run into it. bcrypt already makes each
  // attempt slow; this puts a ceiling on how many can be tried.
  // The address half collapses to a constant unless TRUST_PROXY is set, so
  // without a proxy in front the ceiling is per account — see clientAddress.
  const key = `login:${email}:${clientAddress(request)}`;
  if (isRateLimited(key, MAX_FAILED_LOGINS, LOGIN_WINDOW_MS)) {
    return await tooManyAttemptsError();
  }

  const user = await prisma.user.findUnique({ where: { email } });
  const passwordMatches =
    user !== null && (await verifyPassword(password, user.passwordHash));

  if (!user || !passwordMatches) {
    // Only failures count, so ordinary use never meets the limit.
    if (registerFailedAttempt(key, MAX_FAILED_LOGINS, LOGIN_WINDOW_MS)) {
      return await tooManyAttemptsError();
    }

    return await apiError(401, "INVALID_CREDENTIALS", "INVALID_CREDENTIALS");
  }

  await createSession(user.id);

  return NextResponse.json({ id: user.id, name: user.name, email: user.email });
}
