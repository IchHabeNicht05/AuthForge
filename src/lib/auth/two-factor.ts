import "server-only";
import { TOTP, Secret } from "otpauth";
import QRCode from "qrcode";
import { randomInt } from "node:crypto";
import { prisma } from "@/lib/prisma";
import { decryptSecret, encryptSecret, sha256Hex } from "@/lib/security/crypto";

const ISSUER = "AuthForge";
const BACKUP_CODE_COUNT = 10;

function buildTotp(secretBase32: string, accountLabel: string): TOTP {
  return new TOTP({
    issuer: ISSUER,
    label: accountLabel,
    algorithm: "SHA1",
    digits: 6,
    period: 30,
    secret: Secret.fromBase32(secretBase32),
  });
}

/** Step 1 of enabling 2FA: generate a fresh secret + QR code, not yet persisted as "verified". */
export async function startTwoFactorSetup(userId: string, accountLabel: string) {
  const secret = new Secret({ size: 20 }).base32;
  const totp = buildTotp(secret, accountLabel);
  const otpauthUrl = totp.toString();
  const qrDataUrl = await QRCode.toDataURL(otpauthUrl);

  await prisma.twoFactor.upsert({
    where: { userId },
    create: { userId, secretEncrypted: encryptSecret(secret), verifiedAt: null },
    update: { secretEncrypted: encryptSecret(secret), verifiedAt: null },
  });

  return { secret, otpauthUrl, qrDataUrl };
}

/** Step 2: user submits a code from their authenticator app to confirm setup. */
export async function confirmTwoFactorSetup(userId: string, code: string): Promise<boolean> {
  const record = await prisma.twoFactor.findUnique({ where: { userId } });
  if (!record) return false;

  const secret = decryptSecret(record.secretEncrypted);
  const totp = buildTotp(secret, userId);
  const delta = totp.validate({ token: code, window: 1 });
  if (delta === null) return false;

  await prisma.$transaction([
    prisma.twoFactor.update({ where: { userId }, data: { verifiedAt: new Date() } }),
    prisma.user.update({ where: { id: userId }, data: { twoFactorEnabled: true } }),
  ]);

  return true;
}

/** Verifies a TOTP code during login, for an account that already has 2FA enabled. */
export async function verifyTwoFactorCode(userId: string, code: string): Promise<boolean> {
  const record = await prisma.twoFactor.findUnique({ where: { userId } });
  if (!record || !record.verifiedAt) return false;

  const secret = decryptSecret(record.secretEncrypted);
  const totp = buildTotp(secret, userId);
  return totp.validate({ token: code, window: 1 }) !== null;
}

export async function disableTwoFactor(userId: string): Promise<void> {
  await prisma.$transaction([
    prisma.twoFactor.deleteMany({ where: { userId } }),
    prisma.backupCode.deleteMany({ where: { userId } }),
    prisma.user.update({ where: { id: userId }, data: { twoFactorEnabled: false } }),
  ]);
}

/** Generates a fresh set of backup codes, replacing any existing unused ones. Returns the plaintext codes ONCE. */
export async function generateBackupCodes(userId: string): Promise<string[]> {
  const codes = Array.from({ length: BACKUP_CODE_COUNT }, () => formatBackupCode());

  await prisma.$transaction([
    prisma.backupCode.deleteMany({ where: { userId } }),
    prisma.backupCode.createMany({
      data: codes.map((code) => ({ userId, codeHash: sha256Hex(code) })),
    }),
  ]);

  return codes;
}

/** Consumes one backup code (single use) as a 2FA recovery path. */
export async function consumeBackupCode(userId: string, code: string): Promise<boolean> {
  const codeHash = sha256Hex(normalizeBackupCode(code));
  const record = await prisma.backupCode.findFirst({
    where: { userId, codeHash, usedAt: null },
  });
  if (!record) return false;

  await prisma.backupCode.update({ where: { id: record.id }, data: { usedAt: new Date() } });
  return true;
}

function formatBackupCode(): string {
  // 10 digits, grouped for readability: "1234-5678-90"
  const raw = Array.from({ length: 10 }, () => randomInt(0, 10)).join("");
  return `${raw.slice(0, 4)}-${raw.slice(4, 8)}-${raw.slice(8, 10)}`;
}

function normalizeBackupCode(code: string): string {
  return code.trim();
}
