import argon2 from "argon2";

/**
 * Argon2id is used over bcrypt where available: it's the PHC-recommended
 * default, has tunable memory cost (better resistance to GPU/ASIC cracking),
 * and the `argon2` package ships a maintained native binding. If the native
 * binding can't build on a given host (e.g. some serverless build images),
 * swap this module for a bcrypt implementation — the exported interface
 * (`hashPassword` / `verifyPassword`) is intentionally storage-agnostic so
 * nothing else in the codebase needs to change.
 */
const ARGON2_OPTIONS: argon2.Options = {
  type: argon2.argon2id,
  memoryCost: 19456, // ~19 MB, OWASP-recommended minimum for argon2id
  timeCost: 2,
  parallelism: 1,
};

export async function hashPassword(plainPassword: string): Promise<string> {
  return argon2.hash(plainPassword, ARGON2_OPTIONS);
}

export async function verifyPassword(hash: string, plainPassword: string): Promise<boolean> {
  try {
    return await argon2.verify(hash, plainPassword);
  } catch {
    // Malformed/foreign hash — never throw into an auth code path.
    return false;
  }
}

/**
 * Minimum password policy, enforced both client-side (Zod schema) and here
 * server-side so the rule can never be bypassed by calling the API directly.
 */
export function isPasswordStrongEnough(password: string): boolean {
  if (password.length < 10) return false;
  const hasLetter = /[a-zA-Z]/.test(password);
  const hasNumberOrSymbol = /[0-9!@#$%^&*()\-_=+[\]{};:'",.<>/?\\|`~]/.test(password);
  return hasLetter && hasNumberOrSymbol;
}
