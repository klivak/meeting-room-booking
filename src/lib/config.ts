import { z } from "zod";

// Server-side configuration. Reading env through a schema means a missing or
// malformed variable fails loudly at startup instead of surfacing as a weird
// runtime error later.

const serverEnvSchema = z.object({
  DATABASE_URL: z.string().min(1, "DATABASE_URL is required"),
  SESSION_SECRET: z
    .string()
    .min(16, "SESSION_SECRET must be at least 16 characters long"),
  NOTIFY_BEFORE_MINUTES: z.coerce.number().int().positive().default(10),
});

function loadServerEnv() {
  const parsed = serverEnvSchema.safeParse(process.env);

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

export const serverConfig = loadServerEnv();

// NEXT_PUBLIC_* variables are inlined by Next at build time, so this one must be
// referenced literally and can be read on the client as well.
const weekStartDay = Number(process.env.NEXT_PUBLIC_WEEK_START_DAY ?? 1);

/** First day of the week in the schedule grid: 1 = Monday ... 7 = Sunday. */
export const WEEK_START_DAY =
  Number.isInteger(weekStartDay) && weekStartDay >= 1 && weekStartDay <= 7
    ? weekStartDay
    : 1;
