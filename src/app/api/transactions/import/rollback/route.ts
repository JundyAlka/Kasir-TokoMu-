import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { requireRoutePolicy } from "@/lib/server/route-policy";
import { rollbackTransactionImport } from "@/lib/server/transaction-import";
import { handleRouteError } from "@/lib/server/route-error";

export const runtime = "nodejs";
const Body = z.object({ batchId: z.string().trim().min(1) }).strict();

export async function POST(request: NextRequest) {
  try {
    const user = await requireRoutePolicy("/api/transactions/import/rollback", "POST");
    const { batchId } = Body.parse(await request.json());
    return NextResponse.json(await rollbackTransactionImport(user.workspaceOwnerId, user.userId, batchId));
  } catch (error) {
    return handleRouteError(error, "Gagal membatalkan impor transaksi.");
  }
}
