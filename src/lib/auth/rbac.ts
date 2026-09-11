import "server-only";
import { prisma } from "@/lib/prisma";
import { RoleKey } from "@prisma/client";

/**
 * Central RBAC permission matrix. Each built-in role maps to an explicit
 * set of permission strings — nothing is inferred from role ordering, so
 * adding a new permission means adding one line here rather than auditing
 * every call site for an implicit "Admin and above" comparison.
 */
export const PERMISSIONS = {
  ORG_MANAGE: "org:manage", // rename org, delete org
  MEMBERS_INVITE: "members:invite",
  MEMBERS_REMOVE: "members:remove",
  MEMBERS_CHANGE_ROLE: "members:change_role",
  API_KEYS_CREATE: "api_keys:create",
  API_KEYS_REVOKE: "api_keys:revoke",
  APPLICATIONS_MANAGE: "applications:manage",
  AUDIT_LOG_VIEW: "audit_log:view",
  BILLING_MANAGE: "billing:manage",
} as const;

export type Permission = (typeof PERMISSIONS)[keyof typeof PERMISSIONS];

const ROLE_PERMISSIONS: Record<RoleKey, Permission[]> = {
  [RoleKey.OWNER]: Object.values(PERMISSIONS),
  [RoleKey.ADMIN]: [
    PERMISSIONS.MEMBERS_INVITE,
    PERMISSIONS.MEMBERS_REMOVE,
    PERMISSIONS.MEMBERS_CHANGE_ROLE,
    PERMISSIONS.API_KEYS_CREATE,
    PERMISSIONS.API_KEYS_REVOKE,
    PERMISSIONS.APPLICATIONS_MANAGE,
    PERMISSIONS.AUDIT_LOG_VIEW,
  ],
  [RoleKey.MEMBER]: [PERMISSIONS.API_KEYS_CREATE, PERMISSIONS.API_KEYS_REVOKE],
  [RoleKey.VIEWER]: [],
};

export function roleHasPermission(role: RoleKey, permission: Permission): boolean {
  // `?? []` satisfies noUncheckedIndexedAccess and is a safe default: an
  // unrecognized role (shouldn't happen — RoleKey is a closed Prisma enum)
  // is treated as having no permissions rather than throwing.
  return (ROLE_PERMISSIONS[role] ?? []).includes(permission);
}

export class ForbiddenError extends Error {
  constructor(message = "You don't have permission to do that.") {
    super(message);
    this.name = "ForbiddenError";
  }
}

export class UnauthorizedError extends Error {
  constructor(message = "Authentication required.") {
    super(message);
    this.name = "UnauthorizedError";
  }
}

/**
 * Authorization middleware for organization-scoped API routes: looks up the
 * caller's membership and throws if they're not a member, or a member
 * without the required permission. Route handlers call this first, then
 * proceed knowing `membership.role` is authorized for the action.
 */
export async function requireOrgPermission(
  userId: string,
  organizationId: string,
  permission: Permission,
) {
  const membership = await prisma.organizationMember.findUnique({
    where: { organizationId_userId: { organizationId, userId } },
  });

  if (!membership) {
    throw new ForbiddenError("You're not a member of this organization.");
  }
  if (!roleHasPermission(membership.role, permission)) {
    throw new ForbiddenError(`Your role (${membership.role}) doesn't include "${permission}".`);
  }
  return membership;
}

/** Lighter check used where any membership (regardless of role) is enough. */
export async function requireOrgMembership(userId: string, organizationId: string) {
  const membership = await prisma.organizationMember.findUnique({
    where: { organizationId_userId: { organizationId, userId } },
  });
  if (!membership) throw new ForbiddenError("You're not a member of this organization.");
  return membership;
}
