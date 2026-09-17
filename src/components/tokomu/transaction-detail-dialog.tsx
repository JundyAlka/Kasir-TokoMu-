"use client";

import { useState } from "react";
import { CalendarClock, CreditCard, Loader2, ReceiptText, Trash2, UserRoundCheck } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { ScrollArea } from "@/components/ui/scroll-area";
import { formatCurrency, formatDateTime } from "@/lib/format";
import type { Transaction } from "@/lib/types";
import { cn } from "@/lib/utils";

type TransactionDetailDialogProps = {
  canViewProfit?: boolean;
  canDelete?: boolean;
  onClose: () => void;
  onDelete?: (transactionId: string) => Promise<void>;
  transaction: Transaction | null;
};

function SummaryRow({
  label,
  tone,
  value,
}: {
  label: string;
  tone?: "default" | "positive" | "warn";
  value: string;
}) {
  return (
    <div className="flex items-center justify-between gap-4 py-2 text-sm">
      <span className="text-muted-foreground">{label}</span>
      <span
        className={cn(
          "text-right font-medium tabular-nums",
          tone === "positive" && "text-emerald-600 dark:text-emerald-400",
          tone === "warn" && "text-amber-600 dark:text-amber-400"
        )}
      >
        {value}
      </span>
    </div>
  );
}

export function TransactionDetailDialog({
  canViewProfit = false,
  canDelete = false,
  onClose,
  onDelete,
  transaction,
}: TransactionDetailDialogProps) {
  const [isConfirmingDelete, setIsConfirmingDelete] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);

  const itemCount = transaction?.items.length ?? 0;
  const totalQty =
    transaction?.items.reduce((sum, item) => sum + item.quantity, 0) ?? 0;
  const cogs =
    transaction?.items.reduce(
      (sum, item) => sum + item.costPrice * item.quantity,
      0
    ) ?? 0;
  const grossProfit = (transaction?.total ?? 0) - cogs;
  const grossMargin =
    transaction && transaction.total > 0
      ? Math.round((grossProfit / transaction.total) * 1000) / 10
      : 0;
  const averagePerItem =
    transaction && totalQty > 0 ? transaction.total / totalQty : 0;

  function handleDialogClose() {
    setIsConfirmingDelete(false);
    onClose();
  }

  return (
    <Dialog
      open={transaction !== null}
      onOpenChange={(open) => {
        if (!open) handleDialogClose();
      }}
    >
      <DialogContent className="sm:max-w-lg">
        {transaction ? (
          <>
            <DialogHeader>
              <DialogTitle className="text-lg">Detail Transaksi</DialogTitle>
              <DialogDescription>
                Rincian transaksi berdasarkan data penjualan yang tersimpan di sistem.
              </DialogDescription>
            </DialogHeader>

            <ScrollArea
              className="max-h-[60vh] pr-3"
              scrollBarClassName="data-vertical:w-1.5 data-vertical:border-l-0 data-vertical:px-0"
            >
              <div className="space-y-4 pr-4">
                <div className="rounded-2xl border border-primary/15 bg-primary/5 p-4 dark:bg-primary/10">
                  <div className="flex items-center gap-2 text-sm text-muted-foreground">
                    <ReceiptText className="size-4 text-primary" />
                    {transaction.id}
                  </div>
                  <p className="mt-2 font-heading text-3xl font-semibold">
                    {formatCurrency(transaction.total)}
                  </p>
                  <p className="mt-1 text-xs text-muted-foreground">
                    {itemCount} produk, {totalQty} item terjual.
                  </p>
                </div>

                <div className="grid gap-3 sm:grid-cols-3">
                  <div className="rounded-xl border border-border/60 p-3">
                    <div className="flex items-center gap-2 text-xs text-muted-foreground">
                      <CalendarClock className="size-3.5 text-primary" />
                      Waktu
                    </div>
                    <p className="mt-2 text-sm font-medium">
                      {formatDateTime(transaction.occurredAt)}
                    </p>
                  </div>
                  <div className="rounded-xl border border-border/60 p-3">
                    <div className="flex items-center gap-2 text-xs text-muted-foreground">
                      <CreditCard className="size-3.5 text-primary" />
                      Pembayaran
                    </div>
                    <p className="mt-2 text-sm font-medium">{transaction.paymentMethod}</p>
                  </div>
                  <div className="rounded-xl border border-border/60 p-3">
                    <div className="flex items-center gap-2 text-xs text-muted-foreground">
                      <UserRoundCheck className="size-3.5 text-primary" />
                      Dicatat oleh
                    </div>
                    <p className="mt-2 text-sm font-medium">
                      {transaction.recordedByName || "Kasir"}
                    </p>
                  </div>
                </div>

                <div className="rounded-xl border border-border/60 p-3">
                  <SummaryRow label="Subtotal penjualan" value={formatCurrency(transaction.total)} />
                  {transaction.paymentMethod === "Tunai" ? (
                    <>
                      <SummaryRow label="Uang dibayarkan" value={formatCurrency(transaction.paidAmount)} />
                      <SummaryRow
                        label="Kembalian"
                        value={formatCurrency(transaction.changeAmount)}
                        tone="positive"
                      />
                    </>
                  ) : null}
                  <SummaryRow label="Jumlah produk unik" value={`${itemCount} produk`} />
                  <SummaryRow label="Total kuantitas" value={`${totalQty} item`} />
                  <SummaryRow
                    label="Rata-rata per item"
                    value={formatCurrency(averagePerItem)}
                  />
                  {transaction.shiftSessionId ? (
                    <SummaryRow label="Sesi shift" value={transaction.shiftSessionId} />
                  ) : null}
                </div>

                {canViewProfit ? (
                  <div className="rounded-xl border border-border/60 p-3">
                    <SummaryRow label="HPP transaksi" value={formatCurrency(cogs)} tone="warn" />
                    <SummaryRow
                      label="Laba kotor"
                      value={formatCurrency(grossProfit)}
                      tone="positive"
                    />
                    <SummaryRow
                      label="Margin kotor"
                      value={`${grossMargin}%`}
                      tone="positive"
                    />
                  </div>
                ) : null}

                <div className="space-y-2">
                  <p className="text-xs font-medium text-muted-foreground">Item transaksi</p>
                  {transaction.items.length > 0 ? (
                    transaction.items.map((item) => (
                      <div
                        key={`${transaction.id}-${item.productId}-${item.productName}`}
                        className="rounded-xl border border-border/60 p-3"
                      >
                        <div className="flex items-start justify-between gap-3">
                          <div className="min-w-0">
                            <p className="truncate font-medium">{item.productName}</p>
                            <p className="mt-0.5 text-xs text-muted-foreground">
                              {item.quantity} x {formatCurrency(item.unitPrice)}
                            </p>
                          </div>
                          <p className="text-sm font-medium tabular-nums">
                            {formatCurrency(item.quantity * item.unitPrice)}
                          </p>
                        </div>
                        {canViewProfit ? (
                          <div className="mt-2 flex items-center justify-between gap-3 text-xs text-muted-foreground">
                            <span>HPP/item: {formatCurrency(item.costPrice)}</span>
                            <span>
                              Laba:{" "}
                              {formatCurrency((item.unitPrice - item.costPrice) * item.quantity)}
                            </span>
                          </div>
                        ) : null}
                      </div>
                    ))
                  ) : (
                    <div className="rounded-xl bg-muted/50 px-4 py-6 text-center text-sm text-muted-foreground">
                      Tidak ada item yang tercatat pada transaksi ini.
                    </div>
                  )}
                </div>
              </div>
            </ScrollArea>

            {canDelete ? (
              <div className="pt-3 border-t border-border/60">
                {isConfirmingDelete ? (
                  <div className="rounded-xl border border-destructive/30 bg-destructive/10 p-3 space-y-2">
                    <p className="text-xs font-semibold text-destructive">
                      Hapus transaksi ini?
                    </p>
                    <p className="text-xs text-muted-foreground leading-relaxed">
                      Stok barang yang ada di transaksi ini akan otomatis dikembalikan ke inventaris, dan total penjualan akan disesuaikan kembali.
                    </p>
                    <div className="flex items-center justify-end gap-2 pt-1">
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        className="h-8 rounded-lg text-xs"
                        disabled={isDeleting}
                        onClick={() => setIsConfirmingDelete(false)}
                      >
                        Batal
                      </Button>
                      <Button
                        type="button"
                        variant="destructive"
                        size="sm"
                        className="h-8 rounded-lg text-xs"
                        disabled={isDeleting}
                        onClick={async () => {
                          if (!transaction || !onDelete) return;
                          setIsDeleting(true);
                          try {
                            await onDelete(transaction.id);
                            toast.success("Transaksi berhasil dihapus dan stok barang telah dikembalikan.");
                            setIsConfirmingDelete(false);
                            onClose();
                          } catch (error) {
                            toast.error(error instanceof Error ? error.message : "Gagal menghapus transaksi.");
                          } finally {
                            setIsDeleting(false);
                          }
                        }}
                      >
                        {isDeleting ? (
                          <>
                            <Loader2 className="mr-1.5 size-3.5 animate-spin" />
                            Menghapus...
                          </>
                        ) : (
                          "Ya, Hapus Transaksi"
                        )}
                      </Button>
                    </div>
                  </div>
                ) : (
                  <div className="flex justify-end">
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      className="text-destructive hover:bg-destructive/10 hover:text-destructive h-9 rounded-xl text-xs gap-1.5"
                      onClick={() => setIsConfirmingDelete(true)}
                    >
                      <Trash2 className="size-3.5" />
                      Hapus Transaksi (Pimpinan)
                    </Button>
                  </div>
                )}
              </div>
            ) : null}
          </>
        ) : null}
      </DialogContent>
    </Dialog>
  );
}
