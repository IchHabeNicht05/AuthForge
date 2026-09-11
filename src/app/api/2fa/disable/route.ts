import { NextRequest, NextResponse } from "next/server";
import { getCurrentSession } from "@/lib/auth/session";
import { disableTwoFactor } from "@/lib/auth/two-factor";
import { verifyPassword } from "@/lib/security/password";
import { UnauthorizedError } from "@/lib/auth/rbac";
import { logAuditEvent } from "@/lib/auth/audit";
import { handleApiError, jsonError } from "@/lib/api-response";
import { z } from "zod";

const schema = z.object({ currentPassword: z.string().min(1) });

export async function POST(req: NextRequest) {
  try {
    const session = await getCurrentSession();
    if (!session) throw new UnauthorizedError();

    const { currentPassword } = schema.parse(await req.json());

    // Disabling 2FA is a sensitive downgrade — require re-authentication
    // with the account password rather than trusting the session alone.
    if (session.user.passwordHash) {
      const valid = await verifyPassword(session.user.passwordHash, currentPassword);
      if (!valid) return jsonError("Incorrect password.", 401);
    }

    await disableTwoFactor(session.userId);
    await logAuditEvent({ event: "TWO_FACTOR_DISABLED", actorId: session.userId, actorLabel: session.user.email });

    return NextResponse.json({ enabled: false });
  } catch (error) {
    return handleApiError(error);
  }
}
