import { z } from "zod";

// Public configuration: safe to import from both server and client code.
// Server-only variables live in src/lib/server/env.ts.

const publicEnvSchema = z.object({
  // 1 = Monday ... 7 = Sunday, matching Luxon's weekday numbering.
  NEXT_PUBLIC_WEEK_START_DAY: z.coerce.number().int().min(1).max(7).default(1),
});

// NEXT_PUBLIC_* variables are inlined by Next at build time, so they must be
// referenced literally rather than read from process.env as a whole object.
const parsed = publicEnvSchema.safeParse({
  NEXT_PUBLIC_WEEK_START_DAY: process.env.NEXT_PUBLIC_WEEK_START_DAY,
});

if (!parsed.success) {
  const details = parsed.error.issues
    .map((issue) => `  - ${issue.path.join(".")}: ${issue.message}`)
    .join("\n");

  throw new Error(
    `Invalid public environment configuration:\n${details}\n\nSee .env.example for the expected values.`,
  );
}

/** First day of the week in the schedule grid. */
export const WEEK_START_DAY = parsed.data.NEXT_PUBLIC_WEEK_START_DAY;
