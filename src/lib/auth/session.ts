import "server-only";
import { cookies } from "next/headers";
import { prisma } from "@/lib/prisma";
import { generateOpaqueToken } from "@/lib/security/crypto";
import { anonymizeIp, getRequestIp, getUserAgent, resolveApproxLocation } from "@/lib/security/ip";
import { UAParser } from "ua-parser-js";
import type { Session, User } from "@prisma/client";

export const SESSION_COOKIE_NAME = "authforge_session";

// Short-lived sessions by default; "remember this device" extends the
// lifetime instead of making every session long-lived by default.
const DEFAULT_SESSION_TTL_HOURS = 12;
const REMEMBER_DEVICE_TTL_DAYS = 30;

export interface CreateSessionOptions {
  userId: string;
  rememberDevice?: boolean;
}

/**
 * Creates a new server-side session row and sets the session cookie.
 * Called after password/OAuth login succeeds (and after a successful 2FA
 * challenge, for accounts with 2FA enabled).
 */
export async function createSession({ userId, rememberDevice = false }: CreateSessionOptions): Promise<Session> {
  const sessionToken = generateOpaqueToken(32);
  const rawIp = getRequestIp();
  const ip = anonymizeIp(rawIp);
  const userAgent = getUserAgent();
  const parsed = userAgent ? new UAParser(userAgent).getResult() : null;

  const expiresAt = new Date();
  if (rememberDevice) {
    expiresAt.setDate(expiresAt.getDate() + REMEMBER_DEVICE_TTL_DAYS);
  } else {
    expiresAt.setHours(expiresAt.getHours() + DEFAULT_SESSION_TTL_HOURS);
  }

  const session = await prisma.session.create({
    data: {
      sessionToken,
      userId,
      device: parsed?.device.model ?? (parsed?.device.type ? parsed.device.type : "Desktop"),
      browser: parsed ? [parsed.browser.name, parsed.browser.version].filter(Boolean).join(" ") : null,
      os: parsed ? [parsed.os.name, parsed.os.version].filter(Boolean).join(" ") : null,
      ipAddress: ip,
      approxLocation: await resolveApproxLocation(rawIp),
      rememberDevice,
      expiresAt,
    },
  });

  cookies().set(SESSION_COOKIE_NAME, sessionToken, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    expires: expiresAt,
  });

  return session;
}

/** Reads the current session (and its user) from the request cookie, if any and valid. */
export async function getCurrentSession(): Promise<(Session & { user: User }) | null> {
  const token = cookies().get(SESSION_COOKIE_NAME)?.value;
  if (!token) return null;

  const session = await prisma.session.findUnique({
    where: { sessionToken: token },
    include: { user: true },
  });

  if (!session) return null;
  if (session.revokedAt) return null;
  if (session.expiresAt < new Date()) return null;

  // Sliding activity timestamp — cheap "last active" signal for the
  // sessions dashboard. Not awaited on the hot path of every request would
  // be ideal (fire-and-forget), but we keep it awaited here for correctness
  // in serverless environments where the process may freeze immediately
  // after the response is sent.
  await prisma.session.update({
    where: { id: session.id },
    data: { lastActiveAt: new Date() },
  });

  return session;
}

export async function getCurrentUser(): Promise<User | null> {
  const session = await getCurrentSession();
  return session?.user ?? null;
}

/** Revokes one session by id, scoped to the owning user so users can only revoke their own. */
export async function revokeSession(sessionId: string, userId: string, reason = "user"): Promise<boolean> {
  const result = await prisma.session.updateMany({
    where: { id: sessionId, userId, revokedAt: null },
    data: { revokedAt: new Date(), revokedReason: reason },
  });
  return result.count > 0;
}

/** Revokes every session for a user except (optionally) the current one — "log out other devices". */
export async function revokeAllSessions(userId: string, exceptSessionId?: string, reason = "user_revoke_all"): Promise<number> {
  const result = await prisma.session.updateMany({
    where: {
      userId,
      revokedAt: null,
      ...(exceptSessionId ? { id: { not: exceptSessionId } } : {}),
    },
    data: { revokedAt: new Date(), revokedReason: reason },
  });
  return result.count;
}

/** Clears the session cookie and revokes the underlying session row. */
export async function destroyCurrentSession(): Promise<void> {
  const token = cookies().get(SESSION_COOKIE_NAME)?.value;
  if (token) {
    await prisma.session.updateMany({
      where: { sessionToken: token, revokedAt: null },
      data: { revokedAt: new Date(), revokedReason: "logout" },
    });
  }
  cookies().set(SESSION_COOKIE_NAME, "", { path: "/", expires: new Date(0) });
}
