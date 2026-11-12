import { NextResponse } from "next/server";
import { handleRouteError } from "@/lib/server/route-error";
import { listWorkspaceUsers } from "@/lib/server/rbac";
import { requireRoutePolicy } from "@/lib/server/route-policy";

export const runtime = "nodejs";

export async function GET() {
  try {
    const { userId, role, workspaceOwnerId } = await requireRoutePolicy(
      "/api/auth/switchable-users",
      "GET"
    );

    const allUsers = await listWorkspaceUsers(workspaceOwnerId);

    const users = allUsers
      .filter((u) => u.id !== userId && u.isActive)
      .map((u) => ({
        id: u.id,
        name: u.name,
        email: u.email,
        role: u.role,
      }));

    return NextResponse.json({ users, currentRole: role });
  } catch (error) {
    return handleRouteError(error, "Gagal memuat daftar akun.");
  }
}
