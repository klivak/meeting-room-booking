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
  .min(1, "Вкажіть ім'я")
  .max(MAX_NAME_LENGTH, `Ім'я не може бути довшим за ${MAX_NAME_LENGTH} символів`);

const emailSchema = z
  .string()
  .transform(normalizeEmail)
  .pipe(z.email("Введіть коректну електронну пошту"));

const passwordSchema = z
  .string()
  .min(MIN_PASSWORD_LENGTH, `Пароль має містити щонайменше ${MIN_PASSWORD_LENGTH} символів`)
  .max(MAX_PASSWORD_LENGTH, `Пароль не може бути довшим за ${MAX_PASSWORD_LENGTH} символів`);

export const registerSchema = z.object({
  name: nameSchema,
  email: emailSchema,
  password: passwordSchema,
});

// Login intentionally does not reuse passwordSchema: an old account must stay
// usable even if the length rules change later.
export const loginSchema = z.object({
  email: emailSchema,
  password: z.string().min(1, "Введіть пароль"),
});
