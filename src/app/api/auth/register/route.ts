import { NextResponse } from "next/server";

import { registerSchema } from "@/lib/domain/auth";
import {
  apiError,
  tooManyAttemptsError,
  validationError,
} from "@/lib/server/apiError";
import { prisma } from "@/lib/server/db";
import { env } from "@/lib/server/env";
import { hashPassword } from "@/lib/server/password";
import { clientAddress, recordAttempt } from "@/lib/server/rateLimit";
import { createSession } from "@/lib/server/session";
import { sendVerificationLink } from "@/lib/server/verification";

// Hashing a password costs a few hundred milliseconds of CPU, and registration
// pays that whether the request is genuine or not — so a handful of parallel
// callers can hold the process busy without ever guessing anything. Unlike the
// login limit this one counts every request, successful ones included.
//
// Without a proxy in front clientAddress is a constant, so this becomes one
// counter for everybody. That is why the ceiling is env-configurable rather
// than hardcoded: it has to stay far above what a real office needs, and the
// integration suite creates more accounts in two minutes than an office does
// in a year.
const REGISTER_WINDOW_MS = 10 * 60 * 1000;

export async function POST(request: Request) {
  const key = `register:${clientAddress(request)}`;
  if (recordAttempt(key, env.REGISTER_LIMIT, REGISTER_WINDOW_MS)) {
    return await tooManyAttemptsError();
  }

  const body = await request.json().catch(() => null);

  // The schema normalizes the email, so everything below works with the stored form.
  const parsed = registerSchema.safeParse(body);
  if (!parsed.success) {
    return await validationError(parsed.error);
  }

  const { name, email, password } = parsed.data;

  const existing = await prisma.user.findUnique({ where: { email } });
  if (existing) {
    return await apiError(400, "EMAIL_TAKEN", "EMAIL_TAKEN", {
      field: "email",
    });
  }

  const passwordHash = await hashPassword(password);

  let user;
  try {
    user = await prisma.user.create({ data: { name, email, passwordHash } });
  } catch (error) {
    // Two simultaneous registrations pass the check above; the unique index is
    // what actually decides, and P2002 means this request lost the race.
    if (isUniqueConstraintError(error)) {
      return await apiError(400, "EMAIL_TAKEN", "EMAIL_TAKEN", {
        field: "email",
      });
    }
    throw error;
  }

  // Registration signs the user in right away, but booking stays closed until
  // the address is confirmed through the link printed to the server log.
  await sendVerificationLink(user.id);
  await createSession(user.id);

  return NextResponse.json(
    { id: user.id, name: user.name, email: user.email },
    { status: 201 },
  );
}

function isUniqueConstraintError(error: unknown): boolean {
  return (
    typeof error === "object" &&
    error !== null &&
    "code" in error &&
    error.code === "P2002"
  );
}
