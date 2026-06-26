import { and, eq } from "drizzle-orm";
import { db, pool } from "@/db/client";
import { investorPayouts } from "@/db/schema";
import { getJakartaMonthRange } from "@/lib/server/timezone";

export type AkadType =
  | "murabahah_bil_wakalah"
  | "mudharabah"
  | "musyarakah"
  | "barang_titip_jual"
  | "sales_titipan"
  | "pinjaman_qardh";

export type PeriodProfit = {
  revenue: number;
  cogs: number;
  grossProfit: number;
  expenses: number;
  expenseTotal: number;
  baseProfit: number;
  netProfit: number;
  transactionCount: number;
  averageTicket: number;
};

export type PayoutPreview = {
  investmentId: string;
  investorId: string;
  investorName: string;
  akadType: AkadType;
  type: LegacyInvestmentType;
  baseAmount: number;
  baseProfit: number;
  ratePct: number;
  sharePct: number;
  amount: number;
  note: string;
};

export type PayoutCalculation = PeriodProfit & {
  periodStart: string;
  periodEnd: string;
  totalInvestorPayout: number;
  remaining: number;
  distributableNetProfit: number;
  pcmShare: number;
  reserveShare: number;
  storeShare: number;
  profitSharePcmPct: number;
  profitShareReservePct: number;
  payouts: PayoutPreview[];
};

type LegacyInvestmentType = "uang" | "barang_titip_jual";

type InvestmentRow = {
  id: string;
  investorId: string;
  investorName: string;
  type: LegacyInvestmentType;
  akadType: AkadType | null;
  amount: number | null;
  monthlyReturnRatePct: number | null;
  profitSharePct: number | null;
  productId: string | null;
  productName: string | null;
  unitCost: number | null;
  profitSharePerUnitPct: number | null;
  startDate: string;
  endDate: string | null;
};

function createId(prefix: string) {
  return `${prefix}_${crypto.randomUUID().slice(0, 8)}`;
}

function nowIso() {
  return new Date().toISOString();
}

function roundCurrency(value: number) {
  return Math.round(value);
}

function laterIso(left: string, right: string) {
  return new Date(left) >= new Date(right) ? left : right;
}

function earlierIso(left: string, right: string) {
  return new Date(left) <= new Date(right) ? left : right;
}

function resolveAkadType(investment: InvestmentRow): AkadType {
  if (investment.akadType) {
    return investment.akadType;
  }

  return investment.type === "barang_titip_jual"
    ? "barang_titip_jual"
    : "murabahah_bil_wakalah";
}

function parsePeriod(
  yearOrStart: number | string,
  monthOrEnd: number | string
): { start: string; end: string } {
  if (typeof yearOrStart === "number" && typeof monthOrEnd === "number") {
    return getJakartaMonthRange(yearOrStart, monthOrEnd);
  }

  if (typeof yearOrStart === "string" && typeof monthOrEnd === "string") {
    return { start: yearOrStart, end: monthOrEnd };
  }

  throw new Error("Periode payout tidak valid.");
}

export async function calculatePeriodProfit(
  workspaceOwnerId: string,
  start: string,
  end: string
): Promise<PeriodProfit> {
  const result = await pool.query<{
    revenue: number;
    cogs: number;
    expenses: number;
    transactionCount: number;
  }>(
    `
      with tx as (
        select
          coalesce(sum(total), 0)::int as revenue,
          count(*)::int as transaction_count
        from transactions
        where user_id = $1
          and created_at >= $2::timestamptz
          and created_at < $3::timestamptz
      ),
      item_cost as (
        select coalesce(sum(ti.quantity * ti.cost_price), 0)::int as cogs
        from transaction_items ti
        join transactions t on t.id = ti.transaction_id
        where t.user_id = $1
          and t.created_at >= $2::timestamptz
          and t.created_at < $3::timestamptz
      ),
      exp as (
        select coalesce(sum(amount), 0)::int as expenses
        from expenses
        where user_id = $1
          and created_at >= $2::timestamptz
          and created_at < $3::timestamptz
      )
      select
        tx.revenue,
        item_cost.cogs,
        exp.expenses,
        tx.transaction_count as "transactionCount"
      from tx, item_cost, exp
    `,
    [workspaceOwnerId, start, end]
  );

  const row = result.rows[0] ?? { revenue: 0, cogs: 0, expenses: 0, transactionCount: 0 };
  const grossProfit = row.revenue - row.cogs;
  const baseProfit = grossProfit - row.expenses;

  return {
    revenue: row.revenue,
    cogs: row.cogs,
    grossProfit,
    expenses: row.expenses,
    expenseTotal: row.expenses,
    baseProfit,
    netProfit: baseProfit,
    transactionCount: row.transactionCount,
    averageTicket: row.transactionCount > 0 ? row.revenue / row.transactionCount : 0,
  };
}

async function calculateConsignmentBaseAmount(
  workspaceOwnerId: string,
  investment: InvestmentRow,
  periodStart: string,
  periodEnd: string
) {
  if (!investment.productId || !investment.unitCost) {
    return 0;
  }

  const activeStart = laterIso(periodStart, investment.startDate);
  const activeEnd = investment.endDate ? earlierIso(periodEnd, investment.endDate) : periodEnd;

  if (new Date(activeStart) >= new Date(activeEnd)) {
    return 0;
  }

  const result = await pool.query<{ baseAmount: number }>(
    `
      select coalesce(sum(ti.quantity * (ti.unit_price - $4::int)), 0)::int as "baseAmount"
      from transaction_items ti
      join transactions t on t.id = ti.transaction_id
      where t.user_id = $1
        and ti.product_id = $2
        and t.created_at >= $3::timestamptz
        and t.created_at < $5::timestamptz
    `,
    [workspaceOwnerId, investment.productId, activeStart, investment.unitCost, activeEnd]
  );

  return Math.max(result.rows[0]?.baseAmount ?? 0, 0);
}

function calculatePayoutForInvestment(
  investment: InvestmentRow,
  akadType: AkadType,
  periodBaseProfit: number,
  consignmentBaseAmount: number
): PayoutPreview {
  const legacyType: LegacyInvestmentType =
    akadType === "barang_titip_jual" || akadType === "sales_titipan"
      ? "barang_titip_jual"
      : "uang";

  if (akadType === "murabahah_bil_wakalah") {
    const baseAmount = investment.amount ?? 0;
    const ratePct = investment.monthlyReturnRatePct ?? 2.5;

    return {
      investmentId: investment.id,
      investorId: investment.investorId,
      investorName: investment.investorName,
      akadType,
      type: legacyType,
      baseAmount,
      baseProfit: baseAmount,
      ratePct,
      sharePct: ratePct,
      amount: roundCurrency(baseAmount * (ratePct / 100)),
      note: `Murabahah fixed-rate ${ratePct}% per bulan dari modal.`,
    };
  }

  if (akadType === "mudharabah" || akadType === "musyarakah") {
    const baseAmount = Math.max(periodBaseProfit, 0);
    const ratePct = investment.profitSharePct ?? 0;

    return {
      investmentId: investment.id,
      investorId: investment.investorId,
      investorName: investment.investorName,
      akadType,
      type: legacyType,
      baseAmount,
      baseProfit: baseAmount,
      ratePct,
      sharePct: ratePct,
      amount: roundCurrency(baseAmount * (ratePct / 100)),
      note: `${akadType === "mudharabah" ? "Mudharabah" : "Musyarakah"} ${ratePct}% dari laba bersih periode.`,
    };
  }

  if (akadType === "barang_titip_jual" || akadType === "sales_titipan") {
    const ratePct = investment.profitSharePerUnitPct ?? investment.profitSharePct ?? 0;

    return {
      investmentId: investment.id,
      investorId: investment.investorId,
      investorName: investment.investorName,
      akadType,
      type: legacyType,
      baseAmount: consignmentBaseAmount,
      baseProfit: consignmentBaseAmount,
      ratePct,
      sharePct: ratePct,
      amount: roundCurrency(consignmentBaseAmount * (ratePct / 100)),
      note: `Titipan ${investment.productName ?? "produk"} ${ratePct}% dari margin produk terjual.`,
    };
  }

  return {
    investmentId: investment.id,
    investorId: investment.investorId,
    investorName: investment.investorName,
    akadType,
    type: legacyType,
    baseAmount: investment.amount ?? 0,
    baseProfit: investment.amount ?? 0,
    ratePct: 0,
    sharePct: 0,
    amount: 0,
    note: "Pinjaman qardh tidak menghasilkan payout bagi hasil.",
  };
}

/**
 * Manual checks:
 * - Murabahah modal Rp2.000.000 @2,5% menghasilkan payout Rp50.000, independen dari laba periode.
 * - Barang titip: 10 unit terjual, margin Rp10.000/unit, share 15% menghasilkan payout Rp15.000.
 */
export async function calculatePayouts(
  workspaceOwnerId: string,
  yearOrStart: number | string,
  monthOrEnd: number | string
): Promise<PayoutCalculation> {
  const { start: periodStart, end: periodEnd } = parsePeriod(yearOrStart, monthOrEnd);
  const [profit, investmentResult] = await Promise.all([
    calculatePeriodProfit(workspaceOwnerId, periodStart, periodEnd),
    pool.query<InvestmentRow>(
      `
        select
          i.id,
          i.investor_id as "investorId",
          inv.name as "investorName",
          i.type,
          i.akad_type as "akadType",
          i.amount,
          i.monthly_return_rate_pct as "monthlyReturnRatePct",
          i.profit_share_pct as "profitSharePct",
          i.product_id as "productId",
          p.name as "productName",
          i.unit_cost as "unitCost",
          i.profit_share_per_unit_pct as "profitSharePerUnitPct",
          i.start_date as "startDate",
          i.end_date as "endDate"
        from investments i
        join investors inv
          on inv.id = i.investor_id
          and inv.workspace_owner_id = i.workspace_owner_id
        left join products p on p.id = i.product_id and p.user_id = i.workspace_owner_id
        where i.workspace_owner_id = $1
          and i.is_active = 1
          and inv.is_active = 1
          and i.start_date < $3::timestamptz
          and (i.end_date is null or i.end_date >= $2::timestamptz)
        order by inv.name asc, i.created_at asc
      `,
      [workspaceOwnerId, periodStart, periodEnd]
    ),
  ]);

  const payouts: PayoutPreview[] = [];

  for (const investment of investmentResult.rows) {
    const akadType = resolveAkadType(investment);
    const consignmentBaseAmount =
      akadType === "barang_titip_jual" || akadType === "sales_titipan"
        ? await calculateConsignmentBaseAmount(workspaceOwnerId, investment, periodStart, periodEnd)
        : 0;

    payouts.push(
      calculatePayoutForInvestment(
        investment,
        akadType,
        profit.baseProfit,
        consignmentBaseAmount
      )
    );
  }

  const totalInvestorPayout = payouts.reduce((sum, payout) => sum + payout.amount, 0);
  const remaining = profit.baseProfit - totalInvestorPayout;
  const positiveRemaining = Math.max(remaining, 0);
  const pcmShare = roundCurrency(positiveRemaining * 0.3);
  const storeShare = positiveRemaining - pcmShare;

  return {
    ...profit,
    periodStart,
    periodEnd,
    totalInvestorPayout,
    remaining,
    distributableNetProfit: Math.max(profit.baseProfit, 0),
    pcmShare,
    reserveShare: 0,
    storeShare,
    profitSharePcmPct: 30,
    profitShareReservePct: 0,
    payouts,
  };
}

export async function saveDraftPayouts(
  workspaceOwnerId: string,
  yearOrStart: number | string,
  monthOrEnd: number | string
) {
  const { start: periodStart, end: periodEnd } = parsePeriod(yearOrStart, monthOrEnd);
  const existing = await db
    .select({ id: investorPayouts.id })
    .from(investorPayouts)
    .where(
      and(
        eq(investorPayouts.workspaceOwnerId, workspaceOwnerId),
        eq(investorPayouts.periodStart, periodStart),
        eq(investorPayouts.periodEnd, periodEnd)
      )
    )
    .limit(1);

  if (existing.length > 0) {
    throw new Error("PAYOUTS_ALREADY_EXIST");
  }

  const calculation = await calculatePayouts(workspaceOwnerId, periodStart, periodEnd);
  const timestamp = nowIso();

  if (calculation.payouts.length > 0) {
    await db.insert(investorPayouts).values(
      calculation.payouts.map((payout) => ({
        id: createId("pay"),
        investmentId: payout.investmentId,
        investorId: payout.investorId,
        workspaceOwnerId,
        periodStart,
        periodEnd,
        baseProfit: payout.baseAmount,
        sharePct: payout.ratePct,
        amount: payout.amount,
        status: "draft",
        paidAt: null,
        note: payout.note,
        createdAt: timestamp,
        updatedAt: timestamp,
      }))
    );
  }

  return calculation;
}

export async function updatePayoutStatus(
  workspaceOwnerId: string,
  payoutId: string,
  status: "disetujui" | "dibayar",
  paidAt?: string | null
) {
  const nextPaidAt =
    status === "dibayar" ? new Date(paidAt ?? Date.now()).toISOString() : null;

  const [payout] = await db
    .update(investorPayouts)
    .set({
      status,
      paidAt: nextPaidAt,
      updatedAt: nowIso(),
    })
    .where(
      and(
        eq(investorPayouts.workspaceOwnerId, workspaceOwnerId),
        eq(investorPayouts.id, payoutId)
      )
    )
    .returning();

  if (!payout) {
    throw new Error("Payout tidak ditemukan.");
  }

  return payout;
}
