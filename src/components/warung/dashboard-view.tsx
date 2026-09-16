"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import {
  AlertTriangle,
  ArrowRight,
  ArrowRightLeft,
  ArrowUpRight,
  CheckCircle2,
  ChevronRight,
  Clock3,
  Eye,
  Package,
  Phone,
  ReceiptText,
  ShoppingCart,
  Sparkles,
  WalletCards,
} from "lucide-react";
import { useAppState } from "@/components/providers/app-state-provider";
import { useCurrentRole } from "@/components/role-gate";
import { StatCard } from "@/components/stat-card";
import {
  DashboardMetric,
  MetricDetailDialog,
} from "@/components/tokomu/metric-detail-dialog";
import { TransactionDetailDialog } from "@/components/tokomu/transaction-detail-dialog";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { ScrollArea } from "@/components/ui/scroll-area";
import { formatCurrency, formatDateTime, formatTime } from "@/lib/format";
import { getJakartaDayRange, isWithinJakartaRange } from "@/lib/server/timezone";
import type { Transaction } from "@/lib/types";
import { cn } from "@/lib/utils";

export function DashboardView() {
  const currentRole = useCurrentRole();
  const { debts, lowStockProducts, products, transactions, dataState, retryWorkspace } = useAppState();
  const todayRange = getJakartaDayRange();

  const todayTransactions = useMemo(() => {
    return transactions.filter((transaction) => {
      return isWithinJakartaRange(transaction.occurredAt, todayRange);
    });
  }, [transactions, todayRange]);

  const todaySales = useMemo(() => {
    return todayTransactions.reduce(
      (sum, transaction) => sum + transaction.total,
      0
    );
  }, [todayTransactions]);

  const outstandingDebt = useMemo(() => {
    return debts
      .filter((debt) => debt.status !== "lunas")
      .reduce((sum, debt) => sum + debt.remainingAmount, 0);
  }, [debts]);

  const { totalStockValue, categoryCount } = useMemo(() => {
    let sum = 0;
    const cats = new Set<string>();
    for (const p of products) {
      sum += (p.buyPrice || 0) * (p.stock || 0);
      if (p.category) cats.add(p.category);
    }
    return { totalStockValue: sum, categoryCount: cats.size };
  }, [products]);

  const latestTransaction = transactions[0] ?? null;
  const recentTransactions = transactions.slice(0, 10);
  const latestDebts = debts.slice(0, 6);

  const [activeMetric, setActiveMetric] = useState<DashboardMetric | null>(null);
  const [selectedTransaction, setSelectedTransaction] = useState<Transaction | null>(null);
  const [timelineOpen, setTimelineOpen] = useState(false);
  const canViewTransactionProfit = currentRole !== "kasir";

  return (
    <div className="space-y-4 animate-in fade-in duration-300">
      {/* Quick Action Navigation Bar */}
      <section className="flex flex-wrap items-center gap-2 sm:gap-3 py-0.5">
        <Link
          href="/kasir"
          className="group inline-flex items-center gap-2 rounded-2xl border border-primary/30 bg-gradient-to-r from-primary/15 via-primary/10 to-transparent px-3.5 py-2 text-xs font-semibold text-foreground shadow-xs transition hover:scale-[1.02] hover:border-primary hover:bg-primary/20 active:scale-[0.98] sm:text-sm"
        >
          <div className="flex size-7 items-center justify-center rounded-xl bg-primary text-primary-foreground shadow-xs">
            <ShoppingCart className="size-3.5" />
          </div>
          <span>Buka Kasir POS</span>
          <ArrowUpRight className="size-3.5 text-muted-foreground opacity-60 transition-all group-hover:opacity-100 group-hover:text-primary" />
        </Link>

        <Link
          href="/inventaris"
          className="group inline-flex items-center gap-2 rounded-2xl border border-border/70 bg-card/80 px-3.5 py-2 text-xs font-semibold text-foreground shadow-xs transition hover:scale-[1.02] hover:border-primary/50 hover:bg-card active:scale-[0.98] sm:text-sm"
        >
          <div className="flex size-7 items-center justify-center rounded-xl bg-muted text-foreground">
            <Package className="size-3.5" />
          </div>
          <span>Katalog & Stok</span>
          <ArrowUpRight className="size-3.5 text-muted-foreground opacity-60 transition-all group-hover:opacity-100 group-hover:text-primary" />
        </Link>

        <Link
          href="/buku-hutang"
          className="group inline-flex items-center gap-2 rounded-2xl border border-border/70 bg-card/80 px-3.5 py-2 text-xs font-semibold text-foreground shadow-xs transition hover:scale-[1.02] hover:border-primary/50 hover:bg-card active:scale-[0.98] sm:text-sm"
        >
          <div className="flex size-7 items-center justify-center rounded-xl bg-muted text-foreground">
            <WalletCards className="size-3.5" />
          </div>
          <span>Buku Kasbon</span>
          <ArrowUpRight className="size-3.5 text-muted-foreground opacity-60 transition-all group-hover:opacity-100 group-hover:text-primary" />
        </Link>

        <Link
          href="/laporan"
          className="group inline-flex items-center gap-2 rounded-2xl border border-border/70 bg-card/80 px-3.5 py-2 text-xs font-semibold text-foreground shadow-xs transition hover:scale-[1.02] hover:border-primary/50 hover:bg-card active:scale-[0.98] sm:text-sm"
        >
          <div className="flex size-7 items-center justify-center rounded-xl bg-muted text-foreground">
            <ReceiptText className="size-3.5" />
          </div>
          <span>Laporan & Pembukuan</span>
          <ArrowUpRight className="size-3.5 text-muted-foreground opacity-60 transition-all group-hover:opacity-100 group-hover:text-primary" />
        </Link>
      </section>

      {/* Row 1: Top 4 KPI Metrics Cards */}
      <section className="grid gap-4 grid-cols-2 md:grid-cols-4">
        <StatCard
          title="Omzet hari ini"
          value={formatCurrency(todaySales)}
          description="Akumulasi transaksi yang sudah masuk sejak pagi."
          onClick={() => setActiveMetric("omzet")}
          dataState={dataState}
          onRetry={retryWorkspace}
        />
        <StatCard
          title="Transaksi hari ini"
          value={`${todayTransactions.length} transaksi`}
          description="Ringkasan cepat untuk memantau ritme kasir."
          tone="accent"
          onClick={() => setActiveMetric("transaksi")}
          dataState={dataState}
          onRetry={retryWorkspace}
        />
        <StatCard
          title="Stok menipis"
          value={`${lowStockProducts.length} item`}
          description="Barang yang mulai rawan kosong dan sebaiknya segera dicek."
          tone="warn"
          onClick={() => setActiveMetric("stok")}
          dataState={dataState}
          onRetry={retryWorkspace}
        />
        <StatCard
          title="Kasbon aktif"
          value={formatCurrency(outstandingDebt)}
          description="Total piutang pelanggan yang belum lunas."
          onClick={() => setActiveMetric("kasbon")}
          dataState={dataState}
          onRetry={retryWorkspace}
        />
      </section>

      <div className="space-y-4">
        {/* Row 2: Highlights - Transaksi Terakhir, Stok Perlu Perhatian, SKU Aktif */}
        <div className="grid gap-4 lg:grid-cols-12 items-stretch">
          {/* Transaksi Terakhir */}
          <Card className="flex flex-col justify-between border-border/60 bg-card/74 shadow-[0_28px_70px_-45px_rgba(66,38,20,0.55)] lg:col-span-5 xl:col-span-4">
            <CardHeader className="flex flex-row items-center justify-between gap-2 pb-3">
              <div>
                <CardTitle className="flex items-center gap-2 font-heading text-lg sm:text-xl">
                  <ReceiptText className="size-5 text-primary" />
                  Transaksi Terakhir
                </CardTitle>
                <CardDescription className="text-xs sm:text-sm">
                  Ringkasan cepat penjualan paling baru.
                </CardDescription>
              </div>
              <button
                type="button"
                onClick={() => setTimelineOpen(true)}
                className="flex items-center gap-1 rounded-xl bg-primary/10 px-2.5 py-1 text-xs font-semibold text-primary transition hover:bg-primary/20 shrink-0"
              >
                <span>Riwayat</span>
                <ArrowUpRight className="size-3.5" />
              </button>
            </CardHeader>
            <CardContent className="flex-1 flex flex-col justify-center">
              {latestTransaction ? (
                <div
                  role="button"
                  tabIndex={0}
                  onClick={() => setSelectedTransaction(latestTransaction)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" || e.key === " ") {
                      e.preventDefault();
                      setSelectedTransaction(latestTransaction);
                    }
                  }}
                  className="group rounded-[22px] border border-primary/20 bg-primary/10 p-4 text-foreground transition-all duration-200 hover:scale-[1.01] hover:border-primary/50 hover:bg-primary/15 hover:shadow-md active:scale-[0.99] cursor-pointer dark:border-primary/25 dark:bg-muted/55 select-none"
                  title="Klik untuk melihat detail struk transaksi"
                >
                  <div className="flex items-center justify-between mb-1.5">
                    <span className="inline-flex items-center gap-1 rounded-full bg-emerald-500/15 px-2.5 py-0.5 text-[11px] font-semibold text-emerald-700 dark:text-emerald-400">
                      <CheckCircle2 className="size-3" /> Berhasil
                    </span>
                    <span className="inline-flex items-center gap-1 text-xs font-semibold text-primary transition-transform group-hover:translate-x-0.5">
                      Lihat Struk
                      <ArrowUpRight className="size-3.5" />
                    </span>
                  </div>
                  <p className="font-heading text-2xl font-semibold tracking-tight sm:text-3xl">
                    {formatCurrency(latestTransaction.total)}
                  </p>
                  <p className="mt-1 text-xs text-muted-foreground sm:text-sm">
                    {latestTransaction.paymentMethod} • {formatTime(latestTransaction.occurredAt)}
                  </p>
                  <div className="mt-3.5 space-y-2 border-t border-primary/15 pt-3">
                    {latestTransaction.items.slice(0, 3).map((item) => (
                      <div
                        key={`${latestTransaction.id}-${item.productId}`}
                        className="flex items-center justify-between text-xs sm:text-sm"
                      >
                        <span className="truncate pr-2 font-medium">
                          {item.productName} × {item.quantity}
                        </span>
                        <span className="shrink-0 font-semibold tabular-nums">
                          {formatCurrency(item.unitPrice * item.quantity)}
                        </span>
                      </div>
                    ))}
                    {latestTransaction.items.length > 3 ? (
                      <p className="text-right text-[11px] italic text-muted-foreground">
                        + {latestTransaction.items.length - 3} produk lainnya
                      </p>
                    ) : null}
                  </div>
                </div>
              ) : (
                <div className="rounded-[22px] border border-dashed border-border/70 p-6 text-center text-xs text-muted-foreground sm:text-sm">
                  Belum ada transaksi yang tersimpan.
                </div>
              )}
            </CardContent>
          </Card>

          {/* Stok & SKU Aktif */}
          <div className="grid gap-4 sm:grid-cols-2 lg:col-span-7 xl:col-span-8 items-stretch">
            {/* Stok Perlu Perhatian */}
            <Card className="flex flex-col justify-between border-border/60 bg-card/74 shadow-[0_28px_70px_-45px_rgba(66,38,20,0.55)]">
              <CardHeader className="flex flex-row items-center justify-between gap-2 pb-3">
                <div>
                  <CardTitle className="flex items-center gap-2 font-heading text-lg sm:text-xl">
                    <AlertTriangle className="size-5 text-primary" />
                    Stok Perlu Perhatian
                  </CardTitle>
                  <CardDescription className="text-xs sm:text-sm">
                    Barang rawan kosong sebelum restok.
                  </CardDescription>
                </div>
                {lowStockProducts.length > 0 && (
                  <Link
                    href="/inventaris"
                    className="flex items-center gap-1 rounded-xl bg-primary/10 px-2.5 py-1 text-xs font-semibold text-primary transition hover:bg-primary/20 shrink-0"
                  >
                    <span>Kelola ({lowStockProducts.length})</span>
                    <ArrowUpRight className="size-3.5" />
                  </Link>
                )}
              </CardHeader>
              <CardContent className="space-y-2.5 flex-1">
                {dataState === "error" ? (
                  <div role="alert" className="flex h-[116px] flex-col items-center justify-center gap-2 rounded-[20px] bg-destructive/10 p-4 text-center text-xs font-medium text-destructive sm:text-sm">
                    <span>Gagal memuat data, coba lagi</span>
                    <button type="button" onClick={retryWorkspace} className="rounded-lg border border-current/30 px-2.5 py-1 text-xs font-semibold">
                      Muat ulang
                    </button>
                  </div>
                ) : dataState === "loading" ? (
                  <div className="flex h-[116px] items-center justify-center rounded-[20px] bg-muted/50 p-4 text-center text-xs text-muted-foreground sm:text-sm">
                    Memuat data stok...
                  </div>
                ) : lowStockProducts.length > 0 ? (
                  lowStockProducts.slice(0, 3).map((product) => (
                    <Link
                      key={product.id}
                      href={`/inventaris`}
                      title={`Klik untuk mengelola atau restok ${product.name}`}
                      className="group flex items-center justify-between rounded-[18px] border border-border/70 bg-card/80 px-3.5 py-2.5 transition-all hover:border-primary/50 hover:bg-primary/5 hover:shadow-xs"
                    >
                      <div className="flex items-center gap-2.5 truncate pr-2">
                        <div className="flex size-8 shrink-0 items-center justify-center rounded-xl bg-primary/12 text-primary group-hover:bg-primary group-hover:text-primary-foreground transition-colors">
                          <AlertTriangle className="size-3.5" />
                        </div>
                        <div className="truncate">
                          <p className="truncate text-xs font-medium sm:text-sm group-hover:text-primary transition-colors">{product.name}</p>
                          <p className="text-[11px] text-muted-foreground sm:text-xs">{product.category}</p>
                        </div>
                      </div>
                      <div className="flex items-center gap-2 shrink-0">
                        <Badge className="rounded-full bg-primary px-2.5 py-0.5 text-[11px] font-semibold text-primary-foreground">
                          {product.stock} / min {product.minimumStock}
                        </Badge>
                        <ArrowUpRight className="size-3.5 text-muted-foreground opacity-0 transition-opacity group-hover:opacity-100" />
                      </div>
                    </Link>
                  ))
                ) : (
                  <div className="flex h-[116px] items-center justify-center rounded-[20px] bg-accent/80 p-4 text-center text-xs font-medium text-accent-foreground sm:text-sm">
                    Semua stok aman. Belum ada produk yang menyentuh batas minimum.
                  </div>
                )}
              </CardContent>
            </Card>

            {/* SKU Aktif & Nilai Inventaris */}
            <Link
              href="/inventaris"
              className="group flex flex-col justify-between rounded-xl border border-border/60 bg-card/74 p-6 shadow-[0_28px_70px_-45px_rgba(66,38,20,0.55)] transition-all hover:border-primary/50 hover:bg-card hover:shadow-[0_32px_80px_-40px_rgba(66,38,20,0.65)] hover:scale-[1.01] active:scale-[0.99]"
              title="Klik untuk membuka katalog inventaris produk"
            >
              <div>
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Clock3 className="size-5 text-primary" />
                    <h3 className="font-heading text-lg sm:text-xl font-semibold">SKU Aktif</h3>
                  </div>
                  <span className="flex items-center gap-1 text-xs font-semibold text-primary opacity-80 group-hover:opacity-100 transition-opacity">
                    Katalog
                    <ArrowUpRight className="size-3.5 transition-transform group-hover:translate-x-0.5 group-hover:-translate-y-0.5" />
                  </span>
                </div>
                <p className="text-xs text-muted-foreground mt-1">
                  Katalog produk terdaftar dalam inventaris toko.
                </p>
              </div>

              <div className="my-4">
                <div className="flex items-baseline gap-2">
                  <span className="font-heading text-3xl font-bold sm:text-4xl text-foreground">
                    {dataState === "loading" ? "..." : products.length}
                  </span>
                  <span className="text-xs font-medium text-muted-foreground">SKU Terdaftar</span>
                </div>

                <div className="mt-3 space-y-1.5 border-t border-border/60 pt-3">
                  <div className="flex items-center justify-between text-xs">
                    <span className="text-muted-foreground">Kategori Produk:</span>
                    <span className="font-semibold">{categoryCount} Kategori</span>
                  </div>
                  <div className="flex items-center justify-between text-xs">
                    <span className="text-muted-foreground">Est. Modal Stok:</span>
                    <span className="font-semibold text-emerald-700 dark:text-emerald-400 tabular-nums">
                      {formatCurrency(totalStockValue)}
                    </span>
                  </div>
                </div>
              </div>

              <div className="flex items-center justify-between rounded-xl bg-primary/10 px-3 py-2 text-xs font-semibold text-primary">
                <span>Kelola Inventaris & Harga</span>
                <ChevronRight className="size-3.5 transition-transform group-hover:translate-x-1" />
              </div>
            </Link>
          </div>
        </div>

        {/* Row 3: Timeline & Kasbon - Equal height and interactive list */}
        <div className="grid gap-4 md:grid-cols-12">
          {/* Timeline Transaksi */}
          <Card className="flex flex-col justify-between border-border/60 bg-card/74 shadow-[0_28px_70px_-45px_rgba(66,38,20,0.55)] md:col-span-6 lg:col-span-7 min-w-0">
            <CardHeader className="flex flex-row items-center justify-between gap-2 pb-3">
              <div className="min-w-0 flex-1">
                <CardTitle className="flex items-center gap-2 font-heading text-lg sm:text-xl">
                  <ArrowRightLeft className="size-4 sm:size-5 shrink-0 text-primary" />
                  <span className="truncate">Timeline Transaksi</span>
                </CardTitle>
                <CardDescription className="truncate text-xs sm:text-sm">
                  Aktivitas penjualan kasir terkini (klik baris untuk rincian).
                </CardDescription>
              </div>
              <div className="flex items-center gap-2 shrink-0">
                <button
                  type="button"
                  onClick={() => setTimelineOpen(true)}
                  className="flex items-center gap-1.5 whitespace-nowrap rounded-xl bg-primary/10 px-2.5 py-1.5 text-xs font-semibold text-primary transition hover:bg-primary/20 sm:px-3"
                >
                  <span>Lihat Semua ({recentTransactions.length})</span>
                  <Eye className="size-3.5 shrink-0" />
                </button>
              </div>
            </CardHeader>
            <CardContent className="flex-1 min-w-0">
              <div className="min-h-[340px] max-h-[580px] space-y-2.5 overflow-y-auto pr-1">
                {recentTransactions.length > 0 ? (
                  recentTransactions.slice(0, 10).map((transaction) => (
                    <button
                      type="button"
                      key={transaction.id}
                      aria-label={`Lihat detail transaksi ${formatCurrency(transaction.total)}`}
                      onClick={() => setSelectedTransaction(transaction)}
                      className="group flex w-full items-center justify-between gap-2.5 rounded-[18px] bg-muted/50 px-3 py-2.5 sm:px-3.5 text-left transition hover:bg-primary/5 hover:border-primary/40 border border-transparent focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:outline-none min-w-0 cursor-pointer"
                    >
                      <div className="min-w-0 flex-1 truncate pr-1">
                        <div className="flex items-center gap-2">
                          <p className="truncate font-semibold text-foreground text-xs sm:text-sm">{formatCurrency(transaction.total)}</p>
                          <Badge
                            variant="outline"
                            className={cn(
                              "text-[10px] px-1.5 py-0.2 rounded-full font-medium shrink-0",
                              transaction.paymentMethod?.toLowerCase().includes("tunai")
                                ? "bg-emerald-500/10 text-emerald-700 border-emerald-500/30 dark:text-emerald-400"
                                : transaction.paymentMethod?.toLowerCase().includes("qris")
                                  ? "bg-purple-500/10 text-purple-700 border-purple-500/30 dark:text-purple-400"
                                  : "bg-blue-500/10 text-blue-700 border-blue-500/30 dark:text-blue-400"
                            )}
                          >
                            {transaction.paymentMethod || "Tunai"}
                          </Badge>
                        </div>
                        <p className="truncate text-[11px] text-muted-foreground sm:text-xs mt-0.5">
                          {transaction.items.length} produk • {transaction.items.slice(0, 2).map((i) => i.productName).join(", ")}
                          {transaction.items.length > 2 ? "..." : ""}
                        </p>
                      </div>
                      <div className="flex shrink-0 items-center gap-1.5 sm:gap-2 text-[11px] sm:text-xs text-muted-foreground whitespace-nowrap">
                        <span>{formatDateTime(transaction.occurredAt)}</span>
                        <span className="flex size-6 sm:size-7 shrink-0 items-center justify-center rounded-full border border-border/70 bg-card/70 text-muted-foreground transition group-hover:border-primary/50 group-hover:text-primary group-hover:bg-primary/10">
                          <Eye className="size-3 sm:size-3.5" />
                        </span>
                      </div>
                    </button>
                  ))
                ) : (
                  <div className="flex h-[340px] items-center justify-center rounded-[18px] bg-muted/45 px-4 py-8 text-center text-xs text-muted-foreground sm:text-sm">
                    Belum ada transaksi yang tersimpan.
                  </div>
                )}
              </div>
            </CardContent>
          </Card>

          {/* Kasbon Terbaru */}
          <Card className="flex flex-col justify-between border-border/60 bg-card/74 shadow-[0_28px_70px_-45px_rgba(66,38,20,0.55)] md:col-span-6 lg:col-span-5 min-w-0">
            <CardHeader className="flex flex-row items-center justify-between gap-2 pb-3">
              <div>
                <CardTitle className="flex items-center gap-2 font-heading text-lg sm:text-xl">
                  <WalletCards className="size-4 sm:size-5 shrink-0 text-primary" />
                  <span className="truncate">Kasbon Terbaru</span>
                </CardTitle>
                <CardDescription className="truncate text-xs sm:text-sm">
                  Ringkas untuk follow-up piutang pelanggan.
                </CardDescription>
              </div>
              <Link
                href="/buku-hutang"
                className="flex shrink-0 items-center gap-1 rounded-xl bg-primary/10 px-2.5 py-1.5 text-xs font-semibold text-primary transition hover:bg-primary/20"
              >
                <span>Buku Kasbon</span>
                <ArrowUpRight className="size-3.5" />
              </Link>
            </CardHeader>
            <CardContent className="flex-1 min-w-0">
              <div className="min-h-[340px] max-h-[580px] space-y-2.5 overflow-y-auto pr-1">
                {latestDebts.length > 0 ? (
                  latestDebts.map((debt) => (
                    <Link
                      key={debt.id}
                      href="/buku-hutang"
                      title={`Klik untuk melihat catatan kasbon ${debt.borrowerName}`}
                      className="group flex items-center justify-between gap-2.5 rounded-[18px] border border-border/70 bg-card/80 px-3 py-2.5 sm:px-3.5 min-w-0 transition-all hover:border-primary/50 hover:bg-primary/5 hover:shadow-xs"
                    >
                      <div className="min-w-0 flex-1 truncate pr-1">
                        <p className="truncate font-semibold text-xs sm:text-sm group-hover:text-primary transition-colors">
                          {debt.borrowerName}
                        </p>
                        <div className="flex items-center gap-1 mt-0.5">
                          <Phone className="size-3 text-muted-foreground" />
                          <p className="truncate text-[11px] text-muted-foreground sm:text-xs">{debt.whatsapp || "-"}</p>
                        </div>
                      </div>
                      <div className="shrink-0 text-right whitespace-nowrap">
                        <p className="font-semibold text-xs sm:text-sm tabular-nums">{formatCurrency(debt.remainingAmount)}</p>
                        <Badge
                          variant="secondary"
                          className={cn(
                            "text-[10px] px-1.5 py-0.2 rounded-full font-medium mt-0.5",
                            debt.status === "lunas"
                              ? "bg-emerald-500/15 text-emerald-700 dark:text-emerald-400"
                              : debt.status === "lewat_tempo"
                                ? "bg-rose-500/15 text-rose-700 dark:text-rose-400 font-semibold"
                                : "bg-amber-500/15 text-amber-800 dark:text-amber-400"
                          )}
                        >
                          {debt.status === "lunas" ? "Lunas" : debt.status === "lewat_tempo" ? "Lewat tempo" : "Belum lunas"}
                        </Badge>
                      </div>
                    </Link>
                  ))
                ) : (
                  <div className="flex h-[340px] items-center justify-center rounded-[18px] bg-muted/45 px-4 py-8 text-center text-xs text-muted-foreground sm:text-sm">
                    Belum ada kasbon aktif.
                  </div>
                )}
              </div>
            </CardContent>
          </Card>
        </div>
      </div>

      {/* Detail Modals */}
      <MetricDetailDialog
        metric={activeMetric}
        onClose={() => setActiveMetric(null)}
      />
      
      <Dialog open={timelineOpen} onOpenChange={setTimelineOpen}>
        <DialogContent className="sm:max-w-xl">
          <DialogHeader className="flex flex-row items-center justify-between">
            <div>
              <DialogTitle className="flex items-center gap-2 text-lg">
                <ArrowRightLeft className="size-5 text-primary" />
                Timeline Transaksi Terakhir
              </DialogTitle>
              <DialogDescription>
                Daftar transaksi kasir terbaru. Klik salah satu untuk membuka struk rincian.
              </DialogDescription>
            </div>
            <Link
              href="/laporan"
              onClick={() => setTimelineOpen(false)}
              className="flex items-center gap-1 rounded-xl bg-primary/10 px-2.5 py-1 text-xs font-semibold text-primary transition hover:bg-primary/20 shrink-0 mr-6"
            >
              <span>Semua Laporan</span>
              <ArrowUpRight className="size-3.5" />
            </Link>
          </DialogHeader>
          <ScrollArea className="max-h-[66vh]">
            <div className="space-y-3 pr-2">
              {recentTransactions.length > 0 ? (
                recentTransactions.map((transaction) => (
                  <button
                    type="button"
                    key={`timeline-dialog-${transaction.id}`}
                    aria-label={`Lihat detail transaksi ${formatCurrency(transaction.total)}`}
                    onClick={() => {
                      setTimelineOpen(false);
                      setSelectedTransaction(transaction);
                    }}
                    className="group w-full rounded-2xl border border-border/60 bg-card/70 p-4 text-left transition hover:border-primary/35 hover:bg-primary/5 focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:outline-none cursor-pointer"
                  >
                    <div className="flex items-start justify-between gap-4">
                      <div>
                        <p className="font-heading text-2xl font-semibold tabular-nums">
                          {formatCurrency(transaction.total)}
                        </p>
                        <p className="mt-1 text-sm text-muted-foreground">
                          {transaction.items.length} produk • {transaction.paymentMethod}
                        </p>
                      </div>
                      <div className="flex shrink-0 items-center gap-2 text-sm text-muted-foreground">
                        <span>{formatDateTime(transaction.occurredAt)}</span>
                        <span className="flex size-9 items-center justify-center rounded-full border border-border/70 bg-card transition group-hover:border-primary/50 group-hover:text-primary">
                          <Eye className="size-4" />
                        </span>
                      </div>
                    </div>
                    <div className="mt-3 flex flex-wrap gap-2 text-xs text-muted-foreground">
                      {transaction.items.slice(0, 3).map((item) => (
                        <span
                          key={`${transaction.id}-${item.productId}-${item.productName}`}
                          className="rounded-full bg-muted/65 px-2.5 py-1"
                        >
                          {item.productName} × {item.quantity}
                        </span>
                      ))}
                      {transaction.items.length > 3 ? (
                        <span className="rounded-full bg-muted/65 px-2.5 py-1">
                          +{transaction.items.length - 3} item lain
                        </span>
                      ) : null}
                    </div>
                  </button>
                ))
              ) : (
                <div className="rounded-2xl bg-muted/50 px-4 py-10 text-center text-sm text-muted-foreground">
                  Belum ada transaksi yang tersimpan.
                </div>
              )}
            </div>
          </ScrollArea>
        </DialogContent>
      </Dialog>

      <TransactionDetailDialog
        canViewProfit={canViewTransactionProfit}
        onClose={() => setSelectedTransaction(null)}
        transaction={selectedTransaction}
      />
    </div>
  );
}
