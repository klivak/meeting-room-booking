import { createHash, randomBytes } from "node:crypto";

import { prisma } from "@/lib/server/db";
import { env } from "@/lib/server/env";

// Email confirmation without an SMTP server: the link is printed to the server
// log, which is what the task asks for in development. Swapping the log for a
// real mailer later touches only this file.

const TOKEN_TTL_HOURS = 24;

/**
 * What the table stores in place of the token.
 *
 * The token itself never reaches the database: it is the whole credential, so
 * anyone reading a dump could otherwise confirm somebody else's address and
 * book as them. SHA-256 with no salt is deliberate — these are 32 random bytes
 * rather than passwords, so there is nothing to guess and nothing a precomputed
 * table could hold.
 */
function fingerprint(token: string): string {
  return createHash("sha256").update(token).digest("hex");
}

/**
 * Issues a fresh confirmation link and prints it. Any previous token for the
 * user is dropped, so only the newest link works — a resent link must make the
 * older one useless.
 */
export async function sendVerificationLink(userId: string) {
  // This user's previous token goes, and so does everybody's expired one: an
  // expired token is already refused, but nothing was deleting it, so every
  // abandoned registration left a row behind for good.
  await prisma.verificationToken.deleteMany({
    where: { OR: [{ userId }, { expiresAt: { lte: new Date() } }] },
  });

  const token = randomBytes(32).toString("base64url");
  await prisma.verificationToken.create({
    data: {
      token: fingerprint(token),
      userId,
      expiresAt: new Date(Date.now() + TOKEN_TTL_HOURS * 60 * 60 * 1000),
    },
  });

  // The origin comes from configuration, never from the request. A Host header
  // is written by whoever is calling, so a link built from it points wherever
  // that caller likes: harmless while this only reaches a log, and a handed-over
  // account the day it reaches an inbox.
  const origin = env.SITE_URL.replace(/\/$/, "");
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
export async function confirmVerificationToken(
  token: string,
): Promise<boolean> {
  const stored = await prisma.verificationToken.findUnique({
    where: { token: fingerprint(token) },
  });
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
