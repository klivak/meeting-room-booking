import bcrypt from "bcrypt";

// Cost 12 keeps a single hash around a few hundred milliseconds on a laptop:
// slow enough to make offline brute force expensive, fast enough for a login form.
const BCRYPT_COST = 12;

export function hashPassword(password: string): Promise<string> {
  return bcrypt.hash(password, BCRYPT_COST);
}

export function verifyPassword(password: string, hash: string): Promise<boolean> {
  return bcrypt.compare(password, hash);
}
