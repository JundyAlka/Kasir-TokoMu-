import { NextResponse } from "next/server";
import { getRequestUser } from "@/lib/server/app-service";
import { handleRouteError } from "@/lib/server/route-error";
import { listWorkspaceUsers } from "@/lib/server/rbac";
import { requireRoutePolicy } from "@/lib/server/route-policy";

export const runtime = "nodejs";

export async function GET() {
  try {
    await getRequestUser();
    const { workspaceOwnerId } = await requireRoutePolicy("/api/users", "GET");
    const users = await listWorkspaceUsers(workspaceOwnerId);

    return NextResponse.json({ users });
  } catch (error) {
    return handleRouteError(error, "Gagal memuat daftar user.");
  }
}
