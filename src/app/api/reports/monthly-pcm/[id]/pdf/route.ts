import { renderToStream } from "@react-pdf/renderer";
import { and, eq } from "drizzle-orm";
import { Readable } from "node:stream";
import { db } from "@/db/client";
import { monthlyReports } from "@/db/schema";
import { getRequestUser } from "@/lib/server/app-service";
import {
  PcmMonthlyReportData,
  PcmMonthlyReportDocument,
} from "@/lib/server/pdf-pcm";
import { handleRouteError } from "@/lib/server/route-error";
import { requireRole } from "@/lib/server/rbac";
import { getJakartaMonthRange, JAKARTA_TIME_ZONE } from "@/lib/server/timezone";

export const runtime = "nodejs";

type RouteContext = {
  params: Promise<{ id: string }>;
};

function legacyToReportData(
  value: unknown,
  fallback: {
    periodYear: number;
    periodMonth: number;
    createdAt: string;
  }
): PcmMonthlyReportData {
  if (
    value &&
    typeof value === "object" &&
    "version" in value &&
    "period" in value &&
    "financial" in value
  ) {
    return value as PcmMonthlyReportData;
  }

  const legacy = (value ?? {}) as Record<string, unknown>;
  const label =
    typeof legacy.periodLabel === "string"
      ? legacy.periodLabel
      : new Intl.DateTimeFormat("id-ID", {
          month: "long",
          timeZone: JAKARTA_TIME_ZONE,
          year: "numeric",
        }).format(new Date(getJakartaMonthRange(fallback.periodYear, fallback.periodMonth).start));
  const range = getJakartaMonthRange(fallback.periodYear, fallback.periodMonth);

  return {
    version: 1,
    generatedAt: fallback.createdAt,
    note: typeof legacy.notes === "string" ? legacy.notes : "",
    period: {
      year: fallback.periodYear,
      month: fallback.periodMonth,
      label,
      start: range.start,
      end: range.end,
    },
    identity: {
      storeName: "TokoMu",
      storeTagline: "Toko Amal Usaha PCM Muhammadiyah Grabag",
      storeAddress: "Grabag, Purworejo",
      city: "Purworejo",
      ownerName: "Pimpinan TokoMu",
      pcmName: "PCM Muhammadiyah Grabag",
      pcmChairmanName: "",
      pcmAddress: "Grabag, Purworejo",
    },
    financial: {
      revenue: Number(legacy.omzet ?? 0),
      cogs: 0,
      grossProfit: Number(legacy.labaKotor ?? 0),
      expenseTotal: 0,
      netProfit: Number(legacy.labaKotor ?? 0),
      transactionCount: Number(legacy.transaksi ?? 0),
      averageTicket: 0,
      totalInvestorPayout: Number(legacy.investorPayout ?? 0),
      pcmShare: Number(legacy.bagianPcm ?? 0),
      reserveShare: Number(legacy.danaCadangan ?? 0),
      storeShare: 0,
      profitSharePcmPct: 30,
      profitShareReservePct: 20,
    },
    payouts: [],
    topProducts: [],
  };
}

export async function GET(_request: Request, context: RouteContext) {
  try {
    await requireRole(["pimpinan", "pengelola_keuangan"]);
    const { workspaceOwnerId } = await getRequestUser();
    const { id } = await context.params;
    const [report] = await db
      .select()
      .from(monthlyReports)
      .where(
        and(
          eq(monthlyReports.id, id),
          eq(monthlyReports.workspaceOwnerId, workspaceOwnerId)
        )
      )
      .limit(1);

    if (!report) {
      throw new Error("Laporan tidak ditemukan.");
    }

    const data = legacyToReportData(report.data, {
      periodYear: report.periodYear,
      periodMonth: report.periodMonth,
      createdAt: report.createdAt,
    });
    const stream = await renderToStream(PcmMonthlyReportDocument({ data }));
    const filename = `laporan-pcm-${report.periodYear}-${String(report.periodMonth).padStart(2, "0")}.pdf`;

    return new Response(Readable.toWeb(stream as Readable) as ReadableStream, {
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `inline; filename="${filename}"`,
        "Cache-Control": "private, no-store, max-age=0",
      },
    });
  } catch (error) {
    return handleRouteError(error, "Gagal membuat PDF laporan PCM.");
  }
}
