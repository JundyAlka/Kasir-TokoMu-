"use client";

import { useEffect, useMemo, useState } from "react";
import {
  Download,
  Eye,
  EyeOff,
  FilePenLine,
  FileText,
  Loader2,
  Lock,
  Plus,
  RefreshCw,
  RotateCcw,
  X,
} from "lucide-react";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button, buttonVariants } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { formatCurrency, formatDate } from "@/lib/format";
import { cn } from "@/lib/utils";

type ReportStatus = "draft" | "final";

type ReportRow = {
  id: string;
  periodYear: number;
  periodMonth: number;
  data: unknown;
  status: ReportStatus;
  finalizedAt: string | null;
  createdAt: string;
  updatedAt: string;
};

type SnapshotData = {
  note?: string;
  period?: { label?: string };
  financial?: {
    revenue?: number;
    grossProfit?: number;
    expenses?: number;
    salaries?: number;
    netProfit?: number;
    pcmShare?: number;
    reserveShare?: number;
    totalInvestorPayout?: number;
  };
  omzet?: number;
  labaKotor?: number;
  bagianPcm?: number;
  danaCadangan?: number;
  investorPayout?: number;
};

function currentMonthPayload() {
  const now = new Date();
  return {
    periodYear: now.getFullYear(),
    periodMonth: now.getMonth() + 1,
  };
}

function periodLabel(year: number, month: number) {
  return new Intl.DateTimeFormat("id-ID", {
    month: "long",
    year: "numeric",
  }).format(new Date(year, month - 1, 1));
}

function asSnapshot(value: unknown): SnapshotData {
  if (!value || typeof value !== "object") {
    return {};
  }

  return value as SnapshotData;
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

function getReportMetrics(report: ReportRow) {
  const data = asSnapshot(report.data);
  return {
    label: data.period?.label ?? periodLabel(report.periodYear, report.periodMonth),
    revenue: data.financial?.revenue ?? data.omzet ?? 0,
    grossProfit: data.financial?.grossProfit ?? data.labaKotor ?? 0,
    expenses: data.financial?.expenses ?? 0,
    salaries: data.financial?.salaries ?? 0,
    netProfit: data.financial?.netProfit ?? data.labaKotor ?? 0,
    pcmShare: data.financial?.pcmShare ?? data.bagianPcm ?? 0,
    reserveShare: data.financial?.reserveShare ?? data.danaCadangan ?? 0,
    investorPayout: data.financial?.totalInvestorPayout ?? data.investorPayout ?? 0,
  };
}

export function MonthlyReportPreview() {
  const [reports, setReports] = useState<ReportRow[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [note, setNote] = useState("");
  const [isLoading, setIsLoading] = useState(true);
  const [isCreating, setIsCreating] = useState(false);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [isFinalizing, setIsFinalizing] = useState<string | null>(null);
  const [isReopening, setIsReopening] = useState<string | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [previewVersion, setPreviewVersion] = useState(0);
  const [showPdfPreview, setShowPdfPreview] = useState(false);

  const selectedReport = useMemo(
    () => reports.find((report) => report.id === selectedId) ?? reports[0] ?? null,
    [reports, selectedId]
  );
  const editingReport = reports.find((report) => report.id === editingId) ?? null;
  const currentPeriod = currentMonthPayload();
  const currentMonthReport = reports.find(
    (report) =>
      report.periodYear === currentPeriod.periodYear &&
      report.periodMonth === currentPeriod.periodMonth
  );
  const previewUrl = selectedReport
    ? `/api/reports/monthly-pcm/${selectedReport.id}/pdf?v=${encodeURIComponent(
      `${selectedReport.updatedAt}-${previewVersion}`
    )}`
    : null;

  const isCurrentMonthOutdated = useMemo(() => {
    if (!currentMonthReport) return false;
    const data = currentMonthReport.data as any;
    const fin = data?.financial;
    if (!fin) return false;
    const snapRev = Number(data?.revenue ?? 0);
    const snapNet = Number(data?.netProfit ?? 0);
    const pcmRev = Number(fin?.revenue ?? snapRev);
    const pcmNet = Number(fin?.netProfit ?? snapNet);
    return snapRev !== pcmRev || snapNet !== pcmNet;
  }, [currentMonthReport]);

  // Banner: show ONLY if snapshot is outdated OR current month report is missing
  const showPendingBanner = !currentMonthReport || isCurrentMonthOutdated;

  async function loadReports(nextSelectedId?: string) {
    const data = await requestJson<{ reports: ReportRow[] }>("/api/reports/monthly-pcm");
    setReports(data.reports);
    setSelectedId(nextSelectedId ?? selectedId ?? data.reports[0]?.id ?? null);
  }

  useEffect(() => {
    let mounted = true;
    window.scrollTo({ top: 0, left: 0, behavior: "instant" });

    requestJson<{ reports: ReportRow[] }>("/api/reports/monthly-pcm")
      .then((data) => {
        if (!mounted) return;
        setReports(data.reports);
        setSelectedId(data.reports[0]?.id ?? null);
      })
      .catch((error) => {
        toast.error(error instanceof Error ? error.message : "Gagal memuat laporan PCM.");
      })
      .finally(() => {
        if (mounted) setIsLoading(false);
      });

    return () => {
      mounted = false;
    };
  }, []);

  async function handleSaveReport() {
    setIsCreating(true);
    try {
      const payload = editingReport
        ? {
          periodYear: editingReport.periodYear,
          periodMonth: editingReport.periodMonth,
        }
        : currentMonthPayload();
      const data = await requestJson<{ report: ReportRow }>("/api/reports/monthly-pcm", {
        method: "POST",
        body: JSON.stringify({ ...payload, note }),
      });
      await loadReports(data.report.id);
      setEditingId(null);
      setPreviewVersion((version) => version + 1);
      toast.success(editingReport ? "Perubahan draft berhasil disimpan." : "Draft laporan bulan ini berhasil dibuat.");
      window.dispatchEvent(new CustomEvent("pcm-reports-updated", { detail: { action: "updated" } }));
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Gagal membuat laporan PCM.");
    } finally {
      setIsCreating(false);
    }
  }

  function handleEdit(report: ReportRow) {
    if (report.status !== "draft") return;
    setSelectedId(report.id);
    setEditingId(report.id);
    setNote(asSnapshot(report.data).note ?? "");
    window.scrollTo({ top: 0, behavior: "smooth" });
    setTimeout(() => {
      document.getElementById("report-note")?.focus();
    }, 100);
  }

  function handleCancelEdit() {
    setEditingId(null);
    setNote("");
  }

  async function handleRefresh() {
    setIsRefreshing(true);
    try {
      await loadReports();
      setPreviewVersion((version) => version + 1);
      toast.success("Data laporan dan preview PDF diperbarui.");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Gagal memperbarui laporan PCM.");
    } finally {
      setIsRefreshing(false);
    }
  }

  async function handleFinalize(reportId: string) {
    setIsFinalizing(reportId);
    try {
      const data = await requestJson<{ report: ReportRow }>("/api/reports/monthly-pcm", {
        method: "PATCH",
        body: JSON.stringify({ id: reportId, status: "final" }),
      });
      await loadReports(data.report.id);
      if (editingId === reportId) handleCancelEdit();
      setPreviewVersion((version) => version + 1);
      toast.success("Laporan berhasil difinalkan.");
      window.dispatchEvent(new CustomEvent("pcm-reports-updated", { detail: { action: "finalized" } }));
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Gagal finalize laporan.");
    } finally {
      setIsFinalizing(null);
    }
  }

  async function handleReopen(report: ReportRow) {
    setIsReopening(report.id);
    try {
      const data = await requestJson<{ report: ReportRow }>("/api/reports/monthly-pcm", {
        method: "PATCH",
        body: JSON.stringify({ id: report.id, status: "draft" }),
      });
      await loadReports(data.report.id);
      setEditingId(data.report.id);
      setNote(asSnapshot(data.report.data).note ?? "");
      setPreviewVersion((version) => version + 1);
      toast.success("Laporan dibuka kembali sebagai draft dan siap diedit.");
      window.dispatchEvent(new CustomEvent("pcm-reports-updated", { detail: { action: "reopened" } }));
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Gagal membuka kembali laporan.");
    } finally {
      setIsReopening(null);
    }
  }

  return (
    <div className="space-y-4">
      {showPendingBanner ? (
        <div className="rounded-3xl border border-rose-500/50 bg-rose-500/10 p-5 shadow-sm backdrop-blur-xl flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 animate-pulse">
          <div className="flex items-center gap-3.5">
            <div className="flex size-11 shrink-0 items-center justify-center rounded-2xl bg-rose-500 text-white">
              <FileText className="size-5" />
            </div>
            <div>
              <p className="font-heading text-lg font-semibold text-foreground">
                {isCurrentMonthOutdated && currentMonthReport?.status === "final"
                  ? `Snapshot Laporan Bulanan Baru Saja Diperbarui!`
                  : `Laporan PCM ${periodLabel(currentPeriod.periodYear, currentPeriod.periodMonth)} Belum Final`}
              </p>
              <p className="mt-0.5 text-sm text-muted-foreground">
                {isCurrentMonthOutdated && currentMonthReport?.status === "final"
                  ? `Silakan klik "Buka kembali" pada daftar laporan di bawah, lalu klik "Update Laporan" di atas untuk memperbarui data PCM.`
                  : `Draft laporan PCM bulan ini sudah ada. Periksa dan finalize agar tercatat resmi.`}
              </p>
            </div>
          </div>
        </div>
      ) : null}

      <Card className="border-border/60 bg-card/80">
        <CardHeader className="gap-4 lg:flex-row lg:items-end lg:justify-between">
          <div className="space-y-1">
            <CardTitle className="font-heading text-2xl">Laporan bulanan PCM</CardTitle>
            <CardDescription>
              Buat snapshot laporan resmi, preview PDF, download, dan finalize laporan periode.
            </CardDescription>
          </div>
          <div className="flex flex-col gap-3 sm:min-w-[360px]">
            <Label htmlFor="report-note">Catatan laporan bulan ini</Label>
            <Textarea
              id="report-note"
              value={note}
              onChange={(event) => setNote(event.target.value)}
              placeholder="Catatan untuk Ketua PCM"
              className="min-h-20 rounded-2xl"
            />
            {editingReport ? (
              <p className="text-xs text-muted-foreground">
                Mengedit draft {periodLabel(editingReport.periodYear, editingReport.periodMonth)}.
              </p>
            ) : null}
            <div className="flex flex-wrap gap-2">
              <Button
                className={cn(
                  "rounded-2xl transition-all",
                  (editingReport || isCurrentMonthOutdated) && "animate-pulse ring-2 ring-primary ring-offset-2 bg-primary font-bold shadow-lg"
                )}
                onClick={() => void handleSaveReport()}
                disabled={isCreating || (!editingReport && currentMonthReport?.status === "final" && !isCurrentMonthOutdated)}
              >
                {isCreating ? (
                  <Loader2 className="size-4 animate-spin" />
                ) : editingReport || isCurrentMonthOutdated ? (
                  <FilePenLine className="size-4" />
                ) : (
                  <Plus className="size-4" />
                )}
                {editingReport || isCurrentMonthOutdated
                  ? "Update Perubahan"
                  : currentMonthReport?.status === "final"
                    ? "Laporan Bulan Ini Sudah Final"
                    : "Simpan Perubahan"}
              </Button>
              {editingReport ? (
                <Button variant="outline" className="rounded-2xl" onClick={handleCancelEdit}>
                  <X className="size-4" />
                  Batal
                </Button>
              ) : null}
              <Button
                variant="outline"
                className="rounded-2xl"
                onClick={() => void handleRefresh()}
                disabled={isLoading || isRefreshing}
              >
                <RefreshCw className={cn("size-4", isRefreshing && "animate-spin")} />
                Refresh
              </Button>
            </div>
          </div>
        </CardHeader>
      </Card>

      <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_minmax(420px,0.9fr)]">
        <Card className="border-border/60 bg-card/80">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <FileText className="size-5" />
              Daftar laporan
            </CardTitle>
            <CardDescription>
              Draft dapat diedit. Laporan final bisa dibuka kembali bila perlu dikoreksi.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            {reports.map((report) => {
              const metrics = getReportMetrics(report);
              const isSelected = selectedReport?.id === report.id;
              const isCurrentMonth =
                report.periodYear === currentPeriod.periodYear &&
                report.periodMonth === currentPeriod.periodMonth;

              const reportData = report.data as any;
              const pcmFin = reportData?.financial;
              const snapRev = Number(reportData?.revenue ?? 0);
              const snapNet = Number(reportData?.netProfit ?? 0);
              const pcmRev = Number(pcmFin?.revenue ?? snapRev);
              const pcmNet = Number(pcmFin?.netProfit ?? snapNet);

              const isOutdated = !!pcmFin && (snapRev !== pcmRev || snapNet !== pcmNet);

              return (
                <article
                  key={report.id}
                  className={cn(
                    "space-y-4 rounded-2xl border p-4 transition-colors",
                    isSelected ? "border-primary/40 bg-primary/5" : "border-border/70 bg-background/35"
                  )}
                >
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div>
                      <p className="font-heading text-lg font-semibold">{metrics.label}</p>
                      <p className="mt-1 text-xs text-muted-foreground">
                        Diperbarui {formatDate(report.updatedAt)}
                      </p>
                    </div>
                    <div className="text-right">
                      <Badge variant={report.status === "final" ? "default" : "secondary"}>
                        {report.status === "final" ? "Final" : "Draft"}
                      </Badge>
                      {report.finalizedAt ? (
                        <p className="mt-1 text-xs text-muted-foreground">
                          Final {formatDate(report.finalizedAt)}
                        </p>
                      ) : null}
                    </div>
                  </div>

                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                    <div className="rounded-xl bg-muted/55 p-3">
                      <p className="text-[11px] text-muted-foreground">Laba Kotor</p>
                      <p className="mt-1 font-semibold tabular-nums text-sm">{formatCurrency(metrics.grossProfit)}</p>
                    </div>
                    <div className="rounded-xl bg-muted/55 p-3">
                      <p className="text-[11px] text-muted-foreground">Biaya Operasional</p>
                      <p className="mt-1 font-semibold text-rose-500 tabular-nums text-sm">-{formatCurrency(metrics.expenses || 0)}</p>
                    </div>
                    <div className="rounded-xl bg-muted/55 p-3">
                      <p className="text-[11px] text-muted-foreground">Gaji Karyawan</p>
                      <p className="mt-1 font-semibold text-rose-500 tabular-nums text-sm">-{formatCurrency(metrics.salaries || 0)}</p>
                    </div>
                    <div className="rounded-xl bg-primary/10 border border-primary/20 p-3">
                      <p className="text-[11px] font-medium text-primary">Laba Bersih</p>
                      <p className="mt-1 font-bold text-primary tabular-nums text-sm">{formatCurrency(metrics.netProfit)}</p>
                    </div>
                  </div>

                  <div className="grid gap-2 rounded-xl border border-border/60 p-3 text-sm sm:grid-cols-3">
                    <div><span className="text-muted-foreground">Bagi Hasil PCM</span><p className="font-medium tabular-nums">{formatCurrency(metrics.pcmShare)}</p></div>
                    <div><span className="text-muted-foreground">Dana Cadangan</span><p className="font-medium tabular-nums">{formatCurrency(metrics.reserveShare)}</p></div>
                    <div><span className="text-muted-foreground">Bagi Hasil Investor</span><p className="font-medium tabular-nums">{formatCurrency(metrics.investorPayout)}</p></div>
                  </div>

                  {asSnapshot(report.data).note ? (
                    <div className="rounded-xl bg-accent/40 px-4 py-3 text-sm italic text-muted-foreground">
                      "{asSnapshot(report.data).note}"
                    </div>
                  ) : null}

                  <div className="flex flex-wrap gap-2">
                    <Button
                      size="sm"
                      variant="outline"
                      className="rounded-full"
                      onClick={() => {
                        setSelectedId(report.id);
                        setShowPdfPreview(true);
                      }}
                    >
                      <Eye className="size-4" />
                      Preview
                    </Button>
                    <a
                      href={`/api/reports/monthly-pcm/${report.id}/pdf`}
                      download
                      className={cn(buttonVariants({ size: "sm", variant: "outline" }), "rounded-full")}
                    >
                      <Download className="size-4" />
                      PDF
                    </a>
                    {report.status === "draft" ? (
                      <Button
                        size="sm"
                        variant="outline"
                        className="rounded-full"
                        onClick={() => handleEdit(report)}
                      >
                        <FilePenLine className="size-4" />
                        Edit
                      </Button>
                    ) : isCurrentMonth ? (
                      <Button
                        size="sm"
                        variant={isOutdated ? "default" : "outline"}
                        className={cn(
                          "rounded-full font-bold transition-all",
                          isOutdated
                            ? "bg-rose-600 text-white hover:bg-rose-700 font-bold border-0 shadow-lg ring-2 ring-rose-400 ring-offset-1 animate-pulse"
                            : ""
                        )}
                        disabled={isReopening === report.id}
                        onClick={() => void handleReopen(report)}
                      >
                        {isReopening === report.id ? (
                          <Loader2 className="size-4 animate-spin" />
                        ) : (
                          <RotateCcw className="size-4 text-white" />
                        )}
                        <span className={isOutdated ? "font-bold text-white" : ""}>Buka kembali</span>
                      </Button>
                    ) : null}
                    {report.status === "draft" ? (
                      <Button
                        size="sm"
                        className="rounded-full"
                        disabled={isFinalizing === report.id}
                        onClick={() => void handleFinalize(report.id)}
                      >
                        {isFinalizing === report.id ? (
                          <Loader2 className="size-4 animate-spin" />
                        ) : (
                          <Lock className="size-4" />
                        )}
                        Finalize
                      </Button>
                    ) : null}
                  </div>
                </article>
              );
            })}
            {!isLoading && reports.length === 0 ? (
              <div className="flex min-h-28 items-center justify-center rounded-2xl border border-dashed px-4 text-center text-muted-foreground">
                Belum ada laporan. Buat laporan bulan ini untuk mulai preview PDF.
              </div>
            ) : null}
            {isLoading ? (
              <div className="flex min-h-28 items-center justify-center text-muted-foreground">
                <Loader2 className="mr-2 size-4 animate-spin" />
                Memuat laporan...
              </div>
            ) : null}
          </CardContent>
        </Card>

        <Card className="border-border/60 bg-card/80">
          <CardHeader className="flex flex-row items-center justify-between space-y-0">
            <div>
              <CardTitle className="font-heading text-xl">Preview PDF</CardTitle>
              <CardDescription className="mt-1">
                Tampilan dokumen resmi yang akan diunduh atau dicetak.
              </CardDescription>
            </div>
            {selectedReport && showPdfPreview ? (
              <Button
                variant="ghost"
                size="sm"
                className="rounded-xl text-xs gap-1.5 text-muted-foreground hover:text-foreground"
                onClick={() => setShowPdfPreview(false)}
              >
                <EyeOff className="size-4" />
                Sembunyikan
              </Button>
            ) : null}
          </CardHeader>
          <CardContent className="min-h-0 pt-4">
            {!selectedReport ? (
              <div className="flex h-[420px] flex-col items-center justify-center rounded-2xl border border-dashed border-border/70 p-6 text-center text-muted-foreground">
                <FileText className="size-12 text-muted-foreground/30 mb-3" />
                <p className="font-medium text-foreground">Belum ada laporan terpilih</p>
                <p className="mt-1 text-xs text-muted-foreground max-w-xs">
                  Pilih atau buat laporan dari daftar di samping untuk melihat detail dan preview PDF.
                </p>
              </div>
            ) : !showPdfPreview ? (
              <div className="flex h-[420px] flex-col items-center justify-center rounded-2xl border border-border/60 bg-muted/20 p-6 text-center shadow-inner">
                <div className="flex size-14 items-center justify-center rounded-2xl bg-primary/10 text-primary mb-4">
                  <FileText className="size-7" />
                </div>
                <h4 className="font-heading text-lg font-semibold text-foreground">
                  Dokumen Preview ({getReportMetrics(selectedReport).label})
                </h4>
                <p className="mt-1.5 text-xs text-muted-foreground max-w-sm">
                  Klik tombol di bawah dengan ikon tampilkan untuk memuat pratinjau PDF dokumen.
                </p>
                <div className="mt-6 flex flex-wrap items-center justify-center gap-3">
                  <Button
                    className="rounded-2xl px-5 font-semibold gap-2 shadow-sm"
                    onClick={() => setShowPdfPreview(true)}
                  >
                    <Eye className="size-4" />
                    Tampilkan Preview PDF
                  </Button>
                  <a
                    href={previewUrl ?? "#"}
                    download
                    className={cn(buttonVariants({ variant: "outline" }), "rounded-2xl gap-2")}
                  >
                    <Download className="size-4" />
                    Download PDF
                  </a>
                </div>
              </div>
            ) : previewUrl ? (
              <div className="flex h-[clamp(520px,72dvh,900px)] flex-col overflow-hidden rounded-2xl border border-border/70 bg-background shadow-sm">
                <div className="bg-muted/50 px-4 py-2 text-center text-xs text-muted-foreground border-b border-border/60">
                  Preview mungkin tidak muncul di tablet/kiosk. Klik tombol <strong>PDF</strong> untuk mengunduh.
                </div>
                <iframe
                  key={previewUrl}
                  title="Preview laporan PCM"
                  src={`${previewUrl}#toolbar=1&navpanes=0&scrollbar=1&view=FitH`}
                  className="block flex-1 w-full touch-pan-y bg-background"
                />
              </div>
            ) : null}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
