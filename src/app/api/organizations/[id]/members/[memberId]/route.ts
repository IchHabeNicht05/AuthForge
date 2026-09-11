import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getCurrentSession } from "@/lib/auth/session";
import { requireOrgPermission, PERMISSIONS, UnauthorizedError, ForbiddenError } from "@/lib/auth/rbac";
import { updateMemberRoleSchema } from "@/lib/validation";
import { logAuditEvent } from "@/lib/auth/audit";
import { handleApiError, jsonError } from "@/lib/api-response";
import { RoleKey } from "@prisma/client";

export async function PATCH(
  req: NextRequest,
  { params }: { params: { id: string; memberId: string } },
) {
  try {
    const session = await getCurrentSession();
    if (!session) throw new UnauthorizedError();

    await requireOrgPermission(session.userId, params.id, PERMISSIONS.MEMBERS_CHANGE_ROLE);

    const body = updateMemberRoleSchema.parse(await req.json());

    const target = await prisma.organizationMember.findUnique({ where: { id: params.memberId } });
    if (!target || target.organizationId !== params.id) return jsonError("Member not found.", 404);

    // Guard against demoting the last remaining Owner, which would leave
    // the organization unmanageable.
    if (target.role === RoleKey.OWNER && body.role !== RoleKey.OWNER) {
      const ownerCount = await prisma.organizationMember.count({
        where: { organizationId: params.id, role: RoleKey.OWNER },
      });
      if (ownerCount <= 1) throw new ForbiddenError("An organization must have at least one Owner.");
    }

    const updated = await prisma.organizationMember.update({
      where: { id: params.memberId },
      data: { role: body.role as RoleKey },
    });

    await logAuditEvent({
      event: "ORG_MEMBER_ROLE_CHANGED",
      actorId: session.userId,
      actorLabel: session.user.email,
      organizationId: params.id,
      metadata: { memberId: params.memberId, newRole: body.role },
    });

    return NextResponse.json({ member: updated });
  } catch (error) {
    return handleApiError(error);
  }
}

export async function DELETE(_req: NextRequest, { params }: { params: { id: string; memberId: string } }) {
  try {
    const session = await getCurrentSession();
    if (!session) throw new UnauthorizedError();

    await requireOrgPermission(session.userId, params.id, PERMISSIONS.MEMBERS_REMOVE);

    const target = await prisma.organizationMember.findUnique({ where: { id: params.memberId } });
    if (!target || target.organizationId !== params.id) return jsonError("Member not found.", 404);

    if (target.role === RoleKey.OWNER) {
      const ownerCount = await prisma.organizationMember.count({
        where: { organizationId: params.id, role: RoleKey.OWNER },
      });
      if (ownerCount <= 1) throw new ForbiddenError("An organization must have at least one Owner.");
    }

    await prisma.organizationMember.delete({ where: { id: params.memberId } });

    await logAuditEvent({
      event: "ORG_MEMBER_REMOVED",
      actorId: session.userId,
      actorLabel: session.user.email,
      organizationId: params.id,
      metadata: { memberId: params.memberId },
    });

    return NextResponse.json({ message: "Member removed." });
  } catch (error) {
    return handleApiError(error);
  }
}
