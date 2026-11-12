"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  ArrowUpDown,
  CalendarDays,
  ChevronLeft,
  ChevronRight,
  ChevronsLeft,
  ChevronsRight,
  Download,
  Eye,
  FilterX,
  Loader2,
  ReceiptText,
  RefreshCw,
  Search,
  SlidersHorizontal,
  UserRound,
} from "lucide-react";
import { toast } from "sonner";
import { useAppState } from "@/components/providers/app-state-provider";
import { useCurrentRole } from "@/components/role-gate";
import { TransactionDetailDialog } from "@/components/tokomu/transaction-detail-dialog";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
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
import { formatCurrency, formatDateTime } from "@/lib/format";
import { getJakartaDateKey } from "@/lib/server/timezone";
import type {
  DetailedTransactionRow,
  TransactionQueryResult,
  TransactionSortOption,
} from "@/lib/server/transaction-query-service";
import type { Transaction } from "@/lib/types";
import { cn } from "@/lib/utils";

type DatePreset = "all" | "today" | "7d" | "30d" | "month" | "custom";

function shiftJakartaDays(dateKey: string, deltaDays: number): string {
  const [y, m, d] = dateKey.split("-").map(Number);
  const dt = new Date(Date.UTC(y, m - 1, d + deltaDays));
  const yy = dt.getUTCFullYear();
  const mm = String(dt.getUTCMonth() + 1).padStart(2, "0");
  const dd = String(dt.getUTCDate()).padStart(2, "0");
  return `${yy}-${mm}-${dd}`;
}

function getPaymentBadgeClass(method?: string | null) {
  const lower = (method ?? "").toLowerCase();
  if (lower.includes("tunai")) {
    return "bg-emerald-500/10 text-emerald-700 border-emerald-500/30 dark:text-emerald-400";
  }
  if (lower.includes("qris")) {
    return "bg-purple-500/10 text-purple-700 border-purple-500/30 dark:text-purple-400";
  }
  return "bg-blue-500/10 text-blue-700 border-blue-500/30 dark:text-blue-400";
}

export function TransactionsView() {
  const currentRole = useCurrentRole();
  const { deleteTransaction } = useAppState();
  const canViewProfit = currentRole !== "kasir";
  const canDelete = currentRole === "pimpinan";

  const [searchInput, setSearchInput] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [datePreset, setDatePreset] = useState<DatePreset>("all");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [paymentMethod, setPaymentMethod] = useState("all");
  const [recordedBy, setRecordedBy] = useState("all");
  const [entrySource, setEntrySource] = useState("all");
  const [minTotal, setMinTotal] = useState("");
  const [maxTotal, setMaxTotal] = useState("");
  const [sort, setSort] = useState<TransactionSortOption>("newest");
  const [showAdvanced, setShowAdvanced] = useState(false);

  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(25);

  const [data, setData] = useState<TransactionQueryResult | null>(null);
  const [loading, setLoading] = useState(true);
  const [exporting, setExporting] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [selectedTransaction, setSelectedTransaction] = useState<Transaction | null>(null);

  const abortRef = useRef<AbortController | null>(null);

  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedSearch(searchInput.trim());
      setPage(1);
    }, 300);
    return () => clearTimeout(timer);
  }, [searchInput]);

  const buildQueryString = useCallback(
    (override?: { exportCsv?: boolean }) => {
      const params = new URLSearchParams();
      if (debouncedSearch) params.set("q", debouncedSearch);
      if (startDate) params.set("startDate", startDate);
      if (endDate) params.set("endDate", endDate);
      if (paymentMethod !== "all") params.set("paymentMethod", paymentMethod);
      if (recordedBy !== "all") params.set("recordedBy", recordedBy);
      if (entrySource !== "all") params.set("entrySource", entrySource);
      if (minTotal.trim()) params.set("minTotal", minTotal.trim());
      if (maxTotal.trim()) params.set("maxTotal", maxTotal.trim());
      params.set("sort", sort);
      if (override?.exportCsv) {
        params.set("export", "csv");
      } else {
        params.set("page", String(page));
        params.set("pageSize", String(pageSize));
      }
      return params.toString();
    },
    [
      debouncedSearch,
      endDate,
      entrySource,
      maxTotal,
      minTotal,
      page,
      pageSize,
      paymentMethod,
      recordedBy,
      sort,
      startDate,
    ]
  );

  const fetchTransactions = useCallback(async () => {
    abortRef.current?.abort();
    const controller = new AbortController();
    abortRef.current = controller;

    setLoading(true);
    setErrorMessage(null);
    try {
      const qs = buildQueryString();
      const res = await fetch(`/api/transactions?${qs}`, {
        cache: "no-store",
        signal: controller.signal,
      });
      const json = (await res.json().catch(() => null)) as
        | (TransactionQueryResult & { error?: string })
        | null;

      if (!res.ok || !json || !Array.isArray(json.items)) {
        throw new Error(json?.error || "Gagal memuat riwayat transaksi.");
      }

      setData(json);
    } catch (error) {
      if (error instanceof DOMException && error.name === "AbortError") return;
      const msg = error instanceof Error ? error.message : "Gagal memuat riwayat transaksi.";
      setErrorMessage(msg);
    } finally {
      if (abortRef.current === controller) {
        setLoading(false);
      }
    }
  }, [buildQueryString]);

  useEffect(() => {
    const timer = setTimeout(() => {
      void fetchTransactions();
    }, 0);
    return () => {
      clearTimeout(timer);
      abortRef.current?.abort();
    };
  }, [fetchTransactions]);

  function applyDatePreset(preset: DatePreset) {
    const today = getJakartaDateKey();
    setDatePreset(preset);
    setPage(1);
    if (preset === "all") {
      setStartDate("");
      setEndDate("");
    } else if (preset === "today") {
      setStartDate(today);
      setEndDate(today);
    } else if (preset === "7d") {
      setStartDate(shiftJakartaDays(today, -6));
      setEndDate(today);
    } else if (preset === "30d") {
      setStartDate(shiftJakartaDays(today, -29));
      setEndDate(today);
    } else if (preset === "month") {
      setStartDate(`${today.slice(0, 7)}-01`);
      setEndDate(today);
    }
  }

  function resetAllFilters() {
    setSearchInput("");
    setDebouncedSearch("");
    setDatePreset("all");
    setStartDate("");
    setEndDate("");
    setPaymentMethod("all");
    setRecordedBy("all");
    setEntrySource("all");
    setMinTotal("");
    setMaxTotal("");
    setSort("newest");
    setPage(1);
  }

  async function handleExportCsv() {
    setExporting(true);
    try {
      const qs = buildQueryString({ exportCsv: true });
      const res = await fetch(`/api/transactions?${qs}`, { cache: "no-store" });
      if (!res.ok) {
        throw new Error("Gagal mengekspor data transaksi.");
      }
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = `riwayat-transaksi-${getJakartaDateKey()}.csv`;
      document.body.appendChild(link);
      link.click();
      link.remove();
      URL.revokeObjectURL(url);
      toast.success("CSV riwayat transaksi berhasil diunduh.");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Gagal mengekspor CSV.");
    } finally {
      setExporting(false);
    }
  }

  const hasActiveFilter = useMemo(() => {
    return Boolean(
      debouncedSearch ||
        startDate ||
        endDate ||
        paymentMethod !== "all" ||
        recordedBy !== "all" ||
        entrySource !== "all" ||
        minTotal.trim() ||
        maxTotal.trim() ||
        sort !== "newest"
    );
  }, [
    debouncedSearch,
    endDate,
    entrySource,
    maxTotal,
    minTotal,
    paymentMethod,
    recordedBy,
    sort,
    startDate,
  ]);

  const items: DetailedTransactionRow[] = data?.items ?? [];
  const pagination = data?.pagination ?? { page: 1, pageSize, totalCount: 0, totalPages: 1 };
  const summary = data?.summary;
  const paymentMethods = useMemo(() => {
    const base = new Set(["Tunai", "QRIS", "Transfer"]);
    for (const m of data?.filterOptions.paymentMethods ?? []) {
      if (m) base.add(m);
    }
    return Array.from(base);
  }, [data?.filterOptions.paymentMethods]);

  const cashiers = data?.filterOptions.cashiers ?? [];
  const startItem =
    pagination.totalCount === 0 ? 0 : (pagination.page - 1) * pagination.pageSize + 1;
  const endItem = Math.min(pagination.page * pagination.pageSize, pagination.totalCount);

  return (
    <div className="w-full space-y-5 animate-in fade-in duration-300">
      {/* Page Header */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="font-heading text-2xl sm:text-3xl font-bold text-foreground flex items-center gap-2.5">
            <ReceiptText className="size-6 sm:size-7 text-primary shrink-0" />
            <span>Riwayat & Detail Transaksi</span>
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            Telusuri seluruh transaksi kasir maupun impor secara mendetail dengan filter tanggal, metode bayar, kasir, dan nama produk.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => void fetchTransactions()}
            disabled={loading}
            className="rounded-xl gap-1.5"
          >
            <RefreshCw className={cn("size-3.5", loading && "animate-spin")} />
            Muat Ulang
          </Button>
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => void handleExportCsv()}
            disabled={exporting || pagination.totalCount === 0}
            className="rounded-xl gap-1.5"
          >
            {exporting ? (
              <Loader2 className="size-3.5 animate-spin" />
            ) : (
              <Download className="size-3.5" />
            )}
            Export CSV
          </Button>
        </div>
      </div>

      {/* Summary KPI Cards */}
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <Card className="border-border/60 bg-card/80">
          <CardContent className="p-4">
            <p className="text-xs font-medium text-muted-foreground">Total Transaksi Cocok</p>
            <p className="mt-1 font-heading text-2xl font-bold tabular-nums">
              {(summary?.filteredCount ?? 0).toLocaleString("id-ID")}
            </p>
            <p className="mt-1 text-[11px] text-muted-foreground">
              {hasActiveFilter ? "Berdasarkan filter aktif" : "Seluruh riwayat di database"}
            </p>
          </CardContent>
        </Card>

        <Card className="border-border/60 bg-card/80">
          <CardContent className="p-4">
            <p className="text-xs font-medium text-muted-foreground">Total Omzet Terfilter</p>
            <p className="mt-1 font-heading text-2xl font-bold tabular-nums text-primary">
              {formatCurrency(summary?.filteredTotal ?? 0)}
            </p>
            <div className="mt-1.5 flex flex-wrap gap-1.5">
              {(summary?.paymentBreakdown ?? []).map((b) => (
                <span
                  key={b.method}
                  className="inline-flex items-center rounded-md bg-muted/70 px-1.5 py-0.5 text-[10px] font-medium text-muted-foreground"
                >
                  {b.method}: {b.count}x
                </span>
              ))}
            </div>
          </CardContent>
        </Card>

        {canViewProfit ? (
          <>
            <Card className="border-border/60 bg-card/80">
              <CardContent className="p-4">
                <p className="text-xs font-medium text-muted-foreground">Total HPP Terfilter</p>
                <p className="mt-1 font-heading text-2xl font-bold tabular-nums text-amber-700 dark:text-amber-400">
                  {formatCurrency(summary?.filteredCogs ?? 0)}
                </p>
                <p className="mt-1 text-[11px] text-muted-foreground">
                  Modal barang dari item terjual
                </p>
              </CardContent>
            </Card>

            <Card className="border-border/60 bg-card/80">
              <CardContent className="p-4">
                <p className="text-xs font-medium text-muted-foreground">Laba Kotor Terfilter</p>
                <p className="mt-1 font-heading text-2xl font-bold tabular-nums text-emerald-700 dark:text-emerald-400">
                  {formatCurrency(summary?.filteredGrossProfit ?? 0)}
                </p>
                <p className="mt-1 text-[11px] text-muted-foreground">
                  Omzet dikurangi HPP item
                </p>
              </CardContent>
            </Card>
          </>
        ) : (
          <Card className="border-border/60 bg-card/80 sm:col-span-2">
            <CardContent className="p-4 flex items-center justify-between gap-3">
              <div>
                <p className="text-xs font-medium text-muted-foreground">Rincian Metode Pembayaran</p>
                <div className="mt-2 flex flex-wrap gap-2">
                  {(summary?.paymentBreakdown ?? []).length > 0 ? (
                    summary?.paymentBreakdown.map((b) => (
                      <Badge key={b.method} variant="outline" className={cn("rounded-lg px-2.5 py-1 text-xs", getPaymentBadgeClass(b.method))}>
                        {b.method}: {formatCurrency(b.total)} ({b.count} transaksi)
                      </Badge>
                    ))
                  ) : (
                    <span className="text-xs text-muted-foreground">Belum ada data metode bayar.</span>
                  )}
                </div>
              </div>
            </CardContent>
          </Card>
        )}
      </div>

      {/* Filter Panel */}
      <Card className="border-border/60 bg-card/80 shadow-xs">
        <CardHeader className="pb-3">
          <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <CardTitle className="text-base font-heading">Filter & Pencarian</CardTitle>
              <CardDescription className="text-xs">
                Filter dijalankan langsung di PostgreSQL per halaman sehingga tetap ringan dan hemat memori.
              </CardDescription>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={() => setShowAdvanced((v) => !v)}
                className="h-8 rounded-lg text-xs gap-1.5"
              >
                <SlidersHorizontal className="size-3.5" />
                {showAdvanced ? "Sembunyikan Filter Nominal" : "Filter Nominal & Sumber"}
              </Button>
              {hasActiveFilter ? (
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={resetAllFilters}
                  className="h-8 rounded-lg text-xs gap-1.5 text-rose-600 border-rose-500/30 hover:bg-rose-500/10"
                >
                  <FilterX className="size-3.5" />
                  Reset Filter
                </Button>
              ) : null}
            </div>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Quick Date Presets */}
          <div className="flex flex-wrap items-center gap-1.5">
            <span className="text-xs font-medium text-muted-foreground mr-1 flex items-center gap-1">
              <CalendarDays className="size-3.5" /> Periode:
            </span>
            {(
              [
                { id: "all", label: "Semua Waktu" },
                { id: "today", label: "Hari Ini" },
                { id: "7d", label: "7 Hari Terakhir" },
                { id: "30d", label: "30 Hari Terakhir" },
                { id: "month", label: "Bulan Ini" },
              ] as const
            ).map((preset) => (
              <button
                key={preset.id}
                type="button"
                onClick={() => applyDatePreset(preset.id)}
                className={cn(
                  "rounded-xl px-3 py-1 text-xs font-medium transition cursor-pointer border",
                  datePreset === preset.id
                    ? "bg-primary text-primary-foreground border-primary shadow-xs"
                    : "bg-background/70 text-muted-foreground border-border/70 hover:text-foreground hover:border-primary/40"
                )}
              >
                {preset.label}
              </button>
            ))}
          </div>

          {/* Primary Filter Row */}
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-6">
            <div className="lg:col-span-2 space-y-1.5">
              <Label htmlFor="trx-search" className="text-xs text-muted-foreground">
                Cari Produk / ID Nota / Ref / Kasir
              </Label>
              <div className="relative">
                <Search className="pointer-events-none absolute left-3 top-1/2 size-3.5 -translate-y-1/2 text-muted-foreground" />
                <Input
                  id="trx-search"
                  value={searchInput}
                  onChange={(e) => setSearchInput(e.target.value)}
                  placeholder="Contoh: Gas, Minyak, trx_..., ika"
                  className="pl-8 h-9 rounded-xl text-sm"
                />
              </div>
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="trx-start-date" className="text-xs text-muted-foreground">
                Dari Tanggal
              </Label>
              <Input
                id="trx-start-date"
                type="date"
                value={startDate}
                onChange={(e) => {
                  setStartDate(e.target.value);
                  setDatePreset("custom");
                  setPage(1);
                }}
                className="h-9 rounded-xl text-xs"
              />
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="trx-end-date" className="text-xs text-muted-foreground">
                Sampai Tanggal
              </Label>
              <Input
                id="trx-end-date"
                type="date"
                value={endDate}
                onChange={(e) => {
                  setEndDate(e.target.value);
                  setDatePreset("custom");
                  setPage(1);
                }}
                className="h-9 rounded-xl text-xs"
              />
            </div>

            <div className="space-y-1.5">
              <Label className="text-xs text-muted-foreground">Metode Pembayaran</Label>
              <Select
                value={paymentMethod}
                onValueChange={(value) => {
                  setPaymentMethod(value ?? "all");
                  setPage(1);
                }}
              >
                <SelectTrigger className="w-full h-9 rounded-xl text-xs">
                  <SelectValue placeholder="Semua Metode">
                    {paymentMethod === "all" ? "Semua Metode" : paymentMethod}
                  </SelectValue>
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Semua Metode</SelectItem>
                  {paymentMethods.map((m) => (
                    <SelectItem key={m} value={m}>
                      {m}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-1.5">
              <Label className="text-xs text-muted-foreground">Kasir / Pencatat</Label>
              <Select
                value={recordedBy}
                onValueChange={(value) => {
                  setRecordedBy(value ?? "all");
                  setPage(1);
                }}
              >
                <SelectTrigger className="w-full h-9 rounded-xl text-xs">
                  <SelectValue placeholder="Semua Kasir">
                    {recordedBy === "all" ? "Semua Kasir" : recordedBy}
                  </SelectValue>
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Semua Kasir</SelectItem>
                  {cashiers.map((c) => (
                    <SelectItem key={c} value={c}>
                      {c}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          {/* Advanced Filter Row */}
          {showAdvanced ? (
            <div className="grid gap-3 pt-2 border-t border-border/50 sm:grid-cols-2 lg:grid-cols-4">
              <div className="space-y-1.5">
                <Label className="text-xs text-muted-foreground">Sumber Transaksi</Label>
                <Select
                  value={entrySource}
                  onValueChange={(value) => {
                    setEntrySource(value ?? "all");
                    setPage(1);
                  }}
                >
                  <SelectTrigger className="w-full h-9 rounded-xl text-xs">
                    <SelectValue placeholder="Semua Sumber">
                      {entrySource === "pos"
                        ? "Kasir POS"
                        : entrySource === "import"
                          ? "Impor File"
                          : "Semua Sumber"}
                    </SelectValue>
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Semua Sumber</SelectItem>
                    <SelectItem value="pos">Kasir POS</SelectItem>
                    <SelectItem value="import">Impor File</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="trx-min-total" className="text-xs text-muted-foreground">
                  Nominal Minimal (Rp)
                </Label>
                <Input
                  id="trx-min-total"
                  type="number"
                  min={0}
                  value={minTotal}
                  onChange={(e) => {
                    setMinTotal(e.target.value);
                    setPage(1);
                  }}
                  placeholder="Mis. 50000"
                  className="h-9 rounded-xl text-xs"
                />
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="trx-max-total" className="text-xs text-muted-foreground">
                  Nominal Maksimal (Rp)
                </Label>
                <Input
                  id="trx-max-total"
                  type="number"
                  min={0}
                  value={maxTotal}
                  onChange={(e) => {
                    setMaxTotal(e.target.value);
                    setPage(1);
                  }}
                  placeholder="Mis. 500000"
                  className="h-9 rounded-xl text-xs"
                />
              </div>

              <div className="space-y-1.5">
                <Label className="text-xs text-muted-foreground flex items-center gap-1">
                  <ArrowUpDown className="size-3" /> Urutkan
                </Label>
                <Select
                  value={sort}
                  onValueChange={(value) => {
                    setSort((value as TransactionSortOption) || "newest");
                    setPage(1);
                  }}
                >
                  <SelectTrigger className="w-full h-9 rounded-xl text-xs">
                    <SelectValue>
                      {sort === "oldest"
                        ? "Waktu Terlama"
                        : sort === "highest"
                          ? "Nominal Tertinggi"
                          : sort === "lowest"
                            ? "Nominal Terendah"
                            : "Waktu Terbaru"}
                    </SelectValue>
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="newest">Waktu Terbaru</SelectItem>
                    <SelectItem value="oldest">Waktu Terlama</SelectItem>
                    <SelectItem value="highest">Nominal Tertinggi</SelectItem>
                    <SelectItem value="lowest">Nominal Terendah</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
          ) : (
            <div className="flex flex-wrap items-center justify-between gap-2 pt-1 text-xs text-muted-foreground">
              <div className="flex items-center gap-2">
                <span>Urutan:</span>
                <div className="inline-flex rounded-lg border border-border/60 bg-muted/30 p-0.5">
                  {(
                    [
                      { id: "newest", label: "Terbaru" },
                      { id: "oldest", label: "Terlama" },
                      { id: "highest", label: "Terbesar" },
                      { id: "lowest", label: "Terkecil" },
                    ] as const
                  ).map((opt) => (
                    <button
                      key={opt.id}
                      type="button"
                      onClick={() => {
                        setSort(opt.id);
                        setPage(1);
                      }}
                      className={cn(
                        "rounded-md px-2.5 py-1 text-[11px] font-medium transition cursor-pointer",
                        sort === opt.id
                          ? "bg-background text-foreground shadow-xs font-semibold"
                          : "text-muted-foreground hover:text-foreground"
                      )}
                    >
                      {opt.label}
                    </button>
                  ))}
                </div>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Transactions Table Card */}
      <Card className="border-border/60 bg-card/85 shadow-xs overflow-hidden">
        <CardContent className="p-0">
          {errorMessage ? (
            <div className="p-8 text-center space-y-2">
              <p className="text-sm font-medium text-destructive">{errorMessage}</p>
              <Button variant="outline" size="sm" onClick={() => void fetchTransactions()}>
                Coba Lagi
              </Button>
            </div>
          ) : loading && !data ? (
            <div className="flex h-64 items-center justify-center gap-2 text-muted-foreground">
              <Loader2 className="size-5 animate-spin text-primary" />
              <span className="text-sm">Memuat daftar transaksi...</span>
            </div>
          ) : items.length === 0 ? (
            <div className="p-10 text-center space-y-2">
              <ReceiptText className="mx-auto size-8 text-muted-foreground/50" />
              <p className="text-sm font-medium text-foreground">
                Tidak ada transaksi yang cocok dengan filter saat ini.
              </p>
              <p className="text-xs text-muted-foreground">
                Coba ubah rentang tanggal, kata kunci pencarian, atau reset semua filter.
              </p>
              {hasActiveFilter ? (
                <Button variant="outline" size="sm" onClick={resetAllFilters} className="mt-2 rounded-xl">
                  Reset Semua Filter
                </Button>
              ) : null}
            </div>
          ) : (
            <>
              {/* Desktop Table */}
              <div className="hidden md:block overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow className="bg-muted/35 hover:bg-muted/35">
                      <TableHead className="w-[165px]">Waktu (WIB)</TableHead>
                      <TableHead className="w-[165px]">ID & Kasir</TableHead>
                      <TableHead className="w-[115px]">Metode</TableHead>
                      <TableHead>Rincian Item Terjual</TableHead>
                      <TableHead className="text-right w-[145px]">Total</TableHead>
                      {canViewProfit ? (
                        <TableHead className="text-right w-[135px]">Laba Kotor</TableHead>
                      ) : null}
                      <TableHead className="text-right w-[95px]">Detail</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {items.map((tx) => {
                      const totalQty = tx.items.reduce((s, i) => s + i.quantity, 0);
                      return (
                        <TableRow
                          key={tx.id}
                          onClick={() => setSelectedTransaction(tx)}
                          className="cursor-pointer transition-colors hover:bg-primary/5"
                        >
                          <TableCell className="align-top text-xs whitespace-nowrap">
                            <div className="font-medium text-foreground">
                              {formatDateTime(tx.occurredAt)}
                            </div>
                            {tx.shiftName ? (
                              <Badge variant="outline" className="mt-1 text-[10px] rounded-full px-2 py-0">
                                {tx.shiftName}
                              </Badge>
                            ) : null}
                          </TableCell>
                          <TableCell className="align-top text-xs">
                            <div className="font-mono text-[11px] font-medium text-foreground truncate max-w-[155px]">
                              {tx.id}
                            </div>
                            <div className="mt-1 flex items-center gap-1 text-muted-foreground">
                              <UserRound className="size-3 shrink-0" />
                              <span className="truncate max-w-[135px]">
                                {tx.recordedByName || "Kasir"}
                              </span>
                            </div>
                            {tx.entrySource === "import" ? (
                              <Badge variant="secondary" className="mt-1 text-[10px] rounded-full px-1.5 py-0">
                                Impor{tx.externalRef ? ` • ${tx.externalRef}` : ""}
                              </Badge>
                            ) : null}
                          </TableCell>
                          <TableCell className="align-top">
                            <Badge
                              variant="outline"
                              className={cn(
                                "rounded-full text-[11px] font-medium",
                                getPaymentBadgeClass(tx.paymentMethod)
                              )}
                            >
                              {tx.paymentMethod || "Tunai"}
                            </Badge>
                          </TableCell>
                          <TableCell className="align-top">
                            <div className="flex flex-wrap gap-1.5">
                              {tx.items.slice(0, 3).map((item, idx) => (
                                <span
                                  key={`${tx.id}-${item.productId}-${idx}`}
                                  className="inline-flex items-center rounded-lg bg-muted/65 px-2 py-0.5 text-[11px] text-foreground"
                                >
                                  {item.productName} × {item.quantity}
                                </span>
                              ))}
                              {tx.items.length > 3 ? (
                                <span className="inline-flex items-center rounded-lg bg-primary/10 px-2 py-0.5 text-[11px] font-medium text-primary">
                                  +{tx.items.length - 3} item lagi
                                </span>
                              ) : null}
                            </div>
                            <p className="mt-1 text-[11px] text-muted-foreground">
                              {tx.items.length} produk • {totalQty} pcs terjual
                            </p>
                          </TableCell>
                          <TableCell className="align-top text-right tabular-nums whitespace-nowrap">
                            <div className="font-semibold text-sm text-foreground">
                              {formatCurrency(tx.total)}
                            </div>
                            {tx.paymentMethod === "Tunai" && tx.changeAmount > 0 ? (
                              <div className="text-[11px] text-muted-foreground">
                                Kembali {formatCurrency(tx.changeAmount)}
                              </div>
                            ) : null}
                          </TableCell>
                          {canViewProfit ? (
                            <TableCell className="align-top text-right tabular-nums whitespace-nowrap">
                              <div className="font-semibold text-xs text-emerald-700 dark:text-emerald-400">
                                {formatCurrency(tx.grossProfit ?? 0)}
                              </div>
                              <div className="text-[11px] text-muted-foreground">
                                HPP {formatCurrency(tx.cogs ?? 0)}
                              </div>
                            </TableCell>
                          ) : null}
                          <TableCell className="align-top text-right">
                            <Button
                              type="button"
                              variant="ghost"
                              size="sm"
                              onClick={(e) => {
                                e.stopPropagation();
                                setSelectedTransaction(tx);
                              }}
                              className="h-8 rounded-lg px-2.5 text-xs gap-1"
                            >
                              <Eye className="size-3.5" />
                              Struk
                            </Button>
                          </TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              </div>

              {/* Mobile Cards */}
              <div className="md:hidden divide-y divide-border/50">
                {items.map((tx) => {
                  const totalQty = tx.items.reduce((s, i) => s + i.quantity, 0);
                  return (
                    <button
                      key={`m-${tx.id}`}
                      type="button"
                      onClick={() => setSelectedTransaction(tx)}
                      className="w-full p-4 text-left transition hover:bg-primary/5 space-y-2 cursor-pointer"
                    >
                      <div className="flex items-start justify-between gap-2">
                        <div>
                          <div className="flex items-center gap-2">
                            <span className="font-heading text-base font-bold tabular-nums">
                              {formatCurrency(tx.total)}
                            </span>
                            <Badge
                              variant="outline"
                              className={cn(
                                "rounded-full text-[10px] px-2 py-0",
                                getPaymentBadgeClass(tx.paymentMethod)
                              )}
                            >
                              {tx.paymentMethod}
                            </Badge>
                          </div>
                          <p className="text-[11px] text-muted-foreground mt-0.5">
                            {formatDateTime(tx.occurredAt)} • {tx.recordedByName || "Kasir"}
                          </p>
                        </div>
                        <span className="inline-flex size-8 items-center justify-center rounded-full border border-border/70 bg-card text-muted-foreground shrink-0">
                          <Eye className="size-3.5" />
                        </span>
                      </div>
                      <div className="flex flex-wrap gap-1">
                        {tx.items.slice(0, 3).map((item, idx) => (
                          <span
                            key={`m-${tx.id}-${idx}`}
                            className="rounded-md bg-muted/65 px-2 py-0.5 text-[11px]"
                          >
                            {item.productName} × {item.quantity}
                          </span>
                        ))}
                        {tx.items.length > 3 ? (
                          <span className="rounded-md bg-primary/10 px-2 py-0.5 text-[11px] text-primary font-medium">
                            +{tx.items.length - 3} item ({totalQty} pcs)
                          </span>
                        ) : null}
                      </div>
                    </button>
                  );
                })}
              </div>
            </>
          )}

          {/* Pagination Footer */}
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between border-t border-border/50 p-3.5 sm:px-4 text-xs text-muted-foreground bg-muted/15">
            <div className="flex flex-wrap items-center gap-2">
              <span>Per halaman:</span>
              <div className="inline-flex rounded-lg border border-border/60 bg-background/70 p-0.5">
                {[10, 25, 50, 100].map((size) => (
                  <button
                    key={size}
                    type="button"
                    onClick={() => {
                      setPageSize(size);
                      setPage(1);
                    }}
                    className={cn(
                      "rounded-md px-2.5 py-1 text-xs font-medium transition-colors cursor-pointer",
                      pageSize === size
                        ? "bg-primary text-primary-foreground shadow-xs font-bold"
                        : "text-muted-foreground hover:text-foreground"
                    )}
                  >
                    {size}
                  </button>
                ))}
              </div>
              <span className="pl-1">
                Menampilkan {startItem} - {endItem} dari{" "}
                {pagination.totalCount.toLocaleString("id-ID")} transaksi
              </span>
              {loading ? <Loader2 className="size-3.5 animate-spin text-primary" /> : null}
            </div>

            {pagination.totalPages > 1 ? (
              <div className="flex items-center gap-1.5 self-end sm:self-auto">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  disabled={pagination.page <= 1 || loading}
                  onClick={() => setPage(1)}
                  className="h-8 w-8 p-0 rounded-lg"
                  title="Halaman pertama"
                >
                  <ChevronsLeft className="size-3.5" />
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  disabled={pagination.page <= 1 || loading}
                  onClick={() => setPage((p) => Math.max(1, p - 1))}
                  className="h-8 w-8 p-0 rounded-lg"
                  title="Halaman sebelumnya"
                >
                  <ChevronLeft className="size-3.5" />
                </Button>
                <span className="px-2 font-medium text-foreground tabular-nums">
                  Hal {pagination.page} / {pagination.totalPages}
                </span>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  disabled={pagination.page >= pagination.totalPages || loading}
                  onClick={() => setPage((p) => Math.min(pagination.totalPages, p + 1))}
                  className="h-8 w-8 p-0 rounded-lg"
                  title="Halaman berikutnya"
                >
                  <ChevronRight className="size-3.5" />
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  disabled={pagination.page >= pagination.totalPages || loading}
                  onClick={() => setPage(pagination.totalPages)}
                  className="h-8 w-8 p-0 rounded-lg"
                  title="Halaman terakhir"
                >
                  <ChevronsRight className="size-3.5" />
                </Button>
              </div>
            ) : null}
          </div>
        </CardContent>
      </Card>

      {/* Receipt / Item Breakdown & Delete Modal */}
      <TransactionDetailDialog
        transaction={selectedTransaction}
        canViewProfit={canViewProfit}
        canDelete={canDelete}
        onDelete={async (transactionId) => {
          await deleteTransaction(transactionId);
          setSelectedTransaction(null);
          await fetchTransactions();
        }}
        onClose={() => setSelectedTransaction(null)}
      />
    </div>
  );
}

