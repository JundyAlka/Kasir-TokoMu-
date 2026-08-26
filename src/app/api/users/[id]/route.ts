import { NextRequest, NextResponse } from "next/server";
import { getRequestUser } from "@/lib/server/app-service";
import { logEvent } from "@/lib/server/audit";
import { handleRouteError } from "@/lib/server/route-error";
import {
  countActivePimpinan,
  deactivateWorkspaceUser,
  getWorkspaceUserRole,
} from "@/lib/server/rbac";
import { requireRoutePolicy } from "@/lib/server/route-policy";

export const runtime = "nodejs";

export async function DELETE(
  _request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const actor = await getRequestUser();
    const { workspaceOwnerId } = await requireRoutePolicy("/api/users/[id]", "DELETE");
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

export async function PATCH(
  request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const actor = await getRequestUser();
    const { workspaceOwnerId } = await requireRoutePolicy("/api/users/[id]", "PATCH");
    const { id } = await context.params;
    const body = (await request.json()) as { name?: string };

    if (!body.name || !body.name.trim()) {
      return NextResponse.json({ error: "Nama karyawan wajib diisi." }, { status: 400 });
    }

    const before = await getWorkspaceUserRole(id, workspaceOwnerId);
    if (!before) {
      return NextResponse.json({ error: "User tidak ditemukan di workspace ini." }, { status: 404 });
    }

    const trimmedName = body.name.trim();
    const { pool } = await import("@/db/client");
    await pool.query(`update "user" set name = $1 where id = $2`, [trimmedName, id]);

    await logEvent({ workspaceOwnerId, actorUserId: actor.userId }, {
      eventType: "USER_UPDATED",
      entityType: "user",
      entityId: id,
      category: "auth",
      payload: { name: trimmedName },
    });

    return NextResponse.json({
      success: true,
      user: {
        id,
        name: trimmedName,
      },
    });
  } catch (error) {
    return handleRouteError(error, "Gagal mengubah nama karyawan.");
  }
}
