import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getCurrentSession } from "@/lib/auth/session";
import { createApiKey } from "@/lib/auth/api-keys";
import { createApiKeySchema } from "@/lib/validation";
import { requireOrgPermission, PERMISSIONS, UnauthorizedError } from "@/lib/auth/rbac";
import { checkRateLimit, RATE_LIMITS } from "@/lib/security/rate-limit";
import { logAuditEvent } from "@/lib/auth/audit";
import { handleApiError, jsonError } from "@/lib/api-response";

export async function GET() {
  try {
    const session = await getCurrentSession();
    if (!session) throw new UnauthorizedError();

    const keys = await prisma.apiKey.findMany({
      where: { userId: session.userId },
      orderBy: { createdAt: "desc" },
      select: {
        id: true,
        name: true,
        prefix: true,
        scopes: true,
        createdAt: true,
        lastUsedAt: true,
        expiresAt: true,
        revokedAt: true,
        organizationId: true,
      },
    });

    return NextResponse.json({ apiKeys: keys });
  } catch (error) {
    return handleApiError(error);
  }
}

export async function POST(req: NextRequest) {
  try {
    const session = await getCurrentSession();
    if (!session) throw new UnauthorizedError();

    const rateLimit = await checkRateLimit(RATE_LIMITS.API_KEY_CREATE, session.userId);
    if (!rateLimit.success) return jsonError("Too many API keys created recently. Please slow down.", 429);

    const body = createApiKeySchema.parse(await req.json());

    if (body.organizationId) {
      await requireOrgPermission(session.userId, body.organizationId, PERMISSIONS.API_KEYS_CREATE);
    }

    const { record, fullKey } = await createApiKey({
      userId: session.userId,
      name: body.name,
      organizationId: body.organizationId,
      scopes: body.scopes,
      expiresInDays: body.expiresInDays,
    });

    await logAuditEvent({
      event: "API_KEY_CREATED",
      actorId: session.userId,
      actorLabel: session.user.email,
      organizationId: body.organizationId,
      metadata: { apiKeyId: record.id, name: record.name },
    });

    // fullKey is only ever present in THIS response. Every subsequent read
    // of this key returns only `prefix`.
    return NextResponse.json({ apiKey: record, secret: fullKey }, { status: 201 });
  } catch (error) {
    return handleApiError(error);
  }
}
