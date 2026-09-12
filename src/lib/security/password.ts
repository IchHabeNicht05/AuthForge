import { hash, verify, Algorithm } from "@node-rs/argon2";

/**
 * @node-rs/argon2 místo balíčku `argon2`: oba implementují Argon2id, ale
 * `argon2` (node-gyp-build) je klasický nativní addon vázaný na konkrétní
 * Node.js ABI verzi — na Vercelu to spolehlivě padá s
 * "No native build was found for ... abi=...", protože build a runtime
 * prostředí se mohou lišit verzí Node. @node-rs/argon2 je postavený na
 * N-API, které je stabilní napříč verzemi Node, takže tenhle problém
 * nenastává.
 */
const ARGON2_OPTIONS = {
  algorithm: Algorithm.Argon2id,
  memoryCost: 19456, // ~19 MB, OWASP-doporučené minimum pro argon2id
  timeCost: 2,
  parallelism: 1,
};

export async function hashPassword(plainPassword: string): Promise<string> {
  return hash(plainPassword, ARGON2_OPTIONS);
}

export async function verifyPassword(hash_: string, plainPassword: string): Promise<boolean> {
  try {
    return await verify(hash_, plainPassword);
  } catch {
    return false;
  }
}

export function isPasswordStrongEnough(password: string): boolean {
  if (password.length < 10) return false;
  const hasLetter = /[a-zA-Z]/.test(password);
  const hasNumberOrSymbol = /[0-9!@#$%^&*()\-_=+[\]{};:'",.<>/?\\|`~]/.test(password);
  return hasLetter && hasNumberOrSymbol;
}