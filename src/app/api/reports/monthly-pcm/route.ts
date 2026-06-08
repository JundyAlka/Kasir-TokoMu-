import { and, desc, eq } from "drizzle-orm";
import { NextRequest, NextResponse } from "next/server";
import { db, pool } from "@/db/client";
import { monthlyReports, storeProfiles } from "@/db/schema";
import { getRequestUser } from "@/lib/server/app-service";
import { calculatePayouts } from "@/lib/server/profit-sharing";
import { getPeriodRange, getTopProductsForPeriod } from "@/lib/server/reporting";
import { handleRouteError } from "@/lib/server/route-error";
import { requireRole } from "@/lib/server/rbac";
import { PcmMonthlyReportData } from "@/lib/server/pdf-pcm";

export const runtime = "nodejs";

type MonthlyReportBody = {
  periodYear?: unknown;
  periodMonth?: unknown;
  note?: unknown;
};

function createId(prefix: string) {
  return `${prefix}_${crypto.randomUUID().slice(0, 8)}`;
}

function nowIso() {
  return new Date().toISOString();
}

function parsePeriodPayload(body: unknown) {
  if (!body || typeof body !== "object") {
    throw new Error("Periode laporan wajib diisi.");
  }

  const payload = body as MonthlyReportBody;
  const periodYear = Number(payload.periodYear);
  const periodMonth = Number(payload.periodMonth);
  const range = getPeriodRange(periodYear, periodMonth);

  return {
    periodYear,
    periodMonth,
    note: typeof payload.note === "string" ? payload.note.trim() : "",
    range,
  };
}

function periodLabel(year: number, month: number) {
  return new Intl.DateTimeFormat("id-ID", {
    month: "long",
    year: "numeric",
  }).format(new Date(Date.UTC(year, month - 1, 1)));
}

function normalizeOwnerName(value: string | null | undefined) {
  if (!value || value.trim() === "" || value.includes("[Nama Bapak]")) {
    return "Pimpinan TokoMu";
  }

  return value;
}

function normalizeAddress(value: string | null | undefined) {
  if (!value || value.trim() === "" || value.includes("[Alamat") || value === "Grabag, Magelang") {
    return "Grabag, Purworejo";
  }

  return value;
}

function normalizeCity(value: string | null | undefined) {
  if (!value || value.trim() === "" || value === "Magelang") {
    return "Purworejo";
  }

  return value;
}

async function getInvestmentCapital(workspaceOwnerId: string, investmentIds: string[]) {
  if (investmentIds.length === 0) {
    return new Map<string, number>();
  }

  const result = await pool.query<{ id: string; capital: number }>(
    `
      select
        id,
        coalesce(amount, coalesce(unit_count, 0) * coalesce(unit_cost, 0), 0)::int as capital
      from investments
      where workspace_owner_id = $1
        and id = any($2::text[])
    `,
    [workspaceOwnerId, investmentIds]
  );

  return new Map(result.rows.map((row) => [row.id, row.capital]));
}

async function buildReportData(
  workspaceOwnerId: string,
  periodYear: number,
  periodMonth: number,
  note: string,
  range: { start: string; end: string }
): Promise<PcmMonthlyReportData> {
  const [profileRows, calculation, topProducts] = await Promise.all([
    db.select().from(storeProfiles).where(eq(storeProfiles.userId, workspaceOwnerId)).limit(1),
    calculatePayouts(workspaceOwnerId, range.start, range.end),
    getTopProductsForPeriod(workspaceOwnerId, range.start, range.end, 5),
  ]);
  const profile = profileRows[0];
  const capitalByInvestment = await getInvestmentCapital(
    workspaceOwnerId,
    calculation.payouts.map((payout) => payout.investmentId)
  );

  return {
    version: 1,
    generatedAt: nowIso(),
    note,
    period: {
      year: periodYear,
      month: periodMonth,
      label: periodLabel(periodYear, periodMonth),
      start: range.start,
      end: range.end,
    },
    identity: {
      storeName: profile?.storeName ?? "TokoMu",
      storeTagline: profile?.storeTagline ?? "Toko Amal Usaha PCM Muhammadiyah Grabag",
      storeAddress: normalizeAddress(profile?.storeAddress),
      city: normalizeCity(profile?.city),
      ownerName: normalizeOwnerName(profile?.ownerName),
      pcmName: profile?.pcmName || "PCM Muhammadiyah Grabag",
      pcmChairmanName: profile?.pcmChairmanName ?? "",
      pcmAddress: normalizeAddress(profile?.pcmAddress),
    },
    financial: {
      revenue: calculation.revenue,
      cogs: calculation.cogs,
      grossProfit: calculation.grossProfit,
      expenseTotal: calculation.expenseTotal,
      netProfit: calculation.netProfit,
      transactionCount: calculation.transactionCount,
      averageTicket: calculation.averageTicket,
      totalInvestorPayout: calculation.totalInvestorPayout,
      pcmShare: calculation.pcmShare,
      reserveShare: calculation.reserveShare,
      storeShare: calculation.storeShare,
      profitSharePcmPct: calculation.profitSharePcmPct,
      profitShareReservePct: calculation.profitShareReservePct,
    },
    payouts: calculation.payouts.map((payout) => ({
      ...payout,
      capital: capitalByInvestment.get(payout.investmentId) ?? payout.baseProfit,
    })),
    topProducts,
  };
}

export async function GET() {
  try {
    await requireRole(["pimpinan", "pengelola_keuangan"]);
    const { workspaceOwnerId } = await getRequestUser();
    const reports = await db
      .select()
      .from(monthlyReports)
      .where(eq(monthlyReports.workspaceOwnerId, workspaceOwnerId))
      .orderBy(desc(monthlyReports.periodYear), desc(monthlyReports.periodMonth));

    return NextResponse.json({ reports });
  } catch (error) {
    return handleRouteError(error, "Gagal mengambil laporan PCM.");
  }
}

export async function POST(request: NextRequest) {
  try {
    await requireRole(["pimpinan", "pengelola_keuangan"]);
    const { workspaceOwnerId } = await getRequestUser();
    const { periodYear, periodMonth, note, range } = parsePeriodPayload(await request.json());
    const data = await buildReportData(workspaceOwnerId, periodYear, periodMonth, note, range);
    const timestamp = nowIso();

    const [existing] = await db
      .select()
      .from(monthlyReports)
      .where(
        and(
          eq(monthlyReports.workspaceOwnerId, workspaceOwnerId),
          eq(monthlyReports.periodYear, periodYear),
          eq(monthlyReports.periodMonth, periodMonth)
        )
      )
      .limit(1);

    if (existing?.status === "final") {
      return NextResponse.json(
        { error: "Laporan final tidak bisa diedit." },
        { status: 409 }
      );
    }

    const [report] = existing
      ? await db
          .update(monthlyReports)
          .set({
            data,
            status: "draft",
            finalizedAt: null,
            updatedAt: timestamp,
          })
          .where(eq(monthlyReports.id, existing.id))
          .returning()
      : await db
          .insert(monthlyReports)
          .values({
            id: createId("mrp"),
            workspaceOwnerId,
            periodYear,
            periodMonth,
            data,
            pdfUrl: null,
            status: "draft",
            finalizedAt: null,
            createdAt: timestamp,
            updatedAt: timestamp,
          })
          .returning();

    return NextResponse.json({ report });
  } catch (error) {
    return handleRouteError(error, "Gagal membuat laporan PCM.");
  }
}

export async function PATCH(request: NextRequest) {
  try {
    await requireRole(["pimpinan", "pengelola_keuangan"]);
    const { workspaceOwnerId } = await getRequestUser();
    const body = (await request.json()) as { id?: unknown; status?: unknown };

    if (typeof body.id !== "string" || body.id.trim().length === 0) {
      throw new Error("ID laporan wajib diisi.");
    }

    if (body.status !== "final") {
      throw new Error("Status laporan tidak valid.");
    }

    const timestamp = nowIso();
    const [report] = await db
      .update(monthlyReports)
      .set({
        status: "final",
        finalizedAt: timestamp,
        updatedAt: timestamp,
      })
      .where(
        and(
          eq(monthlyReports.id, body.id),
          eq(monthlyReports.workspaceOwnerId, workspaceOwnerId)
        )
      )
      .returning();

    if (!report) {
      throw new Error("Laporan tidak ditemukan.");
    }

    return NextResponse.json({ report });
  } catch (error) {
    return handleRouteError(error, "Gagal finalize laporan PCM.");
  }
}
