import { NextResponse } from "next/server";
import { getRequestUser, resetWorkspace } from "@/lib/server/app-service";
import { logEvent } from "@/lib/server/audit";
import { handleRouteError } from "@/lib/server/route-error";
import { requireRole } from "@/lib/server/rbac";

export const runtime = "nodejs";

export async function POST() {
  try {
    await requireRole(["pimpinan"]);
    const { userId, workspaceOwnerId } = await getRequestUser();
    const appState = await resetWorkspace(workspaceOwnerId);
    await logEvent(
      { workspaceOwnerId, actorUserId: userId },
      "RESET_WORKSPACE",
      { type: "workspace", id: workspaceOwnerId },
      { productCount: appState.products.length, transactionCount: appState.transactions.length }
    );
    return NextResponse.json({ appState });
  } catch (error) {
    return handleRouteError(error, "Gagal mereset workspace.", 500);
  }
}
