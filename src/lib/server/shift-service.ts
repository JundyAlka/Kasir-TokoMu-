import { and, eq } from "drizzle-orm";
import { formatInTimeZone } from "date-fns-tz";
import { db, pool } from "@/db/client";
import { shiftSessions, shifts } from "@/db/schema";
import { notFoundError } from "@/lib/server/route-error";
import { createScopedQuery } from "@/lib/server/scoped-query";
import { JAKARTA_TIME_ZONE } from "@/lib/server/timezone";

export type ShiftDraft = {
  name: string;
  startTime: string;
  endTime: string;
  assignedUserId?: string | null;
};

export type CashBalances = {
  cash: number;
  coins: number;
  savings: number;
  openedAt?: string;
  closedAt?: string;
  lastShiftName?: string | null;
  lastClosedAt?: string | null;
  lastCashierName?: string | null;
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
  openingCash: number;
  openingCoins: number;
  openingSavings: number;
  openingTotal: number;
  closingCash: number | null;
  closingCoins: number | null;
  closingSavings: number | null;
  closingTotal: number | null;
  expectedCash: number | null;
  expectedClosing: number | null;
  difference: number | null;
  variance: number | null;
  varianceNote: string | null;
  status: "open" | "closed";
  shiftStartTime?: string;
  shiftEndTime?: string;
};

export type RecordedByResolution = {
  userId: string;
  name: string;
  shiftSessionId: string | null;
};

export type ShiftCashMovement = {
  cashSales: number;
  creditSales: number;
  debtRepayments: number;
  cashExpenses: number;
  cashIn: number;
};

type ShiftSessionRow = Omit<ShiftSessionSummary, "shiftName" | "cashierName">;

function createId(prefix: string) {
  return `${prefix}_${crypto.randomUUID().slice(0, 10)}`;
}

function nowIso() {
  return new Date().toISOString();
}

function numberValue(value: number | string | null | undefined) {
  return Number(value ?? 0);
}

function parseBalances(value: CashBalances | number | null | undefined): CashBalances {
  if (typeof value === "number") return { cash: value, coins: 0, savings: 0 };
  return {
    cash: value?.cash ?? 0,
    coins: value?.coins ?? 0,
    savings: value?.savings ?? 0,
    openedAt: value?.openedAt,
    closedAt: value?.closedAt,
  };
}

function assertNonNegative(values: { cash: number; coins: number; savings: number }) {
  if (![values.cash, values.coins, values.savings].every((value) => Number.isInteger(value) && value >= 0)) {
    throw new Error("Nilai kas shift harus bilangan bulat nol atau lebih.");
  }
}

function total(values: { cash: number; coins: number; savings: number }) {
  return values.cash + values.coins + values.savings;
}

function parseTime(value: string) {
  const match = /^([01]\d|2[0-3]):([0-5]\d)$/.exec(value);
  if (!match) throw new Error("Format jam shift harus HH:mm.");
  return Number(match[1]) * 60 + Number(match[2]);
}

function isTimeWithinShift(nowMinutes: number, startTime: string, endTime: string) {
  const start = parseTime(startTime);
  const end = parseTime(endTime);
  if (start === end) return true;
  return start < end ? nowMinutes >= start && nowMinutes < end : nowMinutes >= start || nowMinutes < end;
}

function jakartaMinutes(date: Date) {
  return parseTime(formatInTimeZone(date, JAKARTA_TIME_ZONE, "HH:mm"));
}

function scopedWorkspace(workspaceOwnerId: string) {
  // Keep the workspace identity rooted in the shared scoped-query helper.
  return createScopedQuery(workspaceOwnerId).workspaceOwnerId;
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

function mapSession(row: {
  id: string;
  workspaceOwnerId: string;
  shiftId: string;
  cashierUserId: string;
  startedAt: string;
  endedAt: string | null;
  openingCash: number | string | null;
  openingCoins: number | string | null;
  openingSavings: number | string | null;
  closingCash: number | string | null;
  closingCoins: number | string | null;
  closingSavings: number | string | null;
  expectedCash: number | string | null;
  expectedClosing: number | string | null;
  difference: number | string | null;
  variance: number | string | null;
  varianceNote: string | null;
  status: string;
  shiftName: string;
  cashierName: string;
  shiftStartTime?: string | null;
  shiftEndTime?: string | null;
}): ShiftSessionSummary {
  const openingCash = numberValue(row.openingCash);
  const openingCoins = numberValue(row.openingCoins);
  const openingSavings = numberValue(row.openingSavings);
  const closingCash = row.closingCash == null ? null : numberValue(row.closingCash);
  const closingCoins = row.closingCoins == null ? null : numberValue(row.closingCoins);
  const closingSavings = row.closingSavings == null ? null : numberValue(row.closingSavings);
  return {
    id: row.id,
    workspaceOwnerId: row.workspaceOwnerId,
    shiftId: row.shiftId,
    shiftName: row.shiftName,
    cashierUserId: row.cashierUserId,
    cashierName: row.cashierName,
    startedAt: row.startedAt,
    endedAt: row.endedAt,
    openingCash,
    openingCoins,
    openingSavings,
    openingTotal: openingCash + openingCoins + openingSavings,
    closingCash,
    closingCoins,
    closingSavings,
    closingTotal: closingCash == null ? null : closingCash + (closingCoins ?? 0) + (closingSavings ?? 0),
    expectedCash: row.expectedCash == null ? null : numberValue(row.expectedCash),
    expectedClosing: row.expectedClosing == null ? null : numberValue(row.expectedClosing),
    difference: row.difference == null ? null : numberValue(row.difference),
    variance: row.variance == null ? null : numberValue(row.variance),
    varianceNote: row.varianceNote,
    status: row.status === "closed" ? "closed" : "open",
    shiftStartTime: row.shiftStartTime ?? undefined,
    shiftEndTime: row.shiftEndTime ?? undefined,
  };
}

async function sessionById(workspaceOwnerId: string, sessionId: string) {
  const ownerId = scopedWorkspace(workspaceOwnerId);
  const result = await pool.query<{
    id: string; workspaceOwnerId: string; shiftId: string; cashierUserId: string; startedAt: string; endedAt: string | null;
    openingCash: number | string | null; openingCoins: number | string | null; openingSavings: number | string | null;
    closingCash: number | string | null; closingCoins: number | string | null; closingSavings: number | string | null;
    expectedCash: number | string | null; expectedClosing: number | string | null; difference: number | string | null;
    variance: number | string | null; varianceNote: string | null; status: string; shiftName: string; cashierName: string;
    shiftStartTime?: string | null; shiftEndTime?: string | null;
  }>(
    `select ss.id, ss.workspace_owner_id as "workspaceOwnerId", ss.shift_id as "shiftId", ss.cashier_user_id as "cashierUserId",
      ss.started_at as "startedAt", ss.ended_at as "endedAt", ss.opening_cash as "openingCash", ss.opening_coins as "openingCoins",
      ss.opening_savings as "openingSavings", ss.closing_cash as "closingCash", ss.closing_coins as "closingCoins",
      ss.closing_savings as "closingSavings", ss.expected_cash as "expectedCash", ss.expected_closing as "expectedClosing",
      ss.difference as "difference", ss.variance as "variance", ss.variance_note as "varianceNote", ss.status as "status",
      coalesce(s.name, 'Shift') as "shiftName",
      s.start_time as "shiftStartTime", s.end_time as "shiftEndTime",
      coalesce(u.name, u.email, 'Kasir') as "cashierName"
     from shift_sessions ss left join shifts s on s.id = ss.shift_id
     left join "user" u on u.id = ss.cashier_user_id
     where ss.id = $1 and ss.workspace_owner_id = $2 limit 1`,
    [sessionId, ownerId]
  );
  return result.rows[0] ? mapSession(result.rows[0]) : null;
}

export async function listShiftSettings(workspaceOwnerId: string) {
  const ownerId = scopedWorkspace(workspaceOwnerId);
  const [shiftRows, userResult] = await Promise.all([
    db.select().from(shifts).where(eq(shifts.workspaceOwnerId, ownerId)).orderBy(shifts.startTime, shifts.name),
    pool.query<{ id: string; name: string; email: string; role: string; isActive: boolean }>(
      `select u.id, u.name, u.email, ur.role, (ur.is_active = 1) as "isActive"
       from user_roles ur join "user" u on u.id = ur.user_id
       where ur.workspace_owner_id = $1 and ur.is_active = 1
       order by case ur.role when 'kasir' then 0 when 'pengelola_keuangan' then 1 else 2 end, u.name asc`,
      [ownerId]
    ),
  ]);
  return { shifts: shiftRows.map(mapShift), users: userResult.rows };
}

export async function getActiveShift(workspaceOwnerId: string, now: Date = new Date()) {
  const ownerId = scopedWorkspace(workspaceOwnerId);
  const shiftRows = await db.select().from(shifts).where(and(eq(shifts.workspaceOwnerId, ownerId), eq(shifts.isActive, 1))).orderBy(shifts.startTime);
  if (shiftRows.length === 0) {
    return createShift(ownerId, {
      name: "Shift Utama",
      startTime: "00:00",
      endTime: "23:59",
    });
  }
  const active = shiftRows.find((shift) => isTimeWithinShift(jakartaMinutes(now), shift.startTime, shift.endTime));
  return active ? mapShift(active) : mapShift(shiftRows[0]);
}

export async function createShift(workspaceOwnerId: string, draft: ShiftDraft) {
  const ownerId = scopedWorkspace(workspaceOwnerId);
  parseTime(draft.startTime);
  parseTime(draft.endTime);
  const [shift] = await db.insert(shifts).values({
    id: createId("shift"), workspaceOwnerId: ownerId, name: draft.name.trim(), startTime: draft.startTime,
    endTime: draft.endTime, assignedUserId: draft.assignedUserId || null, isActive: 1, createdAt: nowIso(),
  }).returning();
  return mapShift(shift);
}

export async function updateShift(workspaceOwnerId: string, shiftId: string, draft: Partial<ShiftDraft> & { isActive?: boolean }) {
  const ownerId = scopedWorkspace(workspaceOwnerId);
  if (draft.startTime) parseTime(draft.startTime);
  if (draft.endTime) parseTime(draft.endTime);
  const [existing] = await db.select().from(shifts).where(and(eq(shifts.id, shiftId), eq(shifts.workspaceOwnerId, ownerId))).limit(1);
  if (!existing) throw notFoundError();
  const [updated] = await db.update(shifts).set({
    name: draft.name?.trim() ?? existing.name, startTime: draft.startTime ?? existing.startTime, endTime: draft.endTime ?? existing.endTime,
    assignedUserId: draft.assignedUserId === undefined ? existing.assignedUserId : draft.assignedUserId || null,
    isActive: draft.isActive === undefined ? existing.isActive : draft.isActive ? 1 : 0,
  }).where(and(eq(shifts.id, shiftId), eq(shifts.workspaceOwnerId, ownerId))).returning();
  return mapShift(updated);
}

export async function deleteShift(workspaceOwnerId: string, shiftId: string) {
  const ownerId = scopedWorkspace(workspaceOwnerId);
  const [updated] = await db.update(shifts).set({ isActive: 0 }).where(and(eq(shifts.id, shiftId), eq(shifts.workspaceOwnerId, ownerId))).returning();
  if (!updated) throw notFoundError();
  return mapShift(updated);
}

export async function getOpenSession(workspaceOwnerId: string): Promise<ShiftSessionSummary | null> {
  const ownerId = scopedWorkspace(workspaceOwnerId);
  const result = await pool.query<{ id: string }>(
    `select id from shift_sessions where workspace_owner_id = $1 and status = 'open' order by opened_at desc nulls last, started_at desc limit 1`,
    [ownerId]
  );
  return result.rows[0] ? sessionById(ownerId, result.rows[0].id) : null;
}

export async function openShift(
  workspaceOwnerId: string,
  cashierUserId: string,
  shiftId?: string | null,
  opening?: CashBalances | number | null,
  openingOverrideReason?: string | null
) {
  const ownerId = scopedWorkspace(workspaceOwnerId);
  let targetShiftId = shiftId;
  if (!targetShiftId) {
    const active = await getActiveShift(ownerId);
    if (!active) throw notFoundError();
    targetShiftId = active.id;
  }
  const [shift] = await db.select().from(shifts).where(and(eq(shifts.id, targetShiftId), eq(shifts.workspaceOwnerId, ownerId), eq(shifts.isActive, 1))).limit(1);
  if (!shift) throw notFoundError();
  if (await getOpenSession(ownerId)) throw new Error("Masih ada shift yang masih terbuka untuk workspace ini.");

  const priorResult = await pool.query<{ cash: number | string | null; coins: number | string | null; savings: number | string | null }>(
    `select closing_cash as cash, closing_coins as coins, closing_savings as savings
     from shift_sessions where workspace_owner_id = $1 and status = 'closed'
     order by closed_at desc nulls last, ended_at desc limit 1`,
    [ownerId]
  );
  const prior = priorResult.rows[0];
  const priorBalances = prior ? { cash: numberValue(prior.cash), coins: numberValue(prior.coins), savings: numberValue(prior.savings) } : null;
  const balances: CashBalances = opening == null && priorBalances ? priorBalances : parseBalances(opening);
  assertNonNegative(balances);
  const expectedOpening = priorBalances ? total(priorBalances) : null;
  const openingDifference = opening != null && expectedOpening != null && total(balances) !== expectedOpening;
  const openingNote = [
    openingDifference ? `Kas awal berbeda dari penutupan shift sebelumnya: diisi ${total(balances)}, sebelumnya ${expectedOpening}.` : null,
    openingOverrideReason?.trim() || null,
  ].filter(Boolean).join("\n") || null;
  const openedAt = balances.openedAt || nowIso();
  const [session] = await db.insert(shiftSessions).values({
    id: createId("ssn"), workspaceOwnerId: ownerId, shiftId: targetShiftId, cashierUserId,
    startedAt: openedAt, endedAt: null, openingCash: balances.cash, openingCoins: balances.coins, openingSavings: balances.savings,
    closingCash: null, closingCoins: null, closingSavings: null, expectedCash: null, expectedClosing: null,
    difference: null, variance: null, varianceNote: openingNote, status: "open", openedAt, closedAt: null,
    openedByUserId: cashierUserId, closedByUserId: null,
  }).returning();
  const created = await sessionById(ownerId, session.id);
  if (!created) throw new Error("Gagal membuka shift.");
  return created;
}

export async function closeShift(
  workspaceOwnerId: string,
  sessionId: string,
  closing: CashBalances | number,
  varianceNote?: string | null,
  closedByUserId?: string
) {
  const ownerId = scopedWorkspace(workspaceOwnerId);
  const session = await sessionById(ownerId, sessionId);
  if (!session) throw notFoundError();
  if (session.status !== "open") throw new Error("Sesi shift sudah ditutup.");
  const balances = parseBalances(closing);
  assertNonNegative(balances);
  const closedAt = balances.closedAt || nowIso();

  const movement = await getShiftCashMovement(ownerId, sessionId, session.startedAt, closedAt);
  const expectedClosing = session.openingTotal + movement.cashIn - movement.cashExpenses;
  const actualClosing = total(balances);
  const variance = actualClosing - expectedClosing;
  const normalizedNote = varianceNote?.trim() || "";
  if (variance !== 0 && !normalizedNote) throw new Error("Catatan selisih wajib diisi ketika kas tidak sesuai.");
  const combinedNote = [session.varianceNote, normalizedNote].filter(Boolean).join("\n") || null;

  await db.update(shiftSessions).set({
    endedAt: closedAt, closingCash: balances.cash, closingCoins: balances.coins, closingSavings: balances.savings,
    expectedCash: expectedClosing, expectedClosing, difference: variance, variance, varianceNote: combinedNote,
    status: "closed", closedAt, closedByUserId: closedByUserId || session.cashierUserId,
  }).where(and(eq(shiftSessions.id, sessionId), eq(shiftSessions.workspaceOwnerId, ownerId), eq(shiftSessions.status, "open")));
  const closed = await sessionById(ownerId, sessionId);
  if (!closed) throw new Error("Gagal menutup shift.");
  return closed;
}

export async function getShiftCashMovement(
  workspaceOwnerId: string,
  sessionId: string,
  _startedAt?: string,
  _endedAt: string = nowIso()
): Promise<ShiftCashMovement> {
  const ownerId = scopedWorkspace(workspaceOwnerId);
  if (!(await sessionById(ownerId, sessionId))) throw notFoundError();
  const [cashSales, creditSales, debtRepayments, cashExpenses] = await Promise.all([
    pool.query<{ total: number | string }>(
      `select coalesce(sum(total), 0) as total from transactions
       where user_id = $1 and shift_session_id = $2 and payment_method <> 'Kasbon'`,
      [ownerId, sessionId]
    ),
    pool.query<{ total: number | string }>(
      `select coalesce(sum(total), 0) as total from transactions
       where user_id = $1 and shift_session_id = $2 and payment_method = 'Kasbon'`,
      [ownerId, sessionId]
    ),
    pool.query<{ total: number | string }>(
      `select coalesce(sum(dp.amount), 0) as total from debt_payments dp
       join debts d on d.id = dp.debt_id and d.user_id = $1
       where dp.shift_session_id = $2`,
       [ownerId, sessionId]
    ),
    pool.query<{ total: number | string }>(
      `select coalesce(sum(amount), 0) as total from expenses
       where user_id = $1 and shift_session_id = $2`,
      [ownerId, sessionId]
    ),
  ]);
  const cashSalesTotal = numberValue(cashSales.rows[0]?.total);
  const debtRepaymentTotal = numberValue(debtRepayments.rows[0]?.total);
  return {
    cashSales: cashSalesTotal,
    creditSales: numberValue(creditSales.rows[0]?.total),
    debtRepayments: debtRepaymentTotal,
    cashExpenses: numberValue(cashExpenses.rows[0]?.total),
    cashIn: cashSalesTotal + debtRepaymentTotal,
  };
}

export async function getShiftSummary(workspaceOwnerId: string, shiftId: string) {
  const ownerId = scopedWorkspace(workspaceOwnerId);
  return sessionById(ownerId, shiftId);
}

export async function listShifts(
  workspaceOwnerId: string,
  range: { start: string; end: string },
  cashierUserId?: string
) {
  const ownerId = scopedWorkspace(workspaceOwnerId);
  const result = await pool.query<{ id: string }>(
    `select ss.id from shift_sessions ss
     left join shifts s on s.id = ss.shift_id
     where ss.workspace_owner_id = $1 and coalesce(ss.opened_at, ss.started_at) >= $2::timestamptz and coalesce(ss.opened_at, ss.started_at) < $3::timestamptz
       and ($4::text is null or ss.cashier_user_id = $4 or s.name like 'Impor %' or ss.variance_note like '%impor%')
      order by coalesce(ss.opened_at, ss.started_at) desc, ss.started_at desc`,
    [ownerId, range.start, range.end, cashierUserId ?? null]
  );
  return (await Promise.all(result.rows.map((row) => sessionById(ownerId, row.id)))).filter(
    (session): session is ShiftSessionSummary => session !== null
  );
}

export async function updateShiftSession(
  workspaceOwnerId: string,
  sessionId: string,
  data: {
    status?: "open" | "closed";
    openingCash?: number | null;
    openingCoins?: number | null;
    openingSavings?: number | null;
    closingCash?: number | null;
    closingCoins?: number | null;
    closingSavings?: number | null;
    variance?: number | null;
    varianceNote?: string | null;
    action?: "close" | "update";
  },
  actorUserId?: string
) {
  const ownerId = scopedWorkspace(workspaceOwnerId);
  const session = await sessionById(ownerId, sessionId);
  if (!session) throw notFoundError();

  const now = nowIso();

  if (data.action === "close" || (data.status === "closed" && session.status === "open")) {
    const balances = {
      cash: data.closingCash ?? session.closingCash ?? 0,
      coins: data.closingCoins ?? session.closingCoins ?? 0,
      savings: data.closingSavings ?? session.closingSavings ?? 0,
    };
    const movement = await getShiftCashMovement(ownerId, sessionId, session.startedAt, now);
    const expectedClosing = session.openingTotal + movement.cashIn - movement.cashExpenses;
    const actualClosing = balances.cash + balances.coins + balances.savings;
    const variance = data.variance ?? (actualClosing - expectedClosing);
    const note = data.varianceNote ?? session.varianceNote ?? (variance !== 0 ? "Ditutup manual oleh pimpinan." : "Ditutup oleh pimpinan.");

    await pool.query(
      `update shift_sessions set
        status = 'closed',
        ended_at = coalesce(ended_at, $3),
        closed_at = coalesce(closed_at, $3),
        closing_cash = $4,
        closing_coins = $5,
        closing_savings = $6,
        expected_cash = $7,
        expected_closing = $8,
        difference = $9,
        variance = $10,
        variance_note = $11,
        closed_by_user_id = coalesce(closed_by_user_id, $12)
       where id = $1 and workspace_owner_id = $2`,
      [
        sessionId,
        ownerId,
        now,
        balances.cash,
        balances.coins,
        balances.savings,
        expectedClosing,
        expectedClosing,
        variance,
        variance,
        note,
        actorUserId || session.cashierUserId,
      ]
    );
  } else {
    const openingCash = data.openingCash !== undefined ? data.openingCash : session.openingCash;
    const openingCoins = data.openingCoins !== undefined ? data.openingCoins : session.openingCoins;
    const openingSavings = data.openingSavings !== undefined ? data.openingSavings : session.openingSavings;
    const closingCash = data.closingCash !== undefined ? data.closingCash : session.closingCash;
    const closingCoins = data.closingCoins !== undefined ? data.closingCoins : session.closingCoins;
    const closingSavings = data.closingSavings !== undefined ? data.closingSavings : session.closingSavings;
    const status = data.status || session.status;
    const variance = data.variance !== undefined ? data.variance : session.variance;
    const varianceNote = data.varianceNote !== undefined ? data.varianceNote : session.varianceNote;

    const now = new Date().toISOString();
    await pool.query(
      `update shift_sessions set
        status = $3,
        ended_at = case when $3 = 'open' then null else coalesce(ended_at, $12) end,
        closed_at = case when $3 = 'open' then null else coalesce(closed_at, $12) end,
        closed_by_user_id = case when $3 = 'open' then null else closed_by_user_id end,
        opening_cash = $4,
        opening_coins = $5,
        opening_savings = $6,
        closing_cash = $7,
        closing_coins = $8,
        closing_savings = $9,
        variance = $10,
        difference = $10,
        variance_note = $11
       where id = $1 and workspace_owner_id = $2`,
      [
        sessionId,
        ownerId,
        status,
        openingCash,
        openingCoins,
        openingSavings,
        closingCash,
        closingCoins,
        closingSavings,
        variance,
        varianceNote,
        now,
      ]
    );
  }

  const updated = await sessionById(ownerId, sessionId);
  if (!updated) throw new Error("Gagal memperbarui data shift.");
  return updated;
}

export async function deleteShiftSession(workspaceOwnerId: string, sessionId: string) {
  const ownerId = scopedWorkspace(workspaceOwnerId);
  await pool.query(`update transactions set shift_session_id = null where shift_session_id = $1 and user_id = $2`, [sessionId, ownerId]);
  await pool.query(`update expenses set shift_session_id = null where shift_session_id = $1 and user_id = $2`, [sessionId, ownerId]);
  await pool.query(`update debt_payments set shift_session_id = null where shift_session_id = $1`, [sessionId]);
  const res = await pool.query(`delete from shift_sessions where id = $1 and workspace_owner_id = $2 returning id`, [sessionId, ownerId]);
  if (!res.rows[0]) throw notFoundError();
  return { id: sessionId };
}

export async function restoreShiftSession(workspaceOwnerId: string, sessionData: {
  id: string;
  shiftId?: string;
  cashierUserId?: string;
  startedAt: string;
  endedAt?: string | null;
  openingCash?: number | null;
  openingCoins?: number | null;
  openingSavings?: number | null;
  closingCash?: number | null;
  closingCoins?: number | null;
  closingSavings?: number | null;
  expectedClosing?: number | null;
  variance?: number | null;
  varianceNote?: string | null;
  status: string;
}) {
  const ownerId = scopedWorkspace(workspaceOwnerId);
  let shiftId = sessionData.shiftId;
  if (!shiftId) {
    const shiftRes = await pool.query<{ id: string }>(`select id from shifts where workspace_owner_id = $1 limit 1`, [ownerId]);
    shiftId = shiftRes.rows[0]?.id;
    if (!shiftId) {
      const newShiftRes = await pool.query<{ id: string }>(
        `insert into shifts (id, workspace_owner_id, name, start_time, end_time, created_at)
         values ($1, $2, 'Shift Umum', '07:00', '21:00', now()) returning id`,
        [createId("shift"), ownerId]
      );
      shiftId = newShiftRes.rows[0]?.id;
    }
  }
  const cashierUserId = sessionData.cashierUserId || ownerId;

  await db
    .insert(shiftSessions)
    .values({
      id: sessionData.id,
      workspaceOwnerId: ownerId,
      shiftId: shiftId!,
      cashierUserId,
      startedAt: sessionData.startedAt,
      endedAt: sessionData.endedAt || null,
      openingCash: sessionData.openingCash ?? 0,
      openingCoins: sessionData.openingCoins ?? 0,
      openingSavings: sessionData.openingSavings ?? 0,
      closingCash: sessionData.closingCash ?? null,
      closingCoins: sessionData.closingCoins ?? null,
      closingSavings: sessionData.closingSavings ?? null,
      expectedCash: sessionData.expectedClosing ?? null,
      expectedClosing: sessionData.expectedClosing ?? null,
      variance: sessionData.variance ?? null,
      difference: sessionData.variance ?? null,
      varianceNote: sessionData.varianceNote ?? null,
      status: sessionData.status || "open",
      openedAt: sessionData.startedAt,
      closedAt: sessionData.status === "closed" ? (sessionData.endedAt || sessionData.startedAt) : null,
      openedByUserId: cashierUserId,
      closedByUserId: sessionData.status === "closed" ? cashierUserId : null,
      needsReview: false,
    })
    .onConflictDoUpdate({
      target: shiftSessions.id,
      set: {
        status: sessionData.status || "open",
        openingCash: sessionData.openingCash ?? 0,
        openingCoins: sessionData.openingCoins ?? 0,
        openingSavings: sessionData.openingSavings ?? 0,
        closingCash: sessionData.closingCash ?? null,
        closingCoins: sessionData.closingCoins ?? null,
        closingSavings: sessionData.closingSavings ?? null,
        expectedCash: sessionData.expectedClosing ?? null,
        expectedClosing: sessionData.expectedClosing ?? null,
        variance: sessionData.variance ?? null,
        difference: sessionData.variance ?? null,
        varianceNote: sessionData.varianceNote ?? null,
        endedAt: sessionData.status === "closed" ? (sessionData.endedAt || sessionData.startedAt) : null,
        closedAt: sessionData.status === "closed" ? (sessionData.endedAt || sessionData.startedAt) : null,
        closedByUserId: sessionData.status === "closed" ? cashierUserId : null,
      },
    });

  return await sessionById(ownerId, sessionData.id);
}

export async function getSuggestedOpeningBalances(workspaceOwnerId: string): Promise<CashBalances> {
  const ownerId = scopedWorkspace(workspaceOwnerId);
  const result = await pool.query<{ id: string }>(
    `select id from shift_sessions where workspace_owner_id = $1 and status = 'closed'
     order by coalesce(closed_at, ended_at) desc nulls last, started_at desc limit 1`,
    [ownerId]
  );
  const lastId = result.rows[0]?.id;
  if (!lastId) return { cash: 0, coins: 0, savings: 0 };
  const lastSession = await sessionById(ownerId, lastId);
  if (!lastSession) return { cash: 0, coins: 0, savings: 0 };
  return {
    cash: lastSession.closingCash ?? 0,
    coins: lastSession.closingCoins ?? 0,
    savings: lastSession.closingSavings ?? 0,
    lastShiftName: lastSession.shiftName,
    lastClosedAt: lastSession.endedAt,
    lastCashierName: lastSession.cashierName,
  };
}

export async function resolveRecordedBy(workspaceOwnerId: string, currentUserId: string): Promise<RecordedByResolution> {
  const ownerId = scopedWorkspace(workspaceOwnerId);
  const openSession = await getOpenSession(ownerId);
  if (openSession) return { userId: openSession.cashierUserId, name: openSession.cashierName, shiftSessionId: openSession.id };
  const activeShift = await getActiveShift(ownerId);
  if (activeShift?.assignedUserId) return { userId: activeShift.assignedUserId, name: await getUserName(activeShift.assignedUserId), shiftSessionId: null };
  return { userId: currentUserId, name: await getUserName(currentUserId), shiftSessionId: null };
}
