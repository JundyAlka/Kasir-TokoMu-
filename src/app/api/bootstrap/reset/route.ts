import { NextResponse } from "next/server";
import { getRequestUser, resetWorkspace } from "@/lib/server/app-service";
import { handleRouteError } from "@/lib/server/route-error";
import { requireRole } from "@/lib/server/rbac";

export const runtime = "nodejs";

export async function POST() {
  try {
    await requireRole(["pimpinan"]);
    const { workspaceOwnerId } = await getRequestUser();
    const appState = await resetWorkspace(workspaceOwnerId);
    return NextResponse.json({ appState });
  } catch (error) {
    return handleRouteError(error, "Gagal mereset workspace.", 500);
  }
}
