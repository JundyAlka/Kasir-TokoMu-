import { NextRequest, NextResponse } from "next/server";
import { requireRoutePolicy } from "@/lib/server/route-policy";
import { handleRouteError } from "@/lib/server/route-error";
import { saveProductAlias } from "@/lib/server/transaction-import";

export async function POST(request: NextRequest) {
  try {
    const { workspaceOwnerId } = await requireRoutePolicy("/api/transactions/import/aliases", "POST");
    const body: unknown = await request.json();
    if (!body || typeof body !== "object") throw new Error("Pemetaan produk tidak valid.");
    const { alias, productId } = body as { alias?: unknown; productId?: unknown };
    if (typeof alias !== "string" || typeof productId !== "string") throw new Error("Pemetaan produk tidak valid.");
    return NextResponse.json(await saveProductAlias(workspaceOwnerId, { alias, productId }));
  } catch (error) {
    return handleRouteError(error, "Gagal menyimpan pemetaan produk.");
  }
}
