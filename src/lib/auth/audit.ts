import "server-only";
import { prisma } from "@/lib/prisma";
import { anonymizeIp, getRequestIp, getUserAgent } from "@/lib/security/ip";
import type { AuditEvent, Prisma } from "@prisma/client";

interface LogAuditEventInput {
  event: AuditEvent;
  actorId?: string | null;
  actorLabel: string; // email or "system" / "unknown" for pre-auth events like failed login
  organizationId?: string | null;
  metadata?: Prisma.InputJsonValue;
}

/**
 * Every security-relevant action funnels through this one function so the
 * audit trail can't drift out of sync with what the schema promises
 * (actor, event, IP abstraction, user agent, timestamp — see README).
 */
export async function logAuditEvent(input: LogAuditEventInput): Promise<void> {
  await prisma.auditLog.create({
    data: {
      event: input.event,
      actorId: input.actorId ?? null,
      actorLabel: input.actorLabel,
      organizationId: input.organizationId ?? null,
      ipAddress: anonymizeIp(getRequestIp()),
      userAgent: getUserAgent(),
      metadata: input.metadata,
    },
  });
}
