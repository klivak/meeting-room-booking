import { z } from "zod";

// Server-only configuration. Reading env through a schema means a missing or
// malformed variable fails loudly at startup instead of surfacing as a weird
// runtime error later.
// Must never be imported from a client component: on the client these variables
// simply do not exist and the app would crash on load.

const envSchema = z.object({
  DATABASE_URL: z.string().min(1, "DATABASE_URL is required"),
  SESSION_SECRET: z
    .string()
    .min(16, "SESSION_SECRET must be at least 16 characters long"),
  NOTIFY_BEFORE_MINUTES: z.coerce.number().int().positive().default(10),
  // Public origin of the deployment. Only the social preview needs it: og:image
  // has to be an absolute URL, and a relative one shows no card at all.
  SITE_URL: z.url().default("http://localhost:3000"),
  // Whether a reverse proxy in front of the app rewrites X-Forwarded-For. With
  // nothing in front, that header is written by whoever is sending the request,
  // so believing it would let one caller look like a thousand.
  TRUST_PROXY: z
    .enum(["true", "false"])
    .default("false")
    .transform((value) => value === "true"),
});

function loadEnv() {
  const parsed = envSchema.safeParse(process.env);

  if (!parsed.success) {
    const details = parsed.error.issues
      .map((issue) => `  - ${issue.path.join(".")}: ${issue.message}`)
      .join("\n");

    throw new Error(
      `Invalid environment configuration:\n${details}\n\nCopy .env.example to .env and fill in the values.`,
    );
  }

  return parsed.data;
}

// The value shipped in .env.example and used as the compose fallback. Anyone can
// read it, so signing session cookies with it in production means anyone can
// forge a session.
const PLACEHOLDER_SESSION_SECRET = "dev-secret-change-me-in-production";

function warnAboutPlaceholderSecret(secret: string) {
  if (secret !== PLACEHOLDER_SESSION_SECRET || process.env.NODE_ENV !== "production") {
    return;
  }

  // A warning rather than a refusal: the demo has to start from one command,
  // and refusing here would break `docker compose up` for a reviewer who never
  // intended to deploy anything.
  console.warn(
    [
      "",
      "!".repeat(72),
      "  SESSION_SECRET має значення з .env.example.",
      "  Для реального розгортання задайте власний секрет, інакше сесію",
      "  зможе підробити будь-хто: openssl rand -base64 32",
      "!".repeat(72),
      "",
    ].join("\n"),
  );
}

export const env = loadEnv();

warnAboutPlaceholderSecret(env.SESSION_SECRET);
