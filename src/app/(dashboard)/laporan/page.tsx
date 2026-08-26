import { DailyShiftPanel, LaporanView } from "@/components/warung/laporan-view";
import { LaporanAsetView } from "@/components/warung/laporan-aset-view";
import { PengeluaranRestokView } from "@/components/warung/pengeluaran-restok-view";
import { TransactionImportPanel } from "@/components/tokomu/transaction-import-panel";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { getRequestUser } from "@/lib/server/app-service";

export default async function LaporanPage({
  searchParams,
}: {
  searchParams?: Promise<{ tab?: string }>;
}) {
  const { role } = await getRequestUser();
  const canManageImports = role === "pimpinan" || role === "pengelola_keuangan";
  const params = await searchParams;
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

      <Tabs defaultValue={initialTab} className="w-full">
        <div className="mb-6 overflow-x-auto pb-2 scrollbar-hide">
          <TabsList className="bg-muted/70 p-1.5 border border-border/70 rounded-2xl min-w-max shadow-inner">
            <TabsTrigger value="laba_rugi" className="rounded-xl px-6 py-2.5 font-semibold transition-all">
              Laba Rugi & Omzet
            </TabsTrigger>
            <TabsTrigger value="harian_shift" className="rounded-xl px-6 py-2.5 font-semibold transition-all">
              Harian & Shift
            </TabsTrigger>
            <TabsTrigger value="aset_modal" className="rounded-xl px-6 py-2.5 font-semibold transition-all">
              Aset & Modal Awal
            </TabsTrigger>
            <TabsTrigger value="restok_pengeluaran" className="rounded-xl px-6 py-2.5 font-semibold transition-all">
              Pengeluaran & Restok
            </TabsTrigger>
            {canManageImports ? (
              <TabsTrigger value="impor_transaksi" className="rounded-xl px-6 py-2.5 font-semibold transition-all">
                Impor Transaksi
              </TabsTrigger>
            ) : null}
          </TabsList>
        </div>
        <TabsContent value="laba_rugi" className="mt-0 focus-visible:outline-none focus-visible:ring-0">
          <LaporanView />
        </TabsContent>
        <TabsContent value="harian_shift" className="mt-0 focus-visible:outline-none focus-visible:ring-0">
          <DailyShiftPanel />
        </TabsContent>
        <TabsContent value="aset_modal" className="mt-0 focus-visible:outline-none focus-visible:ring-0">
          <LaporanAsetView />
        </TabsContent>
        <TabsContent value="restok_pengeluaran" className="mt-0 focus-visible:outline-none focus-visible:ring-0">
          <PengeluaranRestokView />
        </TabsContent>
        {canManageImports ? (
          <TabsContent value="impor_transaksi" className="mt-0 focus-visible:outline-none focus-visible:ring-0">
            <TransactionImportPanel />
          </TabsContent>
        ) : null}
      </Tabs>
    </div>
  );
}
