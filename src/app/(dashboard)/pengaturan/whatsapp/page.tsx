import Link from "next/link";
import nextDynamic from "next/dynamic";
import { redirect } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { getRequestUser } from "@/lib/server/app-service";
import { requireRole } from "@/lib/server/rbac";

const WhatsAppReportSettings = nextDynamic(() =>
  import("@/components/tokomu/whatsapp-report-settings").then(
    (m) => m.WhatsAppReportSettings
  )
);

export const dynamic = "force-dynamic";

export default async function PengaturanWhatsAppPage() {
  try {
    await getRequestUser();
    await requireRole(["pimpinan", "pengelola_keuangan"]);
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
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <Link
            href="/pengaturan"
            className="mb-1 inline-flex items-center gap-1.5 text-xs font-medium text-muted-foreground hover:text-foreground"
          >
            <ArrowLeft className="size-3.5" />
            Kembali ke Pengaturan Toko
          </Link>
          <h1 className="font-heading text-2xl font-semibold">
            WhatsApp &amp; Auto Laporan (OpenWA)
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Atur koneksi gateway OpenWA, scan QR WhatsApp, nomor tujuan, dan jadwal kirim laporan mingguan/bulanan beserta PDF.
          </p>
        </div>
      </div>

      <WhatsAppReportSettings />
    </div>
  );
}

