import { NextResponse } from "next/server";

import { loginSchema } from "@/lib/domain/auth";
import { apiError, validationError } from "@/lib/server/apiError";
import { prisma } from "@/lib/server/db";
import { verifyPassword } from "@/lib/server/password";
import { createSession } from "@/lib/server/session";

// Same answer for an unknown email and a wrong password: telling them apart
// would reveal which addresses are registered.
const INVALID_CREDENTIALS_MESSAGE = "Невірна пошта або пароль";

export async function POST(request: Request) {
  const body = await request.json().catch(() => null);

  const parsed = loginSchema.safeParse(body);
  if (!parsed.success) {
    return validationError(parsed.error);
  }

  const { email, password } = parsed.data;

  const user = await prisma.user.findUnique({ where: { email } });
  if (!user) {
    return apiError(401, "INVALID_CREDENTIALS", INVALID_CREDENTIALS_MESSAGE);
  }

  const passwordMatches = await verifyPassword(password, user.passwordHash);
  if (!passwordMatches) {
    return apiError(401, "INVALID_CREDENTIALS", INVALID_CREDENTIALS_MESSAGE);
  }

  await createSession(user.id);

  return NextResponse.json({ id: user.id, name: user.name, email: user.email });
}
