"use client";

import { useEffect, useMemo, useState } from "react";
import { Download, Loader2, Printer, TrendingUp } from "lucide-react";
import { toast } from "sonner";
import { useAppState } from "@/components/providers/app-state-provider";
import { StatCard } from "@/components/stat-card";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { formatCompactCurrency, formatCurrency, formatDate } from "@/lib/format";
import { buildSeries, estimateProductVelocity } from "@/lib/reporting";

type ProfitLossSummary = {
  periodStart: string;
  periodEnd: string;
  revenue: number;
  cogs: number;
  grossProfit: number;
  expenseTotal: number;
  netProfit: number;
  transactionCount: number;
  averageTicket: number;
};

function currentMonthValue() {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
}

const emptySummary: ProfitLossSummary = {
  periodStart: "",
  periodEnd: "",
  revenue: 0,
  cogs: 0,
  grossProfit: 0,
  expenseTotal: 0,
  netProfit: 0,
  transactionCount: 0,
  averageTicket: 0,
};

export function LaporanView() {
  const { transactions, products, settings } = useAppState();
  const [period, setPeriod] = useState(currentMonthValue());
  const [summary, setSummary] = useState<ProfitLossSummary>(emptySummary);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    let active = true;

    void fetch(`/api/reports/profit-loss?period=${period}`, { cache: "no-store" })
      .then(async (response) => {
        const data = (await response.json().catch(() => null)) as
          | (ProfitLossSummary & { error?: string })
          | null;
        if (!response.ok || !data) {
          throw new Error(data?.error ?? "Gagal memuat laporan periode.");
        }
        if (active) setSummary(data);
      })
      .catch((error) => {
        if (!active) return;
        toast.error(error instanceof Error ? error.message : "Gagal memuat laporan periode.");
        setSummary(emptySummary);
      })
      .finally(() => {
        if (active) setIsLoading(false);
      });

    return () => {
      active = false;
    };
  }, [period]);

  const series = useMemo(() => buildSeries("bulanan", transactions), [transactions]);
  const topVelocity = useMemo(
    () => estimateProductVelocity(products, transactions).slice(0, 4),
    [products, transactions]
  );
  const highestValue = Math.max(...series.map((item) => item.revenue), 1);
  const periodLabel = new Intl.DateTimeFormat("id-ID", {
    month: "long",
    year: "numeric",
  }).format(new Date(`${period}-01T00:00:00`));

  return (
    <div className="space-y-4">
      <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <StatCard
          title="Omzet"
          value={formatCompactCurrency(summary.revenue)}
          description={`Total pemasukan untuk ${periodLabel}.`}
        />
        <StatCard
          title="Laba kotor"
          value={formatCompactCurrency(summary.grossProfit)}
          description={`HPP periode ini ${formatCompactCurrency(summary.cogs)}.`}
          tone="accent"
        />
        <StatCard
          title="Pengeluaran"
          value={formatCompactCurrency(summary.expenseTotal)}
          description="Biaya operasional yang tercatat di periode ini."
        />
        <StatCard
          title="Laba bersih"
          value={formatCompactCurrency(summary.netProfit)}
          description="Omzet dikurangi HPP dan beban periode."
          tone="warn"
        />
      </section>

      <div className="grid gap-4 xl:grid-cols-[1.05fr_0.95fr]">
        <Card className="border-border/60 bg-card/74 shadow-[0_28px_70px_-45px_rgba(66,38,20,0.55)]">
          <CardHeader className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
            <div>
              <CardTitle className="font-heading text-2xl">Ringkasan untung rugi</CardTitle>
              <CardDescription>
                Angka utama diambil dari API laporan periode yang sama dengan perhitungan bagi hasil.
              </CardDescription>
            </div>

            <div className="grid gap-2">
              <Label htmlFor="report-period">Periode</Label>
              <div className="relative">
                <Input
                  id="report-period"
                  type="month"
                  value={period}
                  onChange={(event) => {
                    setIsLoading(true);
                    setPeriod(event.target.value);
                  }}
                  className="h-11 rounded-2xl pr-10"
                />
                {isLoading ? (
                  <Loader2 className="absolute top-1/2 right-3 size-4 -translate-y-1/2 animate-spin text-muted-foreground" />
                ) : null}
              </div>
            </div>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="rounded-[26px] border border-border/70 bg-card/80 p-5">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-muted-foreground">Tren omzet 6 bulan</p>
                  <p className="mt-2 font-heading text-3xl font-semibold">{formatCurrency(summary.revenue)}</p>
                </div>
                <div className="rounded-full bg-accent px-4 py-2 text-sm font-medium text-accent-foreground">
                  {summary.transactionCount} transaksi
                </div>
              </div>

              <div className="mt-6 flex h-52 items-end gap-3">
                {series.map((item) => (
                  <div key={item.label} className="flex flex-1 flex-col items-center gap-3">
                    <div className="flex w-full flex-1 items-end">
                      <div
                        className="w-full rounded-t-[18px] bg-gradient-to-t from-primary to-chart-3 shadow-[0_18px_28px_-18px_rgba(186,92,35,0.8)]"
                        style={{
                          height: `${Math.max(14, (item.revenue / highestValue) * 100)}%`,
                        }}
                      />
                    </div>
                    <div className="text-center">
                      <p className="text-xs font-medium text-foreground">{item.label}</p>
                      <p className="mt-1 text-[11px] text-muted-foreground">
                        {formatCompactCurrency(item.revenue)}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            <div className="grid gap-4 lg:grid-cols-2">
              <div className="rounded-[26px] border border-border/70 bg-card/80 p-5">
                <p className="text-sm text-muted-foreground">Rata-rata tiket</p>
                <p className="mt-2 font-heading text-3xl font-semibold">
                  {formatCurrency(summary.averageTicket)}
                </p>
                <p className="mt-2 text-sm text-muted-foreground">
                  Nilai rata-rata per transaksi untuk {periodLabel}.
                </p>
              </div>

              <div className="rounded-[26px] border border-border/70 bg-card/80 p-5">
                <p className="text-sm text-muted-foreground">Produk paling bergerak</p>
                <div className="mt-4 space-y-3">
                  {topVelocity.map((item) => (
                    <div key={item.productId} className="flex items-center justify-between gap-3">
                      <span className="text-sm font-medium">{item.name}</span>
                      <span className="text-sm text-muted-foreground">{item.sold} terjual</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="border-border/60 bg-card/74 shadow-[0_28px_70px_-45px_rgba(66,38,20,0.55)]">
          <CardHeader className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <CardTitle className="font-heading text-2xl">Preview laporan PDF</CardTitle>
              <CardDescription>
                Preview memakai angka untung-rugi nyata dari database.
              </CardDescription>
            </div>
            <div className="flex gap-2">
              <Button
                type="button"
                variant="outline"
                className="rounded-full"
                onClick={() => toast.info("Mode print browser belum diaktifkan.")}
              >
                <Printer className="size-4" />
                Preview print
              </Button>
              <Button
                type="button"
                className="rounded-full"
                onClick={() => toast.info("Cetak PDF masih menunggu generator PDF.")}
              >
                <Download className="size-4" />
                Cetak PDF
              </Button>
            </div>
          </CardHeader>
          <CardContent>
            <div className="rounded-[30px] bg-card/78 p-6 shadow-inner ring-1 ring-border/80 dark:bg-muted/35 dark:ring-border/70">
              <div className="flex items-start justify-between gap-4 border-b border-dashed border-border/80 pb-5">
                <div>
                  <p className="text-sm uppercase tracking-[0.22em] text-primary">TokoMu report</p>
                  <h3 className="mt-2 font-heading text-3xl font-semibold">{settings.storeName}</h3>
                  <p className="mt-2 text-sm text-muted-foreground">
                    {[settings.storeTagline, settings.city].filter(Boolean).join(" • ")}
                  </p>
                  <p className="mt-2 max-w-xl text-sm text-muted-foreground">
                    {settings.storeAddress}
                  </p>
                </div>
                <div className="rounded-[22px] bg-muted/70 px-4 py-3 text-right text-foreground ring-1 ring-border/70">
                  <p className="text-xs uppercase tracking-[0.18em] text-muted-foreground">{periodLabel}</p>
                  <p className="mt-2 font-heading text-2xl font-semibold">{formatCurrency(summary.netProfit)}</p>
                </div>
              </div>

              <div className="grid gap-4 border-b border-dashed border-border/80 py-5 sm:grid-cols-2">
                <div className="rounded-[22px] bg-card p-4 ring-1 ring-border/70">
                  <p className="text-sm text-muted-foreground">Omzet</p>
                  <p className="mt-2 text-2xl font-semibold">{formatCurrency(summary.revenue)}</p>
                </div>
                <div className="rounded-[22px] bg-card p-4 ring-1 ring-border/70">
                  <p className="text-sm text-muted-foreground">HPP</p>
                  <p className="mt-2 text-2xl font-semibold">{formatCurrency(summary.cogs)}</p>
                </div>
                <div className="rounded-[22px] bg-card p-4 ring-1 ring-border/70">
                  <p className="text-sm text-muted-foreground">Beban</p>
                  <p className="mt-2 text-2xl font-semibold">{formatCurrency(summary.expenseTotal)}</p>
                </div>
                <div className="rounded-[22px] bg-card p-4 ring-1 ring-border/70">
                  <p className="text-sm text-muted-foreground">Laba bersih</p>
                  <p className="mt-2 text-2xl font-semibold">{formatCurrency(summary.netProfit)}</p>
                </div>
              </div>

              <div className="space-y-4 py-5">
                <div className="flex items-center gap-2 text-sm font-medium text-foreground">
                  <TrendingUp className="size-4 text-primary" />
                  Catatan untuk pemilik warung
                </div>
                <ul className="space-y-3 text-sm text-muted-foreground">
                  <li className="rounded-[18px] bg-card px-4 py-3 ring-1 ring-border/70">
                    Laba bersih {periodLabel} tercatat {formatCurrency(summary.netProfit)}.
                  </li>
                  <li className="rounded-[18px] bg-card px-4 py-3 ring-1 ring-border/70">
                    Laba kotor {formatCurrency(summary.grossProfit)} setelah HPP {formatCurrency(summary.cogs)}.
                  </li>
                  <li className="rounded-[18px] bg-card px-4 py-3 ring-1 ring-border/70">
                    Data laporan ini memakai API `/api/reports/profit-loss` yang sama dengan basis perhitungan bagi hasil.
                  </li>
                </ul>
              </div>

              <div className="flex items-center justify-between border-t border-dashed border-border/80 pt-5 text-sm text-muted-foreground">
                <span>Disusun otomatis oleh TokoMu</span>
                <span>{formatDate(new Date().toISOString())}</span>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
