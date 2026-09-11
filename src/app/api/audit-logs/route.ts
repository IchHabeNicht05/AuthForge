import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getCurrentSession } from "@/lib/auth/session";
import { requireOrgPermission, PERMISSIONS, UnauthorizedError } from "@/lib/auth/rbac";
import { auditLogQuerySchema } from "@/lib/validation";
import { handleApiError } from "@/lib/api-response";

export async function GET(req: NextRequest) {
  try {
    const session = await getCurrentSession();
    if (!session) throw new UnauthorizedError();

    const { searchParams } = new URL(req.url);
    const query = auditLogQuerySchema.parse(Object.fromEntries(searchParams));

    if (query.organizationId) {
      // Organization-scoped audit log requires explicit permission.
      await requireOrgPermission(session.userId, query.organizationId, PERMISSIONS.AUDIT_LOG_VIEW);
    }

    const logs = await prisma.auditLog.findMany({
      where: query.organizationId
        ? { organizationId: query.organizationId }
        : { actorId: session.userId, organizationId: null },
      orderBy: { createdAt: "desc" },
      take: query.limit,
      ...(query.cursor ? { cursor: { id: query.cursor }, skip: 1 } : {}),
    });

    const nextCursor = logs.length === query.limit ? logs[logs.length - 1]?.id : null;

    return NextResponse.json({ logs, nextCursor });
  } catch (error) {
    return handleApiError(error);
  }
}
