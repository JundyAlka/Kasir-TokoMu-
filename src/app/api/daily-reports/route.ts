import { NextRequest, NextResponse } from "next/server";
import { requireRoutePolicy } from "@/lib/server/route-policy";
import { handleRouteError } from "@/lib/server/route-error";
import { listDailyReports } from "@/lib/server/daily-report-service";

export const runtime = "nodejs";

export async function GET(request: NextRequest) {
  try {
    const { workspaceOwnerId } = await requireRoutePolicy("/api/daily-reports", "GET");
    const end = request.nextUrl.searchParams.get("end") ?? new Date().toISOString().slice(0, 10);
    const start = request.nextUrl.searchParams.get("start") ?? `${end.slice(0, 8)}01`;
    const reports = await listDailyReports(workspaceOwnerId, { start, end: `${end}T23:59:59.999Z` });
    return NextResponse.json({ reports });
  } catch (error) {
    return handleRouteError(error, "Gagal mengambil laporan harian.");
  }
}
