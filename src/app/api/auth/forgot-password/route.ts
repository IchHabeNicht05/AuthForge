import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { forgotPasswordSchema } from "@/lib/validation";
import { checkRateLimit, RATE_LIMITS } from "@/lib/security/rate-limit";
import { createPasswordResetToken } from "@/lib/auth/tokens";
import { sendEmail, passwordResetEmailHtml } from "@/lib/email";
import { logAuditEvent } from "@/lib/auth/audit";
import { handleApiError, jsonError } from "@/lib/api-response";
import { env } from "@/lib/env";

export async function POST(req: NextRequest) {
  try {
    const body = forgotPasswordSchema.parse(await req.json());

    const rateLimit = await checkRateLimit(RATE_LIMITS.PASSWORD_RESET_PER_EMAIL, body.email);
    if (!rateLimit.success) return jsonError("Too many requests. Please try again later.", 429);

    const user = await prisma.user.findUnique({ where: { email: body.email } });

    // Always respond with the same message whether or not the account
    // exists, so this endpoint can't be used to enumerate registered
    // emails. The email itself is only sent when a matching account exists.
    if (user) {
      const rawToken = await createPasswordResetToken(user.id);
      const resetUrl = `${env().APP_URL}/reset-password?token=${rawToken}`;
      await sendEmail({
        to: user.email,
        subject: "Reset your AuthForge password",
        html: passwordResetEmailHtml(resetUrl),
      });
      await logAuditEvent({ event: "PASSWORD_RESET_REQUESTED", actorId: user.id, actorLabel: user.email });
    }

    return NextResponse.json({ message: "If an account exists for that email, a reset link has been sent." });
  } catch (error) {
    return handleApiError(error);
  }
}
