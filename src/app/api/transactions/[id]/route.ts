import { NextRequest, NextResponse } from "next/server";
import { deleteTransaction, getRequestUser } from "@/lib/server/app-service";
import { handleRouteError } from "@/lib/server/route-error";
import { requireRoutePolicy } from "@/lib/server/route-policy";
import { logEvent } from "@/lib/server/audit";

export const runtime = "nodejs";

export async function DELETE(
  _request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  try {
    await requireRoutePolicy("/api/transactions/[id]", "DELETE");
    const { workspaceOwnerId, userId } = await getRequestUser();
    const { id } = await context.params;
    const result = await deleteTransaction(workspaceOwnerId, id);

    await logEvent(
      { workspaceOwnerId, actorUserId: userId },
      {
        eventType: "TRANSACTION_DELETED",
        entityType: "transaction",
        entityId: id,
        category: "delete",
        payload: { transactionId: id },
      }
    ).catch(() => undefined);

    return NextResponse.json(result);
  } catch (error) {
    return handleRouteError(error, "Gagal menghapus transaksi.");
  }
}
