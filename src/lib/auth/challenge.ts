import "server-only";
import { SignJWT, jwtVerify } from "jose";
import { env } from "@/lib/env";

/**
 * When a password check succeeds but the account has 2FA enabled, we don't
 * yet issue a real session — the user isn't authenticated until they also
 * pass the TOTP/backup-code challenge. Rather than persisting that
 * intermediate "half-logged-in" state in the database, it's encoded as a
 * short-lived signed JWT the client holds onto for the one extra request.
 * This keeps the Session table's invariant simple: every row in it is a
 * fully authenticated session.
 */
const CHALLENGE_TTL_SECONDS = 5 * 60;

function getSigningKey() {
  return new TextEncoder().encode(env().AUTH_SECRET);
}

export async function createTwoFactorChallengeToken(userId: string, rememberDevice: boolean): Promise<string> {
  return new SignJWT({ userId, rememberDevice, purpose: "2fa-challenge" })
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime(`${CHALLENGE_TTL_SECONDS}s`)
    .sign(getSigningKey());
}

export async function verifyTwoFactorChallengeToken(
  token: string,
): Promise<{ userId: string; rememberDevice: boolean } | null> {
  try {
    const { payload } = await jwtVerify(token, getSigningKey());
    if (payload.purpose !== "2fa-challenge" || typeof payload.userId !== "string") return null;
    return { userId: payload.userId, rememberDevice: Boolean(payload.rememberDevice) };
  } catch {
    return null;
  }
}
