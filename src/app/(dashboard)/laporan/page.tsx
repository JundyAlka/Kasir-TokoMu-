import { LaporanView } from "@/components/warung/laporan-view";
import { LaporanAsetView } from "@/components/warung/laporan-aset-view";
import { PengeluaranRestokView } from "@/components/warung/pengeluaran-restok-view";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

export default function LaporanPage() {
  return (
    <div className="space-y-6 max-w-7xl mx-auto">
      <div className="flex flex-col gap-2 md:flex-row md:items-end md:justify-between">
        <div>
          <h1 className="font-heading text-3xl font-bold text-foreground">Laporan & Statistik</h1>
          <p className="text-muted-foreground mt-1">Pantau performa omzet, laba rugi, dan aset toko Anda.</p>
        </div>
      </div>

      <Tabs defaultValue="laba_rugi" className="w-full">
        <div className="mb-6 overflow-x-auto pb-2 scrollbar-hide">
          <TabsList className="bg-card/60 p-1.5 border border-border/50 rounded-2xl min-w-max">
            <TabsTrigger value="laba_rugi" className="rounded-xl px-6 py-2.5 data-[state=active]:bg-primary data-[state=active]:text-primary-foreground data-[state=active]:shadow-md transition-all">
              Laba Rugi & Omzet
            </TabsTrigger>
            <TabsTrigger value="aset_modal" className="rounded-xl px-6 py-2.5 data-[state=active]:bg-primary data-[state=active]:text-primary-foreground data-[state=active]:shadow-md transition-all">
              Aset & Modal Awal
            </TabsTrigger>
            <TabsTrigger value="restok_pengeluaran" className="rounded-xl px-6 py-2.5 data-[state=active]:bg-primary data-[state=active]:text-primary-foreground data-[state=active]:shadow-md transition-all">
              Pengeluaran & Restok
            </TabsTrigger>
          </TabsList>
        </div>
        <TabsContent value="laba_rugi" className="mt-0 focus-visible:outline-none focus-visible:ring-0">
          <LaporanView />
        </TabsContent>
        <TabsContent value="aset_modal" className="mt-0 focus-visible:outline-none focus-visible:ring-0">
          <LaporanAsetView />
        </TabsContent>
        <TabsContent value="restok_pengeluaran" className="mt-0 focus-visible:outline-none focus-visible:ring-0">
          <PengeluaranRestokView />
        </TabsContent>
      </Tabs>
    </div>
  );
}
