import { NextRequest, NextResponse } from "next/server";
import { createProduct, deleteBulkProducts, getRequestUser } from "@/lib/server/app-service";
import { handleRouteError } from "@/lib/server/route-error";
import { requireRoutePolicy } from "@/lib/server/route-policy";
import { logEvent } from "@/lib/server/audit";
import { ProductCreateSchema } from "@/lib/server/validation";

export const runtime = "nodejs";

export async function POST(request: NextRequest) {
  try {
    const draft = ProductCreateSchema.parse(await request.json());
    await requireRoutePolicy("/api/products", "POST");
    const { workspaceOwnerId, userId } = await getRequestUser();
    const product = await createProduct(workspaceOwnerId, draft);
    await logEvent(
      { workspaceOwnerId, actorUserId: userId },
      {
        eventType: "PRODUCT_CREATED",
        entityType: "product",
        entityId: product.id,
        category: "create",
        payload: { name: product.name, sku: product.sku },
      }
    );
    return NextResponse.json({ product });
  } catch (error) {
    return handleRouteError(error, "Gagal menambah produk.");
  }
}

export async function DELETE(request: NextRequest) {
  try {
    await requireRoutePolicy("/api/products", "DELETE");
    const { workspaceOwnerId, userId } = await getRequestUser();
    const body = (await request.json().catch(() => ({}))) as { ids?: unknown };
    const ids = Array.isArray(body.ids)
      ? body.ids.filter((id): id is string => typeof id === "string" && id.trim().length > 0)
      : [];

    if (ids.length === 0) {
      return NextResponse.json({ error: "Daftar ID produk wajib diisi." }, { status: 400 });
    }

    const deleted = await deleteBulkProducts(workspaceOwnerId, ids);
    await logEvent(
      { workspaceOwnerId, actorUserId: userId },
      {
        eventType: "PRODUCT_DELETED",
        entityType: "product",
        entityId: ids.join(","),
        category: "delete",
        payload: { count: deleted.length, names: deleted.map((p) => p.name) },
      }
    );

    return NextResponse.json({
      deletedIds: deleted.map((p) => p.id),
      count: deleted.length,
    });
  } catch (error) {
    return handleRouteError(error, "Gagal menghapus produk terpilih.");
  }
}
