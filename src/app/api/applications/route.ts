import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getCurrentSession } from "@/lib/auth/session";
import { createApplicationSchema } from "@/lib/validation";
import { requireOrgPermission, PERMISSIONS, UnauthorizedError } from "@/lib/auth/rbac";
import { generateOpaqueToken, sha256Hex } from "@/lib/security/crypto";
import { logAuditEvent } from "@/lib/auth/audit";
import { handleApiError } from "@/lib/api-response";

export async function GET() {
  try {
    const session = await getCurrentSession();
    if (!session) throw new UnauthorizedError();

    const applications = await prisma.application.findMany({
      where: { ownerId: session.userId },
      orderBy: { createdAt: "desc" },
      select: { id: true, name: true, clientId: true, redirectUrls: true, createdAt: true, organizationId: true },
    });

    return NextResponse.json({ applications });
  } catch (error) {
    return handleApiError(error);
  }
}

export async function POST(req: NextRequest) {
  try {
    const session = await getCurrentSession();
    if (!session) throw new UnauthorizedError();

    const body = createApplicationSchema.parse(await req.json());

    if (body.organizationId) {
      await requireOrgPermission(session.userId, body.organizationId, PERMISSIONS.APPLICATIONS_MANAGE);
    }

    const clientId = `client_${generateOpaqueToken(12)}`;
    const clientSecret = `secret_${generateOpaqueToken(24)}`;

    const application = await prisma.application.create({
      data: {
        name: body.name,
        organizationId: body.organizationId,
        ownerId: session.userId,
        clientId,
        clientSecretHash: sha256Hex(clientSecret),
        redirectUrls: body.redirectUrls,
      },
    });

    await logAuditEvent({
      event: "APPLICATION_CREATED",
      actorId: session.userId,
      actorLabel: session.user.email,
      organizationId: body.organizationId,
      metadata: { applicationId: application.id },
    });

    // clientSecret is shown exactly once — only its hash is persisted.
    return NextResponse.json({ application, clientSecret }, { status: 201 });
  } catch (error) {
    return handleApiError(error);
  }
}
