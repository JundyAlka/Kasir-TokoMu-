import { pool } from "@/db/client";
import { calculatePeriodProfit } from "@/lib/server/profit-sharing";
import { getJakartaDayRange, getJakartaMonthRange, getJakartaWeekRange } from "@/lib/server/timezone";

export type DailyRollup = { reportDate: string; revenue: number; cogs: number; expenseTotal: number; grossProfit: number; netProfit: number; profitDistribution: number; transactionCount: number; status: "draft" | "locked" };
export type DailyTransactionSummary = { dateKey: string; revenue: number; transactionCount: number };
export type DailyReportRollup = { periodStart: string; periodEnd: string; revenue: number; cogs: number; grossProfit: number; expenseTotal: number; netProfit: number; profitDistribution: number; transactionCount: number; averageTicket: number; dailyReports: DailyRollup[]; dailyTransactions?: DailyTransactionSummary[]; source: "daily_reports" | "live_transactions" };

function number(value: unknown) { return Number(value ?? 0); }
function dayRange(date: string) { return getJakartaDayRange(new Date(`${date}T12:00:00.000Z`)); }
function jakartaDateKey(value: string) {
  const parts = new Intl.DateTimeFormat("en-US", { timeZone: "Asia/Jakarta", year: "numeric", month: "2-digit", day: "2-digit" }).formatToParts(new Date(value));
  const read = (type: string) => parts.find((part) => part.type === type)?.value ?? "";
  return `${read("year")}-${read("month")}-${read("day")}`;
}

export function monthDateRange(year: number, month: number) {
  const nextYear = month === 12 ? year + 1 : year;
  const nextMonth = month === 12 ? 1 : month + 1;
  return { start: `${year}-${String(month).padStart(2, "0")}-01`, end: `${nextYear}-${String(nextMonth).padStart(2, "0")}-01` };
}

export async function getDailyReportRollup(workspaceOwnerId: string, range: { start: string; end: string }): Promise<DailyReportRollup> {
  const result = await pool.query<Record<string, unknown>>(
    `select report_date as "reportDate", revenue, cogs, expense_total as "expenseTotal", gross_profit as "grossProfit", net_profit as "netProfit", profit_distribution as "profitDistribution", transaction_count as "transactionCount", status
     from daily_reports where user_id = $1 and report_date >= $2::date and report_date < $3::date order by report_date asc`,
    [workspaceOwnerId, range.start, range.end]
  );
  const dailyReports: DailyRollup[] = result.rows.map((row) => ({ reportDate: String(row.reportDate), revenue: number(row.revenue), cogs: number(row.cogs), expenseTotal: number(row.expenseTotal), grossProfit: number(row.grossProfit), netProfit: number(row.netProfit), profitDistribution: number(row.profitDistribution), transactionCount: number(row.transactionCount), status: row.status === "locked" ? "locked" : "draft" }));
  const totals = dailyReports.reduce((sum, row) => ({ revenue: sum.revenue + row.revenue, cogs: sum.cogs + row.cogs, grossProfit: sum.grossProfit + row.grossProfit, expenseTotal: sum.expenseTotal + row.expenseTotal, netProfit: sum.netProfit + row.netProfit, profitDistribution: sum.profitDistribution + row.profitDistribution, transactionCount: sum.transactionCount + row.transactionCount }), { revenue: 0, cogs: 0, grossProfit: 0, expenseTotal: 0, netProfit: 0, profitDistribution: 0, transactionCount: 0 });
  return { periodStart: range.start, periodEnd: range.end, ...totals, averageTicket: totals.transactionCount ? Math.round(totals.revenue / totals.transactionCount) : 0, dailyReports, dailyTransactions: [], source: "daily_reports" };
}

async function getLiveReportRollup(workspaceOwnerId: string, range: { start: string; end: string }): Promise<DailyReportRollup> {
  const [summary, dailyRollup, liveTransactions] = await Promise.all([
    calculatePeriodProfit(workspaceOwnerId, range.start, range.end),
    getDailyReportRollup(workspaceOwnerId, range),
    pool.query<{ occurredAt: string; total: number }>(
      `select occurred_at as "occurredAt", total
       from transactions
       where user_id = $1
         and occurred_at >= $2::timestamptz
         and occurred_at < $3::timestamptz
       order by occurred_at asc`,
      [workspaceOwnerId, range.start, range.end]
    ),
  ]);

  const dailyMap = new Map<string, { revenue: number; transactionCount: number }>();
  for (const row of liveTransactions.rows) {
    const key = jakartaDateKey(String(row.occurredAt));
    const current = dailyMap.get(key) ?? { revenue: 0, transactionCount: 0 };
    current.revenue += number(row.total);
    current.transactionCount += 1;
    dailyMap.set(key, current);
  }

  const dailyTransactions = Array.from(dailyMap.entries())
    .map(([dateKey, val]) => ({
      dateKey,
      revenue: val.revenue,
      transactionCount: val.transactionCount,
    }))
    .sort((a, b) => a.dateKey.localeCompare(b.dateKey));

  const hasDaily = dailyRollup.dailyReports.length > 0;
  const revenue = Math.max(summary.revenue, dailyRollup.revenue);
  const expenseTotal = Math.max(summary.expenseTotal, dailyRollup.expenseTotal);
  const cogs = Math.max(summary.cogs, dailyRollup.cogs);
  const grossProfit = Math.max(summary.grossProfit, revenue - cogs);
  const netProfit = hasDaily && summary.revenue === 0 ? dailyRollup.netProfit : (revenue - cogs - expenseTotal);
  const transactionCount = Math.max(summary.transactionCount, dailyRollup.transactionCount);
  const averageTicket = transactionCount ? Math.round(revenue / transactionCount) : 0;

  return {
    periodStart: range.start,
    periodEnd: range.end,
    revenue,
    cogs,
    grossProfit,
    expenseTotal,
    netProfit,
    profitDistribution: summary.profitDistribution || dailyRollup.profitDistribution,
    transactionCount,
    averageTicket,
    dailyReports: dailyRollup.dailyReports,
    dailyTransactions,
    source: hasDaily ? "daily_reports" : "live_transactions",
  };
}

export async function getReportRollupByMode(workspaceOwnerId: string, mode: "harian" | "mingguan" | "bulanan", value: string) {
  if (mode === "harian") { const range = dayRange(value); return getDailyReportRollup(workspaceOwnerId, { start: value, end: jakartaDateKey(range.end) }); }
  if (mode === "mingguan") { const range = getJakartaWeekRange(new Date(`${value}T12:00:00.000Z`)); return getLiveReportRollup(workspaceOwnerId, { start: jakartaDateKey(range.start), end: jakartaDateKey(range.end) }); }
  const [year, month] = value.split("-").map(Number); return getLiveReportRollup(workspaceOwnerId, getJakartaMonthRange(year, month));
}

export class UnlockedDailyReportsError extends Error { constructor(readonly dates: string[]) { super("UNLOCKED_DAILY_REPORTS"); } }

export async function assertMonthLocked(workspaceOwnerId: string, year: number, month: number) {
  const range = monthDateRange(year, month);
  const result = await pool.query<{ reportDate: string }>(`select report_date as "reportDate" from daily_reports where user_id = $1 and report_date >= $2::date and report_date < $3::date and status <> 'locked' order by report_date asc`, [workspaceOwnerId, range.start, range.end]);
  if (result.rows.length) throw new UnlockedDailyReportsError(result.rows.map((row) => jakartaDateKey(String(row.reportDate))));
  return getDailyReportRollup(workspaceOwnerId, range);
}
