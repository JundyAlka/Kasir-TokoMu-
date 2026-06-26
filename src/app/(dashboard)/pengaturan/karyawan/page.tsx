import { redirect } from "next/navigation";
import { KaryawanClient } from "@/components/warung/karyawan-client";
import { getRequestUser } from "@/lib/server/app-service";
import { listWorkspaceUsers, requireRole } from "@/lib/server/rbac";
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

  const users = await listWorkspaceUsers(workspaceOwnerId);

  return <KaryawanClient currentRole={role} initialUsers={users} />;
}
