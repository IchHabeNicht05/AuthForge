import { randomBytes, createHash, createCipheriv, createDecipheriv, scryptSync, timingSafeEqual } from "node:crypto";
import { env } from "@/lib/env";

/**
 * AES-256-GCM encryption for values that must be *recoverable* (unlike
 * passwords, which are one-way hashed). The only thing in this schema that
 * needs this is the TOTP secret — we must read it back to verify codes.
 *
 * The key is derived from AUTH_SECRET via scrypt rather than using
 * AUTH_SECRET directly as a raw AES key, so a 32+ char passphrase-style
 * secret (rather than a raw 32-byte key) is safe to configure.
 */
function deriveKey(secret: string): Buffer {
  return scryptSync(secret, "authforge-totp-encryption", 32);
}

export function encryptSecret(plaintext: string): string {
  const key = deriveKey(env().AUTH_SECRET);
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", key, iv);
  const encrypted = Buffer.concat([cipher.update(plaintext, "utf8"), cipher.final()]);
  const authTag = cipher.getAuthTag();
  // Format: base64(iv).base64(authTag).base64(ciphertext)
  return [iv.toString("base64"), authTag.toString("base64"), encrypted.toString("base64")].join(".");
}

export function decryptSecret(payload: string): string {
  const [ivB64, tagB64, dataB64] = payload.split(".");
  if (!ivB64 || !tagB64 || !dataB64) throw new Error("Malformed encrypted payload");
  const key = deriveKey(env().AUTH_SECRET);
  const decipher = createDecipheriv("aes-256-gcm", key, Buffer.from(ivB64, "base64"));
  decipher.setAuthTag(Buffer.from(tagB64, "base64"));
  const decrypted = Buffer.concat([
    decipher.update(Buffer.from(dataB64, "base64")),
    decipher.final(),
  ]);
  return decrypted.toString("utf8");
}

/** Cryptographically random, URL-safe opaque token (session tokens, reset tokens, etc). */
export function generateOpaqueToken(bytes = 32): string {
  return randomBytes(bytes).toString("base64url");
}

/** One-way hash for tokens we need to look up by exact match (reset tokens, backup codes). */
export function sha256Hex(value: string): string {
  return createHash("sha256").update(value).digest("hex");
}

/** Constant-time string comparison to avoid timing side-channels on token checks. */
export function timingSafeEqualStr(a: string, b: string): boolean {
  const bufA = Buffer.from(a);
  const bufB = Buffer.from(b);
  if (bufA.length !== bufB.length) return false;
  return timingSafeEqual(bufA, bufB);
}
