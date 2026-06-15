import { and, desc, eq, gte, lte, sql } from "drizzle-orm";
import { db } from "@/db/client";
import { auditLogs } from "@/db/schema";

export type AuditContext = {
  workspaceOwnerId: string;
  actorUserId: string;
};

export type AuditEntity = {
  type: string;
  id?: string | null;
};

export type AuditListFilters = {
  eventType?: string;
  actorUserId?: string;
  start?: string;
  end?: string;
  limit?: number;
};

function createId() {
  return `aud_${crypto.randomUUID().slice(0, 12)}`;
}

export async function logEvent(
  context: AuditContext,
  eventType: string,
  entity: AuditEntity,
  payload: unknown = {}
) {
  const [entry] = await db
    .insert(auditLogs)
    .values({
      id: createId(),
      workspaceOwnerId: context.workspaceOwnerId,
      actorUserId: context.actorUserId,
      eventType,
      entityType: entity.type,
      entityId: entity.id ?? null,
      payload,
      createdAt: new Date().toISOString(),
    })
    .returning();

  return entry;
}

export async function listAuditLogs(workspaceOwnerId: string, filters: AuditListFilters = {}) {
  const where = [eq(auditLogs.workspaceOwnerId, workspaceOwnerId)];

  if (filters.eventType) {
    where.push(eq(auditLogs.eventType, filters.eventType));
  }

  if (filters.actorUserId) {
    where.push(eq(auditLogs.actorUserId, filters.actorUserId));
  }

  if (filters.start) {
    where.push(gte(auditLogs.createdAt, new Date(filters.start).toISOString()));
  }

  if (filters.end) {
    where.push(lte(auditLogs.createdAt, new Date(filters.end).toISOString()));
  }

  return db
    .select({
      id: auditLogs.id,
      workspaceOwnerId: auditLogs.workspaceOwnerId,
      actorUserId: auditLogs.actorUserId,
      actorName: sql<string | null>`"user"."name"`,
      actorEmail: sql<string | null>`"user"."email"`,
      eventType: auditLogs.eventType,
      entityType: auditLogs.entityType,
      entityId: auditLogs.entityId,
      payload: auditLogs.payload,
      createdAt: auditLogs.createdAt,
    })
    .from(auditLogs)
    .leftJoin(sql`"user"`, sql`"user"."id" = ${auditLogs.actorUserId}`)
    .where(and(...where))
    .orderBy(desc(auditLogs.createdAt))
    .limit(Math.min(Math.max(filters.limit ?? 100, 1), 250));
}
