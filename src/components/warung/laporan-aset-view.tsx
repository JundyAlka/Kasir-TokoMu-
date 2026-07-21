"use client";

import { useEffect, useState } from "react";
import { Coins, HandCoins, Loader2, Package, WalletCards } from "lucide-react";
import { toast } from "sonner";
import { StatCard } from "@/components/stat-card";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { formatCompactCurrency, formatCurrency } from "@/lib/format";

type AssetCapitalSummary = {
  inventoryCapital: number;
  activeReceivables: number;
  investorMoneyCapital: number;
  consignmentCapital: number;
};

const emptySummary: AssetCapitalSummary = {
  inventoryCapital: 0,
  activeReceivables: 0,
  investorMoneyCapital: 0,
  consignmentCapital: 0,
};

export function LaporanAsetView() {
  const [summary, setSummary] = useState<AssetCapitalSummary>(emptySummary);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    let active = true;

    async function fetchAssets() {
      try {
        const response = await fetch("/api/reports/assets", { cache: "no-store" });
        const data = await response.json();
        
        if (!response.ok) {
          throw new Error(data?.error ?? "Gagal memuat laporan aset.");
        }
        
        if (active) {
          setSummary(data);
        }
      } catch (error) {
        if (!active) return;
        toast.error(error instanceof Error ? error.message : "Gagal memuat laporan aset.");
        setSummary(emptySummary);
      } finally {
        if (active) setIsLoading(false);
      }
    }

    void fetchAssets();

    return () => {
      active = false;
    };
  }, []);

  const totalAssets = summary.inventoryCapital + summary.activeReceivables;
  const totalCapital = summary.investorMoneyCapital + summary.consignmentCapital;

  return (
    <div className="space-y-4 animate-in fade-in slide-in-from-bottom-2 duration-500">
      <section className="grid gap-4 grid-cols-2 md:grid-cols-4">
        <StatCard
          title="Total Modal Barang"
          value={formatCompactCurrency(summary.inventoryCapital)}
          description="Nilai beli total semua stok aktif."

        />
        <StatCard
          title="Piutang Aktif"
          value={formatCompactCurrency(summary.activeReceivables)}
          description="Uang di luar dari tagihan pelanggan."
          tone="accent"

        />
        <StatCard
          title="Modal Uang Investor"
          value={formatCompactCurrency(summary.investorMoneyCapital)}
          description="Total uang disuntikkan ke toko."

        />
        <StatCard
          title="Modal Barang Titipan"
          value={formatCompactCurrency(summary.consignmentCapital)}
          description="Nilai beli dari produk konsinyasi."
          tone="warn"

        />
      </section>

      <div className="grid gap-4 lg:grid-cols-2">
        <Card className="border-border/60 bg-card/74 shadow-[0_28px_70px_-45px_rgba(66,38,20,0.55)] relative overflow-hidden">
          <div className="absolute -right-12 -top-12 size-40 rounded-full bg-primary/5 blur-3xl" />
          <CardHeader>
            <div className="flex items-center gap-3">
              <div className="flex size-10 items-center justify-center rounded-2xl bg-primary/10 text-primary">
                <Package className="size-5" />
              </div>
              <div>
                <CardTitle className="font-heading text-xl">Aset Aktif Toko</CardTitle>
                <CardDescription>
                  Nilai aset dan piutang saat ini
                </CardDescription>
              </div>
            </div>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="rounded-[24px] border border-border/70 bg-card/80 p-5 shadow-sm">
              <p className="text-sm font-medium text-muted-foreground">Estimasi Total Aset Barang & Piutang</p>
              <p className="mt-1 font-heading text-4xl font-bold tracking-tight text-primary">
                {isLoading ? (
                  <Loader2 className="size-6 animate-spin text-primary mt-2" />
                ) : (
                  formatCurrency(totalAssets)
                )}
              </p>
            </div>
            
            <div className="space-y-4 rounded-[20px] bg-muted/30 p-4">
              <div className="flex items-center justify-between border-b border-border/50 pb-3">
                <div className="flex items-center gap-2">
                  <div className="size-2 rounded-full bg-primary/70" />
                  <span className="text-sm font-medium text-foreground/80">Stok Barang (HPP)</span>
                </div>
                <span className="font-semibold">{formatCurrency(summary.inventoryCapital)}</span>
              </div>
              <div className="flex items-center justify-between pt-1">
                <div className="flex items-center gap-2">
                  <div className="size-2 rounded-full bg-orange-400/70" />
                  <span className="text-sm font-medium text-foreground/80">Piutang Pelanggan</span>
                </div>
                <span className="font-semibold">{formatCurrency(summary.activeReceivables)}</span>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="border-border/60 bg-card/74 shadow-[0_28px_70px_-45px_rgba(66,38,20,0.55)] relative overflow-hidden">
          <div className="absolute -left-12 -bottom-12 size-40 rounded-full bg-accent/5 blur-3xl" />
          <CardHeader>
            <div className="flex items-center gap-3">
              <div className="flex size-10 items-center justify-center rounded-2xl bg-accent/10 text-accent-foreground">
                <WalletCards className="size-5" />
              </div>
              <div>
                <CardTitle className="font-heading text-xl">Rekap Modal Awal</CardTitle>
                <CardDescription>
                  Sumber modal investasi dan titipan
                </CardDescription>
              </div>
            </div>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="rounded-[24px] border border-border/70 bg-card/80 p-5 shadow-sm">
              <p className="text-sm font-medium text-muted-foreground">Total Nilai Investasi</p>
              <p className="mt-1 font-heading text-4xl font-bold tracking-tight">
                {isLoading ? (
                  <Loader2 className="size-6 animate-spin text-muted-foreground mt-2" />
                ) : (
                  formatCurrency(totalCapital)
                )}
              </p>
            </div>
            
            <div className="space-y-4 rounded-[20px] bg-muted/30 p-4">
              <div className="flex items-center justify-between border-b border-border/50 pb-3">
                <div className="flex items-center gap-2">
                  <Coins className="size-4 text-primary/70" />
                  <span className="text-sm font-medium text-foreground/80">Modal Uang Tunai</span>
                </div>
                <span className="font-semibold">{formatCurrency(summary.investorMoneyCapital)}</span>
              </div>
              <div className="flex items-center justify-between pt-1">
                <div className="flex items-center gap-2">
                  <HandCoins className="size-4 text-orange-400/70" />
                  <span className="text-sm font-medium text-foreground/80">Modal Barang Titipan</span>
                </div>
                <span className="font-semibold">{formatCurrency(summary.consignmentCapital)}</span>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
