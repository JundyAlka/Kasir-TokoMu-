import { NextRequest, NextResponse } from "next/server";
import { getDebtDetail, getRequestUser, updateDebt } from "@/lib/server/app-service";
import { logEvent } from "@/lib/server/audit";
import { handleRouteError } from "@/lib/server/route-error";
import { DebtUpdateSchema } from "@/lib/server/validation";

export const runtime = "nodejs";

export async function GET(
  _request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const { workspaceOwnerId } = await getRequestUser();
    const { id } = await context.params;

    const debt = await getDebtDetail(workspaceOwnerId, id);
    return NextResponse.json({ debt });
  } catch (error) {
    return handleRouteError(error, "Gagal mengambil detail kasbon.");
  }
}

export async function PATCH(
  request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const body = DebtUpdateSchema.parse(await request.json());
    const { userId, workspaceOwnerId } = await getRequestUser();
    const { id } = await context.params;

    const debt = await updateDebt(workspaceOwnerId, id, body);
    if (debt.isPaid) {
      await logEvent(
        { workspaceOwnerId, actorUserId: userId },
        {
          eventType: "DEBT_PAID",
          entityType: "debt",
          entityId: debt.id,
          category: "update",
          payload: {
            borrowerName: debt.borrowerName,
            amount: debt.amount,
            paidAmount: debt.paidAmount,
          },
        }
      );
    }

    return NextResponse.json({ debt });
  } catch (error) {
    return handleRouteError(error, "Gagal memperbarui status hutang.");
  }
}
