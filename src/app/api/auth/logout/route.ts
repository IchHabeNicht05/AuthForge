import { NextResponse } from "next/server";
import { getCurrentSession, destroyCurrentSession } from "@/lib/auth/session";
import { logAuditEvent } from "@/lib/auth/audit";
import { handleApiError } from "@/lib/api-response";

export async function POST() {
  try {
    const session = await getCurrentSession();
    await destroyCurrentSession();

    if (session) {
      await logAuditEvent({ event: "LOGOUT", actorId: session.userId, actorLabel: session.user.email });
    }

    return NextResponse.json({ message: "Logged out." });
  } catch (error) {
    return handleApiError(error);
  }
}
