import "server-only";
import { prisma } from "@/lib/prisma";
import { generateOpaqueToken, sha256Hex } from "@/lib/security/crypto";

const RESET_TOKEN_TTL_MINUTES = 60;
const VERIFY_TOKEN_TTL_HOURS = 24;

/** Creates a password reset token, returning the *raw* token (to email) — only its hash is stored. */
export async function createPasswordResetToken(userId: string): Promise<string> {
  const raw = generateOpaqueToken(32);
  const tokenHash = sha256Hex(raw);
  const expiresAt = new Date(Date.now() + RESET_TOKEN_TTL_MINUTES * 60 * 1000);

  // Invalidate any previous unused reset tokens for this user first, so an
  // old leaked-but-unused link can't be used after a new one is issued.
  await prisma.$transaction([
    prisma.passwordResetToken.updateMany({
      where: { userId, usedAt: null },
      data: { usedAt: new Date() },
    }),
    prisma.passwordResetToken.create({ data: { userId, tokenHash, expiresAt } }),
  ]);

  return raw;
}

export async function consumePasswordResetToken(rawToken: string) {
  const tokenHash = sha256Hex(rawToken);
  const record = await prisma.passwordResetToken.findUnique({ where: { tokenHash } });

  if (!record || record.usedAt || record.expiresAt < new Date()) return null;

  const { count } = await prisma.passwordResetToken.updateMany({
    where: { id: record.id, usedAt: null },
    data: { usedAt: new Date() },
  });
  if (count === 0) return null;

  return record;
}

/** Creates an email verification token (Auth.js-compatible VerificationToken table). */
export async function createEmailVerificationToken(email: string): Promise<string> {
  const raw = generateOpaqueToken(32);
  const tokenHash = sha256Hex(raw);
  const expiresAt = new Date(Date.now() + VERIFY_TOKEN_TTL_HOURS * 60 * 60 * 1000);

  await prisma.verificationToken.deleteMany({ where: { identifier: email } });
  await prisma.verificationToken.create({ data: { identifier: email, token: tokenHash, expiresAt } });

  return raw;
}

export async function consumeEmailVerificationToken(rawToken: string) {
  const tokenHash = sha256Hex(rawToken);
  const record = await prisma.verificationToken.findUnique({ where: { token: tokenHash } });
  if (!record || record.expiresAt < new Date()) return null;

  // deleteMany místo delete: pokud token mezitím smazal jiný paralelní
  // požadavek (React StrictMode, dvojklik, refresh), count bude 0 a nic
  // to nerozbije — jednoduše to znamená "token už byl použit".
  const { count } = await prisma.verificationToken.deleteMany({ where: { token: tokenHash } });
  if (count === 0) return null;

  return record;
}
