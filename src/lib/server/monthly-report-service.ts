import { pool } from "@/db/client";
import { calculatePeriodProfit } from "@/lib/server/profit-sharing";
import { getJakartaDayRange, getJakartaMonthRange, getJakartaWeekRange } from "@/lib/server/timezone";

export type DailyRollup = { reportDate: string; revenue: number; cogs: number; expenseTotal: number; grossProfit: number; netProfit: number; profitDistribution: number; transactionCount: number; status: "draft" | "locked" };
export type DailyReportRollup = { periodStart: string; periodEnd: string; revenue: number; cogs: number; grossProfit: number; expenseTotal: number; netProfit: number; profitDistribution: number; transactionCount: number; averageTicket: number; dailyReports: DailyRollup[]; source: "daily_reports" | "live_transactions" };

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
  return { periodStart: range.start, periodEnd: range.end, ...totals, averageTicket: totals.transactionCount ? Math.round(totals.revenue / totals.transactionCount) : 0, dailyReports, source: "daily_reports" };
}

async function getLiveReportRollup(workspaceOwnerId: string, range: { start: string; end: string }): Promise<DailyReportRollup> {
  const summary = await calculatePeriodProfit(workspaceOwnerId, range.start, range.end);
  return {
    periodStart: range.start,
    periodEnd: range.end,
    revenue: summary.revenue,
    cogs: summary.cogs,
    grossProfit: summary.grossProfit,
    expenseTotal: summary.expenseTotal,
    netProfit: summary.netProfit,
    profitDistribution: summary.profitDistribution,
    transactionCount: summary.transactionCount,
    averageTicket: summary.averageTicket,
    dailyReports: [],
    source: "live_transactions",
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
