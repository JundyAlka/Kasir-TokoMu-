import { and, eq } from "drizzle-orm";
import { formatInTimeZone } from "date-fns-tz";
import { db, pool } from "@/db/client";
import { shiftSessions, shifts } from "@/db/schema";
import { JAKARTA_TIME_ZONE } from "@/lib/server/timezone";

export type ShiftDraft = {
  name: string;
  startTime: string;
  endTime: string;
  assignedUserId?: string | null;
};

export type ShiftSessionSummary = {
  id: string;
  workspaceOwnerId: string;
  shiftId: string;
  shiftName: string;
  cashierUserId: string;
  cashierName: string;
  startedAt: string;
  endedAt: string | null;
  openingCash: number | null;
  closingCash: number | null;
  expectedCash: number | null;
  difference: number | null;
};

export type RecordedByResolution = {
  userId: string;
  name: string;
  shiftSessionId: string | null;
};

function createId(prefix: string) {
  return `${prefix}_${crypto.randomUUID().slice(0, 10)}`;
}

function nowIso() {
  return new Date().toISOString();
}

function parseTime(value: string) {
  const match = /^([01]\d|2[0-3]):([0-5]\d)$/.exec(value);
  if (!match) {
    throw new Error("Format jam shift harus HH:mm.");
  }

  return Number(match[1]) * 60 + Number(match[2]);
}

function isTimeWithinShift(nowMinutes: number, startTime: string, endTime: string) {
  const start = parseTime(startTime);
  const end = parseTime(endTime);

  if (start === end) {
    return true;
  }

  if (start < end) {
    return nowMinutes >= start && nowMinutes < end;
  }

  return nowMinutes >= start || nowMinutes < end;
}

function jakartaMinutes(date: Date) {
  const value = formatInTimeZone(date, JAKARTA_TIME_ZONE, "HH:mm");
  return parseTime(value);
}

async function getUserName(userId: string) {
  const result = await pool.query<{ name: string | null; email: string | null }>(
    `select name, email from "user" where id = $1 limit 1`,
    [userId]
  );
  return result.rows[0]?.name || result.rows[0]?.email || "Kasir";
}

function mapShift(row: typeof shifts.$inferSelect) {
  return {
    id: row.id,
    workspaceOwnerId: row.workspaceOwnerId,
    name: row.name,
    startTime: row.startTime,
    endTime: row.endTime,
    assignedUserId: row.assignedUserId,
    isActive: row.isActive === 1,
    createdAt: row.createdAt,
  };
}

export async function listShiftSettings(workspaceOwnerId: string) {
  const [shiftRows, userResult] = await Promise.all([
    db
      .select()
      .from(shifts)
      .where(eq(shifts.workspaceOwnerId, workspaceOwnerId))
      .orderBy(shifts.startTime, shifts.name),
    pool.query<{
      id: string;
      name: string;
      email: string;
      role: string;
      isActive: boolean;
    }>(
      `
        select
          u.id,
          u.name,
          u.email,
          ur.role,
          (ur.is_active = 1) as "isActive"
        from user_roles ur
        join "user" u on u.id = ur.user_id
        where ur.workspace_owner_id = $1
          and ur.is_active = 1
        order by
          case ur.role when 'kasir' then 0 when 'pengelola_keuangan' then 1 else 2 end,
          u.name asc
      `,
      [workspaceOwnerId]
    ),
  ]);

  return {
    shifts: shiftRows.map(mapShift),
    users: userResult.rows,
  };
}

export async function getActiveShift(workspaceOwnerId: string, now: Date = new Date()) {
  const shiftRows = await db
    .select()
    .from(shifts)
    .where(and(eq(shifts.workspaceOwnerId, workspaceOwnerId), eq(shifts.isActive, 1)))
    .orderBy(shifts.startTime);
  const current = jakartaMinutes(now);
  const active = shiftRows.find((shift) => isTimeWithinShift(current, shift.startTime, shift.endTime));

  return active ? mapShift(active) : null;
}

export async function createShift(workspaceOwnerId: string, draft: ShiftDraft) {
  parseTime(draft.startTime);
  parseTime(draft.endTime);
  const [shift] = await db
    .insert(shifts)
    .values({
      id: createId("shift"),
      workspaceOwnerId,
      name: draft.name.trim(),
      startTime: draft.startTime,
      endTime: draft.endTime,
      assignedUserId: draft.assignedUserId || null,
      isActive: 1,
      createdAt: nowIso(),
    })
    .returning();

  return mapShift(shift);
}

export async function updateShift(workspaceOwnerId: string, shiftId: string, draft: Partial<ShiftDraft> & { isActive?: boolean }) {
  if (draft.startTime) {
    parseTime(draft.startTime);
  }
  if (draft.endTime) {
    parseTime(draft.endTime);
  }

  const [existing] = await db
    .select()
    .from(shifts)
    .where(and(eq(shifts.id, shiftId), eq(shifts.workspaceOwnerId, workspaceOwnerId)))
    .limit(1);

  if (!existing) {
    throw new Error("Shift tidak ditemukan.");
  }

  const [updated] = await db
    .update(shifts)
    .set({
      name: draft.name?.trim() ?? existing.name,
      startTime: draft.startTime ?? existing.startTime,
      endTime: draft.endTime ?? existing.endTime,
      assignedUserId: draft.assignedUserId === undefined ? existing.assignedUserId : draft.assignedUserId || null,
      isActive: draft.isActive === undefined ? existing.isActive : draft.isActive ? 1 : 0,
    })
    .where(and(eq(shifts.id, shiftId), eq(shifts.workspaceOwnerId, workspaceOwnerId)))
    .returning();

  return mapShift(updated);
}

export async function deleteShift(workspaceOwnerId: string, shiftId: string) {
  const [updated] = await db
    .update(shifts)
    .set({ isActive: 0 })
    .where(and(eq(shifts.id, shiftId), eq(shifts.workspaceOwnerId, workspaceOwnerId)))
    .returning();

  if (!updated) {
    throw new Error("Shift tidak ditemukan.");
  }

  return mapShift(updated);
}

export async function getOpenSession(workspaceOwnerId: string): Promise<ShiftSessionSummary | null> {
  const result = await pool.query<ShiftSessionSummary>(
    `
      select
        ss.id,
        ss.workspace_owner_id as "workspaceOwnerId",
        ss.shift_id as "shiftId",
        s.name as "shiftName",
        ss.cashier_user_id as "cashierUserId",
        coalesce(u.name, u.email, 'Kasir') as "cashierName",
        ss.started_at as "startedAt",
        ss.ended_at as "endedAt",
        ss.opening_cash as "openingCash",
        ss.closing_cash as "closingCash",
        ss.expected_cash as "expectedCash",
        ss.difference as "difference"
      from shift_sessions ss
      join shifts s on s.id = ss.shift_id
      left join "user" u on u.id = ss.cashier_user_id
      where ss.workspace_owner_id = $1
        and ss.ended_at is null
      order by ss.started_at desc
      limit 1
    `,
    [workspaceOwnerId]
  );

  return result.rows[0] ?? null;
}

export async function openShift(
  workspaceOwnerId: string,
  cashierUserId: string,
  shiftId: string,
  openingCash?: number | null
) {
  const [shift] = await db
    .select()
    .from(shifts)
    .where(and(eq(shifts.id, shiftId), eq(shifts.workspaceOwnerId, workspaceOwnerId), eq(shifts.isActive, 1)))
    .limit(1);

  if (!shift) {
    throw new Error("Shift tidak ditemukan atau tidak aktif.");
  }

  const existing = await getOpenSession(workspaceOwnerId);
  if (existing) {
    return existing;
  }

  const [session] = await db
    .insert(shiftSessions)
    .values({
      id: createId("ssn"),
      workspaceOwnerId,
      shiftId,
      cashierUserId,
      startedAt: nowIso(),
      endedAt: null,
      openingCash: openingCash ?? null,
      closingCash: null,
      expectedCash: null,
      difference: null,
    })
    .returning();

  return {
    id: session.id,
    workspaceOwnerId: session.workspaceOwnerId,
    shiftId: session.shiftId,
    shiftName: shift.name,
    cashierUserId: session.cashierUserId,
    cashierName: await getUserName(session.cashierUserId),
    startedAt: session.startedAt,
    endedAt: session.endedAt,
    openingCash: session.openingCash,
    closingCash: session.closingCash,
    expectedCash: session.expectedCash,
    difference: session.difference,
  };
}

export async function closeShift(workspaceOwnerId: string, sessionId: string, closingCash: number) {
  const [session] = await db
    .select()
    .from(shiftSessions)
    .where(and(eq(shiftSessions.id, sessionId), eq(shiftSessions.workspaceOwnerId, workspaceOwnerId)))
    .limit(1);

  if (!session) {
    throw new Error("Sesi shift tidak ditemukan.");
  }

  if (session.endedAt) {
    throw new Error("Sesi shift sudah ditutup.");
  }

  const cashResult = await pool.query<{ total: number }>(
    `
      select coalesce(sum(total), 0)::int as total
      from transactions
      where user_id = $1
        and shift_session_id = $2
        and payment_method = 'Tunai'
    `,
    [workspaceOwnerId, sessionId]
  );
  const expectedCash = (session.openingCash ?? 0) + (cashResult.rows[0]?.total ?? 0);
  const difference = closingCash - expectedCash;

  const [updated] = await db
    .update(shiftSessions)
    .set({
      endedAt: nowIso(),
      closingCash,
      expectedCash,
      difference,
    })
    .where(and(eq(shiftSessions.id, sessionId), eq(shiftSessions.workspaceOwnerId, workspaceOwnerId)))
    .returning();

  const [shift] = await db.select().from(shifts).where(eq(shifts.id, updated.shiftId)).limit(1);

  return {
    id: updated.id,
    workspaceOwnerId: updated.workspaceOwnerId,
    shiftId: updated.shiftId,
    shiftName: shift?.name ?? "Shift",
    cashierUserId: updated.cashierUserId,
    cashierName: await getUserName(updated.cashierUserId),
    startedAt: updated.startedAt,
    endedAt: updated.endedAt,
    openingCash: updated.openingCash,
    closingCash: updated.closingCash,
    expectedCash: updated.expectedCash,
    difference: updated.difference,
  };
}

export async function resolveRecordedBy(
  workspaceOwnerId: string,
  currentUserId: string
): Promise<RecordedByResolution> {
  const openSession = await getOpenSession(workspaceOwnerId);
  if (openSession) {
    return {
      userId: openSession.cashierUserId,
      name: openSession.cashierName,
      shiftSessionId: openSession.id,
    };
  }

  const activeShift = await getActiveShift(workspaceOwnerId);
  if (activeShift?.assignedUserId) {
    return {
      userId: activeShift.assignedUserId,
      name: await getUserName(activeShift.assignedUserId),
      shiftSessionId: null,
    };
  }

  return {
    userId: currentUserId,
    name: await getUserName(currentUserId),
    shiftSessionId: null,
  };
}
