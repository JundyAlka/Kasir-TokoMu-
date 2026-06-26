"use client";

import { useCallback, useEffect, useState } from "react";
import {
  AlertTriangle,
  ArrowDown,
  ArrowUp,
  Clock,
  Loader2,
  Package,
  TrendingDown,
  TrendingUp,
  Users,
  Wallet,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { ScrollArea } from "@/components/ui/scroll-area";
import { formatCurrency } from "@/lib/format";
import { cn } from "@/lib/utils";

export type DashboardMetric = "omzet" | "transaksi" | "stok" | "kasbon";

interface MetricDetailDialogProps {
  metric: DashboardMetric | null;
  onClose: () => void;
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type MetricData = any;

const METRIC_TITLES: Record<DashboardMetric, string> = {
  omzet: "Detail Omzet Hari Ini",
  transaksi: "Detail Transaksi Hari Ini",
  stok: "Stok Menipis — Rincian",
  kasbon: "Kasbon Aktif — Rincian",
};

const METRIC_DESCRIPTIONS: Record<DashboardMetric, string> = {
  omzet: "Analisis pendapatan, laba kotor, margin, dan tren per jam.",
  transaksi: "Ringkasan jumlah transaksi, produk terjual, dan distribusi per jam.",
  stok: "Daftar produk yang stoknya mendekati atau di bawah batas minimum.",
  kasbon: "Total piutang, status overdue, dan daftar pelanggan berhutang.",
};

// -- Tiny sub-components --

function StatRow({
  label,
  value,
  tone,
}: {
  label: string;
  value: string;
  tone?: "default" | "positive" | "negative" | "warn";
}) {
  return (
    <div className="flex items-center justify-between gap-3 py-2">
      <span className="text-sm text-muted-foreground">{label}</span>
      <span
        className={cn(
          "font-medium tabular-nums",
          tone === "positive" && "text-emerald-600 dark:text-emerald-400",
          tone === "negative" && "text-red-600 dark:text-red-400",
          tone === "warn" && "text-amber-600 dark:text-amber-400"
        )}
      >
        {value}
      </span>
    </div>
  );
}

function TrendBadge({ pct }: { pct: number | null }) {
  if (pct === null) {
    return (
      <Badge variant="secondary" className="gap-1 rounded-full text-xs">
        — Belum ada data kemarin
      </Badge>
    );
  }

  const isPositive = pct >= 0;
  return (
    <Badge
      className={cn(
        "gap-1 rounded-full border text-xs",
        isPositive
          ? "border-emerald-200 bg-emerald-50 text-emerald-700 dark:border-emerald-800 dark:bg-emerald-900/30 dark:text-emerald-400"
          : "border-red-200 bg-red-50 text-red-700 dark:border-red-800 dark:bg-red-900/30 dark:text-red-400"
      )}
    >
      {isPositive ? (
        <TrendingUp className="size-3" />
      ) : (
        <TrendingDown className="size-3" />
      )}
      {isPositive ? "+" : ""}
      {pct.toFixed(1)}% vs kemarin
    </Badge>
  );
}

function MiniBarChart({
  data,
  valueKey,
  maxHour = 23,
}: {
  data: { hour: number; [key: string]: number }[];
  valueKey: string;
  maxHour?: number;
}) {
  const values = data.map((d) => d[valueKey] as number);
  const maxVal = Math.max(...values, 1);

  // Only show hours 5-23 for readability
  const sliced = data.filter((d) => d.hour >= 5 && d.hour <= maxHour);

  return (
    <div className="mt-3">
      <p className="mb-2 text-xs font-medium text-muted-foreground">Distribusi per jam</p>
      <div className="flex items-end gap-[2px]" style={{ height: 72 }}>
        {sliced.map((d) => {
          const val = d[valueKey] as number;
          const h = maxVal > 0 ? (val / maxVal) * 100 : 0;
          return (
            <div
              key={d.hour}
              className="group relative flex-1 cursor-default rounded-t-sm transition-colors"
              style={{ minWidth: 4 }}
            >
              <div
                className="w-full rounded-t-sm bg-primary/60 transition-all group-hover:bg-primary"
                style={{ height: `${Math.max(h, 2)}%` }}
              />
              <div className="pointer-events-none absolute -top-8 left-1/2 hidden -translate-x-1/2 whitespace-nowrap rounded bg-foreground px-1.5 py-0.5 text-[10px] text-background group-hover:block">
                {String(d.hour).padStart(2, "0")}:00 — {val.toLocaleString("id-ID")}
              </div>
            </div>
          );
        })}
      </div>
      <div className="mt-1 flex justify-between text-[10px] text-muted-foreground">
        <span>05:00</span>
        <span>12:00</span>
        <span>18:00</span>
        <span>23:00</span>
      </div>
    </div>
  );
}

function PaymentMethodBreakdown({
  data,
}: {
  data: { method: string; total: number; count: number }[];
}) {
  const grandTotal = data.reduce((sum, d) => sum + d.total, 0);

  return (
    <div className="mt-3 space-y-2">
      <p className="text-xs font-medium text-muted-foreground">Per metode bayar</p>
      {data.map((d) => {
        const pct = grandTotal > 0 ? (d.total / grandTotal) * 100 : 0;
        return (
          <div key={d.method} className="space-y-1">
            <div className="flex items-center justify-between text-sm">
              <span>{d.method}</span>
              <span className="font-medium tabular-nums">{formatCurrency(d.total)}</span>
            </div>
            <div className="h-1.5 w-full overflow-hidden rounded-full bg-muted">
              <div
                className="h-full rounded-full bg-primary/70 transition-all"
                style={{ width: `${pct}%` }}
              />
            </div>
            <p className="text-[10px] text-muted-foreground">
              {d.count} transaksi ({pct.toFixed(1)}%)
            </p>
          </div>
        );
      })}
    </div>
  );
}

function LoadingSkeleton() {
  return (
    <div className="flex flex-col items-center justify-center gap-3 py-12">
      <Loader2 className="size-6 animate-spin text-primary" />
      <p className="text-sm text-muted-foreground">Memuat rincian…</p>
    </div>
  );
}

function ErrorState({ message }: { message: string }) {
  return (
    <div className="flex flex-col items-center gap-2 py-10 text-center">
      <AlertTriangle className="size-6 text-red-500" />
      <p className="text-sm text-muted-foreground">{message}</p>
    </div>
  );
}

// -- Metric-specific renderers --

function OmzetContent({ data }: { data: MetricData }) {
  return (
    <div className="space-y-4">
      <div className="rounded-2xl border border-primary/15 bg-primary/5 p-4 dark:bg-primary/10">
        <p className="text-sm text-muted-foreground">Omzet hari ini</p>
        <p className="mt-1 font-heading text-3xl font-semibold">{formatCurrency(data.revenue)}</p>
        <div className="mt-2">
          <TrendBadge pct={data.vsYesterdayPct} />
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div className="rounded-xl border border-border/60 p-3">
          <StatRow label="Laba kotor" value={formatCurrency(data.grossProfit)} tone="positive" />
        </div>
        <div className="rounded-xl border border-border/60 p-3">
          <StatRow label="Margin" value={`${data.marginPct}%`} tone={data.marginPct >= 20 ? "positive" : "warn"} />
        </div>
      </div>

      <StatRow label="Jumlah transaksi" value={`${data.txnCount} trx`} />
      <StatRow label="Rata-rata per transaksi" value={formatCurrency(data.avgTicket)} />

      {data.byPaymentMethod.length > 0 && (
        <PaymentMethodBreakdown data={data.byPaymentMethod} />
      )}

      <MiniBarChart data={data.hourlySeries} valueKey="total" />
    </div>
  );
}

function TransaksiContent({ data }: { data: MetricData }) {
  return (
    <div className="space-y-4">
      <div className="rounded-2xl border border-primary/15 bg-accent/50 p-4">
        <p className="text-sm text-muted-foreground">Total transaksi hari ini</p>
        <p className="mt-1 font-heading text-3xl font-semibold">{data.txnCount} transaksi</p>
      </div>

      <StatRow label="Produk terjual" value={`${data.itemsSold} item`} />
      <StatRow label="Rata-rata item/trx" value={`${data.avgItemsPerTxn}`} />

      <div className="grid grid-cols-2 gap-3">
        <div className="rounded-xl border border-border/60 p-3">
          <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
            <ArrowUp className="size-3 text-emerald-500" />
            Terbesar
          </div>
          <p className="mt-1 font-medium tabular-nums">{formatCurrency(data.largest)}</p>
        </div>
        <div className="rounded-xl border border-border/60 p-3">
          <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
            <ArrowDown className="size-3 text-amber-500" />
            Terkecil
          </div>
          <p className="mt-1 font-medium tabular-nums">{formatCurrency(data.smallest)}</p>
        </div>
      </div>

      {data.byPaymentMethod.length > 0 && (
        <PaymentMethodBreakdown data={data.byPaymentMethod} />
      )}

      <MiniBarChart data={data.hourlySeries} valueKey="count" />
    </div>
  );
}

function StokContent({ data }: { data: MetricData }) {
  const items = data as {
    id: string;
    name: string;
    category: string;
    stock: number;
    minimumStock: number;
    dailyVelocity: number;
    daysToEmpty: number | null;
    suggestedRestockQty: number;
  }[];

  if (items.length === 0) {
    return (
      <div className="rounded-2xl bg-accent/50 px-4 py-8 text-center text-sm text-muted-foreground">
        <Package className="mx-auto mb-2 size-8 text-primary/50" />
        Semua stok aman. Tidak ada produk yang perlu perhatian.
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <div className="rounded-2xl border border-amber-200 bg-amber-50 p-3 text-sm dark:border-amber-800 dark:bg-amber-900/20">
        <span className="font-medium text-amber-800 dark:text-amber-300">
          {items.length} produk
        </span>{" "}
        <span className="text-amber-700 dark:text-amber-400">perlu restok</span>
      </div>

      {items.map((item) => (
        <div
          key={item.id}
          className="rounded-xl border border-border/60 p-3 transition-colors hover:bg-muted/30"
        >
          <div className="flex items-start justify-between gap-2">
            <div>
              <p className="font-medium">{item.name}</p>
              <p className="text-xs text-muted-foreground">{item.category}</p>
            </div>
            <Badge
              variant="secondary"
              className={cn(
                "rounded-full tabular-nums",
                item.stock <= 0
                  ? "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400"
                  : "bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400"
              )}
            >
              Sisa {item.stock}
            </Badge>
          </div>
          <div className="mt-2 grid grid-cols-3 gap-2 text-xs text-muted-foreground">
            <div>
              <p>Kecepatan</p>
              <p className="font-medium text-foreground">{item.dailyVelocity}/hari</p>
            </div>
            <div>
              <p>Habis dalam</p>
              <p className="font-medium text-foreground">
                {item.daysToEmpty !== null ? `${item.daysToEmpty} hari` : "—"}
              </p>
            </div>
            <div>
              <p>Saran restok</p>
              <p className="font-medium text-foreground">{item.suggestedRestockQty} unit</p>
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}

function KasbonContent({ data }: { data: MetricData }) {
  return (
    <div className="space-y-4">
      <div className="rounded-2xl border border-primary/15 bg-primary/5 p-4 dark:bg-primary/10">
        <p className="text-sm text-muted-foreground">Total piutang belum lunas</p>
        <p className="mt-1 font-heading text-3xl font-semibold">
          {formatCurrency(data.totalOutstanding)}
        </p>
        <p className="mt-1 text-xs text-muted-foreground">
          dari {data.debtorCount} pelanggan
        </p>
      </div>

      {data.overdueCount > 0 && (
        <div className="rounded-xl border border-red-200 bg-red-50 p-3 dark:border-red-800 dark:bg-red-900/20">
          <div className="flex items-center gap-2 text-sm font-medium text-red-700 dark:text-red-400">
            <AlertTriangle className="size-4" />
            {data.overdueCount} kasbon jatuh tempo
          </div>
          <p className="mt-1 text-sm text-red-600 dark:text-red-400">
            Total overdue: {formatCurrency(data.overdueAmount)}
          </p>
        </div>
      )}

      {data.nearestDue && (
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <Clock className="size-4" />
          Jatuh tempo terdekat:{" "}
          <span className="font-medium text-foreground">
            {new Intl.DateTimeFormat("id-ID", {
              day: "numeric",
              month: "long",
              year: "numeric",
            }).format(new Date(data.nearestDue))}
          </span>
        </div>
      )}

      {data.topDebtors.length > 0 && (
        <div className="space-y-2">
          <p className="flex items-center gap-1.5 text-xs font-medium text-muted-foreground">
            <Users className="size-3.5" />
            Pelanggan berhutang terbanyak
          </p>
          {data.topDebtors.map(
            (
              d: { borrowerName: string; whatsapp: string; total: number; count: number },
              i: number
            ) => (
              <div
                key={`${d.borrowerName}-${i}`}
                className="flex items-center justify-between gap-3 rounded-xl border border-border/60 p-3"
              >
                <div>
                  <div className="flex items-center gap-2">
                    <Wallet className="size-3.5 text-primary" />
                    <p className="font-medium">{d.borrowerName}</p>
                  </div>
                  <p className="mt-0.5 text-xs text-muted-foreground">
                    {d.whatsapp} · {d.count} kasbon
                  </p>
                </div>
                <p className="font-medium tabular-nums text-red-600 dark:text-red-400">
                  {formatCurrency(d.total)}
                </p>
              </div>
            )
          )}
        </div>
      )}
    </div>
  );
}

// -- Main dialog --

export function MetricDetailDialog({ metric, onClose }: MetricDetailDialogProps) {
  const [data, setData] = useState<MetricData>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchDetail = useCallback(async (m: DashboardMetric) => {
    setLoading(true);
    setError(null);
    setData(null);

    try {
      const today = new Intl.DateTimeFormat("sv-SE", {
        timeZone: "Asia/Jakarta",
      }).format(new Date());

      const response = await fetch(
        `/api/dashboard/detail?metric=${m}&date=${today}`
      );
      const json = await response.json();

      if (!response.ok) {
        throw new Error(json?.error ?? "Gagal memuat data.");
      }

      setData(json.data);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Gagal memuat data.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (metric) {
      void fetchDetail(metric);
    }
  }, [metric, fetchDetail]);

  return (
    <Dialog
      open={metric !== null}
      onOpenChange={(open) => {
        if (!open) onClose();
      }}
    >
      <DialogContent className="sm:max-w-md">
        {metric && (
          <>
            <DialogHeader>
              <DialogTitle className="text-lg">{METRIC_TITLES[metric]}</DialogTitle>
              <DialogDescription>{METRIC_DESCRIPTIONS[metric]}</DialogDescription>
            </DialogHeader>

            <ScrollArea className="max-h-[60vh]">
              {loading && <LoadingSkeleton />}
              {error && <ErrorState message={error} />}
              {!loading && !error && data && (
                <div className="pr-2">
                  {metric === "omzet" && <OmzetContent data={data} />}
                  {metric === "transaksi" && <TransaksiContent data={data} />}
                  {metric === "stok" && <StokContent data={data} />}
                  {metric === "kasbon" && <KasbonContent data={data} />}
                </div>
              )}
            </ScrollArea>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}
