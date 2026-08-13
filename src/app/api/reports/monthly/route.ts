import { NextRequest, NextResponse } from "next/server";
import { db } from "@/db/client";
import { monthlyReports } from "@/db/schema";
import { getRequestUser } from "@/lib/server/app-service";
import { requireRoutePolicy } from "@/lib/server/route-policy";
import { handleRouteError } from "@/lib/server/route-error";
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
    await requireRoutePolicy("/api/reports/monthly", "GET");
    const { workspaceOwnerId } = await getRequestUser();
    
    const list = await db
      .select()
      .from(monthlyReports)
      .where(eq(monthlyReports.workspaceOwnerId, workspaceOwnerId))
      .orderBy(desc(monthlyReports.periodYear), desc(monthlyReports.periodMonth))
      .limit(50);
      
    console.log("=== DEBUG MONTHLY REPORTS ===");
    console.log(JSON.stringify(list.slice(0, 3).map(r => ({
      id: r.id,
      year: r.periodYear,
      month: r.periodMonth,
      status: r.status,
      hasFinancial: (r.data as any)?.financial !== undefined
    })), null, 2));

    return NextResponse.json({ reports: list });
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

    const timestamp = new Date().toISOString();

    if (existing.length > 0) {
      // Update data & status
      const [updated] = await db
        .update(monthlyReports)
        .set({
          data: {
            ...(existing[0].data as any),
            ...parsed.data
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
        data: parsed.data,
        status: "final",
        finalizedAt: timestamp,
        createdAt: timestamp,
        updatedAt: timestamp,
      })
      .returning();

    return NextResponse.json({ report });
  } catch (error) {
    return handleRouteError(error, "Gagal menyimpan laporan bulanan.");
  }
}
