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

// Same answer for an unknown email and a wrong password: telling them apart
// would reveal which addresses are registered.
const INVALID_CREDENTIALS_MESSAGE = "Невірна пошта або пароль";

const MAX_FAILED_LOGINS = 10;
const LOGIN_WINDOW_MS = 5 * 60 * 1000;

export async function POST(request: Request) {
  const body = await request.json().catch(() => null);

  const parsed = loginSchema.safeParse(body);
  if (!parsed.success) {
    return validationError(parsed.error);
  }

  const { email, password } = parsed.data;

  // Keyed by address and caller: guessing one account from many machines and
  // many accounts from one machine both run into it. bcrypt already makes each
  // attempt slow; this puts a ceiling on how many can be tried.
  const key = `login:${email}:${clientAddress(request)}`;
  if (isRateLimited(key, MAX_FAILED_LOGINS, LOGIN_WINDOW_MS)) {
    return tooManyAttemptsError();
  }

  const user = await prisma.user.findUnique({ where: { email } });
  const passwordMatches =
    user !== null && (await verifyPassword(password, user.passwordHash));

  if (!user || !passwordMatches) {
    // Only failures count, so ordinary use never meets the limit.
    if (registerFailedAttempt(key, MAX_FAILED_LOGINS, LOGIN_WINDOW_MS)) {
      return tooManyAttemptsError();
    }

    return apiError(401, "INVALID_CREDENTIALS", INVALID_CREDENTIALS_MESSAGE);
  }

  await createSession(user.id);

  return NextResponse.json({ id: user.id, name: user.name, email: user.email });
}
