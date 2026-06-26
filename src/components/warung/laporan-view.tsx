"use client";

import { useEffect, useMemo, useState } from "react";
import {
  CalendarDays,
  Download,
  ListChecks,
  Loader2,
  Printer,
  RotateCcw,
  Settings2,
  TableProperties,
  TrendingUp,
} from "lucide-react";
import { toast } from "sonner";
import { useAppState } from "@/components/providers/app-state-provider";
import { StatCard } from "@/components/stat-card";
import {
  ProfitLossSummary,
  ReportSummaryDetailDialog,
  ReportSummaryMetric,
} from "@/components/tokomu/report-summary-detail-dialog";
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
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { formatCompactCurrency, formatCurrency, formatDate } from "@/lib/format";
import { buildSeries, estimateProductVelocity } from "@/lib/reporting";

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

type ReportPreviewLayout = "cards" | "table";

const monthOptions = [
  { value: "01", label: "Januari" },
  { value: "02", label: "Februari" },
  { value: "03", label: "Maret" },
  { value: "04", label: "April" },
  { value: "05", label: "Mei" },
  { value: "06", label: "Juni" },
  { value: "07", label: "Juli" },
  { value: "08", label: "Agustus" },
  { value: "09", label: "September" },
  { value: "10", label: "Oktober" },
  { value: "11", label: "November" },
  { value: "12", label: "Desember" },
];

export function LaporanView() {
  const { expenses, transactions, products, settings } = useAppState();
  const [period, setPeriod] = useState(currentMonthValue());
  const [summary, setSummary] = useState<ProfitLossSummary>(emptySummary);
  const [isLoading, setIsLoading] = useState(true);
  const [activeSummaryMetric, setActiveSummaryMetric] = useState<ReportSummaryMetric | null>(null);
  const [reportPreviewLayout, setReportPreviewLayout] = useState<ReportPreviewLayout>("cards");
  const [customOwnerNotes, setCustomOwnerNotes] = useState("");
  const [isPdfPreviewOpen, setIsPdfPreviewOpen] = useState(false);

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
  const [selectedYear, selectedMonth] = period.split("-");
  const currentYear = new Date().getFullYear();
  const yearOptions = useMemo(() => {
    const years = new Set<number>();
    for (let year = currentYear + 1; year >= currentYear - 5; year -= 1) {
      years.add(year);
    }
    years.add(Number(selectedYear));
    return Array.from(years).sort((a, b) => b - a);
  }, [currentYear, selectedYear]);
  const periodLabel = new Intl.DateTimeFormat("id-ID", {
    month: "long",
    year: "numeric",
  }).format(new Date(`${period}-01T00:00:00`));
  const defaultOwnerNotes = useMemo(
    () => [
      `Laba bersih ${periodLabel} tercatat ${formatCurrency(summary.netProfit)}.`,
      `Laba kotor ${formatCurrency(summary.grossProfit)} setelah HPP ${formatCurrency(summary.cogs)}.`,
      "Data laporan ini memakai API /api/reports/profit-loss yang sama dengan basis perhitungan bagi hasil.",
    ],
    [periodLabel, summary.cogs, summary.grossProfit, summary.netProfit]
  );
  const ownerNotes = customOwnerNotes.trim()
    ? customOwnerNotes
        .split("\n")
        .map((note) => note.trim())
        .filter(Boolean)
    : defaultOwnerNotes;
  const ownerNotesText = customOwnerNotes || defaultOwnerNotes.join("\n");

  function updatePeriod(nextYear: string, nextMonth: string) {
    setIsLoading(true);
    setPeriod(`${nextYear}-${nextMonth}`);
  }

  function buildReportPdfUrl(download = false) {
    const params = new URLSearchParams({ period });
    if (download) {
      params.set("download", "1");
    }
    ownerNotes.forEach((note) => params.append("note", note));
    return `/api/reports/profit-loss/pdf?${params.toString()}`;
  }

  function handlePreviewPrint() {
    setIsPdfPreviewOpen(true);
  }

  function handleDownloadPdf() {
    const link = document.createElement("a");
    link.href = buildReportPdfUrl(true);
    link.download = `laporan-untung-rugi-${period}.pdf`;
    document.body.appendChild(link);
    link.click();
    link.remove();
  }

  return (
    <div className="space-y-4">
      <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <StatCard
          title="Omzet"
          value={formatCompactCurrency(summary.revenue)}
          description={`Total pemasukan untuk ${periodLabel}.`}
          onClick={() => setActiveSummaryMetric("omzet")}
        />
        <StatCard
          title="Laba kotor"
          value={formatCompactCurrency(summary.grossProfit)}
          description={`HPP periode ini ${formatCompactCurrency(summary.cogs)}.`}
          tone="accent"
          onClick={() => setActiveSummaryMetric("laba_kotor")}
        />
        <StatCard
          title="Pengeluaran"
          value={formatCompactCurrency(summary.expenseTotal)}
          description="Biaya operasional yang tercatat di periode ini."
          onClick={() => setActiveSummaryMetric("pengeluaran")}
        />
        <StatCard
          title="Laba bersih"
          value={formatCompactCurrency(summary.netProfit)}
          description="Omzet dikurangi HPP dan beban periode."
          tone="warn"
          onClick={() => setActiveSummaryMetric("laba_bersih")}
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

            <div className="grid min-w-[260px] gap-2">
              <Label htmlFor="report-month">Periode</Label>
              <div className="relative grid grid-cols-[1fr_96px] gap-2 rounded-[22px] border border-border/70 bg-card/80 p-1.5 shadow-inner">
                <Select
                  value={selectedMonth}
                  onValueChange={(month) => {
                    if (month) updatePeriod(selectedYear, month);
                  }}
                >
                  <SelectTrigger
                    id="report-month"
                    className="h-10 w-full rounded-[16px] border-0 bg-transparent px-3 font-medium shadow-none focus-visible:ring-2"
                  >
                    <div className="flex min-w-0 items-center gap-2">
                      <CalendarDays className="size-4 shrink-0 text-primary" />
                      <SelectValue />
                    </div>
                  </SelectTrigger>
                  <SelectContent align="start" className="w-[188px] rounded-2xl p-1">
                    {monthOptions.map((month) => (
                      <SelectItem key={month.value} value={month.value} className="rounded-xl py-2">
                        {month.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>

                <Select
                  value={selectedYear}
                  onValueChange={(year) => {
                    if (year) updatePeriod(year, selectedMonth);
                  }}
                >
                  <SelectTrigger
                    aria-label="Tahun laporan"
                    className="h-10 w-full rounded-[16px] border-0 bg-muted/45 px-3 font-medium shadow-none focus-visible:ring-2"
                  >
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent align="end" className="w-[112px] rounded-2xl p-1">
                    {yearOptions.map((year) => (
                      <SelectItem key={year} value={String(year)} className="rounded-xl py-2">
                        {year}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                {isLoading ? (
                  <Loader2 className="pointer-events-none absolute top-1/2 right-3 size-4 -translate-y-1/2 animate-spin text-muted-foreground" />
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
                <p className="text-sm text-muted-foreground">Rata-rata transaksi</p>
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
                onClick={handlePreviewPrint}
              >
                <Printer className="size-4" />
                Preview PDF
              </Button>
              <Button
                type="button"
                className="rounded-full"
                onClick={handleDownloadPdf}
              >
                <Download className="size-4" />
                Cetak PDF
              </Button>
            </div>
          </CardHeader>
          <CardContent>
            <div className="mb-4 rounded-[26px] border border-border/70 bg-card/70 p-4">
              <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2 text-sm font-medium">
                    <Settings2 className="size-4 text-primary" />
                    Atur tampilan dan pesan laporan
                  </div>
                  <p className="mt-1 text-sm text-muted-foreground">
                    Pesan di bawah akan muncul di preview dan ikut dibawa ke PDF.
                  </p>
                </div>
                <div className="flex rounded-2xl border border-border/70 bg-muted/35 p-1">
                  <Button
                    type="button"
                    variant={reportPreviewLayout === "cards" ? "default" : "ghost"}
                    size="sm"
                    className="rounded-xl"
                    onClick={() => setReportPreviewLayout("cards")}
                  >
                    <ListChecks className="size-4" />
                    Kartu
                  </Button>
                  <Button
                    type="button"
                    variant={reportPreviewLayout === "table" ? "default" : "ghost"}
                    size="sm"
                    className="rounded-xl"
                    onClick={() => setReportPreviewLayout("table")}
                  >
                    <TableProperties className="size-4" />
                    Tabel
                  </Button>
                </div>
              </div>
              <div className="mt-4 grid gap-2">
                <div className="flex items-center justify-between gap-3">
                  <Label htmlFor="owner-report-notes">Pesan catatan pemilik</Label>
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    className="rounded-xl"
                    onClick={() => setCustomOwnerNotes("")}
                  >
                    <RotateCcw className="size-3.5" />
                    Reset otomatis
                  </Button>
                </div>
                <Textarea
                  id="owner-report-notes"
                  value={ownerNotesText}
                  onChange={(event) => setCustomOwnerNotes(event.target.value)}
                  className="min-h-28 rounded-2xl bg-card/80 text-sm leading-6"
                  placeholder="Tulis satu pesan per baris."
                />
                <p className="text-xs text-muted-foreground">
                  Gunakan satu baris untuk satu pesan. Kosongkan atau klik reset untuk kembali ke pesan otomatis.
                </p>
              </div>
            </div>

            <div className="rounded-[30px] bg-card/78 p-6 shadow-inner ring-1 ring-border/80 dark:bg-muted/35 dark:ring-border/70">
              <div className="flex items-start justify-between gap-4 border-b border-dashed border-border/80 pb-5">
                <div>
                  <p className="text-sm uppercase tracking-[0.22em] text-primary">TokoMu report</p>
                  <h3 className="mt-2 font-heading text-3xl font-semibold">{settings.storeName}</h3>
                  <p className="mt-2 text-sm text-muted-foreground">
                    {[settings.storeTagline, settings.city].filter(Boolean).join(" - ")}
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

              {reportPreviewLayout === "cards" ? (
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
              ) : (
                <div className="border-b border-dashed border-border/80 py-5">
                  <div className="overflow-hidden rounded-[22px] border border-border/70 bg-card">
                    {[
                      ["Omzet", formatCurrency(summary.revenue)],
                      ["HPP", formatCurrency(summary.cogs)],
                      ["Laba kotor", formatCurrency(summary.grossProfit)],
                      ["Beban", formatCurrency(summary.expenseTotal)],
                      ["Laba bersih", formatCurrency(summary.netProfit)],
                    ].map(([label, value]) => (
                      <div
                        key={label}
                        className="grid grid-cols-[1fr_auto] items-center gap-4 border-b border-border/60 px-4 py-3 last:border-b-0"
                      >
                        <span className="text-sm text-muted-foreground">{label}</span>
                        <span className="text-right font-medium tabular-nums">{value}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              <div className="space-y-4 py-5">
                <div className="flex items-center gap-2 text-sm font-medium text-foreground">
                  <TrendingUp className="size-4 text-primary" />
                  Catatan untuk pemilik warung
                </div>
                <ul className="space-y-3 text-sm text-muted-foreground">
                  {ownerNotes.map((note, index) => (
                    <li
                      key={`${note}-${index}`}
                      className="rounded-[18px] bg-card px-4 py-3 ring-1 ring-border/70"
                    >
                      {note}
                    </li>
                  ))}
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

      <ReportSummaryDetailDialog
        expenses={expenses}
        metric={activeSummaryMetric}
        onClose={() => setActiveSummaryMetric(null)}
        periodLabel={periodLabel}
        summary={summary}
      />

      <Dialog open={isPdfPreviewOpen} onOpenChange={setIsPdfPreviewOpen}>
        <DialogContent className="max-h-[94vh] w-[min(1280px,calc(100vw-2rem))] !max-w-none overflow-hidden rounded-[28px] p-0 sm:!max-w-none">
          <DialogHeader className="border-b border-border/70 px-5 py-4 pr-14">
            <DialogTitle>Preview PDF laporan</DialogTitle>
            <DialogDescription>
              Pratinjau memakai data periode {periodLabel}. Gunakan tombol Cetak PDF jika ingin mengunduh dokumen.
            </DialogDescription>
          </DialogHeader>
          <div className="bg-muted/35 p-3 sm:p-5">
            <div className="overflow-hidden rounded-[20px] border border-border/70 bg-background shadow-inner">
              {isPdfPreviewOpen ? (
                <iframe
                  title={`Preview PDF laporan ${periodLabel}`}
                  src={`${buildReportPdfUrl()}#view=FitH&toolbar=1&navpanes=0`}
                  className="h-[76vh] min-h-[560px] w-full bg-background"
                />
              ) : null}
            </div>
          </div>
          <div className="flex flex-col gap-2 border-t border-border/70 bg-card/95 px-5 py-4 sm:flex-row sm:items-center sm:justify-between">
            <p className="text-sm text-muted-foreground">
              Preview ditampilkan inline agar tidak otomatis mengunduh file.
            </p>
            <Button type="button" className="rounded-full" onClick={handleDownloadPdf}>
              <Download className="size-4" />
              Cetak PDF
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
