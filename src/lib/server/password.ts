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
