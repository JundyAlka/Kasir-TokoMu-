import "@/lib/server/pdf-polyfill";
import { renderToBuffer } from "@react-pdf/renderer";
import { and, desc, eq } from "drizzle-orm";
import { db, pool } from "@/db/client";
import { restockPlans, storeProfiles } from "@/db/schema";
import {
  ProfitLossPdfData,
  ProfitLossReportDocument,
} from "@/lib/server/pdf-profit-loss";
import { calculatePayouts } from "@/lib/server/profit-sharing";
import { getReportRollupByMode } from "@/lib/server/monthly-report-service";
import { listWorkspaceUsers } from "@/lib/server/rbac";
import {
  getAssetCapitalSummary,
  getBottomProductsForPeriod,
  getPeriodRange,
  getTopProductsForPeriod,
} from "@/lib/server/reporting";
import {
  getJakartaDateKey,
  getJakartaDayRange,
  getJakartaWeekRange,
  JAKARTA_TIME_ZONE,
} from "@/lib/server/timezone";

export interface BuildProfitLossPdfOptions {
  workspaceOwnerId: string;
  periodValue: string;
  mode?: "harian" | "mingguan" | "bulanan";
  requestedNotes?: string[];
  customModalAwal?: number | null;
  customInventaris?: number | null;
  customShowcase?: number | null;
}

export interface ProfitLossPdfResult {
  buffer: Buffer;
  filename: string;
  label: string;
}

function formatShortDate(dateInput: string | Date) {
  return new Intl.DateTimeFormat("id-ID", {
    day: "numeric",
    month: "short",
    year: "numeric",
    timeZone: JAKARTA_TIME_ZONE,
  }).format(new Date(dateInput));
}

function parseReportPeriod(
  value: string,
  mode: "harian" | "mingguan" | "bulanan"
) {
  if (mode === "harian") {
    const cleanDate = /^\d{4}-\d{2}-\d{2}$/.test(value ?? "")
      ? value
      : getJakartaDateKey();
    const range = getJakartaDayRange(cleanDate);
    return {
      mode,
      rollupValue: cleanDate,
      range,
      label: formatShortDate(range.start),
    };
  }

  if (mode === "mingguan") {
    const cleanDate = /^\d{4}-\d{2}-\d{2}$/.test(value ?? "")
      ? value
      : getJakartaDateKey();
    const range = getJakartaWeekRange(cleanDate);
    const inclusiveEnd = new Date(new Date(range.end).getTime() - 1000);
    return {
      mode,
      rollupValue: cleanDate,
      range,
      label: `Minggu (${formatShortDate(range.start)} - ${formatShortDate(inclusiveEnd)})`,
    };
  }

  const match = /^(\d{4})-(\d{2})$/.exec(value ?? "");
  if (!match) {
    throw new Error("Format periode harus YYYY-MM.");
  }

  const year = Number(match[1]);
  const month = Number(match[2]);
  const range = getPeriodRange(year, month);

  return {
    mode,
    rollupValue: `${year}-${String(month).padStart(2, "0")}`,
    range,
    label: new Intl.DateTimeFormat("id-ID", {
      month: "long",
      timeZone: JAKARTA_TIME_ZONE,
      year: "numeric",
    }).format(new Date(range.start)),
  };
}

function cleanFilename(value: string) {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9-]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

function formatCurrency(value: number) {
  return new Intl.NumberFormat("id-ID", {
    style: "currency",
    currency: "IDR",
    maximumFractionDigits: 0,
  }).format(value || 0);
}

async function getExpenseCategories(
  workspaceOwnerId: string,
  periodStart: string,
  periodEnd: string
) {
  const result = await pool.query<{
    category: string;
    amount: string;
  }>(
    `
      select category, coalesce(sum(amount), 0)::text as amount
      from expenses
      where user_id = $1
        and created_at >= $2::timestamptz
        and created_at < $3::timestamptz
      group by category
      order by sum(amount) desc, category asc
    `,
    [workspaceOwnerId, periodStart, periodEnd]
  );

  return result.rows.map((r) => ({
    category: r.category,
    amount: Number(r.amount || 0),
  }));
}

async function getLowStockProducts(workspaceOwnerId: string) {
  const result = await pool.query<{
    name: string;
    stock: number;
    minimumStock: number;
    category: string;
  }>(
    `
      select name, stock, minimum_stock as "minimumStock", category
      from products
      where user_id = $1 and stock <= minimum_stock
      order by stock asc
      limit 20
    `,
    [workspaceOwnerId]
  );

  return result.rows;
}

export async function buildProfitLossPdfBuffer(
  options: BuildProfitLossPdfOptions
): Promise<ProfitLossPdfResult> {
  const {
    workspaceOwnerId,
    periodValue,
    mode = "bulanan",
    requestedNotes = [],
    customModalAwal = null,
    customInventaris = null,
    customShowcase = null,
  } = options;

  const period = parseReportPeriod(periodValue, mode);

  const [profile] = await db
    .select()
    .from(storeProfiles)
    .where(eq(storeProfiles.userId, workspaceOwnerId))
    .limit(1);

  const [
    payoutSummary,
    dailySummary,
    expenseCategories,
    expenseItemsResult,
    lowStockProducts,
    topProducts,
    bottomProducts,
    pendingRestocks,
    usersList,
    assetSummary,
    productStatsResult,
    paymentBreakdownResult,
    debtsResult,
    stockCategoriesResult,
    supplierDebtsResult,
    latestShiftResult,
  ] = await Promise.all([
    calculatePayouts(workspaceOwnerId, period.range.start, period.range.end),
    getReportRollupByMode(workspaceOwnerId, mode, period.rollupValue),
    getExpenseCategories(workspaceOwnerId, period.range.start, period.range.end),
    pool.query<{
      id: string;
      title: string;
      amount: string;
      category: string;
      createdAt: string;
    }>(
      `select id, title, coalesce(amount, 0)::text as amount, category, created_at as "createdAt"
       from expenses
       where user_id = $1 and created_at >= $2::timestamptz and created_at < $3::timestamptz
       order by created_at desc, id desc
       limit 50`,
      [workspaceOwnerId, period.range.start, period.range.end]
    ),
    getLowStockProducts(workspaceOwnerId),
    getTopProductsForPeriod(workspaceOwnerId, period.range.start, period.range.end, 5),
    getBottomProductsForPeriod(workspaceOwnerId, period.range.start, period.range.end, 5),
    db
      .select()
      .from(restockPlans)
      .where(
        and(
          eq(restockPlans.workspaceOwnerId, workspaceOwnerId),
          eq(restockPlans.isDone, 0)
        )
      )
      .orderBy(desc(restockPlans.createdAt))
      .limit(20),
    listWorkspaceUsers(workspaceOwnerId),
    getAssetCapitalSummary(workspaceOwnerId),
    pool.query<{ totalProducts: string; totalUnits: string }>(
      `select count(*)::text as "totalProducts", coalesce(sum(stock), 0)::text as "totalUnits" from products where user_id = $1`,
      [workspaceOwnerId]
    ),
    pool.query<{ paymentMethod: string; total: string; count: string }>(
      `select coalesce(payment_method, 'cash') as "paymentMethod", coalesce(sum(total), 0)::text as total, count(*)::text as count
       from transactions
       where user_id = $1 and occurred_at >= $2::timestamptz and occurred_at < $3::timestamptz
       group by payment_method`,
      [workspaceOwnerId, period.range.start, period.range.end]
    ),
    pool.query<{
      borrowerName: string;
      remainingAmount: string;
      whatsapp: string | null;
    }>(
      `select borrower_name as "borrowerName", coalesce(sum(amount - paid_amount), 0)::text as "remainingAmount", max(whatsapp) as "whatsapp"
       from debts where user_id = $1 and is_paid = 0
       group by borrower_name
       order by sum(amount - paid_amount) desc
       limit 25`,
      [workspaceOwnerId]
    ),
    pool.query<{
      category: string;
      categoryValue: string;
      productCount: string;
      unitCount: string;
    }>(
      `select category, coalesce(sum(stock * buy_price), 0)::text as "categoryValue", count(*)::text as "productCount", coalesce(sum(stock), 0)::text as "unitCount"
       from products where user_id = $1 and stock > 0
       group by category order by sum(stock * buy_price) desc`,
      [workspaceOwnerId]
    ),
    pool.query<{
      name: string;
      partnerType: string;
      liabilityAmount: string;
    }>(
      `select inv.name, inv.partner_type as "partnerType", coalesce(sum(greatest(0, ti.qty_sold * ti.unit_cost - ti.settled_amount)), 0)::text as "liabilityAmount"
       from investors inv
       left join titipan_intakes ti on ti.investor_id = inv.id and ti.user_id = inv.workspace_owner_id
       where inv.workspace_owner_id = $1 and inv.is_active = 1
       group by inv.id, inv.name, inv.partner_type
       order by sum(greatest(0, ti.qty_sold * ti.unit_cost - ti.settled_amount)) desc, inv.name asc`,
      [workspaceOwnerId]
    ),
    pool.query<{
      cash: string;
      coins: string;
      savings: string;
    }>(
      `select coalesce(closing_cash, opening_cash, 0)::text as cash, coalesce(closing_coins, opening_coins, 0)::text as coins, coalesce(closing_savings, opening_savings, 0)::text as savings
       from shift_sessions where workspace_owner_id = $1
       order by started_at desc limit 1`,
      [workspaceOwnerId]
    ),
  ]);

  const activeEmployees = usersList.filter((u) => u.isActive && u.monthlySalary > 0);
  const totalActiveProducts = Number(productStatsResult.rows[0]?.totalProducts ?? 0);
  const totalStockUnits = Number(productStatsResult.rows[0]?.totalUnits ?? 0);
  const totalAssets = assetSummary.inventoryCapital + assetSummary.activeReceivables;

  const salesChannels = paymentBreakdownResult.rows.map((r) => ({
    method:
      r.paymentMethod === "cash"
        ? "Tunai (Cash)"
        : r.paymentMethod === "kasbon"
          ? "Kasbon (Piutang)"
          : r.paymentMethod === "transfer"
            ? "Transfer Bank"
            : r.paymentMethod === "qris"
              ? "QRIS"
              : r.paymentMethod,
    count: Number(r.count || 0),
    total: Number(r.total || 0),
  }));

  const totalExpense =
    dailySummary.expenseTotal ||
    expenseCategories.reduce((sum, item) => sum + item.amount, 0);
  const enrichedExpenseCategories = expenseCategories.map((item) => ({
    ...item,
    percentage:
      totalExpense > 0
        ? `${Math.round((item.amount / totalExpense) * 1000) / 10}%`
        : "0%",
  }));

  const expenseItems = expenseItemsResult.rows.map((e) => ({
    id: e.id,
    title: e.title,
    category: e.category,
    amount: Number(e.amount || 0),
    createdAt: e.createdAt,
  }));

  const latestShiftRaw = latestShiftResult.rows[0] ?? {
    cash: "0",
    coins: "0",
    savings: "0",
  };
  const cashVal = Number(latestShiftRaw.cash || 0);
  const coinsVal = Number(latestShiftRaw.coins || 0);
  const savingsVal = Number(latestShiftRaw.savings || 0);
  const cashTotal = cashVal + coinsVal + savingsVal;

  const debtors = debtsResult.rows
    .map((d) => ({
      borrowerName: d.borrowerName,
      remainingAmount: Number(d.remainingAmount || 0),
      whatsapp: d.whatsapp,
    }))
    .filter((d) => d.remainingAmount > 0);

  const stockCategories = stockCategoriesResult.rows.map((c) => ({
    category: c.category,
    categoryValue: Number(c.categoryValue || 0),
    productCount: Number(c.productCount || 0),
    unitCount: Number(c.unitCount || 0),
  }));

  const supplierDebts = supplierDebtsResult.rows.map((s) => ({
    name: s.name,
    partnerType: s.partnerType,
    liabilityAmount: Number(s.liabilityAmount || 0),
  }));

  const modalAwal =
    customModalAwal ??
    (assetSummary.investorMoneyCapital > 0
      ? assetSummary.investorMoneyCapital
      : 10700000);
  const inventarisToko = customInventaris ?? 6200000;
  const showcase = customShowcase ?? 3800000;
  const kas =
    cashTotal > 0
      ? cashTotal
      : Math.max(
          0,
          dailySummary.revenue - dailySummary.expenseTotal - dailySummary.cogs
        );
  const stokDagangan = assetSummary.inventoryCapital;
  const piutangToko = assetSummary.activeReceivables;
  const totalPhysicalAssets =
    kas + stokDagangan + inventarisToko + showcase + piutangToko;

  const hutangToko = assetSummary.consignmentCapital;
  const hutangSalesTitipan = assetSummary.dailyConsignmentLiability;
  const hutangInvestasi =
    assetSummary.investorMoneyCapital > 0
      ? assetSummary.investorMoneyCapital
      : 7000000;
  const totalHutang = hutangToko + hutangSalesTitipan + hutangInvestasi;
  const biayaAtk = totalExpense > 0 ? totalExpense : 46000;
  const totalKewajibanDanBiaya = modalAwal + totalHutang + biayaAtk;
  const labaRugiBerjalan = totalPhysicalAssets - totalKewajibanDanBiaya;

  const physicalBalanceSheet = {
    modalAwal,
    kas,
    stokDagangan,
    inventarisToko,
    showcase,
    piutangToko,
    totalAset: totalPhysicalAssets,
    hutangToko,
    hutangSalesTitipan,
    hutangInvestasi,
    totalHutang,
    biayaAtk,
    totalKewajibanDanBiaya,
    labaRugiBerjalan,
    isSurplus: labaRugiBerjalan >= 0,
  };

  const pcmPct = profile?.profitSharePcmPct ?? 30;
  const reservePct = profile?.profitShareReservePct ?? 20;
  const executorPct = Math.max(0, 100 - pcmPct - reservePct);
  const distributable = Math.max(0, dailySummary.netProfit);
  const pcmAmount = Math.round((distributable * pcmPct) / 100);
  const reserveAmount = Math.round((distributable * reservePct) / 100);
  const executorAmount = Math.max(0, distributable - pcmAmount - reserveAmount);

  const cashSales = paymentBreakdownResult.rows
    .filter((r) => r.paymentMethod === "cash")
    .reduce((sum, r) => sum + Number(r.total || 0), 0);
  const nonCashSales = paymentBreakdownResult.rows
    .filter((r) => r.paymentMethod === "transfer" || r.paymentMethod === "qris")
    .reduce((sum, r) => sum + Number(r.total || 0), 0);
  const kasbonSales = paymentBreakdownResult.rows
    .filter((r) => r.paymentMethod === "kasbon")
    .reduce((sum, r) => sum + Number(r.total || 0), 0);

  const operationalBreakdown = {
    cashSales,
    nonCashSales,
    kasbonSales,
    totalRevenue: dailySummary.revenue,
    cogs: dailySummary.cogs,
    grossProfit: dailySummary.grossProfit,
    operatingExpenses: dailySummary.expenseTotal,
    profitDistribution: dailySummary.profitDistribution,
    totalExpenses: dailySummary.expenseTotal + dailySummary.profitDistribution,
    netProfit: dailySummary.netProfit,
    isSurplus: dailySummary.netProfit >= 0,
    pcmPct,
    pcmAmount,
    reservePct,
    reserveAmount,
    executorPct,
    executorAmount,
  };

  const financialMargin =
    dailySummary.revenue > 0
      ? Math.round((dailySummary.netProfit / dailySummary.revenue) * 1000) / 10
      : 0;

  const ownerNotes =
    requestedNotes.length > 0
      ? requestedNotes
      : [
          `Laba bersih usaha ${period.label} tercatat ${formatCurrency(dailySummary.netProfit)} dengan omzet penjualan ${formatCurrency(dailySummary.revenue)}.`,
          `Total beban operasional dan pengeluaran tercatat senilai ${formatCurrency(dailySummary.expenseTotal)}.`,
          `Nilai modal stok aktif barang dagangan saat ini senilai ${formatCurrency(assetSummary.inventoryCapital)} dari ${totalActiveProducts} SKU (${totalStockUnits} unit fisik).`,
          `Piutang kasbon aktif pelanggan toko tercatat senilai ${formatCurrency(assetSummary.activeReceivables)}.`,
          `Hasil pembukuan usaha ${period.label} membukukan ${dailySummary.netProfit >= 0 ? "Surplus Bersih" : "Defisit Operasional"} ${formatCurrency(dailySummary.netProfit)} (Margin Bersih: ${financialMargin}%).`,
          "Laporan kinerja dan laba rugi operasional dicetak dan divalidasi secara otomatis dari sistem TokoMu.",
        ];

  const data: ProfitLossPdfData = {
    generatedAt: new Date().toISOString(),
    period: {
      label: period.label,
      start: period.range.start,
      end: period.range.end,
      reportKind: mode,
    },
    identity: {
      storeName: profile?.storeName ?? "TokoMu",
      storeTagline:
        profile?.storeTagline ?? "Toko Amal Usaha PCM Muhammadiyah Grabag - Purworejo",
      storeAddress: profile?.storeAddress ?? "Kratonrejo",
      city: profile?.city ?? "",
    },
    financial: {
      revenue: dailySummary.revenue,
      cogs: dailySummary.cogs,
      grossProfit: dailySummary.grossProfit,
      expenseTotal: dailySummary.expenseTotal,
      netProfit: dailySummary.netProfit,
      profitDistribution: dailySummary.profitDistribution,
      transactionCount: dailySummary.transactionCount,
      averageTicket: dailySummary.averageTicket,
    },
    operationalBreakdown,
    physicalBalanceSheet,
    debtors,
    stockCategories,
    supplierDebts,
    cashPositions: {
      cash: cashVal,
      coins: coinsVal,
      savings: savingsVal,
      total: cashTotal,
    },
    assetsAndCapital: {
      inventoryCapital: assetSummary.inventoryCapital,
      activeReceivables: assetSummary.activeReceivables,
      investorMoneyCapital: assetSummary.investorMoneyCapital,
      consignmentCapital: assetSummary.consignmentCapital,
      dailyConsignmentLiability: assetSummary.dailyConsignmentLiability,
      totalAssets,
      totalActiveProducts,
      totalStockUnits,
    },
    salesChannels,
    expenseItems,
    expenseCategories: enrichedExpenseCategories,
    topProducts,
    bottomProducts,
    ownerNotes,
    payouts: payoutSummary.payouts,
    restockPlans: pendingRestocks,
    lowStockProducts,
    employeeSalaries: activeEmployees,
    dailyReports: dailySummary.dailyReports,
  };

  const buffer = await renderToBuffer(ProfitLossReportDocument({ data }));
  const prefix =
    mode === "harian"
      ? "laporan-keuangan-harian"
      : mode === "mingguan"
        ? "laporan-keuangan-mingguan"
        : "laporan-keuangan-bulanan";
  const filename = `${prefix}-${cleanFilename(period.label)}.pdf`;

  return {
    buffer,
    filename,
    label: period.label,
  };
}

