import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getCurrentSession } from "@/lib/auth/session";
import { requireOrgMembership, requireOrgPermission, PERMISSIONS, UnauthorizedError } from "@/lib/auth/rbac";
import { inviteMemberSchema } from "@/lib/validation";
import { logAuditEvent } from "@/lib/auth/audit";
import { handleApiError, jsonError } from "@/lib/api-response";
import { RoleKey } from "@prisma/client";

export async function GET(_req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const session = await getCurrentSession();
    if (!session) throw new UnauthorizedError();

    await requireOrgMembership(session.userId, params.id);

    const members = await prisma.organizationMember.findMany({
      where: { organizationId: params.id },
      include: { user: { select: { id: true, email: true, name: true, image: true } } },
      orderBy: { invitedAt: "asc" },
    });

    return NextResponse.json({ members });
  } catch (error) {
    return handleApiError(error);
  }
}

export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const session = await getCurrentSession();
    if (!session) throw new UnauthorizedError();

    await requireOrgPermission(session.userId, params.id, PERMISSIONS.MEMBERS_INVITE);

    const body = inviteMemberSchema.parse(await req.json());

    const invitedUser = await prisma.user.findUnique({ where: { email: body.email } });
    if (!invitedUser) {
      // A production system would send an email invite for not-yet-registered
      // addresses; kept out of scope here, but the shape of the response
      // makes the missing step explicit rather than silently failing.
      return jsonError("No AuthForge account exists for that email yet. Ask them to sign up first.", 404);
    }

    const existingMembership = await prisma.organizationMember.findUnique({
      where: { organizationId_userId: { organizationId: params.id, userId: invitedUser.id } },
    });
    if (existingMembership) return jsonError("This user is already a member.", 409);

    const member = await prisma.organizationMember.create({
      data: {
        organizationId: params.id,
        userId: invitedUser.id,
        role: body.role as RoleKey,
        joinedAt: new Date(),
      },
      include: { user: { select: { id: true, email: true, name: true } } },
    });

    await logAuditEvent({
      event: "ORG_MEMBER_INVITED",
      actorId: session.userId,
      actorLabel: session.user.email,
      organizationId: params.id,
      metadata: { invitedUserId: invitedUser.id, role: body.role },
    });

    return NextResponse.json({ member }, { status: 201 });
  } catch (error) {
    return handleApiError(error);
  }
}
