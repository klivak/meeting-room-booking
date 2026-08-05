import bcrypt from "bcrypt";

// Cost 12 keeps a single hash around a few hundred milliseconds on a laptop:
// slow enough to make offline brute force expensive, fast enough for a login form.
const BCRYPT_COST = 12;

// Known limit: bcrypt reads the first 72 BYTES, while the rule in the spec caps
// the password at 72 CHARACTERS. They coincide for ASCII, but a Cyrillic
// password takes two bytes per character, so anything past byte 72 is ignored
// and two passwords sharing that prefix verify against the same hash. Capping
// by bytes instead would reject passwords the spec allows, so the rule stays as
// written; switching to argon2, or pre-hashing with SHA-256, would remove the
// limit altogether.

export function hashPassword(password: string): Promise<string> {
  return bcrypt.hash(password, BCRYPT_COST);
}

export function verifyPassword(
  password: string,
  hash: string,
): Promise<boolean> {
  return bcrypt.compare(password, hash);
}

// A bcrypt hash at the same cost as every stored one, of 32 random bytes that
// were never written down. Baked in as a constant rather than computed at
// import: hashing it would block startup for the same few hundred milliseconds
// it exists to spend, and nothing about it needs to be secret — no password can
// match it either way.
const DECOY_HASH =
  "$2b$12$D8Aex0yXoLxicji9XRcgnu4HXlH4gSMrPYdQmwBMcL/0QDn7lKNJu";

/**
 * Spends the same time a real check would, and always says no.
 *
 * Without this an unknown address answers in a millisecond while a registered
 * one answers in three hundred, so the response time tells anyone who measures
 * it which addresses have accounts — exactly what the identical error message
 * is there to hide.
 */
export function verifyPasswordAgainstNobody(
  password: string,
): Promise<boolean> {
  return bcrypt.compare(password, DECOY_HASH);
}
