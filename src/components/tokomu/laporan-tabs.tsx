"use client";

import { useState } from "react";
import dynamic from "next/dynamic";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Loader2 } from "lucide-react";

function TabLoadingFallback() {
  return (
    <div className="flex h-64 w-full items-center justify-center rounded-2xl border border-border/60 bg-card/40">
      <div className="flex flex-col items-center gap-2 text-muted-foreground">
        <Loader2 className="size-6 animate-spin text-primary" />
        <p className="text-sm font-medium">Memuat data laporan...</p>
      </div>
    </div>
  );
}

const LaporanView = dynamic(
  () => import("@/components/warung/laporan-view").then((m) => m.LaporanView),
  { ssr: false, loading: TabLoadingFallback }
);
const DailyShiftPanel = dynamic(
  () => import("@/components/warung/laporan-view").then((m) => m.DailyShiftPanel),
  { ssr: false, loading: TabLoadingFallback }
);
const LaporanAsetView = dynamic(
  () => import("@/components/warung/laporan-aset-view").then((m) => m.LaporanAsetView),
  { ssr: false, loading: TabLoadingFallback }
);
const PengeluaranRestokView = dynamic(
  () => import("@/components/warung/pengeluaran-restok-view").then((m) => m.PengeluaranRestokView),
  { ssr: false, loading: TabLoadingFallback }
);
const TransactionImportPanel = dynamic(
  () => import("@/components/tokomu/transaction-import-panel").then((m) => m.TransactionImportPanel),
  { ssr: false, loading: TabLoadingFallback }
);

export function LaporanTabs({
  initialTab,
  canManageImports,
}: {
  initialTab: string;
  canManageImports: boolean;
}) {
  const [activeTab, setActiveTab] = useState(initialTab);
  const [visitedTabs, setVisitedTabs] = useState<Record<string, boolean>>({
    [initialTab]: true,
  });

  const handleTabChange = (value: string | number) => {
    const tabStr = String(value);
    setActiveTab(tabStr);
    setVisitedTabs((prev) => (prev[tabStr] ? prev : { ...prev, [tabStr]: true }));
  };

  return (
    <Tabs value={activeTab} onValueChange={handleTabChange} className="w-full">
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
        {visitedTabs["laba_rugi"] ? <LaporanView /> : null}
      </TabsContent>

      <TabsContent value="harian_shift" className="mt-0 focus-visible:outline-none focus-visible:ring-0">
        {visitedTabs["harian_shift"] ? <DailyShiftPanel /> : null}
      </TabsContent>

      <TabsContent value="aset_modal" className="mt-0 focus-visible:outline-none focus-visible:ring-0">
        {visitedTabs["aset_modal"] ? <LaporanAsetView /> : null}
      </TabsContent>

      <TabsContent value="restok_pengeluaran" className="mt-0 focus-visible:outline-none focus-visible:ring-0">
        {visitedTabs["restok_pengeluaran"] ? <PengeluaranRestokView /> : null}
      </TabsContent>

      {canManageImports ? (
        <TabsContent value="impor_transaksi" className="mt-0 focus-visible:outline-none focus-visible:ring-0">
          {visitedTabs["impor_transaksi"] ? <TransactionImportPanel /> : null}
        </TabsContent>
      ) : null}
    </Tabs>
  );
}
