import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { resetPasswordSchema } from "@/lib/validation";
import { hashPassword } from "@/lib/security/password";
import { consumePasswordResetToken } from "@/lib/auth/tokens";
import { revokeAllSessions } from "@/lib/auth/session";
import { logAuditEvent } from "@/lib/auth/audit";
import { handleApiError, jsonError } from "@/lib/api-response";

export async function POST(req: NextRequest) {
  try {
    const body = resetPasswordSchema.parse(await req.json());

    const tokenRecord = await consumePasswordResetToken(body.token);
    if (!tokenRecord) return jsonError("This reset link is invalid or has expired.", 400);

    const passwordHash = await hashPassword(body.password);
    const user = await prisma.user.update({
      where: { id: tokenRecord.userId },
      data: { passwordHash },
    });

    // Resetting the password is a strong signal of account compromise or
    // recovery — revoke every existing session so a stolen session cookie
    // (or the attacker who prompted the reset) is immediately logged out.
    const revokedCount = await revokeAllSessions(user.id, undefined, "password_change");

    await logAuditEvent({
      event: "PASSWORD_RESET_COMPLETED",
      actorId: user.id,
      actorLabel: user.email,
      metadata: { sessionsRevoked: revokedCount },
    });

    return NextResponse.json({ message: "Password updated. Please sign in again." });
  } catch (error) {
    return handleApiError(error);
  }
}
