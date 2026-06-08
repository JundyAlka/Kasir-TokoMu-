import { NextRequest, NextResponse } from "next/server";
import { createTransaction, getRequestUser } from "@/lib/server/app-service";
import { handleRouteError } from "@/lib/server/route-error";
import { PaymentMethod } from "@/lib/types";

export const runtime = "nodejs";

export async function POST(request: NextRequest) {
  try {
    const { workspaceOwnerId } = await getRequestUser();
    const body = (await request.json()) as {
      paymentMethod: PaymentMethod;
      items: Array<{ productId: string; quantity: number }>;
    };
    const result = await createTransaction(workspaceOwnerId, body);
    return NextResponse.json(result);
  } catch (error) {
    return handleRouteError(error, "Gagal menyimpan transaksi.");
  }
}
