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
  const { debts, lowStockProducts, products, transactions } = useAppState();
  const todayRange = getJakartaDayRange();

  const todayTransactions = transactions.filter((transaction) => {
    return isWithinJakartaRange(transaction.createdAt, todayRange);
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
      <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <StatCard
          title="Omzet hari ini"
          value={formatCurrency(todaySales)}
          description="Akumulasi transaksi yang sudah masuk sejak pagi."
          onClick={() => setActiveMetric("omzet")}
        />
        <StatCard
          title="Transaksi hari ini"
          value={`${todayTransactions.length} transaksi`}
          description="Ringkasan cepat untuk memantau ritme kasir."
          tone="accent"
          onClick={() => setActiveMetric("transaksi")}
        />
        <StatCard
          title="Stok menipis"
          value={`${lowStockProducts.length} item`}
          description="Barang yang mulai rawan kosong dan sebaiknya segera dicek."
          tone="warn"
          onClick={() => setActiveMetric("stok")}
        />
        <StatCard
          title="Kasbon aktif"
          value={formatCurrency(outstandingDebt)}
          description="Total piutang pelanggan yang belum lunas."
          onClick={() => setActiveMetric("kasbon")}
        />
      </section>

      <div className="grid gap-4 xl:grid-cols-[1.05fr_0.95fr]">
        <Card className="border-border/60 bg-card/74 shadow-[0_28px_70px_-45px_rgba(66,38,20,0.55)]">
          <CardHeader>
            <CardTitle className="font-heading text-2xl">Aktivitas terbaru</CardTitle>
            <CardDescription>
              Semua ringkasan yang sebelumnya membuat layar kasir terasa penuh dipindahkan ke sini.
            </CardDescription>
          </CardHeader>
          <CardContent className="grid gap-4 lg:grid-cols-[0.95fr_1.05fr]">
            <div className="rounded-[26px] border border-primary/20 bg-primary/10 px-5 py-5 text-foreground dark:border-primary/25 dark:bg-muted/55">
              <div className="flex items-center gap-2 text-muted-foreground">
                <ReceiptText className="size-4 text-primary" />
                <p className="text-sm font-medium">Transaksi terakhir</p>
              </div>

              {latestTransaction ? (
                <>
                  <p className="mt-3 font-heading text-4xl font-semibold">
                    {formatCurrency(latestTransaction.total)}
                  </p>
                  <p className="mt-2 text-sm text-muted-foreground">
                    {latestTransaction.paymentMethod} - {formatTime(latestTransaction.createdAt)}
                  </p>
                  <div className="mt-5 space-y-3">
                    {latestTransaction.items.map((item) => (
                      <div
                        key={`${latestTransaction.id}-${item.productId}`}
                        className="flex items-center justify-between text-sm"
                      >
                        <span>
                          {item.productName} x{item.quantity}
                        </span>
                        <span className="font-medium">
                          {formatCurrency(item.unitPrice * item.quantity)}
                        </span>
                      </div>
                    ))}
                  </div>
                </>
              ) : (
                <p className="mt-4 text-sm text-muted-foreground">
                  Belum ada transaksi yang tersimpan.
                </p>
              )}
            </div>

            <div className="rounded-[26px] border border-border/70 bg-card/82 p-5">
              <button
                type="button"
                aria-label="Buka timeline 10 transaksi terakhir"
                onClick={() => setTimelineOpen(true)}
                className="group flex w-full items-center justify-between gap-3 rounded-2xl px-1 py-1 text-left transition focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:outline-none"
              >
                <span className="flex items-center gap-2">
                  <ArrowRightLeft className="size-4 text-primary" />
                  <span className="font-medium">Timeline transaksi</span>
                </span>
                <span className="flex items-center gap-1 text-xs text-muted-foreground transition group-hover:text-primary">
                  {recentTransactions.length} terakhir
                  <Eye className="size-3.5" />
                </span>
              </button>
              <div className="mt-5 max-h-[348px] space-y-3 overflow-y-auto pr-1">
                {recentTransactions.length > 0 ? (
                  recentTransactions.map((transaction) => (
                    <button
                      type="button"
                      key={transaction.id}
                      aria-label={`Lihat detail transaksi ${formatCurrency(transaction.total)}`}
                      onClick={() => setSelectedTransaction(transaction)}
                      className="group flex w-full items-start justify-between gap-3 rounded-[20px] bg-muted/50 px-4 py-3 text-left transition hover:bg-muted/75 focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:outline-none"
                    >
                      <div>
                        <p className="font-medium">{formatCurrency(transaction.total)}</p>
                        <p className="mt-1 text-sm text-muted-foreground">
                          {transaction.items.length} produk - {transaction.paymentMethod}
                        </p>
                      </div>
                      <div className="flex items-center gap-2 text-sm text-muted-foreground">
                        <span>{formatDateTime(transaction.createdAt)}</span>
                        <span className="flex size-8 shrink-0 items-center justify-center rounded-full border border-border/70 bg-card/70 text-muted-foreground transition group-hover:border-primary/50 group-hover:text-primary">
                          <Eye className="size-4" />
                        </span>
                      </div>
                    </button>
                  ))
                ) : (
                  <div className="rounded-[20px] bg-muted/45 px-4 py-8 text-center text-sm text-muted-foreground">
                    Belum ada transaksi yang tersimpan.
                  </div>
                )}
              </div>
            </div>
          </CardContent>
        </Card>

        <div className="space-y-4">
          <Card className="border-border/60 bg-card/74 shadow-[0_28px_70px_-45px_rgba(66,38,20,0.55)]">
            <CardHeader>
              <CardTitle className="font-heading text-2xl">Stok perlu perhatian</CardTitle>
              <CardDescription>
                Cocok dibuka sebelum restok atau saat mau tutup toko.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              {lowStockProducts.length > 0 ? (
                lowStockProducts.slice(0, 5).map((product) => (
                  <div
                    key={product.id}
                    className="flex items-center justify-between rounded-[20px] border border-border/70 bg-card/80 px-4 py-3"
                  >
                    <div className="flex items-center gap-3">
                      <div className="flex size-10 items-center justify-center rounded-2xl bg-primary/12 text-primary">
                        <AlertTriangle className="size-4" />
                      </div>
                      <div>
                        <p className="font-medium">{product.name}</p>
                        <p className="text-sm text-muted-foreground">{product.category}</p>
                      </div>
                    </div>
                    <Badge className="rounded-full bg-primary text-primary-foreground">
                      {product.stock} / min {product.minimumStock}
                    </Badge>
                  </div>
                ))
              ) : (
                <div className="rounded-[20px] bg-accent px-4 py-5 text-sm text-accent-foreground">
                  Semua stok aman. Belum ada produk yang menyentuh batas minimum.
                </div>
              )}
            </CardContent>
          </Card>

          <Card className="border-border/60 bg-card/74 shadow-[0_28px_70px_-45px_rgba(66,38,20,0.55)]">
            <CardHeader>
              <CardTitle className="font-heading text-2xl">Kasbon terbaru</CardTitle>
              <CardDescription>
                Ringkas untuk follow-up pelanggan tanpa masuk ke halaman penuh buku hutang.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              {latestDebts.map((debt) => (
                <div
                  key={debt.id}
                  className="flex items-start justify-between gap-3 rounded-[20px] border border-border/70 bg-card/80 px-4 py-3"
                >
                  <div>
                    <div className="flex items-center gap-2">
                      <WalletCards className="size-4 text-primary" />
                      <p className="font-medium">{debt.borrowerName}</p>
                    </div>
                    <p className="mt-1 text-sm text-muted-foreground">{debt.whatsapp}</p>
                  </div>
                  <div className="text-right">
                    <p className="font-medium">{formatCurrency(debt.remainingAmount)}</p>
                    <p className="mt-1 text-sm text-muted-foreground">
                      {debt.status === "lunas"
                        ? "Lunas"
                        : debt.status === "lewat_tempo"
                          ? "Lewat tempo"
                          : "Aktif"}
                    </p>
                  </div>
                </div>
              ))}
            </CardContent>
          </Card>

          <Card className="border-border/60 bg-card/74 shadow-[0_28px_70px_-45px_rgba(66,38,20,0.55)]">
            <CardContent className="flex items-center justify-between gap-4 p-5">
              <div>
                <p className="text-sm text-muted-foreground">SKU aktif</p>
                <p className="mt-2 font-heading text-3xl font-semibold">{products.length} produk</p>
              </div>
              <div className="flex size-12 items-center justify-center rounded-2xl bg-foreground text-background">
                <Clock3 className="size-5" />
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
                        <span>{formatDateTime(transaction.createdAt)}</span>
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
