"use client";

import { useState } from "react";
import { AlertTriangle, ArrowRightLeft, Clock3, Eye, ReceiptText, WalletCards } from "lucide-react";
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

export function DashboardView() {
  const currentRole = useCurrentRole();
  const { debts, lowStockProducts, products, transactions, dataState, retryWorkspace } = useAppState();
  const todayRange = getJakartaDayRange();

  const todayTransactions = transactions.filter((transaction) => {
    return isWithinJakartaRange(transaction.occurredAt, todayRange);
  });

  const todaySales = todayTransactions.reduce(
    (sum, transaction) => sum + transaction.total,
    0
  );
  const outstandingDebt = debts
    .filter((debt) => debt.status !== "lunas")
    .reduce((sum, debt) => sum + debt.remainingAmount, 0);
  const latestTransaction = transactions[0] ?? null;
  const recentTransactions = transactions.slice(0, 10);
  const latestDebts = debts.slice(0, 4);

  const [activeMetric, setActiveMetric] = useState<DashboardMetric | null>(null);
  const [selectedTransaction, setSelectedTransaction] = useState<Transaction | null>(null);
  const [timelineOpen, setTimelineOpen] = useState(false);
  const canViewTransactionProfit = currentRole !== "kasir";

  return (
    <div className="space-y-4">
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
        <div className="grid gap-4 lg:grid-cols-12">
          {/* Transaksi Terakhir */}
          <Card className="border-border/60 bg-card/74 shadow-[0_28px_70px_-45px_rgba(66,38,20,0.55)] lg:col-span-5 xl:col-span-4">
            <CardHeader className="pb-3">
              <CardTitle className="flex items-center gap-2 font-heading text-xl">
                <ReceiptText className="size-5 text-primary" />
                Transaksi Terakhir
              </CardTitle>
              <CardDescription className="text-xs sm:text-sm">
                Ringkasan cepat dari aktivitas penjualan paling baru.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="rounded-[22px] border border-primary/20 bg-primary/10 p-4 text-foreground dark:border-primary/25 dark:bg-muted/55">
                {latestTransaction ? (
                  <>
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
                          <span className="shrink-0 font-semibold">
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
                  </>
                ) : (
                  <p className="py-4 text-center text-xs text-muted-foreground sm:text-sm">
                    Belum ada transaksi yang tersimpan.
                  </p>
                )}
              </div>
            </CardContent>
          </Card>

          {/* Stok & SKU Aktif */}
          <div className="grid gap-4 sm:grid-cols-2 lg:col-span-7 xl:col-span-8">
            <Card className="border-border/60 bg-card/74 shadow-[0_28px_70px_-45px_rgba(66,38,20,0.55)]">
              <CardHeader className="pb-3">
                <CardTitle className="flex items-center gap-2 font-heading text-xl">
                  <AlertTriangle className="size-5 text-primary" />
                  Stok Perlu Perhatian
                </CardTitle>
                <CardDescription className="text-xs sm:text-sm">
                  Barang rawan kosong sebelum restok.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-2.5">
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
                    <div
                      key={product.id}
                      className="flex items-center justify-between rounded-[18px] border border-border/70 bg-card/80 px-3.5 py-2.5"
                    >
                      <div className="flex items-center gap-2.5 truncate pr-2">
                        <div className="flex size-8 shrink-0 items-center justify-center rounded-xl bg-primary/12 text-primary">
                          <AlertTriangle className="size-3.5" />
                        </div>
                        <div className="truncate">
                          <p className="truncate text-xs font-medium sm:text-sm">{product.name}</p>
                          <p className="text-[11px] text-muted-foreground sm:text-xs">{product.category}</p>
                        </div>
                      </div>
                      <Badge className="shrink-0 rounded-full bg-primary px-2.5 py-0.5 text-[11px] font-semibold text-primary-foreground">
                        {product.stock} / min {product.minimumStock}
                      </Badge>
                    </div>
                  ))
                ) : (
                  <div className="flex h-[116px] items-center justify-center rounded-[20px] bg-accent/80 p-4 text-center text-xs font-medium text-accent-foreground sm:text-sm">
                    Semua stok aman. Belum ada produk yang menyentuh batas minimum.
                  </div>
                )}
              </CardContent>
            </Card>

            <Card className="flex flex-col justify-between border-border/60 bg-card/74 shadow-[0_28px_70px_-45px_rgba(66,38,20,0.55)]">
              <CardHeader className="pb-2">
                <CardTitle className="flex items-center gap-2 font-heading text-xl">
                  <Clock3 className="size-5 text-primary" />
                  SKU Aktif
                </CardTitle>
                <CardDescription className="text-xs sm:text-sm">
                  Katalog produk terdaftar dalam inventaris toko.
                </CardDescription>
              </CardHeader>
              <CardContent className="flex items-center justify-between gap-4 pb-6 pt-3">
                {dataState === "error" ? (
                  <div role="alert" className="space-y-2 text-sm text-destructive">
                    <p className="font-semibold">Gagal memuat data, coba lagi</p>
                    <button type="button" onClick={retryWorkspace} className="rounded-lg border border-current/30 px-2.5 py-1 text-xs font-semibold">
                      Muat ulang
                    </button>
                  </div>
                ) : (
                  <div>
                    <p className="font-heading text-3xl font-bold sm:text-4xl">{dataState === "loading" ? "..." : products.length}</p>
                    <p className="mt-1 text-xs text-muted-foreground sm:text-sm">Produk siap jual di POS</p>
                  </div>
                )}
                <div className="flex size-14 shrink-0 items-center justify-center rounded-2xl bg-primary/15 text-primary">
                  <Clock3 className="size-6" />
                </div>
              </CardContent>
            </Card>
          </div>
        </div>

        {/* Row 3: Timeline & Kasbon - Equal height and tight list */}
        <div className="grid gap-4 lg:grid-cols-12">
          {/* Timeline Transaksi */}
          <Card className="flex flex-col justify-between border-border/60 bg-card/74 shadow-[0_28px_70px_-45px_rgba(66,38,20,0.55)] lg:col-span-7">
            <CardHeader className="flex flex-row items-center justify-between pb-3">
              <div>
                <CardTitle className="flex items-center gap-2 font-heading text-xl">
                  <ArrowRightLeft className="size-5 text-primary" />
                  Timeline Transaksi
                </CardTitle>
                <CardDescription className="text-xs sm:text-sm">
                  Aktivitas penjualan kasir terkini.
                </CardDescription>
              </div>
              <button
                type="button"
                onClick={() => setTimelineOpen(true)}
                className="flex items-center gap-1.5 rounded-xl bg-primary/10 px-3 py-1.5 text-xs font-semibold text-primary transition hover:bg-primary/20"
              >
                <span>Lihat Semua ({recentTransactions.length})</span>
                <Eye className="size-3.5" />
              </button>
            </CardHeader>
            <CardContent className="flex-1">
              <div className="min-h-[340px] max-h-[580px] space-y-2.5 overflow-y-auto pr-1">
                {recentTransactions.length > 0 ? (
                  recentTransactions.slice(0, 10).map((transaction) => (
                    <button
                      type="button"
                      key={transaction.id}
                      aria-label={`Lihat detail transaksi ${formatCurrency(transaction.total)}`}
                      onClick={() => setSelectedTransaction(transaction)}
                      className="group flex w-full items-center justify-between gap-3 rounded-[18px] bg-muted/50 px-3.5 py-2.5 text-left transition hover:bg-muted/75 focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:outline-none"
                    >
                      <div className="truncate pr-2">
                        <p className="font-semibold text-foreground text-xs sm:text-sm">{formatCurrency(transaction.total)}</p>
                        <p className="truncate text-[11px] text-muted-foreground sm:text-xs">
                          {transaction.items.length} produk • {transaction.paymentMethod}
                        </p>
                      </div>
                      <div className="flex shrink-0 items-center gap-2 text-xs text-muted-foreground">
                        <span>{formatDateTime(transaction.occurredAt)}</span>
                        <span className="flex size-7 shrink-0 items-center justify-center rounded-full border border-border/70 bg-card/70 text-muted-foreground transition group-hover:border-primary/50 group-hover:text-primary">
                          <Eye className="size-3.5" />
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
          <Card className="flex flex-col justify-between border-border/60 bg-card/74 shadow-[0_28px_70px_-45px_rgba(66,38,20,0.55)] lg:col-span-5">
            <CardHeader className="pb-3">
              <CardTitle className="flex items-center gap-2 font-heading text-xl">
                <WalletCards className="size-5 text-primary" />
                Kasbon Terbaru
              </CardTitle>
              <CardDescription className="text-xs sm:text-sm">
                Ringkas untuk follow-up piutang pelanggan.
              </CardDescription>
            </CardHeader>
            <CardContent className="flex-1">
              <div className="min-h-[340px] max-h-[580px] space-y-2.5 overflow-y-auto pr-1">
                {latestDebts.length > 0 ? (
                  latestDebts.slice(0, 8).map((debt) => (
                    <div
                      key={debt.id}
                      className="flex items-center justify-between gap-3 rounded-[18px] border border-border/70 bg-card/80 px-3.5 py-2.5"
                    >
                      <div className="truncate pr-2">
                        <p className="truncate font-semibold text-xs sm:text-sm">{debt.borrowerName}</p>
                        <p className="truncate text-[11px] text-muted-foreground sm:text-xs">{debt.whatsapp}</p>
                      </div>
                      <div className="shrink-0 text-right">
                        <p className="font-semibold text-xs sm:text-sm">{formatCurrency(debt.remainingAmount)}</p>
                        <p className="text-[11px] text-muted-foreground sm:text-xs">
                          {debt.status === "lunas"
                            ? "Lunas"
                            : debt.status === "lewat_tempo"
                              ? "Lewat tempo"
                              : "Aktif"}
                        </p>
                      </div>
                    </div>
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

      <MetricDetailDialog
        metric={activeMetric}
        onClose={() => setActiveMetric(null)}
      />
      <Dialog open={timelineOpen} onOpenChange={setTimelineOpen}>
        <DialogContent className="sm:max-w-xl">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-lg">
              <ArrowRightLeft className="size-5 text-primary" />
              Timeline transaksi
            </DialogTitle>
            <DialogDescription>
              Menampilkan maksimal 10 transaksi terakhir. Klik salah satu row untuk melihat detailnya.
            </DialogDescription>
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
                    className="group w-full rounded-2xl border border-border/60 bg-card/70 p-4 text-left transition hover:border-primary/35 hover:bg-primary/5 focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:outline-none"
                  >
                    <div className="flex items-start justify-between gap-4">
                      <div>
                        <p className="font-heading text-2xl font-semibold">
                          {formatCurrency(transaction.total)}
                        </p>
                        <p className="mt-1 text-sm text-muted-foreground">
                          {transaction.items.length} produk - {transaction.paymentMethod}
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
                          {item.productName} x{item.quantity}
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
