import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { loginSchema } from "@/lib/validation";
import { verifyPassword } from "@/lib/security/password";
import { createSession } from "@/lib/auth/session";
import { createTwoFactorChallengeToken } from "@/lib/auth/challenge";
import { checkRateLimit, RATE_LIMITS, ACCOUNT_LOCK_THRESHOLD, ACCOUNT_LOCK_WINDOW_MINUTES } from "@/lib/security/rate-limit";
import { getRequestIp } from "@/lib/security/ip";
import { logAuditEvent } from "@/lib/auth/audit";
import { handleApiError, jsonError } from "@/lib/api-response";

async function recentFailedAttempts(email: string): Promise<number> {
  const since = new Date(Date.now() - ACCOUNT_LOCK_WINDOW_MINUTES * 60 * 1000);
  return prisma.securityEvent.count({
    where: { type: "FAILED_LOGIN_ATTEMPT", identifier: email, createdAt: { gte: since } },
  });
}

export async function POST(req: NextRequest) {
  try {
    const ip = getRequestIp() ?? "unknown";
    const body = loginSchema.parse(await req.json());

    // Two independent limiter buckets: per-email (stops targeted credential
    // stuffing against one account) and per-IP (stops one source hammering
    // many accounts). Both must pass.
    const [emailLimit, ipLimit] = await Promise.all([
      checkRateLimit(RATE_LIMITS.LOGIN_PER_EMAIL, body.email),
      checkRateLimit(RATE_LIMITS.LOGIN_PER_IP, ip),
    ]);
    if (!emailLimit.success || !ipLimit.success) {
      return jsonError("Too many login attempts. Please try again later.", 429);
    }

    // Brute-force lockout: independent of the rate limiter backend, driven
    // by the audited SecurityEvent trail, so an attacker rotating IPs still
    // gets locked out after enough consecutive failures on one account.
    const failedCount = await recentFailedAttempts(body.email);
    if (failedCount >= ACCOUNT_LOCK_THRESHOLD) {
      return jsonError(
        `This account is temporarily locked due to repeated failed sign-in attempts. Try again in ${ACCOUNT_LOCK_WINDOW_MINUTES} minutes, or reset your password.`,
        423,
      );
    }

    const user = await prisma.user.findUnique({ where: { email: body.email } });

    const genericInvalid = async () => {
      await prisma.securityEvent.create({
        data: { type: "FAILED_LOGIN_ATTEMPT", identifier: body.email, ipAddress: ip },
      });
      await logAuditEvent({ event: "LOGIN_FAILED", actorLabel: body.email, metadata: { reason: "invalid_credentials" } });
      return jsonError("Invalid email or password.", 401);
    };

    if (!user || !user.passwordHash) return genericInvalid();

    const validPassword = await verifyPassword(user.passwordHash, body.password);
    if (!validPassword) return genericInvalid();

    if (user.twoFactorEnabled) {
      const challengeToken = await createTwoFactorChallengeToken(user.id, body.rememberDevice);
      return NextResponse.json({ twoFactorRequired: true, challengeToken });
    }

    const session = await createSession({ userId: user.id, rememberDevice: body.rememberDevice });
    await logAuditEvent({ event: "LOGIN_SUCCESS", actorId: user.id, actorLabel: user.email, metadata: { method: "password" } });

    return NextResponse.json({ twoFactorRequired: false, userId: user.id, sessionId: session.id });
  } catch (error) {
    return handleApiError(error);
  }
}
