import { NextRequest, NextResponse } from "next/server";
import { getRequestUser } from "@/lib/server/app-service";
import { calculatePeriodProfit } from "@/lib/server/profit-sharing";
import { getPeriodRange } from "@/lib/server/reporting";
import { handleRouteError } from "@/lib/server/route-error";
import { requireRole } from "@/lib/server/rbac";

export const runtime = "nodejs";

function parsePeriod(value: string | null) {
  const match = /^(\d{4})-(\d{2})$/.exec(value ?? "");
  if (!match) {
    throw new Error("Format periode harus YYYY-MM.");
  }

  return getPeriodRange(Number(match[1]), Number(match[2]));
}

export async function GET(request: NextRequest) {
  try {
    await requireRole(["pimpinan", "pengelola_keuangan"]);
    const { workspaceOwnerId } = await getRequestUser();
    const range = parsePeriod(request.nextUrl.searchParams.get("period"));
    const summary = await calculatePeriodProfit(workspaceOwnerId, range.start, range.end);

    return NextResponse.json({
      periodStart: range.start,
      periodEnd: range.end,
      ...summary,
    });
  } catch (error) {
    return handleRouteError(error, "Gagal menghitung laporan untung rugi.");
  }
}
