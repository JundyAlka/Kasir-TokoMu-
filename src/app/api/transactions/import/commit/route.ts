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
    const createHistoricalShifts = form.get("createHistoricalShifts") === "true";
    const rawNonProductNames = form.get("nonProductNames");
    const parsed: unknown = typeof rawNonProductNames === "string" ? JSON.parse(rawNonProductNames) : [];
    if (!Array.isArray(parsed) || parsed.some((value) => typeof value !== "string")) throw new Error("Daftar bukan produk tidak valid.");
    return NextResponse.json(await commitTransactionImport({ workspaceOwnerId: user.workspaceOwnerId, actorUserId: user.userId, fileName, file: await file.arrayBuffer(), createHistoricalShifts, nonProductNames: parsed }));
  } catch (error) {
    return handleRouteError(error, "Gagal menyimpan impor transaksi.");
  }
}
