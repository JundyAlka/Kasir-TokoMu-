import { and, count, desc, eq, gte, ilike, lte, or, sql } from "drizzle-orm";
import { db } from "@/db/client";
import { auditLogs } from "@/db/schema";
import type { AuditCategory } from "@/lib/audit-labels";

export type AuditContext = {
  workspaceOwnerId: string;
  actorUserId: string;
};

export type AuditEventInput = {
  eventType: string;
  entityType: string;
  entityId?: string | null;
  category?: AuditCategory;
  before?: unknown;
  after?: unknown;
  payload?: unknown;
};

export type AuditListFilters = {
  eventType?: string;
  actorUserId?: string;
  category?: string;
  q?: string;
  start?: string;
  end?: string;
  page?: number;
  pageSize?: number;
};

function createId() {
  return `aud_${crypto.randomUUID().slice(0, 12)}`;
}

/**
 * Log an audit event. Supports both the new object-based signature and the
 * legacy positional arguments for backward compatibility.
 */
export async function logEvent(
  context: AuditContext,
  eventTypeOrInput: string | AuditEventInput,
  entity?: { type: string; id?: string | null },
  payload?: unknown
) {
  let input: AuditEventInput;

  if (typeof eventTypeOrInput === "string") {
    // Legacy call: logEvent(ctx, "EVENT", { type, id }, payload)
    input = {
      eventType: eventTypeOrInput,
      entityType: entity?.type ?? "unknown",
      entityId: entity?.id,
      payload: payload ?? {},
    };
  } else {
    input = eventTypeOrInput;
  }

  const [entry] = await db
    .insert(auditLogs)
    .values({
      id: createId(),
      workspaceOwnerId: context.workspaceOwnerId,
      actorUserId: context.actorUserId,
      eventType: input.eventType,
      entityType: input.entityType,
      entityId: input.entityId ?? null,
      category: input.category ?? "system",
      payload: input.payload ?? {},
      before: input.before ?? null,
      after: input.after ?? null,
      createdAt: new Date().toISOString(),
    })
    .returning();

  return entry;
}

function buildWhere(workspaceOwnerId: string, filters: AuditListFilters) {
  const conditions = [eq(auditLogs.workspaceOwnerId, workspaceOwnerId)];

  if (filters.eventType) {
    conditions.push(eq(auditLogs.eventType, filters.eventType));
  }

  if (filters.actorUserId) {
    conditions.push(eq(auditLogs.actorUserId, filters.actorUserId));
  }

  if (filters.category) {
    conditions.push(eq(auditLogs.category, filters.category));
  }

  if (filters.start) {
    conditions.push(gte(auditLogs.createdAt, new Date(filters.start).toISOString()));
  }

  if (filters.end) {
    conditions.push(lte(auditLogs.createdAt, new Date(filters.end).toISOString()));
  }

  if (filters.q) {
    const pattern = `%${filters.q}%`;
    conditions.push(
      or(
        ilike(auditLogs.eventType, pattern),
        ilike(auditLogs.entityType, pattern),
        ilike(auditLogs.entityId, pattern)
      )!
    );
  }

  return and(...conditions)!;
}

export async function listAuditLogs(workspaceOwnerId: string, filters: AuditListFilters = {}) {
  const page = Math.max(filters.page ?? 1, 1);
  const pageSize = Math.min(Math.max(filters.pageSize ?? 25, 1), 100);
  const offset = (page - 1) * pageSize;
  const whereClause = buildWhere(workspaceOwnerId, filters);

  const [rows, totalResult] = await Promise.all([
    db
      .select({
        id: auditLogs.id,
        workspaceOwnerId: auditLogs.workspaceOwnerId,
        actorUserId: auditLogs.actorUserId,
        actorName: sql<string | null>`"user"."name"`,
        actorEmail: sql<string | null>`"user"."email"`,
        eventType: auditLogs.eventType,
        entityType: auditLogs.entityType,
        entityId: auditLogs.entityId,
        category: auditLogs.category,
        payload: auditLogs.payload,
        before: auditLogs.before,
        after: auditLogs.after,
        createdAt: auditLogs.createdAt,
      })
      .from(auditLogs)
      .leftJoin(sql`"user"`, sql`"user"."id" = ${auditLogs.actorUserId}`)
      .where(whereClause)
      .orderBy(desc(auditLogs.createdAt))
      .limit(pageSize)
      .offset(offset),
    db
      .select({ total: count() })
      .from(auditLogs)
      .where(whereClause),
  ]);

  return {
    rows,
    total: totalResult[0]?.total ?? 0,
    page,
    pageSize,
  };
}

/**
 * Get distinct event types and actors for the filter dropdowns (facets).
 */
export async function getAuditFacets(workspaceOwnerId: string) {
  const [eventTypes, actors] = await Promise.all([
    db
      .selectDistinct({ eventType: auditLogs.eventType })
      .from(auditLogs)
      .where(eq(auditLogs.workspaceOwnerId, workspaceOwnerId))
      .orderBy(auditLogs.eventType),
    db
      .selectDistinct({
        actorUserId: auditLogs.actorUserId,
        actorName: sql<string | null>`"user"."name"`,
        actorEmail: sql<string | null>`"user"."email"`,
      })
      .from(auditLogs)
      .leftJoin(sql`"user"`, sql`"user"."id" = ${auditLogs.actorUserId}`)
      .where(eq(auditLogs.workspaceOwnerId, workspaceOwnerId))
      .orderBy(sql`"user"."name"`),
  ]);

  return {
    eventTypes: eventTypes.map((r) => r.eventType),
    actors: actors.map((r) => ({
      id: r.actorUserId,
      name: r.actorName,
      email: r.actorEmail,
    })),
  };
}
