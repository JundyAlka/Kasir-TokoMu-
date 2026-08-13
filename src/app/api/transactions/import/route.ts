import { NextResponse } from "next/server";
import { requireRoutePolicy } from "@/lib/server/route-policy";
import { handleRouteError } from "@/lib/server/route-error";
import { listTransactionImportBatches } from "@/lib/server/transaction-import";

export const runtime = "nodejs";

export async function GET() {
  try {
    const { workspaceOwnerId } = await requireRoutePolicy("/api/transactions/import", "GET");
    return NextResponse.json({ batches: await listTransactionImportBatches(workspaceOwnerId) });
  } catch (error) {
    return handleRouteError(error, "Gagal memuat riwayat impor transaksi.");
  }
}
