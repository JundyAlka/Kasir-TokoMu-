import { and, eq } from "drizzle-orm";
import { db, pool } from "@/db/client";
import { investorPayouts } from "@/db/schema";

export type PeriodProfit = {
  revenue: number;
  cogs: number;
  grossProfit: number;
  expenseTotal: number;
  netProfit: number;
  transactionCount: number;
  averageTicket: number;
};

export type PayoutPreview = {
  investmentId: string;
  investorId: string;
  investorName: string;
  type: "uang" | "barang_titip_jual";
  amount: number;
  sharePct: number;
  baseProfit: number;
  note: string;
};

export type PayoutCalculation = PeriodProfit & {
  periodStart: string;
  periodEnd: string;
  distributableNetProfit: number;
  profitSharePcmPct: number;
  profitShareReservePct: number;
  totalInvestorPayout: number;
  pcmShare: number;
  reserveShare: number;
  storeShare: number;
  payouts: PayoutPreview[];
};

type InvestmentRow = {
  id: string;
  investorId: string;
  investorName: string;
  type: "uang" | "barang_titip_jual";
  amount: number | null;
  profitSharePct: number | null;
  productId: string | null;
  productName: string | null;
  unitCount: number | null;
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

export async function calculatePeriodProfit(
  workspaceOwnerId: string,
  periodStart: string,
  periodEnd: string
): Promise<PeriodProfit> {
  const result = await pool.query<{
    revenue: number;
    cogs: number;
    expenseTotal: number;
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
        select coalesce(sum(amount), 0)::int as expense_total
        from expenses
        where user_id = $1
          and created_at >= $2::timestamptz
          and created_at < $3::timestamptz
      )
      select
        tx.revenue,
        item_cost.cogs,
        exp.expense_total as "expenseTotal",
        tx.transaction_count as "transactionCount"
      from tx, item_cost, exp
    `,
    [workspaceOwnerId, periodStart, periodEnd]
  );

  const row = result.rows[0] ?? {
    revenue: 0,
    cogs: 0,
    expenseTotal: 0,
    transactionCount: 0,
  };
  const grossProfit = row.revenue - row.cogs;
  const netProfit = grossProfit - row.expenseTotal;

  return {
    revenue: row.revenue,
    cogs: row.cogs,
    grossProfit,
    expenseTotal: row.expenseTotal,
    netProfit,
    transactionCount: row.transactionCount,
    averageTicket: row.transactionCount > 0 ? row.revenue / row.transactionCount : 0,
  };
}

async function calculateConsignmentBaseProfit(
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

  const result = await pool.query<{ baseProfit: number }>(
    `
      select coalesce(sum(ti.quantity * (ti.unit_price - $4::int)), 0)::int as "baseProfit"
      from transaction_items ti
      join transactions t on t.id = ti.transaction_id
      where t.user_id = $1
        and ti.product_id = $2
        and t.created_at >= $3::timestamptz
        and t.created_at < $5::timestamptz
    `,
    [workspaceOwnerId, investment.productId, activeStart, investment.unitCost, activeEnd]
  );

  return result.rows[0]?.baseProfit ?? 0;
}

/**
 * Manual checks:
 * - Investor uang 10% dengan laba bersih periode Rp2.000.000 menghasilkan payout Rp200.000.
 * - Jika periode rugi bersih, payout berbasis laba bersih, bagian PCM, dan reserve menjadi Rp0.
 * - Barang titip jual: 10 dus terjual, margin Rp10.000/dus, share 15% menghasilkan 10 * 10.000 * 0,15 = Rp15.000.
 */
export async function calculatePayouts(
  workspaceOwnerId: string,
  periodStart: string,
  periodEnd: string
): Promise<PayoutCalculation> {
  const [profit, profileResult, investmentResult] = await Promise.all([
    calculatePeriodProfit(workspaceOwnerId, periodStart, periodEnd),
    pool.query<{
      profitSharePcmPct: number;
      profitShareReservePct: number;
    }>(
      `
        select
          profit_share_pcm_pct as "profitSharePcmPct",
          profit_share_reserve_pct as "profitShareReservePct"
        from store_profiles
        where user_id = $1
        limit 1
      `,
      [workspaceOwnerId]
    ),
    pool.query<InvestmentRow>(
      `
        select
          i.id,
          i.investor_id as "investorId",
          inv.name as "investorName",
          i.type,
          i.amount,
          i.profit_share_pct as "profitSharePct",
          i.product_id as "productId",
          p.name as "productName",
          i.unit_count as "unitCount",
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
  const distributableNetProfit = Math.max(profit.netProfit, 0);

  for (const investment of investmentResult.rows) {
    if (investment.type === "uang") {
      const sharePct = investment.profitSharePct ?? 0;
      const amount = roundCurrency(distributableNetProfit * (sharePct / 100));

      payouts.push({
        investmentId: investment.id,
        investorId: investment.investorId,
        investorName: investment.investorName,
        type: investment.type,
        amount,
        sharePct,
        baseProfit: distributableNetProfit,
        note: `Bagi hasil modal uang ${sharePct}% dari laba bersih periode.`,
      });
      continue;
    }

    const sharePct = investment.profitSharePerUnitPct ?? 0;
    const baseProfit = Math.max(
      await calculateConsignmentBaseProfit(
        workspaceOwnerId,
        investment,
        periodStart,
        periodEnd
      ),
      0
    );
    const amount = roundCurrency(baseProfit * (sharePct / 100));

    payouts.push({
      investmentId: investment.id,
      investorId: investment.investorId,
      investorName: investment.investorName,
      type: investment.type,
      amount,
      sharePct,
      baseProfit,
      note: `Bagi hasil barang titip jual ${investment.productName ?? "produk"} ${sharePct}% dari margin produk terjual.`,
    });
  }

  const profitSharePcmPct = profileResult.rows[0]?.profitSharePcmPct ?? 30;
  const profitShareReservePct = profileResult.rows[0]?.profitShareReservePct ?? 20;
  const totalInvestorPayout = payouts.reduce((sum, payout) => sum + payout.amount, 0);
  const pcmShare = roundCurrency(distributableNetProfit * (profitSharePcmPct / 100));
  const reserveShare = roundCurrency(distributableNetProfit * (profitShareReservePct / 100));
  const storeShare = profit.netProfit - totalInvestorPayout - pcmShare - reserveShare;

  return {
    ...profit,
    periodStart,
    periodEnd,
    distributableNetProfit,
    profitSharePcmPct,
    profitShareReservePct,
    totalInvestorPayout,
    pcmShare,
    reserveShare,
    storeShare,
    payouts,
  };
}

export async function saveDraftPayouts(
  workspaceOwnerId: string,
  periodStart: string,
  periodEnd: string
) {
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
        baseProfit: payout.baseProfit,
        sharePct: payout.sharePct,
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
