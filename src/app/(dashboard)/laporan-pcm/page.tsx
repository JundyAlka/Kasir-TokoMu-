import { redirect } from "next/navigation";
import { MonthlyReportPreview } from "@/components/tokomu/monthly-report-preview";
import { getRequestUser } from "@/lib/server/app-service";
import { requireRole } from "@/lib/server/rbac";

export default async function LaporanPcmPage() {
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

  return <MonthlyReportPreview />;
}

