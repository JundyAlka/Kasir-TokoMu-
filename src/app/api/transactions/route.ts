import { NextRequest, NextResponse } from "next/server";
import { createTransaction, getRequestUser } from "@/lib/server/app-service";
import { handleRouteError } from "@/lib/server/route-error";
import { resolveRecordedBy } from "@/lib/server/shift-service";
import { TransactionCheckoutSchema } from "@/lib/server/validation";

export const runtime = "nodejs";

export async function POST(request: NextRequest) {
  try {
    const body = TransactionCheckoutSchema.parse(await request.json());
    const { userId, workspaceOwnerId } = await getRequestUser();
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
