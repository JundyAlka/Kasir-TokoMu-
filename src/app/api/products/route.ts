import { NextRequest, NextResponse } from "next/server";
import { createProduct, getRequestUser } from "@/lib/server/app-service";
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
