import { redirect } from "next/navigation";
import { LaporanTabs } from "@/components/tokomu/laporan-tabs";
import { getRequestUser } from "@/lib/server/app-service";
import type { Role } from "@/lib/server/rbac";

export const dynamic = "force-dynamic";

export default async function LaporanPage({
  searchParams,
}: {
  searchParams?: Promise<{ tab?: string }>;
}) {
  let role: Role = "pimpinan";
  try {
    const user = await getRequestUser();
    role = user.role;
  } catch {
    redirect("/auth");
  }

  const canManageImports = role === "pimpinan" || role === "pengelola_keuangan";
  const params = searchParams ? await searchParams : {};
  const allowedTabs = [
    "laba_rugi",
    "harian_shift",
    "aset_modal",
    "restok_pengeluaran",
    ...(canManageImports ? ["impor_transaksi"] : []),
  ];
  const initialTab =
    params?.tab && allowedTabs.includes(params.tab) ? params.tab : "laba_rugi";

  return (
    <div className="w-full space-y-6">
      <div className="flex flex-col gap-2 md:flex-row md:items-end md:justify-between">
        <div>
          <h1 className="font-heading text-3xl font-bold text-foreground">Laporan & Statistik</h1>
          <p className="text-muted-foreground mt-1">Pantau performa omzet, laba rugi, dan aset toko Anda.</p>
        </div>
      </div>

      <LaporanTabs initialTab={initialTab} canManageImports={canManageImports} />
    </div>
  );
}
