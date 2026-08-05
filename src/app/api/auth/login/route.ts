import { NextResponse } from "next/server";

import { loginSchema } from "@/lib/domain/auth";
import {
  apiError,
  tooManyAttemptsError,
  validationError,
} from "@/lib/server/apiError";
import {
  clientAddress,
  isRateLimited,
  recordAttempt,
} from "@/lib/server/rateLimit";
import { prisma } from "@/lib/server/db";
import {
  verifyPassword,
  verifyPasswordAgainstNobody,
} from "@/lib/server/password";
import { createSession } from "@/lib/server/session";

const MAX_FAILED_LOGINS = 10;
const LOGIN_WINDOW_MS = 5 * 60 * 1000;

// Past this many failures the request is refused before the password is checked
// at all.
//
// It exists because of the rule below: to be sure a throttled owner can still
// sign in, a throttled request has to be verified, and verifying costs a bcrypt
// either way. Without a second ceiling, someone could hold the process busy by
// failing forever. Ten times the first limit, so nobody typing their own
// password badly will ever reach it.
const REFUSE_WITHOUT_CHECKING = MAX_FAILED_LOGINS * 10;

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

  if (isRateLimited(key, REFUSE_WITHOUT_CHECKING, LOGIN_WINDOW_MS)) {
    // Recorded so that hammering keeps the ceiling in place rather than letting
    // it lapse while the hammering continues.
    recordAttempt(key, REFUSE_WITHOUT_CHECKING, LOGIN_WINDOW_MS);

    return await tooManyAttemptsError();
  }

  const throttled = isRateLimited(key, MAX_FAILED_LOGINS, LOGIN_WINDOW_MS);

  const user = await prisma.user.findUnique({ where: { email } });
  // An address with no account is checked against a decoy hash, so the answer
  // takes the same time either way and the clock stops naming who is registered.
  const passwordMatches = user
    ? await verifyPassword(password, user.passwordHash)
    : await verifyPasswordAgainstNobody(password);

  // The throttle is applied only to a request that got the password wrong.
  // Refusing the right one too would hand anybody a way to lock any account out
  // of its own login by failing ten times on its address: the key is per
  // account, and without a proxy in front the caller half of it is a constant.
  if (!user || !passwordMatches) {
    if (
      throttled ||
      // Only failures count, so ordinary use never meets the limit.
      recordAttempt(key, MAX_FAILED_LOGINS, LOGIN_WINDOW_MS)
    ) {
      return await tooManyAttemptsError();
    }

    return await apiError(401, "INVALID_CREDENTIALS", "INVALID_CREDENTIALS");
  }

  await createSession(user.id);

  return NextResponse.json({ id: user.id, name: user.name, email: user.email });
}
