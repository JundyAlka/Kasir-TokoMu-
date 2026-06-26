"use client";

import { AlertTriangle, CalendarClock, CheckCircle2, Users, WalletCards } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { ScrollArea } from "@/components/ui/scroll-area";
import { formatCurrency, formatDate } from "@/lib/format";
import type { Debt } from "@/lib/types";
import { cn } from "@/lib/utils";

export type DebtSummaryMetric = "aktif" | "lunas" | "lewat_tempo";

type DebtSummaryDetailDialogProps = {
  debts: Debt[];
  metric: DebtSummaryMetric | null;
  onClose: () => void;
};

const titles: Record<DebtSummaryMetric, string> = {
  aktif: "Detail Kasbon Aktif",
  lunas: "Detail Kasbon Lunas",
  lewat_tempo: "Detail Kasbon Lewat Tempo",
};

const descriptions: Record<DebtSummaryMetric, string> = {
  aktif: "Rincian piutang yang masih memiliki sisa tagihan dan perlu dipantau.",
  lunas: "Rangkuman pelanggan yang sudah menyelesaikan seluruh pembayaran kasbon.",
  lewat_tempo: "Kasbon belum lunas dengan tanggal jatuh tempo yang sudah terlewati.",
};

function SummaryRow({
  label,
  value,
  tone,
}: {
  label: string;
  value: string;
  tone?: "default" | "positive" | "warn";
}) {
  return (
    <div className="flex items-center justify-between gap-4 py-2 text-sm">
      <span className="text-muted-foreground">{label}</span>
      <span
        className={cn(
          "font-medium tabular-nums",
          tone === "positive" && "text-emerald-600 dark:text-emerald-400",
          tone === "warn" && "text-amber-600 dark:text-amber-400"
        )}
      >
        {value}
      </span>
    </div>
  );
}

function statusText(status: Debt["status"]) {
  if (status === "lunas") return "Lunas";
  if (status === "lewat_tempo") return "Lewat tempo";
  return "Aktif";
}

function metricDebts(debts: Debt[], metric: DebtSummaryMetric) {
  if (metric === "aktif") {
    return debts.filter((debt) => debt.status !== "lunas");
  }

  return debts.filter((debt) => debt.status === metric);
}

export function DebtSummaryDetailDialog({
  debts,
  metric,
  onClose,
}: DebtSummaryDetailDialogProps) {
  const selectedDebts = metric ? metricDebts(debts, metric) : [];
  const totalAmount = selectedDebts.reduce((sum, debt) => sum + debt.amount, 0);
  const paidAmount = selectedDebts.reduce((sum, debt) => sum + debt.paidAmount, 0);
  const remainingAmount = selectedDebts.reduce((sum, debt) => sum + debt.remainingAmount, 0);
  const nearestDue = selectedDebts
    .filter((debt) => debt.status !== "lunas")
    .sort((a, b) => new Date(a.dueDate).getTime() - new Date(b.dueDate).getTime())[0];
  const largestRemaining = [...selectedDebts].sort(
    (a, b) => b.remainingAmount - a.remainingAmount
  )[0];

  return (
    <Dialog
      open={metric !== null}
      onOpenChange={(open) => {
        if (!open) onClose();
      }}
    >
      <DialogContent className="sm:max-w-lg">
        {metric ? (
          <>
            <DialogHeader>
              <DialogTitle className="text-lg">{titles[metric]}</DialogTitle>
              <DialogDescription>{descriptions[metric]}</DialogDescription>
            </DialogHeader>

            <ScrollArea className="max-h-[62vh]">
              <div className="space-y-4 pr-2">
                <div className="rounded-2xl border border-primary/15 bg-primary/5 p-4 dark:bg-primary/10">
                  <div className="flex items-center gap-2 text-sm text-muted-foreground">
                    {metric === "lunas" ? (
                      <CheckCircle2 className="size-4 text-emerald-500" />
                    ) : metric === "lewat_tempo" ? (
                      <AlertTriangle className="size-4 text-amber-500" />
                    ) : (
                      <WalletCards className="size-4 text-primary" />
                    )}
                    Total pelanggan
                  </div>
                  <p className="mt-2 font-heading text-3xl font-semibold">
                    {selectedDebts.length} pelanggan
                  </p>
                  <p className="mt-1 text-xs text-muted-foreground">
                    Berdasarkan data kasbon pada halaman Buku Hutang saat ini.
                  </p>
                </div>

                <div className="rounded-xl border border-border/60 p-3">
                  <SummaryRow label="Nilai kasbon awal" value={formatCurrency(totalAmount)} />
                  <SummaryRow
                    label="Total sudah dibayar"
                    value={formatCurrency(paidAmount)}
                    tone="positive"
                  />
                  <SummaryRow
                    label="Sisa yang belum lunas"
                    value={formatCurrency(remainingAmount)}
                    tone={remainingAmount > 0 ? "warn" : "positive"}
                  />
                </div>

                <div className="grid gap-3 sm:grid-cols-2">
                  <div className="rounded-xl border border-border/60 p-3">
                    <div className="flex items-center gap-2 text-xs text-muted-foreground">
                      <CalendarClock className="size-3.5 text-primary" />
                      Tempo terdekat
                    </div>
                    <p className="mt-2 text-sm font-medium">
                      {nearestDue ? formatDate(nearestDue.dueDate) : "Tidak ada tempo aktif"}
                    </p>
                  </div>
                  <div className="rounded-xl border border-border/60 p-3">
                    <div className="flex items-center gap-2 text-xs text-muted-foreground">
                      <Users className="size-3.5 text-primary" />
                      Sisa terbesar
                    </div>
                    <p className="mt-2 text-sm font-medium">
                      {largestRemaining && largestRemaining.remainingAmount > 0
                        ? `${largestRemaining.borrowerName} - ${formatCurrency(largestRemaining.remainingAmount)}`
                        : "Tidak ada sisa tagihan"}
                    </p>
                  </div>
                </div>

                <div className="space-y-2">
                  <p className="text-xs font-medium text-muted-foreground">Daftar terkait</p>
                  {selectedDebts.length > 0 ? (
                    selectedDebts.slice(0, 8).map((debt) => (
                      <div
                        key={debt.id}
                        className="rounded-xl border border-border/60 p-3"
                      >
                        <div className="flex items-start justify-between gap-3">
                          <div>
                            <p className="font-medium">{debt.borrowerName}</p>
                            <p className="mt-0.5 text-xs text-muted-foreground">
                              {debt.whatsapp} - {statusText(debt.status)}
                            </p>
                          </div>
                          <p className="text-sm font-medium tabular-nums">
                            {formatCurrency(debt.remainingAmount)}
                          </p>
                        </div>
                        <div className="mt-2 grid grid-cols-2 gap-2 text-xs text-muted-foreground">
                          <span>Total: {formatCurrency(debt.amount)}</span>
                          <span className="text-right">Tempo: {formatDate(debt.dueDate)}</span>
                        </div>
                      </div>
                    ))
                  ) : (
                    <div className="rounded-xl bg-muted/50 px-4 py-6 text-center text-sm text-muted-foreground">
                      Belum ada data untuk kategori ini.
                    </div>
                  )}
                </div>
              </div>
            </ScrollArea>
          </>
        ) : null}
      </DialogContent>
    </Dialog>
  );
}
