import { NextResponse } from "next/server";
import { getCurrentSession, revokeSession } from "@/lib/auth/session";
import { UnauthorizedError } from "@/lib/auth/rbac";
import { logAuditEvent } from "@/lib/auth/audit";
import { handleApiError, jsonError } from "@/lib/api-response";

export async function DELETE(_req: Request, { params }: { params: { id: string } }) {
  try {
    const current = await getCurrentSession();
    if (!current) throw new UnauthorizedError();

    const revoked = await revokeSession(params.id, current.userId);
    if (!revoked) return jsonError("Session not found.", 404);

    await logAuditEvent({
      event: "SESSION_REVOKED",
      actorId: current.userId,
      actorLabel: current.user.email,
      metadata: { sessionId: params.id, self: params.id === current.id },
    });

    return NextResponse.json({ message: "Session revoked." });
  } catch (error) {
    return handleApiError(error);
  }
}
