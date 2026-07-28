import { NextResponse } from "next/server";

import { registerSchema } from "@/lib/domain/auth";
import { apiError, validationError } from "@/lib/server/apiError";
import { prisma } from "@/lib/server/db";
import { hashPassword } from "@/lib/server/password";
import { createSession } from "@/lib/server/session";
import { sendVerificationLink } from "@/lib/server/verification";

const EMAIL_TAKEN_MESSAGE = "Ця електронна пошта вже зареєстрована";

export async function POST(request: Request) {
  const body = await request.json().catch(() => null);

  // The schema normalizes the email, so everything below works with the stored form.
  const parsed = registerSchema.safeParse(body);
  if (!parsed.success) {
    return validationError(parsed.error);
  }

  const { name, email, password } = parsed.data;

  const existing = await prisma.user.findUnique({ where: { email } });
  if (existing) {
    return apiError(400, "EMAIL_TAKEN", EMAIL_TAKEN_MESSAGE, "email");
  }

  const passwordHash = await hashPassword(password);

  let user;
  try {
    user = await prisma.user.create({ data: { name, email, passwordHash } });
  } catch (error) {
    // Two simultaneous registrations pass the check above; the unique index is
    // what actually decides, and P2002 means this request lost the race.
    if (isUniqueConstraintError(error)) {
      return apiError(400, "EMAIL_TAKEN", EMAIL_TAKEN_MESSAGE, "email");
    }
    throw error;
  }

  // Registration signs the user in right away, but booking stays closed until
  // the address is confirmed through the link printed to the server log.
  await sendVerificationLink(user.id, new URL(request.url).origin);
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
