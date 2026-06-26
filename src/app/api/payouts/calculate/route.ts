import { NextRequest, NextResponse } from "next/server";
import { getRequestUser } from "@/lib/server/app-service";
import { calculatePayouts } from "@/lib/server/profit-sharing";
import { handleRouteError } from "@/lib/server/route-error";
import { requireRole } from "@/lib/server/rbac";

export const runtime = "nodejs";

function parseBodyPeriod(body: unknown) {
  if (!body || typeof body !== "object") {
    throw new Error("Periode wajib diisi.");
  }

  const payload = body as {
    year?: unknown;
    month?: unknown;
    periodYear?: unknown;
    periodMonth?: unknown;
  };
  return {
    year: Number(payload.year ?? payload.periodYear),
    month: Number(payload.month ?? payload.periodMonth),
  };
}

export async function POST(request: NextRequest) {
  try {
    await requireRole(["pimpinan", "pengelola_keuangan"]);
    const { workspaceOwnerId } = await getRequestUser();
    const period = parseBodyPeriod(await request.json());
    const calculation = await calculatePayouts(workspaceOwnerId, period.year, period.month);

    return NextResponse.json({ calculation });
  } catch (error) {
    return handleRouteError(error, "Gagal menghitung preview payout.");
  }
}
