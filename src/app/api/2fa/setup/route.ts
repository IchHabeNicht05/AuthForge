import { NextResponse } from "next/server";
import { getCurrentSession } from "@/lib/auth/session";
import { startTwoFactorSetup } from "@/lib/auth/two-factor";
import { UnauthorizedError } from "@/lib/auth/rbac";
import { handleApiError } from "@/lib/api-response";

export async function POST() {
  try {
    const session = await getCurrentSession();
    if (!session) throw new UnauthorizedError();

    const { secret, otpauthUrl, qrDataUrl } = await startTwoFactorSetup(session.userId, session.user.email);

    // The raw secret is returned once as a manual-entry fallback for
    // authenticator apps that can't scan a QR code — never logged or
    // persisted in plaintext (see lib/security/crypto.ts).
    return NextResponse.json({ secret, otpauthUrl, qrDataUrl });
  } catch (error) {
    return handleApiError(error);
  }
}
