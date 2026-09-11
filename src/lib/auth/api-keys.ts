import "server-only";
import { randomBytes } from "node:crypto";
import { prisma } from "@/lib/prisma";
import { sha256Hex } from "@/lib/security/crypto";

/**
 * API key format: "af_live_<40 random base62 chars>". The prefix
 * ("af_live_" + first 8 chars) is stored in plaintext for display/lookup
 * ("af_live_9k2xQ1a3...") — enough for a user to recognize which key is
 * which without ever re-exposing the secret. Only a SHA-256 hash of the
 * *full* key is stored; the full key itself is shown exactly once, at
 * creation time, and is never retrievable again.
 */
const KEY_PREFIX = "af_live_";
const SECRET_LENGTH_BYTES = 30;

export interface GeneratedApiKey {
  fullKey: string; // shown once to the caller
  prefix: string; // safe to store/display
  keyHash: string; // what actually gets persisted
}

export function generateApiKeyMaterial(): GeneratedApiKey {
  const secret = randomBytes(SECRET_LENGTH_BYTES).toString("base64url");
  const fullKey = `${KEY_PREFIX}${secret}`;
  const prefix = fullKey.slice(0, KEY_PREFIX.length + 8);
  return { fullKey, prefix, keyHash: sha256Hex(fullKey) };
}

export interface CreateApiKeyInput {
  userId: string;
  name: string;
  organizationId?: string;
  scopes?: string[];
  expiresInDays?: number;
}

export async function createApiKey(input: CreateApiKeyInput) {
  const material = generateApiKeyMaterial();
  const expiresAt = input.expiresInDays
    ? new Date(Date.now() + input.expiresInDays * 24 * 60 * 60 * 1000)
    : null;

  const record = await prisma.apiKey.create({
    data: {
      name: input.name,
      prefix: material.prefix,
      keyHash: material.keyHash,
      userId: input.userId,
      organizationId: input.organizationId,
      scopes: input.scopes ?? [],
      expiresAt,
    },
  });

  // fullKey is returned alongside the record ONLY here, at creation time.
  return { record, fullKey: material.fullKey };
}

export async function revokeApiKey(apiKeyId: string, userId: string): Promise<boolean> {
  const result = await prisma.apiKey.updateMany({
    where: { id: apiKeyId, userId, revokedAt: null },
    data: { revokedAt: new Date() },
  });
  return result.count > 0;
}

/** Used by the demo app / any endpoint accepting `Authorization: Bearer af_live_...`. */
export async function verifyApiKey(fullKey: string) {
  if (!fullKey.startsWith(KEY_PREFIX)) return null;
  const keyHash = sha256Hex(fullKey);

  const record = await prisma.apiKey.findFirst({
    where: { keyHash, revokedAt: null },
    include: { user: true },
  });
  if (!record) return null;
  if (record.expiresAt && record.expiresAt < new Date()) return null;

  // Fire-and-forget-style update of lastUsedAt; awaited for correctness in
  // short-lived serverless invocations (see note in session.ts).
  await prisma.apiKey.update({ where: { id: record.id }, data: { lastUsedAt: new Date() } });

  return record;
}
