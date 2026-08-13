import { NextRequest, NextResponse } from "next/server";
import { deleteProduct, getRequestUser, updateProduct } from "@/lib/server/app-service";
import { handleRouteError } from "@/lib/server/route-error";
import { requireRoutePolicy } from "@/lib/server/route-policy";
import { logEvent } from "@/lib/server/audit";
import { ProductUpdateSchema } from "@/lib/server/validation";

export const runtime = "nodejs";

export async function PATCH(
  request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const draft = ProductUpdateSchema.parse(await request.json());
    await requireRoutePolicy("/api/products/[id]", "PATCH");
    const { workspaceOwnerId, userId } = await getRequestUser();
    const { id } = await context.params;
    const product = await updateProduct(workspaceOwnerId, id, draft);
    await logEvent(
      { workspaceOwnerId, actorUserId: userId },
      {
        eventType: "PRODUCT_UPDATED",
        entityType: "product",
        entityId: product.id,
        category: "update",
        payload: { name: product.name },
      }
    );
    return NextResponse.json({ product });
  } catch (error) {
    return handleRouteError(error, "Gagal memperbarui produk.");
  }
}

export async function DELETE(
  _request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  try {
    await requireRoutePolicy("/api/products/[id]", "DELETE");
    const { workspaceOwnerId, userId } = await getRequestUser();
    const { id } = await context.params;
    const product = await deleteProduct(workspaceOwnerId, id);
    await logEvent(
      { workspaceOwnerId, actorUserId: userId },
      {
        eventType: "PRODUCT_DELETED",
        entityType: "product",
        entityId: product.id,
        category: "delete",
        payload: { name: product.name },
      }
    );
    return NextResponse.json({ product });
  } catch (error) {
    return handleRouteError(error, "Gagal menghapus produk.");
  }
}
