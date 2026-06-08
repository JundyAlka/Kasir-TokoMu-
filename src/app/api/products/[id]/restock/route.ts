import { NextRequest, NextResponse } from "next/server";
import { getRequestUser, restockProduct } from "@/lib/server/app-service";
import { handleRouteError } from "@/lib/server/route-error";
import { requireRole } from "@/lib/server/rbac";

export const runtime = "nodejs";

export async function POST(
  request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  try {
    await requireRole(["pimpinan", "pengelola_keuangan"]);
    const { workspaceOwnerId } = await getRequestUser();
    const { id } = await context.params;
    const body = (await request.json()) as { quantity: number };
    const product = await restockProduct(workspaceOwnerId, id, Number(body.quantity));
    return NextResponse.json({ product });
  } catch (error) {
    return handleRouteError(error, "Gagal menambah stok.");
  }
}
