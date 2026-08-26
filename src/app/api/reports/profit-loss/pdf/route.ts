import { renderToStream } from "@react-pdf/renderer";
import { and, desc, eq } from "drizzle-orm";
import { Readable } from "node:stream";
import { db, pool } from "@/db/client";
import { storeProfiles, restockPlans } from "@/db/schema";
import {
  ProfitLossReportDocument,
  ProfitLossPdfData,
} from "@/lib/server/pdf-profit-loss";
import { calculatePayouts } from "@/lib/server/profit-sharing";
import { getPeriodRange, getTopProductsForPeriod, getBottomProductsForPeriod } from "@/lib/server/reporting";
import { getReportRollupByMode } from "@/lib/server/monthly-report-service";
import { handleRouteError } from "@/lib/server/route-error";
import { listWorkspaceUsers } from "@/lib/server/rbac";
import { requireRoutePolicy } from "@/lib/server/route-policy";
import { JAKARTA_TIME_ZONE } from "@/lib/server/timezone";
import { getRequestUser } from "@/lib/server/app-service";

export const runtime = "nodejs";

function parsePeriod(value: string | null) {
  const match = /^(\d{4})-(\d{2})$/.exec(value ?? "");
  if (!match) {
    throw new Error("Format periode harus YYYY-MM.");
  }

  const year = Number(match[1]);
  const month = Number(match[2]);

  return {
    year,
    month,
    range: getPeriodRange(year, month),
    label: new Intl.DateTimeFormat("id-ID", {
      month: "long",
      timeZone: JAKARTA_TIME_ZONE,
      year: "numeric",
    }).format(new Date(getPeriodRange(year, month).start)),
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

async function getExpenseCategories(workspaceOwnerId: string, periodStart: string, periodEnd: string) {
  const result = await pool.query<{
    category: string;
    amount: number;
  }>(
    `
      select category, coalesce(sum(amount), 0)::int as amount
      from expenses
      where user_id = $1
        and created_at >= $2::timestamptz
        and created_at < $3::timestamptz
      group by category
      order by amount desc, category asc
    `,
    [workspaceOwnerId, periodStart, periodEnd]
  );

  return result.rows;
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

export async function GET(request: Request) {
  try {
    await requireRoutePolicy("/api/reports/profit-loss/pdf", "GET");
    const { workspaceOwnerId } = await getRequestUser();
    const url = new URL(request.url);
    const period = parsePeriod(url.searchParams.get("period"));
    const disposition = url.searchParams.get("download") === "1" ? "attachment" : "inline";
    const requestedNotes = url.searchParams
      .getAll("note")
      .map((note) => note.trim())
      .filter(Boolean)
      .slice(0, 6);
    const [profile] = await db
      .select()
      .from(storeProfiles)
      .where(eq(storeProfiles.userId, workspaceOwnerId))
      .limit(1);

    const [
      payoutSummary,
      dailySummary,
      expenseCategories,
      lowStockProducts,
      topProducts,
      bottomProducts,
      pendingRestocks,
      usersList,
      assetSummary,
      productStatsResult,
      paymentBreakdownResult,
    ] = await Promise.all([
      calculatePayouts(workspaceOwnerId, period.range.start, period.range.end),
      getReportRollupByMode(workspaceOwnerId, "bulanan", `${period.year}-${String(period.month).padStart(2, "0")}`),
      getExpenseCategories(workspaceOwnerId, period.range.start, period.range.end),
      getLowStockProducts(workspaceOwnerId),
      getTopProductsForPeriod(workspaceOwnerId, period.range.start, period.range.end, 5),
      getBottomProductsForPeriod(workspaceOwnerId, period.range.start, period.range.end, 5),
      db.select().from(restockPlans).where(and(eq(restockPlans.workspaceOwnerId, workspaceOwnerId), eq(restockPlans.isDone, 0))).orderBy(desc(restockPlans.createdAt)).limit(20),
      listWorkspaceUsers(workspaceOwnerId),
      import("@/lib/server/reporting").then(m => m.getAssetCapitalSummary(workspaceOwnerId)),
      pool.query<{ totalProducts: string; totalUnits: string }>(
        `select count(*)::text as "totalProducts", coalesce(sum(stock), 0)::text as "totalUnits" from products where user_id = $1`,
        [workspaceOwnerId]
      ),
      pool.query<{ paymentMethod: string; total: string; count: string }>(
        `select coalesce(payment_method, 'cash') as "paymentMethod", coalesce(sum(total), 0)::text as total, count(*)::text as count
         from transactions
         where user_id = $1 and created_at >= $2::timestamptz and created_at < $3::timestamptz
         group by payment_method`,
        [workspaceOwnerId, period.range.start, period.range.end]
      ),
    ]);

    const activeEmployees = usersList.filter(u => u.isActive && u.monthlySalary > 0);
    const totalActiveProducts = Number(productStatsResult.rows[0]?.totalProducts ?? 0);
    const totalStockUnits = Number(productStatsResult.rows[0]?.totalUnits ?? 0);
    const totalAssets = assetSummary.inventoryCapital + assetSummary.activeReceivables;

    const salesChannels = paymentBreakdownResult.rows.map((r) => ({
      method: r.paymentMethod === "cash" ? "Tunai (Cash)" : r.paymentMethod === "kasbon" ? "Kasbon (Piutang)" : r.paymentMethod === "transfer" ? "Transfer Bank" : r.paymentMethod === "qris" ? "QRIS" : r.paymentMethod,
      count: Number(r.count || 0),
      total: Number(r.total || 0),
    }));

    const totalExpense = dailySummary.expenseTotal || expenseCategories.reduce((sum, item) => sum + item.amount, 0);
    const enrichedExpenseCategories = expenseCategories.map((item) => ({
      ...item,
      percentage: totalExpense > 0 ? `${Math.round((item.amount / totalExpense) * 1000) / 10}%` : "0%",
    }));

    const ownerNotes =
      requestedNotes.length > 0
        ? requestedNotes
        : [
            `Laba bersih ${period.label} tercatat ${formatCurrency(dailySummary.netProfit)} dengan omzet penjualan ${formatCurrency(dailySummary.revenue)}.`,
            `Total modal stok aktif toko senilai ${formatCurrency(assetSummary.inventoryCapital)} dari ${totalActiveProducts} SKU barang (${totalStockUnits} unit).`,
            `Piutang kasbon pelanggan aktif tercatat ${formatCurrency(assetSummary.activeReceivables)}.`,
            "Laporan kinerja dan keuangan dicetak dan divalidasi secara otomatis dari sistem TokoMu.",
          ];

    const data: ProfitLossPdfData = {
      generatedAt: new Date().toISOString(),
      period: {
        label: period.label,
        start: period.range.start,
        end: period.range.end,
      },
      identity: {
        storeName: profile?.storeName ?? "TokoMu",
        storeTagline: profile?.storeTagline ?? "Toko Amal Usaha PCM Muhammadiyah Grabag - Purworejo",
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
    const stream = await renderToStream(ProfitLossReportDocument({ data }));
    const filename = `laporan-keuangan-bulanan-${cleanFilename(period.label)}.pdf`;

    return new Response(Readable.toWeb(stream as Readable) as ReadableStream, {
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `${disposition}; filename="${filename}"`,
      },
    });
  } catch (error) {
    return handleRouteError(error, "Gagal membuat PDF laporan untung rugi.");
  }
}
