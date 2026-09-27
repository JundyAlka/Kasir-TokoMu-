"use client";

import dynamic from "next/dynamic";
import { Loader2 } from "lucide-react";

function TabLoadingFallback() {
  return (
    <div className="flex h-64 w-full items-center justify-center rounded-2xl border border-border/60 bg-card/40">
      <div className="flex flex-col items-center gap-2 text-muted-foreground">
        <Loader2 className="size-6 animate-spin text-primary" />
        <p className="text-sm font-medium">Memuat data pengeluaran & restok...</p>
      </div>
    </div>
  );
}

const PengeluaranRestokView = dynamic(
  () => import("@/components/warung/pengeluaran-restok-view").then((m) => m.PengeluaranRestokView),
  { ssr: false, loading: TabLoadingFallback }
);

export function PengeluaranClient() {
  return <PengeluaranRestokView />;
}
