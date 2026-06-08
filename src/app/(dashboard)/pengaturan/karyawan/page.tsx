import { redirect } from "next/navigation";
import { pool } from "@/db/client";
import { KaryawanClient, type WorkspaceUser } from "@/components/warung/karyawan-client";
import { getRequestUser } from "@/lib/server/app-service";
import { requireRole } from "@/lib/server/rbac";
import type { Role } from "@/lib/server/rbac";

export default async function KaryawanPage() {
  let role: Role;
  let workspaceOwnerId: string;

  try {
    await getRequestUser();
    const context = await requireRole(["pimpinan"]);
    role = context.role;
    workspaceOwnerId = context.workspaceOwnerId;
  } catch (error) {
    if (error instanceof Error && error.message === "FORBIDDEN") {
      redirect("/dashboard");
    }

    if (error instanceof Error && error.message === "UNAUTHORIZED") {
      redirect("/auth");
    }

    throw error;
  }

  const result = await pool.query<WorkspaceUser>(
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

  return <KaryawanClient currentRole={role} initialUsers={result.rows} />;
}
