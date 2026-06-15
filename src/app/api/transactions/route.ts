import { NextRequest, NextResponse } from "next/server";
import { createTransaction, getRequestUser } from "@/lib/server/app-service";
import { handleRouteError } from "@/lib/server/route-error";
import { TransactionCheckoutSchema } from "@/lib/server/validation";

export const runtime = "nodejs";

export async function POST(request: NextRequest) {
  try {
    const body = TransactionCheckoutSchema.parse(await request.json());
    const { workspaceOwnerId } = await getRequestUser();
    const result = await createTransaction(workspaceOwnerId, body);
    return NextResponse.json(result);
  } catch (error) {
    if (error instanceof Error && error.message.toLowerCase().includes("stok")) {
      return handleRouteError(error, "Stok tidak cukup.", 409);
    }

    return handleRouteError(error, "Gagal menyimpan transaksi.");
  }
}
