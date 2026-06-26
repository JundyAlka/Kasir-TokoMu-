import { NextResponse } from "next/server";
import { getRequestUser } from "@/lib/server/app-service";
import { handleRouteError } from "@/lib/server/route-error";
import { listWorkspaceUsers, requireRole } from "@/lib/server/rbac";

export const runtime = "nodejs";

export async function GET() {
  try {
    await getRequestUser();
    const { workspaceOwnerId } = await requireRole(["pimpinan"]);
    const users = await listWorkspaceUsers(workspaceOwnerId);

    return NextResponse.json({ users });
  } catch (error) {
    return handleRouteError(error, "Gagal memuat daftar user.");
  }
}
