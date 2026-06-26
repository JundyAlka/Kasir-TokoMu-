"use client";

import { Calculator, ReceiptText, TrendingDown, TrendingUp, WalletCards } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { ScrollArea } from "@/components/ui/scroll-area";
import { formatCurrency, formatDate } from "@/lib/format";
import type { Expense } from "@/lib/types";
import { cn } from "@/lib/utils";

export type ReportSummaryMetric = "omzet" | "laba_kotor" | "pengeluaran" | "laba_bersih";

export type ProfitLossSummary = {
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

type ReportSummaryDetailDialogProps = {
  expenses: Expense[];
  metric: ReportSummaryMetric | null;
  onClose: () => void;
  periodLabel: string;
  summary: ProfitLossSummary;
};

const titles: Record<ReportSummaryMetric, string> = {
  omzet: "Detail Omzet Periode",
  laba_kotor: "Detail Laba Kotor",
  pengeluaran: "Detail Pengeluaran",
  laba_bersih: "Detail Laba Bersih",
};

const descriptions: Record<ReportSummaryMetric, string> = {
  omzet: "Total pemasukan penjualan dan rata-rata transaksi pada periode laporan.",
  laba_kotor: "Omzet dikurangi HPP barang terjual berdasarkan item transaksi.",
  pengeluaran: "Beban operasional yang tercatat pada periode laporan aktif.",
  laba_bersih: "Laba kotor setelah dikurangi pengeluaran periode.",
};

function pct(part: number, total: number) {
  if (total === 0) return "0%";
  return `${Math.round((part / total) * 1000) / 10}%`;
}

function SummaryRow({
  label,
  value,
  tone,
}: {
  label: string;
  value: string;
  tone?: "default" | "positive" | "negative" | "warn";
}) {
  return (
    <div className="flex items-center justify-between gap-4 py-2 text-sm">
      <span className="text-muted-foreground">{label}</span>
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

function isInPeriod(expense: Expense, summary: ProfitLossSummary) {
  if (!summary.periodStart || !summary.periodEnd) {
    return false;
  }

  const createdAt = new Date(expense.createdAt).getTime();
  return (
    createdAt >= new Date(summary.periodStart).getTime() &&
    createdAt <= new Date(summary.periodEnd).getTime()
  );
}

function expensesByCategory(expenses: Expense[]) {
  return expenses.reduce<Record<string, number>>((acc, expense) => {
    acc[expense.category] = (acc[expense.category] ?? 0) + expense.amount;
    return acc;
  }, {});
}

export function ReportSummaryDetailDialog({
  expenses,
  metric,
  onClose,
  periodLabel,
  summary,
}: ReportSummaryDetailDialogProps) {
  const periodExpenses = expenses.filter((expense) => isInPeriod(expense, summary));
  const categoryTotals = expensesByCategory(periodExpenses);
  const grossMarginPct = pct(summary.grossProfit, summary.revenue);
  const netMarginPct = pct(summary.netProfit, summary.revenue);

  const metricValue =
    metric === "omzet"
      ? summary.revenue
      : metric === "laba_kotor"
        ? summary.grossProfit
        : metric === "pengeluaran"
          ? summary.expenseTotal
          : summary.netProfit;

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
                    {metric === "omzet" ? (
                      <ReceiptText className="size-4 text-primary" />
                    ) : metric === "pengeluaran" ? (
                      <TrendingDown className="size-4 text-amber-500" />
                    ) : metric === "laba_bersih" ? (
                      <WalletCards className="size-4 text-primary" />
                    ) : (
                      <TrendingUp className="size-4 text-emerald-500" />
                    )}
                    {periodLabel}
                  </div>
                  <p className="mt-2 font-heading text-3xl font-semibold">
                    {formatCurrency(metricValue)}
                  </p>
                  <p className="mt-1 text-xs text-muted-foreground">
                    Periode {summary.periodStart ? formatDate(summary.periodStart) : "-"} sampai{" "}
                    {summary.periodEnd ? formatDate(summary.periodEnd) : "-"}.
                  </p>
                </div>

                <div className="rounded-xl border border-border/60 p-3">
                  {metric === "omzet" ? (
                    <>
                      <SummaryRow label="Total transaksi" value={`${summary.transactionCount} transaksi`} />
                      <SummaryRow label="Rata-rata per transaksi" value={formatCurrency(summary.averageTicket)} />
                      <SummaryRow label="HPP dari omzet" value={`${pct(summary.cogs, summary.revenue)} omzet`} />
                    </>
                  ) : null}

                  {metric === "laba_kotor" ? (
                    <>
                      <SummaryRow label="Omzet" value={formatCurrency(summary.revenue)} />
                      <SummaryRow label="Dikurangi HPP" value={formatCurrency(summary.cogs)} tone="warn" />
                      <SummaryRow label="Margin kotor" value={grossMarginPct} tone="positive" />
                    </>
                  ) : null}

                  {metric === "pengeluaran" ? (
                    <>
                      <SummaryRow label="Total pengeluaran" value={formatCurrency(summary.expenseTotal)} tone="warn" />
                      <SummaryRow label="Jumlah catatan beban" value={`${periodExpenses.length} catatan`} />
                      <SummaryRow label="Porsi dari omzet" value={`${pct(summary.expenseTotal, summary.revenue)} omzet`} />
                    </>
                  ) : null}

                  {metric === "laba_bersih" ? (
                    <>
                      <SummaryRow label="Laba kotor" value={formatCurrency(summary.grossProfit)} tone="positive" />
                      <SummaryRow label="Dikurangi pengeluaran" value={formatCurrency(summary.expenseTotal)} tone="warn" />
                      <SummaryRow
                        label="Margin bersih"
                        value={netMarginPct}
                        tone={summary.netProfit >= 0 ? "positive" : "negative"}
                      />
                    </>
                  ) : null}
                </div>

                <div className="rounded-xl border border-border/60 p-3">
                  <div className="flex items-center gap-2 text-sm font-medium">
                    <Calculator className="size-4 text-primary" />
                    Dasar perhitungan
                  </div>
                  <div className="mt-3 space-y-2 text-sm text-muted-foreground">
                    <p>Omzet = total nilai transaksi penjualan pada periode aktif.</p>
                    <p>HPP = jumlah costPrice x quantity dari item transaksi yang terjual.</p>
                    <p>Laba kotor = omzet - HPP.</p>
                    <p>Laba bersih = laba kotor - pengeluaran.</p>
                  </div>
                </div>

                {metric === "pengeluaran" ? (
                  <div className="space-y-2">
                    <p className="text-xs font-medium text-muted-foreground">Rincian kategori pengeluaran</p>
                    {Object.entries(categoryTotals).length > 0 ? (
                      Object.entries(categoryTotals).map(([category, total]) => (
                        <div
                          key={category}
                          className="flex items-center justify-between rounded-xl border border-border/60 p-3 text-sm"
                        >
                          <span>{category}</span>
                          <span className="font-medium tabular-nums">{formatCurrency(total)}</span>
                        </div>
                      ))
                    ) : (
                      <div className="rounded-xl bg-muted/50 px-4 py-6 text-center text-sm text-muted-foreground">
                        Tidak ada catatan pengeluaran pada periode ini.
                      </div>
                    )}
                  </div>
                ) : null}
              </div>
            </ScrollArea>
          </>
        ) : null}
      </DialogContent>
    </Dialog>
  );
}
