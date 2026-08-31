import { NextRequest, NextResponse } from "next/server";
import { pool } from "@/db/client";
import { getRequestUser } from "@/lib/server/app-service";
import { getAssetCapitalSummary } from "@/lib/server/reporting";
import { getReportRollupByMode } from "@/lib/server/monthly-report-service";
import { handleRouteError } from "@/lib/server/route-error";
import { requireRoutePolicy } from "@/lib/server/route-policy";
import { getJakartaMonthRange } from "@/lib/server/timezone";

export const runtime = "nodejs";

export async function GET(request: NextRequest) {
  try {
    await requireRoutePolicy("/api/reports/cashier-ledger", "GET");
    const { workspaceOwnerId } = await getRequestUser();

    const periodParam = request.nextUrl.searchParams.get("period");
    if (!periodParam || !/^\d{4}-\d{2}$/.test(periodParam)) {
      throw new Error("Format periode harus YYYY-MM.");
    }

    const [year, month] = periodParam.split("-").map(Number);
    const range = getJakartaMonthRange(year, month);

    const [
      profitLoss,
      assets,
      expenseCategoriesResult,
      piutangResult,
      productStatsResult,
      categoryStatsResult,
      paymentMethodStatsResult,
      partnerStatsResult,
      latestShiftResult,
    ] = await Promise.all([
      getReportRollupByMode(workspaceOwnerId, "bulanan", periodParam),
      getAssetCapitalSummary(workspaceOwnerId),
      pool.query<{ category: string; amount: number; count: number }>(
        `
        select category, coalesce(sum(amount), 0)::int as amount, count(*)::int as count
        from expenses
        where user_id = $1
          and created_at >= $2::timestamptz
          and created_at < $3::timestamptz
        group by category
        order by amount desc, category asc
        `,
        [workspaceOwnerId, range.start, range.end]
      ),
      pool.query<{
        borrowerName: string;
        remainingAmount: number;
        whatsapp: string | null;
        count: number;
      }>(
        `
        select
          borrower_name as "borrowerName",
          coalesce(sum(amount - paid_amount), 0)::int as "remainingAmount",
          max(whatsapp) as "whatsapp",
          count(*)::int as count
        from debts
        where user_id = $1 and is_paid = 0
        group by borrower_name
        order by "remainingAmount" desc
        `,
        [workspaceOwnerId]
      ),
      pool.query<{ totalProducts: string; totalUnits: string }>(
        `
        select count(*)::text as "totalProducts",
               coalesce(sum(stock), 0)::text as "totalUnits"
        from products
        where user_id = $1
        `,
        [workspaceOwnerId]
      ),
      pool.query<{
        category: string;
        categoryValue: number;
        productCount: number;
        unitCount: number;
      }>(
        `
        select
          category,
          coalesce(sum(stock * buy_price), 0)::int as "categoryValue",
          count(*)::int as "productCount",
          coalesce(sum(stock), 0)::int as "unitCount"
        from products
        where user_id = $1 and stock > 0
        group by category
        order by "categoryValue" desc
        `,
        [workspaceOwnerId]
      ),
      pool.query<{
        paymentMethod: string;
        total: number;
        count: number;
      }>(
        `
        select
          coalesce(payment_method, 'cash') as "paymentMethod",
          coalesce(sum(total), 0)::int as total,
          count(*)::int as count
        from transactions
        where user_id = $1
          and occurred_at >= $2::timestamptz
          and occurred_at < $3::timestamptz
        group by payment_method
        order by total desc
        `,
        [workspaceOwnerId, range.start, range.end]
      ),
      pool.query<{
        name: string;
        partnerType: string;
        liabilityAmount: number;
      }>(
        `
        select
          inv.name,
          inv.partner_type as "partnerType",
          coalesce(sum(greatest(0, ti.qty_sold * ti.unit_cost - ti.settled_amount)), 0)::int as "liabilityAmount"
        from investors inv
        left join titipan_intakes ti on ti.investor_id = inv.id and ti.user_id = inv.workspace_owner_id
        where inv.workspace_owner_id = $1 and inv.is_active = 1
        group by inv.id, inv.name, inv.partner_type
        order by "liabilityAmount" desc, inv.name asc
        `,
        [workspaceOwnerId]
      ),
      pool.query<{
        cash: number;
        coins: number;
        savings: number;
      }>(
        `
        select
          coalesce(closing_cash, opening_cash, 0)::int as cash,
          coalesce(closing_coins, opening_coins, 0)::int as coins,
          coalesce(closing_savings, opening_savings, 0)::int as savings
        from shift_sessions
        where workspace_owner_id = $1
        order by started_at desc
        limit 1
        `,
        [workspaceOwnerId]
      ),
    ]);

    const totalProducts = Number(productStatsResult.rows[0]?.totalProducts ?? 0);
    const totalUnits = Number(productStatsResult.rows[0]?.totalUnits ?? 0);

    const piutangList = piutangResult.rows.filter((r) => r.remainingAmount > 0);
    const totalPiutang = piutangList.reduce((sum, r) => sum + r.remainingAmount, 0);

    const expenseCategories = expenseCategoriesResult.rows;
    const totalExpenseByCategory = expenseCategories.reduce((sum, r) => sum + r.amount, 0);

    const latestShift = latestShiftResult.rows[0] ?? { cash: 0, coins: 0, savings: 0 };
    const cashTotal = latestShift.cash + latestShift.coins + latestShift.savings;

    // Supplier liabilities (Hutang Toko / Kulakan)
    const supplierPartners = partnerStatsResult.rows.filter(
      (p) => p.partnerType === "titipan_bagihasil" || p.partnerType === "sales_harian"
    );

    return NextResponse.json({
      period: periodParam,
      cekStok: {
        inventoryCapital: assets.inventoryCapital,
        totalProducts,
        totalUnits,
        categories: categoryStatsResult.rows,
      },
      pemasukan: {
        revenue: profitLoss.revenue,
        transactionCount: profitLoss.transactionCount,
        cogs: profitLoss.cogs,
        grossProfit: profitLoss.grossProfit,
        paymentChannels: paymentMethodStatsResult.rows,
      },
      pengeluaran: {
        total: profitLoss.expenseTotal || totalExpenseByCategory,
        categories: expenseCategories,
      },
      piutangToko: {
        total: totalPiutang,
        debtorCount: piutangList.length,
        list: piutangList,
      },
      hutangToko: {
        investorMoneyCapital: assets.investorMoneyCapital,
        consignmentCapital: assets.consignmentCapital,
        dailyConsignmentLiability: assets.dailyConsignmentLiability,
        total: assets.investorMoneyCapital + assets.consignmentCapital + assets.dailyConsignmentLiability,
        partners: supplierPartners,
      },
      cashPositions: {
        cash: latestShift.cash,
        coins: latestShift.coins,
        savings: latestShift.savings,
        total: cashTotal,
      },
      neraca: {
        kas: cashTotal > 0 ? cashTotal : Math.max(0, profitLoss.revenue - profitLoss.expenseTotal - profitLoss.cogs),
        stokBarang: assets.inventoryCapital,
        piutang: totalPiutang,
        hutangToko: assets.consignmentCapital,
        hutangTitipan: assets.dailyConsignmentLiability,
        hutangInvestor: assets.investorMoneyCapital,
        totalHutang: assets.investorMoneyCapital + assets.consignmentCapital + assets.dailyConsignmentLiability,
        biayaOperasional: profitLoss.expenseTotal || totalExpenseByCategory,
        labaBersih: profitLoss.netProfit,
      },
    });
  } catch (error) {
    return handleRouteError(error, "Gagal memuat data buku kas toko.");
  }
}
