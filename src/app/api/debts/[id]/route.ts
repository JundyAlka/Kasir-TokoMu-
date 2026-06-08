import { NextRequest, NextResponse } from "next/server";
import { getRequestUser, markDebtPaid } from "@/lib/server/app-service";
import { handleRouteError } from "@/lib/server/route-error";

export const runtime = "nodejs";

export async function PATCH(
  request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const { workspaceOwnerId } = await getRequestUser();
    const { id } = await context.params;
    const body = (await request.json()) as { isPaid?: boolean };

    if (body.isPaid !== true) {
      return NextResponse.json(
        { error: "Hanya perubahan status lunas yang didukung." },
        { status: 400 }
      );
    }

    const debt = await markDebtPaid(workspaceOwnerId, id);
    return NextResponse.json({ debt });
  } catch (error) {
    return handleRouteError(error, "Gagal memperbarui status hutang.");
  }
}
