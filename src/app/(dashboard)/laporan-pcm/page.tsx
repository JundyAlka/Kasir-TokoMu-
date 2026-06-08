import { forbidden } from "next/navigation";
import { MonthlyReportPreview } from "@/components/tokomu/monthly-report-preview";
import { getRequestUser } from "@/lib/server/app-service";
import { requireRole } from "@/lib/server/rbac";

export default async function LaporanPcmPage() {
  try {
    await requireRole(["pimpinan", "pengelola_keuangan"]);
  } catch (error) {
    if (error instanceof Error && error.message === "FORBIDDEN") {
      forbidden();
    }
    throw error;
  }

  await getRequestUser();

  return <MonthlyReportPreview />;
}
