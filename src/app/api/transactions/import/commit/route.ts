import { NextRequest, NextResponse } from "next/server";
import { requireRoutePolicy } from "@/lib/server/route-policy";
import { commitTransactionImport } from "@/lib/server/transaction-import";
import { handleRouteError } from "@/lib/server/route-error";

export const runtime = "nodejs";

export async function POST(request: NextRequest) {
  try {
    const user = await requireRoutePolicy("/api/transactions/import/commit", "POST");
    const form = await request.formData();
    const file = form.get("file");
    if (!file || typeof file !== "object" || !("arrayBuffer" in file)) throw new Error("File impor wajib diisi.");
    const fileName = "name" in file && typeof file.name === "string" ? file.name : "import";
    return NextResponse.json(await commitTransactionImport({ workspaceOwnerId: user.workspaceOwnerId, actorUserId: user.userId, fileName, file: await file.arrayBuffer() }));
  } catch (error) {
    return handleRouteError(error, "Gagal menyimpan impor transaksi.");
  }
}
