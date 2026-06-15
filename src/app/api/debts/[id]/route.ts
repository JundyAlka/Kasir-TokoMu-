import { NextRequest, NextResponse } from "next/server";
import { getRequestUser, markDebtPaid } from "@/lib/server/app-service";
import { handleRouteError } from "@/lib/server/route-error";
import { DebtUpdateSchema } from "@/lib/server/validation";

export const runtime = "nodejs";

export async function PATCH(
  request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  try {
    DebtUpdateSchema.parse(await request.json());
    const { workspaceOwnerId } = await getRequestUser();
    const { id } = await context.params;

    const debt = await markDebtPaid(workspaceOwnerId, id);
    return NextResponse.json({ debt });
  } catch (error) {
    return handleRouteError(error, "Gagal memperbarui status hutang.");
  }
}
