import { NextRequest, NextResponse } from "next/server";
import { getRequestUser } from "@/lib/server/app-service";
import { getAssetCapitalSummary } from "@/lib/server/reporting";
import { handleRouteError } from "@/lib/server/route-error";
import { requireRole } from "@/lib/server/rbac";

export const runtime = "nodejs";

export async function GET(request: NextRequest) {
  try {
    await requireRole(["pimpinan", "pengelola_keuangan", "kasir"]);
    const { workspaceOwnerId } = await getRequestUser();
    const summary = await getAssetCapitalSummary(workspaceOwnerId);

    return NextResponse.json(summary);
  } catch (error) {
    return handleRouteError(error, "Gagal memuat laporan aset dan modal.");
  }
}
