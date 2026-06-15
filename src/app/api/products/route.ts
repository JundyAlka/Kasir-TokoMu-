import { NextRequest, NextResponse } from "next/server";
import { createProduct, getRequestUser } from "@/lib/server/app-service";
import { handleRouteError } from "@/lib/server/route-error";
import { requireRole } from "@/lib/server/rbac";
import { ProductCreateSchema } from "@/lib/server/validation";

export const runtime = "nodejs";

export async function POST(request: NextRequest) {
  try {
    const draft = ProductCreateSchema.parse(await request.json());
    await requireRole(["pimpinan", "pengelola_keuangan"]);
    const { workspaceOwnerId } = await getRequestUser();
    const product = await createProduct(workspaceOwnerId, draft);
    return NextResponse.json({ product });
  } catch (error) {
    return handleRouteError(error, "Gagal menambah produk.");
  }
}
