import { renderToStream } from "@react-pdf/renderer";
import { eq } from "drizzle-orm";
import { Readable } from "node:stream";
import { db, pool } from "@/db/client";
import { storeProfiles } from "@/db/schema";
import {
  ProfitLossReportDocument,
  ProfitLossPdfData,
} from "@/lib/server/pdf-profit-loss";
import { calculatePeriodProfit } from "@/lib/server/profit-sharing";
import { getPeriodRange, getTopProductsForPeriod } from "@/lib/server/reporting";
import { handleRouteError } from "@/lib/server/route-error";
import { requireRole } from "@/lib/server/rbac";
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

export async function GET(request: Request) {
  try {
    await requireRole(["pimpinan", "pengelola_keuangan"]);
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

    const [summary, expenseCategories, topProducts] = await Promise.all([
      calculatePeriodProfit(workspaceOwnerId, period.range.start, period.range.end),
      getExpenseCategories(workspaceOwnerId, period.range.start, period.range.end),
      getTopProductsForPeriod(workspaceOwnerId, period.range.start, period.range.end, 5),
    ]);
    const ownerNotes =
      requestedNotes.length > 0
        ? requestedNotes
        : [
            `Laba bersih ${period.label} tercatat ${formatCurrency(summary.netProfit)}.`,
            `Laba kotor ${formatCurrency(summary.grossProfit)} setelah HPP ${formatCurrency(summary.cogs)}.`,
            "Data laporan ini memakai API /api/reports/profit-loss yang sama dengan basis perhitungan bagi hasil.",
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
        storeTagline: profile?.storeTagline ?? "",
        storeAddress: profile?.storeAddress ?? "",
        city: profile?.city ?? "",
      },
      financial: {
        revenue: summary.revenue,
        cogs: summary.cogs,
        grossProfit: summary.grossProfit,
        expenseTotal: summary.expenseTotal,
        netProfit: summary.netProfit,
        transactionCount: summary.transactionCount,
        averageTicket: Math.round(summary.averageTicket),
      },
      expenseCategories,
      topProducts,
      ownerNotes,
    };
    const stream = await renderToStream(ProfitLossReportDocument({ data }));
    const filename = `laporan-untung-rugi-${cleanFilename(period.label)}.pdf`;

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
