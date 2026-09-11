import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getCurrentSession } from "@/lib/auth/session";
import { createOrganizationSchema } from "@/lib/validation";
import { UnauthorizedError } from "@/lib/auth/rbac";
import { logAuditEvent } from "@/lib/auth/audit";
import { handleApiError, jsonError } from "@/lib/api-response";
import { RoleKey } from "@prisma/client";

export async function GET() {
  try {
    const session = await getCurrentSession();
    if (!session) throw new UnauthorizedError();

    const memberships = await prisma.organizationMember.findMany({
      where: { userId: session.userId },
      include: {
        organization: { include: { _count: { select: { members: true } } } },
      },
      orderBy: { invitedAt: "asc" },
    });

    return NextResponse.json({
      organizations: memberships.map((m) => ({
        id: m.organization.id,
        name: m.organization.name,
        slug: m.organization.slug,
        role: m.role,
        memberCount: m.organization._count.members,
      })),
    });
  } catch (error) {
    return handleApiError(error);
  }
}

export async function POST(req: NextRequest) {
  try {
    const session = await getCurrentSession();
    if (!session) throw new UnauthorizedError();

    const body = createOrganizationSchema.parse(await req.json());

    const slugTaken = await prisma.organization.findUnique({ where: { slug: body.slug } });
    if (slugTaken) return jsonError("That URL slug is already taken.", 409);

    const org = await prisma.organization.create({
      data: {
        name: body.name,
        slug: body.slug,
        members: { create: { userId: session.userId, role: RoleKey.OWNER, joinedAt: new Date() } },
      },
    });

    await logAuditEvent({
      event: "ORG_CREATED",
      actorId: session.userId,
      actorLabel: session.user.email,
      organizationId: org.id,
    });

    return NextResponse.json({ organization: org }, { status: 201 });
  } catch (error) {
    return handleApiError(error);
  }
}
