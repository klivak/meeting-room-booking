import { testPrisma } from "./db";

export const BASE_URL = process.env.TEST_BASE_URL ?? "http://localhost:3100";

type Options = {
  method?: string;
  body?: unknown;
  /** Cookie header of the signed-in user; omitted means a guest. */
  cookie?: string;
};

export type ApiResponse<T = unknown> = {
  status: number;
  body: T;
  /** Set-Cookie of the response, ready to be sent back on the next call. */
  cookie?: string;
};

/** Single entry point for the tests, so every call is shaped the same way. */
export async function api<T = Record<string, never>>(
  path: string,
  options: Options = {},
): Promise<ApiResponse<T>> {
  const response = await fetch(`${BASE_URL}${path}`, {
    method: options.method ?? "GET",
    headers: {
      "Content-Type": "application/json",
      ...(options.cookie ? { cookie: options.cookie } : {}),
    },
    body: options.body === undefined ? undefined : JSON.stringify(options.body),
  });

  const raw = await response.text();
  const setCookie = response.headers.get("set-cookie");

  return {
    status: response.status,
    body: raw ? (JSON.parse(raw) as T) : ({} as T),
    // Only the name=value part matters for sending it back.
    cookie: setCookie ? setCookie.split(";")[0] : undefined,
  };
}

/**
 * Registers a user, confirms the address and returns the session cookie.
 *
 * Confirmation is done directly in the database on purpose: every other test
 * is about bookings, and making each one walk the verification link would test
 * the same thing over and over. The flow itself has its own file.
 */
export async function registerUser(email: string, name = "Тест Тестовий") {
  const { id, cookie } = await registerUnverifiedUser(email, name);

  await testPrisma.user.update({
    where: { id },
    data: { emailVerifiedAt: new Date() },
  });

  return { id, cookie };
}

/** Registers a user and leaves the address unconfirmed. */
export async function registerUnverifiedUser(
  email: string,
  name = "Тест Тестовий",
) {
  const response = await api<{ id: string }>("/api/auth/register", {
    method: "POST",
    body: { name, email, password: "password123" },
  });

  if (response.status !== 201 || !response.cookie) {
    throw new Error(`Could not register ${email}: ${response.status}`);
  }

  return { id: response.body.id, cookie: response.cookie };
}
