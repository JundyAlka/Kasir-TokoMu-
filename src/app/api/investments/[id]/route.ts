import { NextRequest, NextResponse } from "next/server";
import { getRequestUser } from "@/lib/server/app-service";
import {
  deactivateInvestment,
  updateInvestment,
} from "@/lib/server/investor-service";
import { handleRouteError } from "@/lib/server/route-error";
import { requireRole } from "@/lib/server/rbac";

export const runtime = "nodejs";

export async function PATCH(
  request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  try {
    await requireRole(["pimpinan", "pengelola_keuangan"]);
    const { workspaceOwnerId } = await getRequestUser();
    const { id } = await context.params;
    const investment = await updateInvestment(workspaceOwnerId, id, await request.json());
    return NextResponse.json({ investment });
  } catch (error) {
    return handleRouteError(error, "Gagal memperbarui investasi.");
  }
}

export async function DELETE(
  _request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  try {
    await requireRole(["pimpinan", "pengelola_keuangan"]);
    const { workspaceOwnerId } = await getRequestUser();
    const { id } = await context.params;
    const investment = await deactivateInvestment(workspaceOwnerId, id);
    return NextResponse.json({ investment });
  } catch (error) {
    return handleRouteError(error, "Gagal menghapus investasi.");
  }
}
