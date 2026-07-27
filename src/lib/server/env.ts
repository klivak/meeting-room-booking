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

export const env = loadEnv();
