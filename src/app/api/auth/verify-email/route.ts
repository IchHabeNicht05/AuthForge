import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { consumeEmailVerificationToken } from "@/lib/auth/tokens";
import { logAuditEvent } from "@/lib/auth/audit";
import { handleApiError, jsonError } from "@/lib/api-response";

const schema = z.object({ token: z.string().min(1) });

export async function POST(req: NextRequest) {
  try {
    const { token } = schema.parse(await req.json());

    const record = await consumeEmailVerificationToken(token);
    if (!record) return jsonError("This verification link is invalid or has expired.", 400);

    const user = await prisma.user.update({
      where: { email: record.identifier },
      data: { emailVerified: new Date() },
    });

    await logAuditEvent({ event: "EMAIL_VERIFIED", actorId: user.id, actorLabel: user.email });

    return NextResponse.json({ message: "Email verified." });
  } catch (error) {
    return handleApiError(error);
  }
}
