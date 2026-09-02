import { Suspense } from "react";
import { redirect } from "next/navigation";
import { MonthlyReportPreview } from "@/components/tokomu/monthly-report-preview";
import { getRequestUser } from "@/lib/server/app-service";
import { requireRole } from "@/lib/server/rbac";

export const dynamic = "force-dynamic";

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

  return (
    <Suspense fallback={<div className="p-8 text-center text-muted-foreground">Memuat laporan PCM...</div>}>
      <MonthlyReportPreview />
    </Suspense>
  );
}

