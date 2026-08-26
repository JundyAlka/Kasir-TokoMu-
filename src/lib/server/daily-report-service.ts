import { pool } from "@/db/client";
import { createScopedQuery } from "@/lib/server/scoped-query";
import { getJakartaDayRange } from "@/lib/server/timezone";

export type DailyReportSummary = {
  id: string;
  userId: string;
  reportDate: string;
  openingTotal: number;
  revenue: number;
  cogs: number;
  expenseTotal: number;
  grossProfit: number;
  netProfit: number;
  closingTotal: number;
  transactionCount: number;
  profitDistribution: number;
  status: "draft" | "locked";
  lockedAt: string | null;
  lockedByUserId: string | null;
};

function createId() {
  return `drp_${crypto.randomUUID().slice(0, 10)}`;
}

function nowIso() {
  return new Date().toISOString();
}

function asNumber(value: number | string | null | undefined) {
  return Number(value ?? 0);
}

function getRange(reportDate: string) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(reportDate)) throw new Error("Tanggal laporan tidak valid.");
  return getJakartaDayRange(new Date(`${reportDate}T12:00:00.000Z`));
}

function scopedWorkspace(workspaceOwnerId: string) {
  return createScopedQuery(workspaceOwnerId).workspaceOwnerId;
}

function mapRow(row: Record<string, unknown>): DailyReportSummary {
  return {
    id: String(row.id),
    userId: String(row.userId),
    reportDate: String(row.reportDate),
    openingTotal: asNumber(row.openingTotal as number | string | null),
    revenue: asNumber(row.revenue as number | string | null),
    cogs: asNumber(row.cogs as number | string | null),
    expenseTotal: asNumber(row.expenseTotal as number | string | null),
    grossProfit: asNumber(row.grossProfit as number | string | null),
    netProfit: asNumber(row.netProfit as number | string | null),
    closingTotal: asNumber(row.closingTotal as number | string | null),
    transactionCount: asNumber(row.transactionCount as number | string | null),
    profitDistribution: asNumber(row.profitDistribution as number | string | null),
    status: row.status === "locked" ? "locked" : "draft",
    lockedAt: row.lockedAt ? String(row.lockedAt) : null,
    lockedByUserId: row.lockedByUserId ? String(row.lockedByUserId) : null,
  };
}

/** Build one workspace-scoped report. Any number of shifts (including one) may belong to the day. */
export async function buildDailyReport(workspaceOwnerId: string, reportDate: string): Promise<DailyReportSummary> {
  const ownerId = scopedWorkspace(workspaceOwnerId);
  const range = getRange(reportDate);
  const [openingResult, closingResult, salesResult, cogsResult, expenseResult] = await Promise.all([
    pool.query<{ total: number | string }>(
      `select coalesce(opening_cash, 0) + coalesce(opening_coins, 0) + coalesce(opening_savings, 0) as total
       from shift_sessions
       where workspace_owner_id = $1
         and coalesce(opened_at, started_at) >= $2::timestamptz
         and coalesce(opened_at, started_at) < $3::timestamptz
       order by coalesce(opened_at, started_at) asc limit 1`,
      [ownerId, range.start, range.end]
    ),
    pool.query<{ total: number | string }>(
      `select coalesce(closing_cash, 0) + coalesce(closing_coins, 0) + coalesce(closing_savings, 0) as total
       from shift_sessions
       where workspace_owner_id = $1
         and coalesce(opened_at, started_at) >= $2::timestamptz
         and coalesce(opened_at, started_at) < $3::timestamptz
         and status = 'closed'
       order by coalesce(closed_at, ended_at) desc nulls last limit 1`,
      [ownerId, range.start, range.end]
    ),
    pool.query<{ revenue: number | string; transactionCount: number | string }>(
      `select coalesce(sum(t.total), 0) as revenue, count(*) as "transactionCount"
       from transactions t join shift_sessions ss on ss.id = t.shift_session_id
       where t.user_id = $1 and ss.workspace_owner_id = $1
         and coalesce(ss.opened_at, ss.started_at) >= $2::timestamptz
         and coalesce(ss.opened_at, ss.started_at) < $3::timestamptz`,
      [ownerId, range.start, range.end]
    ),
    pool.query<{ cogs: number | string }>(
      `select coalesce(sum(ti.quantity * ti.cost_price), 0) as cogs
       from transaction_items ti join transactions t on t.id = ti.transaction_id
       join shift_sessions ss on ss.id = t.shift_session_id
       where t.user_id = $1 and ss.workspace_owner_id = $1
         and coalesce(ss.opened_at, ss.started_at) >= $2::timestamptz
         and coalesce(ss.opened_at, ss.started_at) < $3::timestamptz`,
      [ownerId, range.start, range.end]
    ),
    pool.query<{ expenseTotal: number | string; profitDistribution: number | string }>(
      `select
         coalesce(sum(case when e.is_cash_movement = false and e.expense_type <> 'bagi_hasil_investor' then e.amount else 0 end), 0) as "expenseTotal",
         coalesce(sum(case when e.expense_type = 'bagi_hasil_investor' then e.amount else 0 end), 0) as "profitDistribution"
       from expenses e join shift_sessions ss on ss.id = e.shift_session_id
       where e.user_id = $1 and ss.workspace_owner_id = $1
         and coalesce(ss.opened_at, ss.started_at) >= $2::timestamptz
         and coalesce(ss.opened_at, ss.started_at) < $3::timestamptz`,
      [ownerId, range.start, range.end]
    ),
  ]);

  const openingTotal = asNumber(openingResult.rows[0]?.total);
  const closingTotal = asNumber(closingResult.rows[0]?.total);
  const revenue = asNumber(salesResult.rows[0]?.revenue);
  const cogs = asNumber(cogsResult.rows[0]?.cogs);
  const expenseTotal = asNumber(expenseResult.rows[0]?.expenseTotal);
  const profitDistribution = asNumber(expenseResult.rows[0]?.profitDistribution);
  const grossProfit = revenue - cogs;
  const netProfit = grossProfit - expenseTotal;
  const transactionCount = asNumber(salesResult.rows[0]?.transactionCount);
  const timestamp = nowIso();
  const saved = await pool.query<Record<string, unknown>>(
    `insert into daily_reports (
       id, user_id, report_date, opening_total, revenue, cogs, expense_total, gross_profit, net_profit,
       closing_total, transaction_count, profit_distribution, status, created_at, updated_at
     ) values ($1, $2, $3::date, $4, $5, $6, $7, $8, $9, $10, $11, $12, 'draft', $13::timestamptz, $13::timestamptz)
     on conflict (user_id, report_date) do update set
       opening_total = excluded.opening_total, revenue = excluded.revenue, cogs = excluded.cogs,
       expense_total = excluded.expense_total, gross_profit = excluded.gross_profit, net_profit = excluded.net_profit,
       closing_total = excluded.closing_total, transaction_count = excluded.transaction_count,
       profit_distribution = excluded.profit_distribution, updated_at = excluded.updated_at
     where daily_reports.status = 'draft'
     returning id, user_id as "userId", report_date as "reportDate", opening_total as "openingTotal",
       revenue, cogs, expense_total as "expenseTotal", gross_profit as "grossProfit", net_profit as "netProfit",
       closing_total as "closingTotal", transaction_count as "transactionCount",
       profit_distribution as "profitDistribution", status, locked_at as "lockedAt", locked_by_user_id as "lockedByUserId"`,
    [createId(), ownerId, reportDate, openingTotal, revenue, cogs, expenseTotal, grossProfit, netProfit, closingTotal, transactionCount, profitDistribution, timestamp]
  );
  if (saved.rows[0]) return mapRow(saved.rows[0]);

  const locked = await pool.query<Record<string, unknown>>(
    `select id, user_id as "userId", report_date as "reportDate", opening_total as "openingTotal",
       revenue, cogs, expense_total as "expenseTotal", gross_profit as "grossProfit", net_profit as "netProfit",
       closing_total as "closingTotal", transaction_count as "transactionCount", profit_distribution as "profitDistribution",
       status, locked_at as "lockedAt", locked_by_user_id as "lockedByUserId"
     from daily_reports where user_id = $1 and report_date = $2::date limit 1`,
    [ownerId, reportDate]
  );
  if (!locked.rows[0]) throw new Error("Gagal menyimpan laporan harian.");
  return mapRow(locked.rows[0]);
}

export async function lockDailyReport(workspaceOwnerId: string, reportDate: string, lockedByUserId: string) {
  const ownerId = scopedWorkspace(workspaceOwnerId);
  const range = getRange(reportDate);
  const open = await pool.query<{ id: string }>(
    `select id from shift_sessions where workspace_owner_id = $1 and status = 'open'
       and coalesce(opened_at, started_at) >= $2::timestamptz and coalesce(opened_at, started_at) < $3::timestamptz limit 1`,
    [ownerId, range.start, range.end]
  );
  if (open.rows[0]) throw new Error("Tidak dapat mengunci laporan selama masih ada shift terbuka.");
  await buildDailyReport(ownerId, reportDate);
  const locked = await pool.query<Record<string, unknown>>(
    `update daily_reports set status = 'locked', locked_at = $3::timestamptz, locked_by_user_id = $4, updated_at = $3::timestamptz
     where user_id = $1 and report_date = $2::date
     returning id, user_id as "userId", report_date as "reportDate", opening_total as "openingTotal",
       revenue, cogs, expense_total as "expenseTotal", gross_profit as "grossProfit", net_profit as "netProfit",
       closing_total as "closingTotal", transaction_count as "transactionCount", profit_distribution as "profitDistribution",
       status, locked_at as "lockedAt", locked_by_user_id as "lockedByUserId"`,
    [ownerId, reportDate, nowIso(), lockedByUserId]
  );
  if (!locked.rows[0]) throw new Error("Laporan harian tidak ditemukan.");
  return mapRow(locked.rows[0]);
}

export async function listDailyReports(workspaceOwnerId: string, range: { start: string; end: string }) {
  const ownerId = scopedWorkspace(workspaceOwnerId);
  const rows = await pool.query<Record<string, unknown>>(
    `select id, user_id as "userId", report_date as "reportDate", opening_total as "openingTotal",
       revenue, cogs, expense_total as "expenseTotal", gross_profit as "grossProfit", net_profit as "netProfit",
       closing_total as "closingTotal", transaction_count as "transactionCount", profit_distribution as "profitDistribution",
       status, locked_at as "lockedAt", locked_by_user_id as "lockedByUserId"
     from daily_reports
     where user_id = $1 and report_date >= $2::date and report_date < $3::date
     order by report_date desc`,
    [ownerId, range.start, range.end]
  );
  return rows.rows.map(mapRow);
}
