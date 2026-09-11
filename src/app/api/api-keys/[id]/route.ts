import { NextResponse } from "next/server";
import { getCurrentSession } from "@/lib/auth/session";
import { revokeApiKey } from "@/lib/auth/api-keys";
import { UnauthorizedError } from "@/lib/auth/rbac";
import { logAuditEvent } from "@/lib/auth/audit";
import { handleApiError, jsonError } from "@/lib/api-response";

export async function DELETE(_req: Request, { params }: { params: { id: string } }) {
  try {
    const session = await getCurrentSession();
    if (!session) throw new UnauthorizedError();

    const revoked = await revokeApiKey(params.id, session.userId);
    if (!revoked) return jsonError("API key not found.", 404);

    await logAuditEvent({
      event: "API_KEY_REVOKED",
      actorId: session.userId,
      actorLabel: session.user.email,
      metadata: { apiKeyId: params.id },
    });

    return NextResponse.json({ message: "API key revoked." });
  } catch (error) {
    return handleApiError(error);
  }
}
