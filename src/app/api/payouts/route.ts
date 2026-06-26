import { NextRequest, NextResponse } from "next/server";
import { pool } from "@/db/client";
import { getRequestUser } from "@/lib/server/app-service";
import { logEvent } from "@/lib/server/audit";
import { saveDraftPayouts } from "@/lib/server/profit-sharing";
import { getPeriodRange } from "@/lib/server/reporting";
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

function parseSearchPeriod(request: NextRequest) {
  const periodYear = Number(
    request.nextUrl.searchParams.get("year") ?? request.nextUrl.searchParams.get("periodYear")
  );
  const periodMonth = Number(
    request.nextUrl.searchParams.get("month") ?? request.nextUrl.searchParams.get("periodMonth")
  );
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
          coalesce(i.akad_type, case when i.type = 'barang_titip_jual' then 'barang_titip_jual' else 'murabahah_bil_wakalah' end) as "akadType",
          p.period_start as "periodStart",
          p.period_end as "periodEnd",
          p.base_profit as "baseAmount",
          p.share_pct as "ratePct",
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
    const { userId, workspaceOwnerId } = await getRequestUser();
    const period = parseBodyPeriod(await request.json());
    const calculation = await saveDraftPayouts(workspaceOwnerId, period.year, period.month);

    await logEvent({ workspaceOwnerId, actorUserId: userId }, {
      eventType: "PAYOUT_DRAFTED",
      entityType: "payout_period",
      entityId: `${period.year}-${String(period.month).padStart(2, "0")}`,
      category: "finance",
      payload: {
        periodYear: period.year,
        periodMonth: period.month,
        totalInvestorPayout: calculation.totalInvestorPayout,
        payoutCount: calculation.payouts.length,
      },
    });

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
