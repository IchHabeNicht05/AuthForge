import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { registerSchema } from "@/lib/validation";
import { hashPassword } from "@/lib/security/password";
import { checkRateLimit, RATE_LIMITS } from "@/lib/security/rate-limit";
import { getRequestIp } from "@/lib/security/ip";
import { createEmailVerificationToken } from "@/lib/auth/tokens";
import { sendEmail, verificationEmailHtml } from "@/lib/email";
import { logAuditEvent } from "@/lib/auth/audit";
import { handleApiError, jsonError } from "@/lib/api-response";
import { env } from "@/lib/env";

export async function POST(req: NextRequest) {
  try {
    const ip = getRequestIp() ?? "unknown";
    const rateLimit = await checkRateLimit(RATE_LIMITS.REGISTER_PER_IP, ip);
    if (!rateLimit.success) {
      return jsonError("Too many registration attempts. Please try again later.", 429);
    }

    const body = registerSchema.parse(await req.json());

    const existing = await prisma.user.findUnique({ where: { email: body.email } });
    if (existing) {
      // Deliberately vague to avoid confirming which emails are registered.
      return jsonError("Unable to create an account with these details.", 409);
    }

    const passwordHash = await hashPassword(body.password);
    const user = await prisma.user.create({
      data: { email: body.email, name: body.name, passwordHash },
    });

    await logAuditEvent({
      event: "REGISTER",
      actorId: user.id,
      actorLabel: user.email,
    });

    const rawToken = await createEmailVerificationToken(user.email);
    const verifyUrl = `${env().APP_URL}/verify-email?token=${rawToken}`;
    await sendEmail({
      to: user.email,
      subject: "Verify your AuthForge account",
      html: verificationEmailHtml(verifyUrl),
    });

    return NextResponse.json(
      { message: "Account created. Check your email to verify your address." },
      { status: 201 },
    );
  } catch (error) {
    return handleApiError(error);
  }
}
