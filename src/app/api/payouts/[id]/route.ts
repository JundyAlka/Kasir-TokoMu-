import { NextRequest, NextResponse } from "next/server";
import { getRequestUser } from "@/lib/server/app-service";
import { logEvent } from "@/lib/server/audit";
import { updatePayoutStatus } from "@/lib/server/profit-sharing";
import { handleRouteError } from "@/lib/server/route-error";
import { requireRole } from "@/lib/server/rbac";

export const runtime = "nodejs";

function parseStatus(value: unknown) {
  if (value !== "disetujui" && value !== "dibayar") {
    throw new Error("Status payout harus disetujui atau dibayar.");
  }

  return value;
}

export async function PATCH(
  request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  try {
    await requireRole(["pimpinan", "pengelola_keuangan"]);
    const { userId, workspaceOwnerId } = await getRequestUser();
    const { id } = await context.params;
    const body = (await request.json()) as { status?: unknown; paidAt?: string | null };
    const status = parseStatus(body.status);
    const payout = await updatePayoutStatus(
      workspaceOwnerId,
      id,
      status,
      body.paidAt
    );
    await logEvent({ workspaceOwnerId, actorUserId: userId }, {
      eventType: status === "dibayar" ? "PAYOUT_PAID" : "PAYOUT_APPROVED",
      entityType: "payout",
      entityId: payout.id,
      category: "finance",
      after: {
        status,
        paidAt: payout.paidAt,
      },
      payload: {
        status,
        amount: payout.amount,
        investorId: payout.investorId,
        paidAt: payout.paidAt,
      },
    });

    return NextResponse.json({ payout });
  } catch (error) {
    return handleRouteError(error, "Gagal memperbarui status payout.");
  }
}
