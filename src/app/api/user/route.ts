import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getCurrentUser, getCurrentSession, destroyCurrentSession } from "@/lib/auth/session";
import { verifyPassword } from "@/lib/security/password";
import { deleteAccountSchema } from "@/lib/validation";
import { logAuditEvent } from "@/lib/auth/audit";
import { UnauthorizedError } from "@/lib/auth/rbac";
import { handleApiError, jsonError } from "@/lib/api-response";
import { RoleKey } from "@prisma/client";

export async function DELETE(req: NextRequest) {
  try {
    const session = await getCurrentSession();
    if (!session) throw new UnauthorizedError();

    const body = deleteAccountSchema.parse(await req.json());

    // Ochrana proti odchodu jediného Ownera organizace bez náhrady.
    const soleOwnerships = await prisma.organizationMember.findMany({
      where: { userId: session.userId, role: RoleKey.OWNER },
      include: { organization: { select: { name: true } } },
    });
    for (const membership of soleOwnerships) {
      const otherOwners = await prisma.organizationMember.count({
        where: { organizationId: membership.organizationId, role: RoleKey.OWNER, userId: { not: session.userId } },
      });
      if (otherOwners === 0) {
        return jsonError(
          `You're the only Owner of "${membership.organization.name}". Transfer ownership or delete the organization before deleting your account.`,
          409,
        );
      }
    }

    if (session.user.passwordHash) {
      if (!body.password) return jsonError("Password confirmation required.", 400);
      const valid = await verifyPassword(session.user.passwordHash, body.password);
      if (!valid) return jsonError("Incorrect password.", 401);
    }

    await logAuditEvent({ event: "ACCOUNT_DELETED", actorId: session.userId, actorLabel: session.user.email });

    await prisma.user.delete({ where: { id: session.userId } });
    await destroyCurrentSession(); // smaže cookie i (už neexistující) session řádek bezpečně

    return NextResponse.json({ message: "Account deleted." });
  } catch (error) {
    return handleApiError(error);
  }
}

export async function GET() {
  try {
    const user = await getCurrentUser();
    if (!user) throw new UnauthorizedError();

    return NextResponse.json({
      id: user.id,
      email: user.email,
      name: user.name,
      image: user.image,
      emailVerified: user.emailVerified,
      twoFactorEnabled: user.twoFactorEnabled,
      hasPassword: Boolean(user.passwordHash),
      createdAt: user.createdAt,
    });
  } catch (error) {
    return handleApiError(error);
  }
}
