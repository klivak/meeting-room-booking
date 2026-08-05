import { env } from "@/lib/server/env";

// Counts attempts per key in memory. It exists to make guessing and flooding
// expensive, not to be a complete defence: the counters live in the process, so
// several instances count separately and a restart forgets everything. A shared
// store would be the next step if this ever ran clustered.
//
// What counts as an attempt is the caller's decision: the login route records
// only failures, so ordinary use never meets the limit, while registration
// records every request, because there the cost is paid whether or not it
// succeeds.

const attempts = new Map<string, number[]>();

// Guards against unbounded growth if keys keep changing (many addresses tried).
const MAX_KEYS = 10_000;

/** Records one attempt and reports whether the key is now over the limit. */
export function recordAttempt(
  key: string,
  limit: number,
  windowMs: number,
): boolean {
  const now = Date.now();
  const recent = (attempts.get(key) ?? []).filter(
    (moment) => moment > now - windowMs,
  );

  recent.push(now);
  attempts.set(key, recent);

  if (attempts.size > MAX_KEYS) {
    for (const [storedKey, moments] of attempts) {
      if (moments.every((moment) => moment <= now - windowMs)) {
        attempts.delete(storedKey);
      }
    }
  }

  return recent.length > limit;
}

/** Whether the key is currently blocked, without recording a new attempt. */
export function isRateLimited(
  key: string,
  limit: number,
  windowMs: number,
): boolean {
  const now = Date.now();
  const recent = (attempts.get(key) ?? []).filter(
    (moment) => moment > now - windowMs,
  );

  return recent.length > limit;
}

/**
 * Best effort client address.
 *
 * The header is read only when TRUST_PROXY says something in front of the app
 * rewrites it. Without that proxy the value is chosen by the caller, so a fresh
 * one in every request would mean a fresh counter in every request — and the
 * limit below would stop exactly nobody. Without the proxy every caller shares
 * one constant instead, which leaves the rest of the key doing the work: the
 * login route puts the address there, so the counter stays per account.
 */
export function clientAddress(request: Request): string {
  if (!env.TRUST_PROXY) {
    return "direct";
  }

  const forwarded = request.headers.get("x-forwarded-for");

  return forwarded?.split(",")[0]?.trim() ?? "unknown";
}
