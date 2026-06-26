import { NextRequest, NextResponse } from "next/server";
import { getRequestUser, recordDebtPayment } from "@/lib/server/app-service";
import { logEvent } from "@/lib/server/audit";
import { handleRouteError } from "@/lib/server/route-error";
import { DebtPaymentCreateSchema } from "@/lib/server/validation";

export const runtime = "nodejs";

export async function POST(
  request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const body = DebtPaymentCreateSchema.parse(await request.json());
    const { userId, workspaceOwnerId } = await getRequestUser();
    const { id } = await context.params;

    const result = await recordDebtPayment(workspaceOwnerId, id, body, userId);
    if (result.debt.isPaid) {
      await logEvent(
        { workspaceOwnerId, actorUserId: userId },
        {
          eventType: "DEBT_PAID",
          entityType: "debt",
          entityId: result.debt.id,
          category: "update",
          payload: {
            borrowerName: result.debt.borrowerName,
            amount: result.debt.amount,
            paidAmount: result.debt.paidAmount,
          },
        }
      );
    }

    return NextResponse.json(result);
  } catch (error) {
    return handleRouteError(error, "Gagal mencatat pembayaran kasbon.");
  }
}
