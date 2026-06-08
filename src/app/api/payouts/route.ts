import { NextRequest, NextResponse } from "next/server";
import { pool } from "@/db/client";
import { getRequestUser } from "@/lib/server/app-service";
import { saveDraftPayouts } from "@/lib/server/profit-sharing";
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

function parseSearchPeriod(request: NextRequest) {
  const periodYear = Number(request.nextUrl.searchParams.get("periodYear"));
  const periodMonth = Number(request.nextUrl.searchParams.get("periodMonth"));
  return getPeriodRange(periodYear, periodMonth);
}

export async function GET(request: NextRequest) {
  try {
    await requireRole(["pimpinan", "pengelola_keuangan"]);
    const { workspaceOwnerId } = await getRequestUser();
    const range = parseSearchPeriod(request);
    const result = await pool.query(
      `
        select
          p.id,
          p.investment_id as "investmentId",
          p.investor_id as "investorId",
          inv.name as "investorName",
          i.type,
          p.period_start as "periodStart",
          p.period_end as "periodEnd",
          p.base_profit as "baseProfit",
          p.share_pct as "sharePct",
          p.amount,
          p.status,
          p.paid_at as "paidAt",
          p.note,
          p.created_at as "createdAt",
          p.updated_at as "updatedAt"
        from investor_payouts p
        left join investors inv
          on inv.id = p.investor_id
          and inv.workspace_owner_id = p.workspace_owner_id
        left join investments i
          on i.id = p.investment_id
          and i.workspace_owner_id = p.workspace_owner_id
        where p.workspace_owner_id = $1
          and p.period_start = $2::timestamptz
          and p.period_end = $3::timestamptz
        order by inv.name asc, p.created_at asc
      `,
      [workspaceOwnerId, range.start, range.end]
    );

    return NextResponse.json({
      periodStart: range.start,
      periodEnd: range.end,
      payouts: result.rows,
    });
  } catch (error) {
    return handleRouteError(error, "Gagal memuat daftar payout.");
  }
}

export async function POST(request: NextRequest) {
  try {
    await requireRole(["pimpinan", "pengelola_keuangan"]);
    const { workspaceOwnerId } = await getRequestUser();
    const range = parseBodyPeriod(await request.json());
    const calculation = await saveDraftPayouts(workspaceOwnerId, range.start, range.end);

    return NextResponse.json({ calculation });
  } catch (error) {
    if (error instanceof Error && error.message === "PAYOUTS_ALREADY_EXIST") {
      return NextResponse.json(
        { error: "Payout untuk periode ini sudah pernah dibuat." },
        { status: 409 }
      );
    }

    return handleRouteError(error, "Gagal menyimpan draft payout.");
  }
}
