import { hash, verify } from "@node-rs/argon2";

/**
 * @node-rs/argon2 místo balíčku `argon2`: oba implementují Argon2id, ale
 * `argon2` (node-gyp-build) je klasický nativní addon vázaný na konkrétní
 * Node.js ABI verzi — na Vercelu to spolehlivě padá s
 * "No native build was found for ... abi=...". @node-rs/argon2 je postavený
 * na N-API, stabilním napříč verzemi Node, takže tenhle problém nenastává.
 *
 * `algorithm: 2` odpovídá hodnotě Argon2id v enumu `Algorithm` této
 * knihovny (Argon2d = 0, Argon2i = 1, Argon2id = 2). Používáme číslo místo
 * `Algorithm.Argon2id`, protože jde o tzv. ambient const enum (deklarovaný
 * v .d.ts knihovny) a Next.js vyžaduje `isolatedModules`, což přímý odkaz
 * na hodnotu takového enumu zakazuje.
 */
const ARGON2_OPTIONS = {
  algorithm: 2, // Argon2id
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