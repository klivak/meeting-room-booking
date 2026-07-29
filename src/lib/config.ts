import { z } from "zod";

// Public configuration: safe to import from both server and client code.
// Server-only variables live in src/lib/server/env.ts.

const publicEnvSchema = z.object({
  // 1 = Monday ... 7 = Sunday, matching Luxon's weekday numbering.
  NEXT_PUBLIC_WEEK_START_DAY: z.coerce.number().int().min(1).max(7).default(1),
  // Whether the sign-in screen offers to fill in the seeded demo account. Off
  // unless asked for: a button that types a known password into the form is a
  // convenience for whoever is reviewing the project, not a feature of it.
  NEXT_PUBLIC_DEMO_LOGIN: z
    .enum(["true", "false"])
    .default("false")
    .transform((value) => value === "true"),
});

// NEXT_PUBLIC_* variables are inlined by Next at build time, so they must be
// referenced literally rather than read from process.env as a whole object.
const parsed = publicEnvSchema.safeParse({
  NEXT_PUBLIC_WEEK_START_DAY: process.env.NEXT_PUBLIC_WEEK_START_DAY,
  NEXT_PUBLIC_DEMO_LOGIN: process.env.NEXT_PUBLIC_DEMO_LOGIN,
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

/** Whether the sign-in screen offers the seeded demo account in one click. */
export const DEMO_LOGIN = parsed.data.NEXT_PUBLIC_DEMO_LOGIN;
