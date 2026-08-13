import { NextRequest, NextResponse } from "next/server";
import { getRequestUser } from "@/lib/server/app-service";
import { getAssetCapitalSummary } from "@/lib/server/reporting";
import { handleRouteError } from "@/lib/server/route-error";
import { requireRoutePolicy } from "@/lib/server/route-policy";

export const runtime = "nodejs";

export async function GET(request: NextRequest) {
  try {
    await requireRoutePolicy("/api/reports/assets", "GET");
    const { workspaceOwnerId } = await getRequestUser();
    const summary = await getAssetCapitalSummary(workspaceOwnerId);

    return NextResponse.json(summary);
  } catch (error) {
    return handleRouteError(error, "Gagal memuat laporan aset dan modal.");
  }
}
