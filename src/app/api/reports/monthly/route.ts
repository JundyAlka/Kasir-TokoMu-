import { NextRequest, NextResponse } from "next/server";
import { db } from "@/db/client";
import { monthlyReports } from "@/db/schema";
import { getRequestUser } from "@/lib/server/app-service";
import { requireRoutePolicy } from "@/lib/server/route-policy";
import { handleRouteError } from "@/lib/server/route-error";
import { assertMonthLocked, UnlockedDailyReportsError } from "@/lib/server/monthly-report-service";
import { getReportRollupByMode } from "@/lib/server/monthly-report-service";
import { getReportNotificationState } from "@/lib/report-notifications";
import { z } from "zod";
import { and, desc, eq } from "drizzle-orm";
import crypto from "crypto";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const MonthlyReportCreateSchema = z.object({
  periodYear: z.number().int().min(2000),
  periodMonth: z.number().int().min(1).max(12),
  data: z.record(z.string(), z.any()),
});

function createId(prefix: string) {
  return `${prefix}_${crypto.randomUUID().slice(0, 8)}`;
}

export async function GET(request: NextRequest) {
  try {
    const { workspaceOwnerId } = await requireRoutePolicy("/api/reports/monthly", "GET");
    
    const list = await db
      .select()
      .from(monthlyReports)
      .where(eq(monthlyReports.workspaceOwnerId, workspaceOwnerId))
      .orderBy(desc(monthlyReports.periodYear), desc(monthlyReports.periodMonth))
      .limit(50);
      
    const notificationStates = await Promise.all(
      list.map(async (report) => {
        const period = `${report.periodYear}-${String(report.periodMonth).padStart(2, "0")}`;
        const live = await getReportRollupByMode(workspaceOwnerId, "bulanan", period);
        const state = getReportNotificationState(report.status, report.data, live);
        return { period, ...state };
      })
    );

    return NextResponse.json({
      reports: list,
      notifications: {
        snapshotOutdatedPeriods: notificationStates.filter((state) => state.snapshotOutdated).map((state) => state.period),
        pcmOutdatedPeriods: notificationStates.filter((state) => state.pcmOutdated).map((state) => state.period),
      },
    });
  } catch (error) {
    return handleRouteError(error, "Gagal mengambil daftar riwayat laporan bulanan.");
  }
}

export async function POST(request: NextRequest) {
  try {
    await requireRoutePolicy("/api/reports/monthly", "POST");
    const body = await request.json();
    const parsed = MonthlyReportCreateSchema.parse(body);
    const { workspaceOwnerId } = await getRequestUser();
    
    // Cek apakah sudah difinalisasi
    const existing = await db
      .select()
      .from(monthlyReports)
      .where(
        and(
          eq(monthlyReports.workspaceOwnerId, workspaceOwnerId),
          eq(monthlyReports.periodYear, parsed.periodYear),
          eq(monthlyReports.periodMonth, parsed.periodMonth)
        )
      )
      .limit(1);

    const rollup = await assertMonthLocked(workspaceOwnerId, parsed.periodYear, parsed.periodMonth);
    const timestamp = new Date().toISOString();
    // A historical/live month can legitimately have no daily report rows yet.
    // In that case the client already supplied the live transaction rollup;
    // never overwrite it with the empty daily-report zero totals.
    const data = rollup.dailyReports.length > 0 ? { ...parsed.data, ...rollup } : parsed.data;

    if (existing.length > 0) {
      // Update data & status
      const [updated] = await db
        .update(monthlyReports)
        .set({
          data: {
            ...(existing[0].data as any),
            ...data
          },
          status: "final",
          finalizedAt: timestamp,
          updatedAt: timestamp,
        })
        .where(
          and(
            eq(monthlyReports.id, existing[0].id),
            eq(monthlyReports.workspaceOwnerId, workspaceOwnerId)
          )
        )
        .returning();
      return NextResponse.json({ report: updated });
    }

    const [report] = await db
      .insert(monthlyReports)
      .values({
        id: createId("mrep"),
        workspaceOwnerId,
        periodYear: parsed.periodYear,
        periodMonth: parsed.periodMonth,
        data,
        status: "final",
        finalizedAt: timestamp,
        createdAt: timestamp,
        updatedAt: timestamp,
      })
      .returning();

    return NextResponse.json({ report });
  } catch (error) {
    if (error instanceof UnlockedDailyReportsError) {
      return NextResponse.json({ error: "Masih ada laporan harian yang belum dikunci.", code: "DAILY_REPORTS_UNLOCKED", unlockedDates: error.dates }, { status: 409 });
    }
    return handleRouteError(error, "Gagal menyimpan laporan bulanan.");
  }
}
