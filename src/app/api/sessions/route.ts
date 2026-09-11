import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getCurrentSession, revokeAllSessions } from "@/lib/auth/session";
import { UnauthorizedError } from "@/lib/auth/rbac";
import { logAuditEvent } from "@/lib/auth/audit";
import { handleApiError } from "@/lib/api-response";

export async function GET() {
  try {
    const current = await getCurrentSession();
    if (!current) throw new UnauthorizedError();

    const sessions = await prisma.session.findMany({
      where: { userId: current.userId, revokedAt: null, expiresAt: { gt: new Date() } },
      orderBy: { lastActiveAt: "desc" },
      select: {
        id: true,
        device: true,
        browser: true,
        os: true,
        approxLocation: true,
        createdAt: true,
        lastActiveAt: true,
        expiresAt: true,
        rememberDevice: true,
      },
    });

    return NextResponse.json({
      sessions: sessions.map((s) => ({ ...s, isCurrent: s.id === current.id })),
    });
  } catch (error) {
    return handleApiError(error);
  }
}

/** "Revoke all other sessions" — keeps the caller's current session alive. */
export async function DELETE() {
  try {
    const current = await getCurrentSession();
    if (!current) throw new UnauthorizedError();

    const revokedCount = await revokeAllSessions(current.userId, current.id);

    await logAuditEvent({
      event: "SESSION_REVOKED_ALL",
      actorId: current.userId,
      actorLabel: current.user.email,
      metadata: { revokedCount },
    });

    return NextResponse.json({ revokedCount });
  } catch (error) {
    return handleApiError(error);
  }
}
