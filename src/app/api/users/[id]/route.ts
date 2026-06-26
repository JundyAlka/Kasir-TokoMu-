import { NextRequest, NextResponse } from "next/server";
import { getRequestUser } from "@/lib/server/app-service";
import { logEvent } from "@/lib/server/audit";
import { handleRouteError } from "@/lib/server/route-error";
import {
  countActivePimpinan,
  deactivateWorkspaceUser,
  getWorkspaceUserRole,
  requireRole,
} from "@/lib/server/rbac";

export const runtime = "nodejs";

export async function DELETE(
  _request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const actor = await getRequestUser();
    const { workspaceOwnerId } = await requireRole(["pimpinan"]);
    const { id } = await context.params;

    const before = await getWorkspaceUserRole(id, workspaceOwnerId);
    if (!before) {
      return NextResponse.json({ error: "User tidak ditemukan di workspace ini." }, { status: 404 });
    }

    if (before.isActive !== 1) {
      return NextResponse.json({
        user: {
          id,
          role: before.role,
          isActive: false,
        },
      });
    }

    if (before.role === "pimpinan") {
      const activePimpinan = await countActivePimpinan(workspaceOwnerId);
      if (activePimpinan <= 1) {
        return NextResponse.json(
          { error: "Pimpinan terakhir tidak boleh dinonaktifkan." },
          { status: 400 }
        );
      }
    }

    const after = await deactivateWorkspaceUser(id, workspaceOwnerId);
    if (!after) {
      return NextResponse.json({ error: "User tidak ditemukan di workspace ini." }, { status: 404 });
    }

    await logEvent({ workspaceOwnerId, actorUserId: actor.userId }, {
      eventType: "USER_DEACTIVATED",
      entityType: "user",
      entityId: id,
      category: "auth",
      before: {
        role: before.role,
        isActive: true,
      },
      after: {
        role: after.role,
        isActive: false,
      },
      payload: {
        role: after.role,
      },
    });

    return NextResponse.json({
      user: {
        id,
        role: after.role,
        isActive: false,
      },
    });
  } catch (error) {
    return handleRouteError(error, "Gagal menonaktifkan user.");
  }
}
