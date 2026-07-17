import { redirect } from "next/navigation";
import { PengaturanView } from "@/components/warung/pengaturan-view";
import { getRequestUser } from "@/lib/server/app-service";
import { requireRole } from "@/lib/server/rbac";
import type { Role } from "@/lib/server/rbac";

export default async function PengaturanPage() {
  let role: Role;

  try {
    await getRequestUser();
    const context = await requireRole(["pimpinan", "pengelola_keuangan", "kasir"]);
    role = context.role;
  } catch (error) {
    if (error instanceof Error && error.message === "FORBIDDEN") {
      redirect("/dashboard");
    }
    if (error instanceof Error && error.message === "UNAUTHORIZED") {
      redirect("/auth");
    }
    throw error;
  }

  return <PengaturanView role={role} />;
}
