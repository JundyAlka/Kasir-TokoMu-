import { NextRequest, NextResponse } from "next/server";
import { getRequestUser } from "@/lib/server/app-service";
import { calculatePayouts } from "@/lib/server/profit-sharing";
import { getPeriodRange } from "@/lib/server/reporting";
import { handleRouteError } from "@/lib/server/route-error";
import { requireRole } from "@/lib/server/rbac";

export const runtime = "nodejs";

function parseBodyPeriod(body: unknown) {
  if (!body || typeof body !== "object") {
    throw new Error("Periode wajib diisi.");
  }

  const payload = body as { periodYear?: unknown; periodMonth?: unknown };
  return getPeriodRange(Number(payload.periodYear), Number(payload.periodMonth));
}

export async function POST(request: NextRequest) {
  try {
    await requireRole(["pimpinan", "pengelola_keuangan"]);
    const { workspaceOwnerId } = await getRequestUser();
    const range = parseBodyPeriod(await request.json());
    const calculation = await calculatePayouts(workspaceOwnerId, range.start, range.end);

    return NextResponse.json({ calculation });
  } catch (error) {
    return handleRouteError(error, "Gagal menghitung preview payout.");
  }
}
