import { NextResponse } from "next/server";
import { getCurrentSession } from "@/lib/auth/session";
import { generateBackupCodes } from "@/lib/auth/two-factor";
import { UnauthorizedError } from "@/lib/auth/rbac";
import { jsonError, handleApiError } from "@/lib/api-response";

/** Regenerates backup codes, invalidating any previous unused ones. Requires 2FA to already be enabled. */
export async function POST() {
  try {
    const session = await getCurrentSession();
    if (!session) throw new UnauthorizedError();
    if (!session.user.twoFactorEnabled) return jsonError("Enable two-factor authentication first.", 400);

    const backupCodes = await generateBackupCodes(session.userId);
    return NextResponse.json({ backupCodes });
  } catch (error) {
    return handleApiError(error);
  }
}
