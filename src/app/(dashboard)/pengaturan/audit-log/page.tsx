import { redirect } from "next/navigation";
import { AuditLogTable } from "@/components/tokomu/audit-log-table";
import { getRequestUser } from "@/lib/server/app-service";
import { requireRole } from "@/lib/server/rbac";

export default async function AuditLogPage() {
  try {
    await getRequestUser();
    await requireRole(["pimpinan"]);
  } catch (error) {
    if (error instanceof Error && error.message === "FORBIDDEN") {
      redirect("/dashboard");
    }

    if (error instanceof Error && error.message === "UNAUTHORIZED") {
      redirect("/auth");
    }

    throw error;
  }

  return (
    <div className="space-y-4">
      <div>
        <h1 className="font-heading text-2xl font-semibold">Audit log</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Riwayat semua aktivitas penting di workspace ini.
        </p>
      </div>
      <AuditLogTable />
    </div>
  );
}
