import { NextRequest, NextResponse } from "next/server";
import { getCurrentSession } from "@/lib/auth/session";
import { confirmTwoFactorSetup, generateBackupCodes } from "@/lib/auth/two-factor";
import { enableTwoFactorConfirmSchema } from "@/lib/validation";
import { UnauthorizedError } from "@/lib/auth/rbac";
import { logAuditEvent } from "@/lib/auth/audit";
import { handleApiError, jsonError } from "@/lib/api-response";

export async function POST(req: NextRequest) {
  try {
    const session = await getCurrentSession();
    if (!session) throw new UnauthorizedError();

    const { code } = enableTwoFactorConfirmSchema.parse(await req.json());

    const confirmed = await confirmTwoFactorSetup(session.userId, code);
    if (!confirmed) return jsonError("That code didn't match. Double-check your authenticator app and try again.", 400);

    const backupCodes = await generateBackupCodes(session.userId);

    await logAuditEvent({ event: "TWO_FACTOR_ENABLED", actorId: session.userId, actorLabel: session.user.email });

    // Backup codes are returned exactly once, at generation time.
    return NextResponse.json({ enabled: true, backupCodes });
  } catch (error) {
    return handleApiError(error);
  }
}
