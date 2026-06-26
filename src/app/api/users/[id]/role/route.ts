import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { getRequestUser } from "@/lib/server/app-service";
import { logEvent } from "@/lib/server/audit";
import { handleRouteError } from "@/lib/server/route-error";
import {
  assignRole,
  countActivePimpinan,
  getWorkspaceUserRole,
  requireRole,
} from "@/lib/server/rbac";

export const runtime = "nodejs";

const RoleUpdateSchema = z
  .object({
    role: z.enum(["pengelola_keuangan", "kasir"], {
      error: "Role hanya boleh pengelola_keuangan atau kasir.",
    }),
  })
  .strict();

export async function PATCH(
  request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const actor = await getRequestUser();
    const { workspaceOwnerId } = await requireRole(["pimpinan"]);
    const { id } = await context.params;
    const body = RoleUpdateSchema.parse(await request.json());

    const before = await getWorkspaceUserRole(id, workspaceOwnerId);
    if (!before) {
      return NextResponse.json({ error: "User tidak ditemukan di workspace ini." }, { status: 404 });
    }

    if (before.isActive !== 1) {
      return NextResponse.json({ error: "User sudah nonaktif." }, { status: 400 });
    }

    if (before.role === "pimpinan") {
      const activePimpinan = await countActivePimpinan(workspaceOwnerId);
      if (id === actor.userId && activePimpinan <= 1) {
        return NextResponse.json(
          { error: "Pimpinan terakhir tidak boleh diturunkan." },
          { status: 400 }
        );
      }

      return NextResponse.json(
        { error: "Role pimpinan owner tidak boleh diubah dari halaman karyawan." },
        { status: 400 }
      );
    }

    const after = await assignRole(id, body.role, workspaceOwnerId);

    await logEvent({ workspaceOwnerId, actorUserId: actor.userId }, {
      eventType: "ROLE_CHANGED",
      entityType: "user",
      entityId: id,
      category: "auth",
      before: {
        role: before.role,
        isActive: before.isActive === 1,
      },
      after: {
        role: after.role,
        isActive: after.isActive === 1,
      },
      payload: {
        fromRole: before.role,
        toRole: after.role,
      },
    });

    return NextResponse.json({
      user: {
        id,
        role: after.role,
        isActive: after.isActive === 1,
      },
    });
  } catch (error) {
    return handleRouteError(error, "Gagal mengubah role user.");
  }
}
