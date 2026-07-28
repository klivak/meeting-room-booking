import { z } from "zod";

// Pure validation rules for registration and login. Shared by the API routes
// and the forms, so the client shows the same messages the server enforces.

/**
 * Emails are compared and stored in this normalized form, so "  Ivan@X.com  "
 * and "ivan@x.com" are the same account and the unique index actually holds.
 */
export function normalizeEmail(email: string): string {
  return email.trim().toLowerCase();
}

// bcrypt only reads the first 72 bytes of a password, so anything longer would
// silently compare equal. The limit is enforced instead of truncated.
export const MIN_PASSWORD_LENGTH = 8;
export const MAX_PASSWORD_LENGTH = 72;
export const MAX_NAME_LENGTH = 100;

const nameSchema = z
  .string()
  .trim()
  .min(1, "NAME_REQUIRED")
  .max(MAX_NAME_LENGTH, "NAME_TOO_LONG");

const emailSchema = z
  .string()
  .transform(normalizeEmail)
  .pipe(z.email("EMAIL_INVALID"));

const passwordSchema = z
  .string()
  .min(MIN_PASSWORD_LENGTH, "PASSWORD_TOO_SHORT")
  .max(MAX_PASSWORD_LENGTH, "PASSWORD_TOO_LONG");

export const registerSchema = z.object({
  name: nameSchema,
  email: emailSchema,
  password: passwordSchema,
});

// Login intentionally does not reuse passwordSchema: an old account must stay
// usable even if the length rules change later.
export const loginSchema = z.object({
  email: emailSchema,
  password: z.string().min(1, "PASSWORD_REQUIRED"),
});
