import { NextRequest, NextResponse } from "next/server";
import { getRequestUser, restockProduct } from "@/lib/server/app-service";
import { handleRouteError } from "@/lib/server/route-error";
import { requireRoutePolicy } from "@/lib/server/route-policy";
import { RestockBodySchema } from "@/lib/server/validation";

export const runtime = "nodejs";

export async function POST(
  request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const body = RestockBodySchema.parse(await request.json());
    await requireRoutePolicy("/api/products/[id]/restock", "POST");
    const { workspaceOwnerId } = await getRequestUser();
    const { id } = await context.params;
    const product = await restockProduct(workspaceOwnerId, id, body.quantity);
    return NextResponse.json({ product });
  } catch (error) {
    return handleRouteError(error, "Gagal menambah stok.");
  }
}
