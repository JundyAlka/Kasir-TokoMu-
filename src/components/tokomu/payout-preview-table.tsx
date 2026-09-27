"use client";

import { useEffect, useMemo, useState } from "react";
import {
  ArrowUpRight,
  Boxes,
  CheckCircle2,
  Coins,
  LayoutGrid,
  ListFilter,
  Loader2,
  Package,
  RefreshCw,
  Save,
  Search,
  SlidersHorizontal,
  Store,
  Table as TableIcon,
  TrendingUp,
  WalletCards,
} from "lucide-react";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { formatCurrency } from "@/lib/format";
import type { AkadType } from "@/lib/server/profit-sharing";

type PayoutStatus = "draft" | "disetujui" | "dibayar";

export type PayoutRow = {
  id?: string;
  investmentId: string;
  investorId: string;
  investorName?: string;
  akadType: AkadType;
  type?: "uang" | "barang_titip_jual";
  baseAmount: number;
  ratePct: number;
  shareMode?: "percentage" | "per_unit_amount";
  perUnitAmount?: number | null;
  amount: number;
  status?: PayoutStatus;
  paidAt?: string | null;
  note: string;
  periodStart?: string;
  periodEnd?: string;
  quantitySold?: number;
  productId?: string | null;
  productName?: string | null;
  currentStock?: number | null;
  unitCost?: number | null;
  unitPrice?: number | null;
  capitalAmount?: number | null;
  initialStock?: number | null;
};

type PayoutCalculation = {
  periodStart: string;
  periodEnd: string;
  revenue: number;
  cogs: number;
  expenses: number;
  baseProfit: number;
  totalInvestorPayout: number;
  remaining: number;
  pcmShare: number;
  storeShare: number;
  payouts: PayoutRow[];
};

const akadLabels: Record<AkadType, string> = {
  murabahah_bil_wakalah: "Murabahah",
  mudharabah: "Mudharabah",
  musyarakah: "Musyarakah",
  barang_titip_jual: "Barang titip jual",
  sales_titipan: "Sales titipan",
  pinjaman_qardh: "Qardh",
};

function currentMonthValue() {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
}

function getRecentMonths(count = 12) {
  const options = [];
  const now = new Date();
  for (let i = 0; i < count; i++) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    const value = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
    const label = new Intl.DateTimeFormat("id-ID", { month: "long", year: "numeric" }).format(d);
    options.push({ value, label });
  }
  return options;
}

function parseMonthValue(value: string) {
  const [year, month] = value.split("-").map(Number);
  if (!Number.isInteger(year) || !Number.isInteger(month)) {
    throw new Error("Periode bulan tidak valid.");
  }

  return { year, month };
}

async function requestJson<T>(input: RequestInfo, init?: RequestInit): Promise<T> {
  const response = await fetch(input, {
    ...init,
    headers: {
      "Content-Type": "application/json",
      ...(init?.headers ?? {}),
    },
  });
  const data = (await response.json().catch(() => null)) as (T & { error?: string }) | null;
  if (!response.ok) {
    throw new Error(data?.error ?? "Permintaan gagal.");
  }
  return data as T;
}

export function PayoutPreviewTable({
  rows,
  mode = "preview",
  onApprove,
  onPaid,
}: Readonly<{
  rows: PayoutRow[];
  mode?: "preview" | "saved";
  onApprove?: (id: string) => void;
  onPaid?: (id: string) => void;
}>) {
  return (
    <div className="overflow-x-auto rounded-2xl border border-border/60">
      <Table className="min-w-[980px]">
        <TableHeader>
          <TableRow className="bg-muted/40 hover:bg-muted/40">
            <TableHead>Investor</TableHead>
            <TableHead>Tipe akad</TableHead>
            <TableHead>Detail Produk / Modal</TableHead>
            <TableHead>Load Progres / Terjual</TableHead>
            <TableHead>Skema bagi hasil</TableHead>
            <TableHead>Payout</TableHead>
            <TableHead>Catatan</TableHead>
            {mode === "saved" ? <TableHead className="text-right">Status</TableHead> : null}
          </TableRow>
        </TableHeader>
        <TableBody>
          {rows.map((row) => {
            const isTitipJual =
              row.akadType === "barang_titip_jual" ||
              row.akadType === "sales_titipan" ||
              row.type === "barang_titip_jual";
            const qtySold = row.quantitySold ?? 0;
            const currStock = row.currentStock ?? 0;
            const totalStock = row.initialStock || (qtySold + currStock) || 1;
            const soldPct = Math.round((qtySold / totalStock) * 100);

            return (
              <TableRow key={row.id ?? row.investmentId} className="hover:bg-muted/30">
                <TableCell className="font-semibold text-foreground">
                  <div className="flex items-center gap-2">
                    <span className="size-2 rounded-full bg-primary" />
                    <span>{row.investorName ?? row.investorId}</span>
                  </div>
                </TableCell>
                <TableCell>
                  <Badge
                    variant="outline"
                    className="border-border bg-muted/50 text-muted-foreground font-medium"
                  >
                    {akadLabels[row.akadType] ?? row.akadType}
                  </Badge>
                </TableCell>
                <TableCell>
                  {isTitipJual ? (
                    <div>
                      <span className="font-medium text-foreground block">
                        {row.productName || "Produk Titipan"}
                      </span>
                      <span className="text-xs text-muted-foreground">
                        Modal: {row.unitCost ? formatCurrency(row.unitCost) : "-"}
                      </span>
                    </div>
                  ) : (
                    <div>
                      <span className="text-xs text-muted-foreground block">Modal Investasi:</span>
                      <span className="font-semibold text-foreground">
                        {formatCurrency(row.capitalAmount || row.baseAmount)}
                      </span>
                    </div>
                  )}
                </TableCell>
                <TableCell className="min-w-[190px]">
                  {isTitipJual ? (
                    <div className="space-y-1">
                      <div className="flex items-center justify-between text-xs">
                        <span className="font-semibold text-foreground">
                          {qtySold} pcs terjual
                        </span>
                        <span className="text-muted-foreground text-[11px]">
                          Sisa {currStock} pcs
                        </span>
                      </div>
                      <div className="h-2 w-full rounded-full bg-muted overflow-hidden border border-border/40">
                        <div
                          className="h-full rounded-full bg-primary/80 transition-all duration-500"
                          style={{ width: `${Math.max(soldPct, qtySold > 0 ? 6 : 0)}%` }}
                        />
                      </div>
                      <span className="text-[10px] text-muted-foreground block text-right">
                        {soldPct}% berkurang
                      </span>
                    </div>
                  ) : (
                    <div className="space-y-1">
                      <div className="flex items-center justify-between text-xs">
                        <span className="font-semibold text-foreground">
                          Return {row.ratePct}%
                        </span>
                        <span className="text-muted-foreground text-[11px]">
                          {formatCurrency(row.amount)}
                        </span>
                      </div>
                      <div className="h-2 w-full rounded-full bg-muted overflow-hidden border border-border/40">
                        <div
                          className="h-full rounded-full bg-foreground/30 transition-all duration-500"
                          style={{ width: `${Math.min(100, Math.max(12, row.ratePct * 10))}%` }}
                        />
                      </div>
                    </div>
                  )}
                </TableCell>
                <TableCell>
                  {isTitipJual ? (
                    row.shareMode === "per_unit_amount" ? (
                      <span className="font-medium text-foreground">
                        {formatCurrency(row.perUnitAmount ?? (qtySold > 0 ? row.amount / qtySold : 0))} / pcs
                      </span>
                    ) : (
                      <span className="font-medium text-foreground">{row.ratePct}% margin</span>
                    )
                  ) : (
                    <span className="font-medium text-foreground">{row.ratePct}% per bulan</span>
                  )}
                </TableCell>
                <TableCell className="font-bold text-base text-foreground">
                  {formatCurrency(row.amount)}
                </TableCell>
                <TableCell className="max-w-xs whitespace-normal text-xs text-muted-foreground">
                  {row.note}
                </TableCell>
                {mode === "saved" ? (
                  <TableCell className="text-right">
                    <div className="flex flex-wrap justify-end gap-2">
                      <Badge variant={row.status === "dibayar" ? "default" : "secondary"}>
                        {row.status ?? "draft"}
                      </Badge>
                      {row.status === "draft" && row.id ? (
                        <Button
                          size="sm"
                          variant="outline"
                          className="rounded-full h-8 text-xs"
                          onClick={() => onApprove?.(row.id!)}
                        >
                          Setujui
                        </Button>
                      ) : null}
                      {row.status === "disetujui" && row.id ? (
                        <Button
                          size="sm"
                          className="rounded-full h-8 text-xs"
                          onClick={() => onPaid?.(row.id!)}
                        >
                          Tandai Dibayar
                        </Button>
                      ) : null}
                    </div>
                  </TableCell>
                ) : null}
              </TableRow>
            );
          })}
          {rows.length === 0 ? (
            <TableRow>
              <TableCell colSpan={mode === "saved" ? 8 : 7} className="h-28 text-center text-muted-foreground">
                Tidak ada data investor untuk kategori yang dipilih.
              </TableCell>
            </TableRow>
          ) : null}
        </TableBody>
      </Table>
    </div>
  );
}

export function BagiHasilClient() {
  const [period, setPeriod] = useState(currentMonthValue());
  const [calculation, setCalculation] = useState<PayoutCalculation | null>(null);
  const [savedRows, setSavedRows] = useState<PayoutRow[]>([]);
  const [historyRows, setHistoryRows] = useState<PayoutRow[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [calculatedAt, setCalculatedAt] = useState<Date | null>(null);
  const [viewSource, setViewSource] = useState<"live" | "draft">("live");
  const [filterTab, setFilterTab] = useState<"all" | "titip_jual" | "titip_modal">("all");
  const [layoutMode, setLayoutMode] = useState<"cards" | "table">("cards");

  const periodPayload = useMemo(() => parseMonthValue(period), [period]);
  const hasSavedDraft = savedRows.length > 0;
  const selectedMonthLabel = getRecentMonths().find((m) => m.value === period)?.label ?? period;

  // Active rows based on live vs draft selection
  const rawVisibleRows = useMemo(() => {
    if (viewSource === "draft" && hasSavedDraft) {
      return savedRows;
    }
    return calculation ? calculation.payouts : (hasSavedDraft ? savedRows : []);
  }, [viewSource, hasSavedDraft, savedRows, calculation]);

  // Filtered rows based on switch filter (all, titip_jual, titip_modal)
  const visibleRows = useMemo(() => {
    return rawVisibleRows.filter((row) => {
      const isTitipJual =
        row.akadType === "barang_titip_jual" ||
        row.akadType === "sales_titipan" ||
        row.type === "barang_titip_jual";
      if (filterTab === "titip_jual") return isTitipJual;
      if (filterTab === "titip_modal") return !isTitipJual;
      return true;
    });
  }, [rawVisibleRows, filterTab]);

  const titipJualCount = useMemo(() => {
    return rawVisibleRows.filter(
      (r) =>
        r.akadType === "barang_titip_jual" ||
        r.akadType === "sales_titipan" ||
        r.type === "barang_titip_jual"
    ).length;
  }, [rawVisibleRows]);

  const titipModalCount = rawVisibleRows.length - titipJualCount;

  // Automatic realtime fetch function
  async function fetchAllData(silent = false) {
    if (!silent) setIsLoading(true);
    else setIsRefreshing(true);

    try {
      const [savedData, calcData, historyData] = await Promise.all([
        requestJson<{ payouts: PayoutRow[] }>(
          `/api/payouts?year=${periodPayload.year}&month=${periodPayload.month}`
        ).catch(() => ({ payouts: [] as PayoutRow[] })),
        requestJson<{ calculation: PayoutCalculation }>("/api/payouts/calculate", {
          method: "POST",
          body: JSON.stringify(periodPayload),
        }).catch(() => null),
        requestJson<{ payouts: PayoutRow[] }>("/api/payouts").catch(() => ({
          payouts: [] as PayoutRow[],
        })),
      ]);

      setSavedRows(savedData.payouts);
      if (calcData) {
        setCalculation(calcData.calculation);
        setCalculatedAt(new Date());
      }
      setHistoryRows(historyData.payouts);
    } finally {
      setIsLoading(false);
      setIsRefreshing(false);
    }
  }

  // Load immediately on period change & set up auto-sync polling
  useEffect(() => {
    let mounted = true;

    async function initialFetch() {
      setIsLoading(true);
      try {
        const [savedData, calcData, historyData] = await Promise.all([
          requestJson<{ payouts: PayoutRow[] }>(
            `/api/payouts?year=${periodPayload.year}&month=${periodPayload.month}`
          ).catch(() => ({ payouts: [] as PayoutRow[] })),
          requestJson<{ calculation: PayoutCalculation }>("/api/payouts/calculate", {
            method: "POST",
            body: JSON.stringify(periodPayload),
          }).catch(() => null),
          requestJson<{ payouts: PayoutRow[] }>("/api/payouts").catch(() => ({
            payouts: [] as PayoutRow[],
          })),
        ]);

        if (!mounted) return;
        setSavedRows(savedData.payouts);
        if (calcData) {
          setCalculation(calcData.calculation);
          setCalculatedAt(new Date());
        }
        setHistoryRows(historyData.payouts);
      } finally {
        if (mounted) setIsLoading(false);
      }
    }

    void initialFetch();

    // Auto-polling every 30s so cashier transactions automatically update numbers
    const interval = setInterval(() => {
      if (document.visibilityState === "visible") {
        void fetchAllData(true);
      }
    }, 30000);

    // Refresh immediately when window regains focus
    const handleFocus = () => {
      void fetchAllData(true);
    };
    window.addEventListener("focus", handleFocus);

    return () => {
      mounted = false;
      clearInterval(interval);
      window.removeEventListener("focus", handleFocus);
    };
  }, [periodPayload.year, periodPayload.month]);

  async function handleManualRefresh() {
    await fetchAllData(false);
    toast.success("Data berhasil disinkronkan langsung dari transaksi kasir terbaru.");
  }

  async function handleSaveDraft() {
    setIsSaving(true);
    try {
      await requestJson<{ calculation: PayoutCalculation }>("/api/payouts", {
        method: "POST",
        body: JSON.stringify(periodPayload),
      });
      const data = await requestJson<{ payouts: PayoutRow[] }>(
        `/api/payouts?year=${periodPayload.year}&month=${periodPayload.month}`
      );
      setSavedRows(data.payouts);
      setViewSource("draft");
      toast.success(`${data.payouts.length} draft payout berhasil disimpan.`);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Gagal menyimpan draft payout.");
    } finally {
      setIsSaving(false);
    }
  }

  async function updateStatus(id: string, status: "disetujui" | "dibayar") {
    try {
      await requestJson(`/api/payouts/${id}`, {
        method: "PATCH",
        body: JSON.stringify({ status }),
      });
      const [savedData, historyData] = await Promise.all([
        requestJson<{ payouts: PayoutRow[] }>(
          `/api/payouts?year=${periodPayload.year}&month=${periodPayload.month}`
        ),
        requestJson<{ payouts: PayoutRow[] }>("/api/payouts"),
      ]);
      setSavedRows(savedData.payouts);
      setHistoryRows(historyData.payouts);
      toast.success(status === "dibayar" ? "Payout ditandai dibayar." : "Payout disetujui.");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Gagal memperbarui payout.");
    }
  }

  return (
    <div className="space-y-5">
      {/* Header Card */}
      <Card className="rounded-2xl border-border/60 bg-card shadow-sm overflow-hidden">
        <CardHeader className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between pb-6">
          <div className="space-y-1.5">
            <div className="flex flex-wrap items-center gap-2.5">
              <CardTitle className="font-heading text-2xl font-bold">
                Distribusi Bagi Hasil Periode
              </CardTitle>
              {/* Real-time Indicator Pill */}
              <div className="inline-flex items-center gap-1.5 rounded-full border border-border bg-muted/50 px-3 py-1 text-xs font-medium text-muted-foreground">
                <span className="relative flex size-1.5">
                  <span className="relative inline-flex size-1.5 rounded-full bg-primary" />
                </span>
                <span>Realtime</span>
                {calculatedAt ? (
                  <span className="font-normal text-muted-foreground ml-1">
                    • {new Intl.DateTimeFormat("id-ID", { timeStyle: "medium" }).format(calculatedAt)}
                  </span>
                ) : null}
              </div>
            </div>
            <CardDescription className="text-sm">
              Perhitungan hak investor otomatis tersinkron langsung dari transaksi kasir TokoMu tanpa perlu hitung ulang manual.
            </CardDescription>
          </div>

          <div className="flex flex-wrap items-center gap-2.5">
            <div className="grid gap-1 min-w-[170px]">
              <Select
                value={period}
                onValueChange={(value) => {
                  setPeriod(value || "");
                  setViewSource("live");
                  setCalculation(null);
                  setCalculatedAt(null);
                  setSavedRows([]);
                }}
              >
                <SelectTrigger id="period-month" className="h-10 rounded-2xl bg-card border-border/70">
                  <SelectValue placeholder="Pilih bulan" />
                </SelectTrigger>
                <SelectContent>
                  {getRecentMonths().map((m) => (
                    <SelectItem key={m.value} value={m.value}>
                      {m.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <Button
              variant="outline"
              className="h-10 rounded-2xl border-border/70 hover:bg-primary/10 gap-1.5"
              onClick={() => void handleManualRefresh()}
              disabled={isLoading || isRefreshing}
            >
              <RefreshCw className={`size-4 ${isLoading || isRefreshing ? "animate-spin text-primary" : ""}`} />
              <span>Segarkan</span>
            </Button>

            {calculation && !hasSavedDraft && (
              <Button
                className="h-10 rounded-2xl gap-1.5 shadow-sm"
                onClick={() => void handleSaveDraft()}
                disabled={isSaving}
              >
                {isSaving ? <Loader2 className="size-4 animate-spin" /> : <Save className="size-4" />}
                <span>Simpan Draft</span>
              </Button>
            )}
          </div>
        </CardHeader>
      </Card>

      {/* KPI Summary Cards */}
      {(() => {
        const displayProfit = calculation?.baseProfit;
        const displayTotalPayout = calculation
          ? calculation.totalInvestorPayout
          : hasSavedDraft
          ? savedRows.reduce((sum, r) => sum + (r.amount || 0), 0)
          : undefined;
        const displayPcm = calculation?.pcmShare;
        const displayStore = calculation?.storeShare;

        return (
          <section className="grid gap-3 sm:grid-cols-2 md:grid-cols-4">
            <Card className="rounded-2xl border-border/60 bg-card shadow-sm">
              <CardHeader className="pb-3">
                <CardDescription className="flex items-center gap-1.5 text-xs font-medium text-muted-foreground">
                  <TrendingUp className="size-3.5" />
                  Laba Bersih Periode
                </CardDescription>
                <CardTitle className="text-xl font-bold tracking-tight">
                  {displayProfit !== undefined ? formatCurrency(displayProfit) : "-"}
                </CardTitle>
              </CardHeader>
            </Card>

            <Card className="rounded-2xl border-border/60 bg-card shadow-sm">
              <CardHeader className="pb-3">
                <CardDescription className="flex items-center gap-1.5 text-xs font-medium text-muted-foreground">
                  <Coins className="size-3.5" />
                  Total Bagi Hasil Investor
                </CardDescription>
                <CardTitle className="text-xl font-bold tracking-tight">
                  {displayTotalPayout !== undefined ? formatCurrency(displayTotalPayout) : "-"}
                </CardTitle>
              </CardHeader>
            </Card>

            <Card className="rounded-2xl border-border/60 bg-card shadow-sm">
              <CardHeader className="pb-3">
                <CardDescription className="flex items-center gap-1.5 text-xs font-medium text-muted-foreground">
                  <Store className="size-3.5" />
                  Bagian PCM (30%)
                </CardDescription>
                <CardTitle className="text-xl font-bold tracking-tight">
                  {displayPcm !== undefined ? formatCurrency(displayPcm) : "-"}
                </CardTitle>
              </CardHeader>
            </Card>

            <Card className="rounded-2xl border-border/60 bg-card shadow-sm">
              <CardHeader className="pb-3">
                <CardDescription className="flex items-center gap-1.5 text-xs font-medium text-muted-foreground">
                  <Store className="size-3.5" />
                  Bagian Toko (70%)
                </CardDescription>
                <CardTitle className="text-xl font-bold tracking-tight">
                  {displayStore !== undefined ? formatCurrency(displayStore) : "-"}
                </CardTitle>
              </CardHeader>
            </Card>
          </section>
        );
      })()}

      {/* Main Section: Switch Tabs & Visualization */}
      <Card className="rounded-2xl border-border/60 bg-card shadow-sm overflow-hidden">
        <CardHeader className="flex flex-col gap-4 border-b border-border/40 pb-5">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
            <div className="flex items-center gap-2">
              <WalletCards className="size-5 text-foreground" />
              <CardTitle className="text-lg font-bold">
                {viewSource === "draft" && hasSavedDraft
                  ? `Draft Payout Tersimpan (${selectedMonthLabel})`
                  : `Preview Bagi Hasil Realtime (${selectedMonthLabel})`}
              </CardTitle>
            </div>

            {/* Source Switcher if draft exists */}
            {hasSavedDraft && (
              <div className="flex items-center rounded-2xl border border-border/60 bg-muted/50 p-1 text-xs">
                <button
                  type="button"
                  className={`px-3 py-1.5 rounded-xl font-semibold transition-all ${
                    viewSource === "live"
                      ? "bg-card text-foreground shadow-sm"
                      : "text-muted-foreground hover:text-foreground"
                  }`}
                  onClick={() => setViewSource("live")}
                >
                  Real-time
                </button>
                <button
                  type="button"
                  className={`px-3 py-1.5 rounded-xl font-semibold transition-all ${
                    viewSource === "draft"
                      ? "bg-card text-foreground shadow-sm"
                      : "text-muted-foreground hover:text-foreground"
                  }`}
                  onClick={() => setViewSource("draft")}
                >
                  Draft ({savedRows.length})
                </button>
              </div>
            )}
          </div>

          {/* Filtering Switch Bar: Titip Jual vs Titip Modal */}
          <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-3 pt-2">
            <div className="flex flex-wrap items-center gap-1.5">
              <button
                type="button"
                className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-medium transition-all ${
                  filterTab === "all"
                    ? "bg-foreground text-background shadow-sm"
                    : "bg-muted/60 text-muted-foreground hover:bg-muted hover:text-foreground"
                }`}
                onClick={() => setFilterTab("all")}
              >
                <span>Semua</span>
                <span className="opacity-60 text-[11px]">
                  {rawVisibleRows.length}
                </span>
              </button>

              <button
                type="button"
                className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-medium transition-all ${
                  filterTab === "titip_jual"
                    ? "bg-foreground text-background shadow-sm"
                    : "bg-muted/60 text-muted-foreground hover:bg-muted hover:text-foreground"
                }`}
                onClick={() => setFilterTab("titip_jual")}
              >
                <Package className="size-3.5" />
                <span>Konsinyasi</span>
                <span className="opacity-60 text-[11px]">
                  {titipJualCount}
                </span>
              </button>

              <button
                type="button"
                className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-medium transition-all ${
                  filterTab === "titip_modal"
                    ? "bg-foreground text-background shadow-sm"
                    : "bg-muted/60 text-muted-foreground hover:bg-muted hover:text-foreground"
                }`}
                onClick={() => setFilterTab("titip_modal")}
              >
                <Coins className="size-3.5" />
                <span>Titip Modal</span>
                <span className="opacity-60 text-[11px]">
                  {titipModalCount}
                </span>
              </button>
            </div>

            {/* Layout Switcher (Cards vs Table) */}
            <div className="flex items-center rounded-2xl border border-border/60 bg-muted/40 p-1 self-start md:self-auto">
              <button
                type="button"
                className={`flex items-center gap-1.5 px-3 py-1 rounded-xl text-xs font-medium transition-all ${
                  layoutMode === "cards"
                    ? "bg-card text-foreground shadow-sm"
                    : "text-muted-foreground hover:text-foreground"
                }`}
                onClick={() => setLayoutMode("cards")}
              >
                <LayoutGrid className="size-3.5" />
                <span>Visual Card</span>
              </button>
              <button
                type="button"
                className={`flex items-center gap-1.5 px-3 py-1 rounded-xl text-xs font-medium transition-all ${
                  layoutMode === "table"
                    ? "bg-card text-foreground shadow-sm"
                    : "text-muted-foreground hover:text-foreground"
                }`}
                onClick={() => setLayoutMode("table")}
              >
                <TableIcon className="size-3.5" />
                <span>Tabel</span>
              </button>
            </div>
          </div>
        </CardHeader>

        <CardContent className="pt-6">
          {isLoading && !calculation && visibleRows.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-16 gap-3 text-muted-foreground">
              <Loader2 className="size-8 animate-spin text-primary" />
              <p className="text-sm">Menghitung pembagian bagi hasil realtime...</p>
            </div>
          ) : visibleRows.length === 0 ? (
            <div className="rounded-2xl border border-dashed border-border/70 p-12 text-center text-muted-foreground">
              <Boxes className="size-10 mx-auto mb-3 opacity-40" />
              <p className="font-semibold text-foreground">Tidak ada data investor untuk kategori ini</p>
              <p className="text-xs text-muted-foreground mt-1">
                Silakan ganti kategori filter atau pilih periode bulan lainnya.
              </p>
            </div>
          ) : layoutMode === "table" ? (
            <PayoutPreviewTable
              rows={visibleRows}
              mode={viewSource === "draft" ? "saved" : "preview"}
              onApprove={(id) => void updateStatus(id, "disetujui")}
              onPaid={(id) => void updateStatus(id, "dibayar")}
            />
          ) : (
            /* Visual Cards Presentation */
            <div className="grid gap-4 md:grid-cols-2">
              {visibleRows.map((row) => {
                const isTitipJual =
                  row.akadType === "barang_titip_jual" ||
                  row.akadType === "sales_titipan" ||
                  row.type === "barang_titip_jual";
                const qtySold = row.quantitySold ?? 0;
                const currStock = row.currentStock ?? 0;
                const totalStock = row.initialStock || (qtySold + currStock) || 1;
                const soldPct = Math.min(100, Math.round((qtySold / totalStock) * 100));

                return (
                  <div
                    key={row.id ?? row.investmentId}
                    className="flex flex-col justify-between rounded-2xl border border-border/70 bg-card p-5 shadow-sm hover:shadow-md transition-all space-y-4"
                  >
                    {/* Card Header */}
                    <div className="flex items-start justify-between gap-3">
                      <div className="space-y-1">
                        <div className="flex items-center gap-2">
                          <span className="size-2 rounded-full bg-foreground/40" />
                          <h4 className="font-bold text-base text-foreground">
                            {row.investorName ?? row.investorId}
                          </h4>
                        </div>
                        <Badge
                          variant="outline"
                          className="border-border bg-muted/50 text-muted-foreground text-[11px] font-medium"
                        >
                          {akadLabels[row.akadType] ?? row.akadType}
                        </Badge>
                      </div>

                      <div className="text-right">
                        <p className="text-[11px] font-medium text-muted-foreground">Hak Payout</p>
                        <p className="text-xl font-bold text-foreground tracking-tight">
                          {formatCurrency(row.amount)}
                        </p>
                      </div>
                    </div>

                    {/* Middle Section: Titip Jual vs Titip Modal */}
                    {isTitipJual ? (
                      <div className="space-y-3">
                        {/* Visual Load Bar Garis Load Berkurangnya Barang */}
                        <div className="rounded-xl border border-border bg-muted/30 p-3.5 space-y-2.5">
                          <div className="flex items-center justify-between text-xs">
                            <span className="font-medium text-foreground flex items-center gap-1.5">
                              <Boxes className="size-3.5 text-muted-foreground" />
                              Stok Barang Terjual
                            </span>
                            <Badge
                              variant="outline"
                              className="border-border bg-muted/50 text-foreground font-semibold text-[11px]"
                            >
                              {soldPct}% Terjual
                            </Badge>
                          </div>

                          {/* Progress Track */}
                          <div className="relative h-2.5 w-full rounded-full bg-muted overflow-hidden border border-border/40">
                            <div
                              className="h-full rounded-full bg-primary/75 transition-all duration-700"
                              style={{ width: `${Math.max(soldPct, qtySold > 0 ? 5 : 0)}%` }}
                            />
                          </div>

                          {/* Info Status Barang */}
                          <div className="flex flex-wrap items-center justify-between text-xs gap-1 pt-0.5">
                            <span className="font-semibold text-foreground">
                              Terjual: {qtySold} pcs
                            </span>
                            <span className="text-muted-foreground font-medium">
                              Sisa: {currStock} pcs
                            </span>
                            <span className="text-muted-foreground text-[11px]">
                              Total: {totalStock} pcs
                            </span>
                          </div>
                        </div>

                        {/* Rincian Produk Terjual */}
                        <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 text-xs">
                          <div className="rounded-xl border border-border/50 bg-muted/30 p-2.5">
                            <p className="text-muted-foreground text-[11px]">Produk</p>
                            <p className="font-semibold text-foreground truncate mt-0.5" title={row.productName || ""}>
                              {row.productName || "Barang Titipan"}
                            </p>
                          </div>

                          <div className="rounded-xl border border-border/50 bg-muted/30 p-2.5">
                            <p className="text-muted-foreground text-[11px]">Modal Dasar</p>
                            <p className="font-semibold text-foreground mt-0.5">
                              {row.unitCost ? formatCurrency(row.unitCost) : "-"}
                            </p>
                          </div>

                          <div className="rounded-xl border border-border/50 bg-muted/30 p-2.5 col-span-2 sm:col-span-1">
                            <p className="text-muted-foreground text-[11px]">Skema Bagi Hasil</p>
                            <p className="font-semibold text-foreground mt-0.5">
                              {row.shareMode === "per_unit_amount"
                                ? `${formatCurrency(row.perUnitAmount ?? (qtySold > 0 ? row.amount / qtySold : 0))} / pcs`
                                : `${row.ratePct}% margin`}
                            </p>
                          </div>
                        </div>
                      </div>
                    ) : (
                      <div className="space-y-3">
                        {/* Visual Load Bar Distribusi Titip Modal */}
                        <div className="rounded-xl border border-border bg-muted/30 p-3.5 space-y-2.5">
                          <div className="flex items-center justify-between text-xs">
                            <span className="font-medium text-foreground flex items-center gap-1.5">
                              <Coins className="size-3.5 text-muted-foreground" />
                              Distribusi Return Modal
                            </span>
                            <Badge
                              variant="outline"
                              className="border-border bg-muted/50 text-foreground font-semibold text-[11px]"
                            >
                              {row.ratePct}% Return
                            </Badge>
                          </div>

                          {/* Progress Track */}
                          <div className="relative h-2.5 w-full rounded-full bg-muted overflow-hidden border border-border/40">
                            <div
                              className="h-full rounded-full bg-foreground/25 transition-all duration-700"
                              style={{ width: `${Math.min(100, Math.max(12, row.ratePct * 10))}%` }}
                            />
                          </div>

                          <div className="flex items-center justify-between text-xs pt-0.5">
                            <span className="font-semibold text-foreground">
                              Bagi Hasil: {formatCurrency(row.amount)}
                            </span>
                            <span className="text-muted-foreground text-[11px]">
                              Rate: {row.ratePct}% / bulan
                            </span>
                          </div>
                        </div>

                        {/* Nominal Modal Highlight */}
                        <div className="grid grid-cols-2 gap-2 text-xs">
                          <div className="rounded-xl border border-border/50 bg-muted/30 p-2.5">
                            <p className="text-muted-foreground text-[11px]">Nominal Modal</p>
                            <p className="font-bold text-foreground text-sm mt-0.5">
                              {formatCurrency(row.capitalAmount || row.baseAmount)}
                            </p>
                          </div>

                          <div className="rounded-xl border border-border/50 bg-muted/30 p-2.5">
                            <p className="text-muted-foreground text-[11px]">Skema Akad</p>
                            <p className="font-semibold text-foreground mt-0.5">
                              {akadLabels[row.akadType] ?? row.akadType} ({row.ratePct}%)
                            </p>
                          </div>
                        </div>
                      </div>
                    )}

                    {/* Bottom: Note & Action Buttons for saved draft */}
                    <div className="border-t border-border/40 pt-3 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 text-xs text-muted-foreground">
                      <p className="italic leading-relaxed">{row.note}</p>

                      {viewSource === "draft" && row.id ? (
                        <div className="flex items-center gap-2 shrink-0 self-end sm:self-auto">
                          <Badge variant={row.status === "dibayar" ? "default" : "secondary"}>
                            {row.status ?? "draft"}
                          </Badge>
                          {row.status === "draft" ? (
                            <Button
                              size="sm"
                              variant="outline"
                              className="rounded-full h-7 text-xs"
                              onClick={() => void updateStatus(row.id!, "disetujui")}
                            >
                              Setujui
                            </Button>
                          ) : null}
                          {row.status === "disetujui" ? (
                            <Button
                              size="sm"
                              className="rounded-full h-7 text-xs"
                              onClick={() => void updateStatus(row.id!, "dibayar")}
                            >
                              Tandai Dibayar
                            </Button>
                          ) : null}
                        </div>
                      ) : null}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>

      {/* History Section if exists */}
      {historyRows.length > 0 && (
        <div className="space-y-4 pt-2">
          <div className="flex items-center gap-2">
            <h3 className="font-heading text-lg font-bold">Riwayat Payout Sebelumnya</h3>
          </div>
          {Object.entries(
            historyRows.reduce((acc, row) => {
              const monthKey = row.periodStart
                ? new Intl.DateTimeFormat("id-ID", { month: "long", year: "numeric" }).format(
                    new Date(row.periodStart)
                  )
                : "Periode Tidak Diketahui";
              if (!acc[monthKey]) acc[monthKey] = [];
              acc[monthKey].push(row);
              return acc;
            }, {} as Record<string, PayoutRow[]>)
          )
            .filter(([monthKey]) => monthKey !== selectedMonthLabel || !hasSavedDraft)
            .map(([monthKey, groupRows]) => (
              <Card key={monthKey} className="rounded-2xl border-border/60 bg-card">
                <CardHeader className="py-4">
                  <CardTitle className="text-base font-semibold">{monthKey}</CardTitle>
                </CardHeader>
                <CardContent>
                  <PayoutPreviewTable
                    rows={groupRows}
                    mode="saved"
                    onApprove={(id) => void updateStatus(id, "disetujui")}
                    onPaid={(id) => void updateStatus(id, "dibayar")}
                  />
                </CardContent>
              </Card>
            ))}
        </div>
      )}
    </div>
  );
}
