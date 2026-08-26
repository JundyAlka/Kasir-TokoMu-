import { NextRequest, NextResponse } from "next/server";
import { createTransaction } from "@/lib/server/app-service";
import { requireRoutePolicy } from "@/lib/server/route-policy";
import { handleRouteError } from "@/lib/server/route-error";
import { getOpenSession, resolveRecordedBy } from "@/lib/server/shift-service";
import { TransactionCheckoutSchema } from "@/lib/server/validation";

export const runtime = "nodejs";

export async function POST(request: NextRequest) {
  try {
    const { role, userId, workspaceOwnerId } = await requireRoutePolicy("/api/transactions", "POST");
    const body = TransactionCheckoutSchema.parse(await request.json());
    const openShift = await getOpenSession(workspaceOwnerId);
    if (!openShift) throw new Error("SHIFT_NOT_OPEN");
    if (role === "kasir" && openShift.cashierUserId !== userId) throw new Error("NOT_FOUND");
    const recordedBy = await resolveRecordedBy(workspaceOwnerId, userId);
    const result = await createTransaction(workspaceOwnerId, {
      ...body,
      recordedByUserId: recordedBy.userId,
      recordedByName: recordedBy.name,
      shiftSessionId: recordedBy.shiftSessionId,
    });
    return NextResponse.json(result);
  } catch (error) {
    if (error instanceof Error && error.message.toLowerCase().includes("stok")) {
      return handleRouteError(error, "Stok tidak cukup.", 409);
    }

    return handleRouteError(error, "Gagal menyimpan transaksi.");
  }
}
