import { randomBytes } from "node:crypto";

import { prisma } from "@/lib/server/db";

// Email confirmation without an SMTP server: the link is printed to the server
// log, which is what the task asks for in development. Swapping the log for a
// real mailer later touches only this file.

const TOKEN_TTL_HOURS = 24;

/**
 * Issues a fresh confirmation link and prints it. Any previous token for the
 * user is dropped, so only the newest link works — a resent link must make the
 * older one useless.
 */
export async function sendVerificationLink(userId: string, origin: string) {
  await prisma.verificationToken.deleteMany({ where: { userId } });

  const token = randomBytes(32).toString("base64url");
  await prisma.verificationToken.create({
    data: {
      token,
      userId,
      expiresAt: new Date(Date.now() + TOKEN_TTL_HOURS * 60 * 60 * 1000),
    },
  });

  const link = `${origin}/api/auth/verify?token=${token}`;

  // Framed so it is impossible to miss among the request logs.
  console.info(
    [
      "",
      "=".repeat(72),
      "  Підтвердження email. Відкрийте посилання:",
      `  ${link}`,
      "=".repeat(72),
      "",
    ].join("\n"),
  );

  return link;
}

/**
 * Marks the address confirmed if the token is valid, and reports whether it
 * was. The token is single use: it is deleted either way, so a leaked link
 * cannot be replayed.
 */
export async function confirmVerificationToken(token: string): Promise<boolean> {
  const stored = await prisma.verificationToken.findUnique({ where: { token } });
  if (!stored) {
    return false;
  }

  await prisma.verificationToken.delete({ where: { token: stored.token } });

  if (stored.expiresAt <= new Date()) {
    return false;
  }

  await prisma.user.update({
    where: { id: stored.userId },
    data: { emailVerifiedAt: new Date() },
  });

  return true;
}
