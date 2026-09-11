import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { changePasswordSchema } from "@/lib/validation";
import { hashPassword, verifyPassword } from "@/lib/security/password";
import { getCurrentSession, revokeAllSessions } from "@/lib/auth/session";
import { UnauthorizedError } from "@/lib/auth/rbac";
import { logAuditEvent } from "@/lib/auth/audit";
import { handleApiError, jsonError } from "@/lib/api-response";

export async function PATCH(req: NextRequest) {
  try {
    const session = await getCurrentSession();
    if (!session) throw new UnauthorizedError();

    const body = changePasswordSchema.parse(await req.json());

    if (!session.user.passwordHash) {
      return jsonError("This account signed up via OAuth and has no password set.", 400);
    }

    const valid = await verifyPassword(session.user.passwordHash, body.currentPassword);
    if (!valid) return jsonError("Current password is incorrect.", 401);

    const passwordHash = await hashPassword(body.newPassword);
    await prisma.user.update({ where: { id: session.userId }, data: { passwordHash } });

    const revokedCount = await revokeAllSessions(session.userId, session.id, "password_change");

    await logAuditEvent({
      event: "PASSWORD_CHANGED",
      actorId: session.userId,
      actorLabel: session.user.email,
      metadata: { otherSessionsRevoked: revokedCount },
    });

    return NextResponse.json({ message: "Password updated." });
  } catch (error) {
    return handleApiError(error);
  }
}
