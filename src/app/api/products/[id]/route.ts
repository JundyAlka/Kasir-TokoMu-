import { NextRequest, NextResponse } from "next/server";
import { getRequestUser, updateProduct } from "@/lib/server/app-service";
import { handleRouteError } from "@/lib/server/route-error";
import { requireRole } from "@/lib/server/rbac";
import { ProductDraft } from "@/lib/types";

export const runtime = "nodejs";

export async function PATCH(
  request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  try {
    await requireRole(["pimpinan", "pengelola_keuangan"]);
    const { workspaceOwnerId } = await getRequestUser();
    const { id } = await context.params;
    const draft = (await request.json()) as ProductDraft;
    const product = await updateProduct(workspaceOwnerId, id, draft);
    return NextResponse.json({ product });
  } catch (error) {
    return handleRouteError(error, "Gagal memperbarui produk.");
  }
}
