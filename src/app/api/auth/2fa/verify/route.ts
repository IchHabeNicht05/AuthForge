import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { twoFactorChallengeSchema } from "@/lib/validation";
import { verifyTwoFactorChallengeToken } from "@/lib/auth/challenge";
import { verifyTwoFactorCode, consumeBackupCode } from "@/lib/auth/two-factor";
import { createSession } from "@/lib/auth/session";
import { checkRateLimit, RATE_LIMITS } from "@/lib/security/rate-limit";
import { logAuditEvent } from "@/lib/auth/audit";
import { handleApiError, jsonError } from "@/lib/api-response";

export async function POST(req: NextRequest) {
  try {
    const body = twoFactorChallengeSchema.parse(await req.json());

    const challenge = await verifyTwoFactorChallengeToken(body.challengeToken);
    if (!challenge) return jsonError("This sign-in attempt has expired. Please log in again.", 401);

    const rateLimit = await checkRateLimit(RATE_LIMITS.TWO_FACTOR_VERIFY, challenge.userId);
    if (!rateLimit.success) return jsonError("Too many attempts. Please try again shortly.", 429);

    const user = await prisma.user.findUnique({ where: { id: challenge.userId } });
    if (!user) return jsonError("Account not found.", 404);

    const valid = body.isBackupCode
      ? await consumeBackupCode(user.id, body.code)
      : await verifyTwoFactorCode(user.id, body.code);

    if (!valid) {
      await logAuditEvent({ event: "TWO_FACTOR_CHALLENGE_FAILED", actorId: user.id, actorLabel: user.email });
      return jsonError("Invalid code.", 401);
    }

    const session = await createSession({ userId: user.id, rememberDevice: challenge.rememberDevice });

    await logAuditEvent({
      event: body.isBackupCode ? "BACKUP_CODE_USED" : "LOGIN_SUCCESS",
      actorId: user.id,
      actorLabel: user.email,
      metadata: { method: body.isBackupCode ? "backup_code" : "totp" },
    });

    return NextResponse.json({ userId: user.id, sessionId: session.id });
  } catch (error) {
    return handleApiError(error);
  }
}
