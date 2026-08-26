import { NextRequest, NextResponse } from "next/server";
import { requireRoutePolicy } from "@/lib/server/route-policy";
import { previewTransactionImport } from "@/lib/server/transaction-import";
import { handleRouteError } from "@/lib/server/route-error";

export const runtime = "nodejs";

async function importFile(request: NextRequest) {
  const form = await request.formData();
  const file = form.get("file");
  if (!file || typeof file !== "object" || !("arrayBuffer" in file)) throw new Error("File impor wajib diisi.");
  const rawNonProductNames = form.get("nonProductNames");
  let nonProductNames: string[] = [];
  if (typeof rawNonProductNames === "string") {
    const parsed: unknown = JSON.parse(rawNonProductNames);
    if (!Array.isArray(parsed) || parsed.some((value) => typeof value !== "string")) throw new Error("Daftar bukan produk tidak valid.");
    nonProductNames = parsed;
  }
  return { name: "name" in file && typeof file.name === "string" ? file.name : "import", data: await file.arrayBuffer(), nonProductNames };
}

export async function POST(request: NextRequest) {
  try {
    const { workspaceOwnerId } = await requireRoutePolicy("/api/transactions/import/preview", "POST");
    const file = await importFile(request);
    return NextResponse.json(await previewTransactionImport(workspaceOwnerId, file.data, { nonProductNames: file.nonProductNames }));
  } catch (error) {
    return handleRouteError(error, "Gagal membaca file impor.");
  }
}
