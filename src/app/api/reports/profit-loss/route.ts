import { NextRequest, NextResponse } from "next/server";
import { getRequestUser } from "@/lib/server/app-service";
import { getReportRollupByMode } from "@/lib/server/monthly-report-service";
import { handleRouteError } from "@/lib/server/route-error";
import { requireRoutePolicy } from "@/lib/server/route-policy";

export const runtime = "nodejs";

export async function GET(request: NextRequest) {
  try {
    await requireRoutePolicy("/api/reports/profit-loss", "GET");
    const { workspaceOwnerId } = await getRequestUser();
    const modeParam = request.nextUrl.searchParams.get("range");
    const mode = modeParam === "harian" || modeParam === "mingguan" ? modeParam : "bulanan";
    const value = mode === "bulanan" ? request.nextUrl.searchParams.get("period") : request.nextUrl.searchParams.get("date");
    if (!value) throw new Error("Periode laporan wajib diisi.");
    const summary = await getReportRollupByMode(workspaceOwnerId, mode, value);

    return NextResponse.json({
      mode,
      ...summary,
    });
  } catch (error) {
    return handleRouteError(error, "Gagal menghitung laporan untung rugi.");
  }
}
