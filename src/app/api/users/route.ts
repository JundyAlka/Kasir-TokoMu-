import { NextResponse } from "next/server";
import { pool } from "@/db/client";
import { getRequestUser } from "@/lib/server/app-service";
import { handleRouteError } from "@/lib/server/route-error";
import { requireRole } from "@/lib/server/rbac";

export const runtime = "nodejs";

export async function GET() {
  try {
    await getRequestUser();
    const { workspaceOwnerId } = await requireRole(["pimpinan"]);
    const result = await pool.query(
      `
        select
          u.id,
          u.name,
          u.email,
          ur.role
        from user_roles ur
        join "user" u on u.id = ur.user_id
        where ur.workspace_owner_id = $1
        order by
          case ur.role
            when 'pimpinan' then 0
            when 'pengelola_keuangan' then 1
            else 2
          end,
          u.name asc
      `,
      [workspaceOwnerId]
    );

    return NextResponse.json({ users: result.rows });
  } catch (error) {
    return handleRouteError(error, "Gagal memuat daftar user.");
  }
}
