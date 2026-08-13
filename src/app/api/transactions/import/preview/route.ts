import { NextRequest, NextResponse } from "next/server";
import { requireRoutePolicy } from "@/lib/server/route-policy";
import { previewTransactionImport } from "@/lib/server/transaction-import";
import { handleRouteError } from "@/lib/server/route-error";

export const runtime = "nodejs";

async function importFile(request: NextRequest) {
  const form = await request.formData();
  const file = form.get("file");
  if (!file || typeof file !== "object" || !("arrayBuffer" in file)) throw new Error("File impor wajib diisi.");
  return { name: "name" in file && typeof file.name === "string" ? file.name : "import", data: await file.arrayBuffer() };
}

export async function POST(request: NextRequest) {
  try {
    const { workspaceOwnerId } = await requireRoutePolicy("/api/transactions/import/preview", "POST");
    const file = await importFile(request);
    return NextResponse.json(await previewTransactionImport(workspaceOwnerId, file.data));
  } catch (error) {
    return handleRouteError(error, "Gagal membaca file impor.");
  }
}
