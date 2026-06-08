import { NextRequest, NextResponse } from "next/server";
import { getRequestUser } from "@/lib/server/app-service";
import {
  deleteInvestor,
  getInvestor,
  updateInvestor,
} from "@/lib/server/investor-service";
import { handleRouteError } from "@/lib/server/route-error";
import { requireRole } from "@/lib/server/rbac";

export const runtime = "nodejs";

export async function GET(
  _request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  try {
    await requireRole(["pimpinan", "pengelola_keuangan"]);
    const { workspaceOwnerId } = await getRequestUser();
    const { id } = await context.params;
    const investor = await getInvestor(workspaceOwnerId, id);
    return NextResponse.json(investor);
  } catch (error) {
    return handleRouteError(error, "Gagal memuat detail investor.");
  }
}

export async function PATCH(
  request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  try {
    await requireRole(["pimpinan", "pengelola_keuangan"]);
    const { workspaceOwnerId } = await getRequestUser();
    const { id } = await context.params;
    const investor = await updateInvestor(workspaceOwnerId, id, await request.json());
    return NextResponse.json({ investor });
  } catch (error) {
    return handleRouteError(error, "Gagal memperbarui investor.");
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
    const investor = await deleteInvestor(workspaceOwnerId, id);
    return NextResponse.json({ investor });
  } catch (error) {
    return handleRouteError(error, "Gagal menghapus investor.");
  }
}
