"use client";

import { useEffect, useMemo, useState } from "react";
import {
  Download,
  Eye,
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

  async function loadReports(nextSelectedId?: string) {
    const data = await requestJson<{ reports: ReportRow[] }>("/api/reports/monthly-pcm");
    setReports(data.reports);
    setSelectedId(nextSelectedId ?? selectedId ?? data.reports[0]?.id ?? null);
  }

  useEffect(() => {
    let mounted = true;

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
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Gagal membuka kembali laporan.");
    } finally {
      setIsReopening(null);
    }
  }

  return (
    <div className="space-y-4">
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
                className="rounded-2xl"
                onClick={() => void handleSaveReport()}
                disabled={isCreating || (!editingReport && currentMonthReport?.status === "final")}
              >
                {isCreating ? (
                  <Loader2 className="size-4 animate-spin" />
                ) : editingReport ? (
                  <FilePenLine className="size-4" />
                ) : (
                  <Plus className="size-4" />
                )}
                {editingReport
                  ? "Simpan Perubahan"
                  : currentMonthReport?.status === "final"
                    ? "Laporan Bulan Ini Sudah Final"
                    : currentMonthReport?.status === "draft"
                      ? "Perbarui Draft Bulan Ini"
                      : "Buat Laporan Bulan Ini"}
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

                  <div className="grid grid-cols-2 gap-3">
                    <div className="rounded-xl bg-muted/55 p-3">
                      <p className="text-xs text-muted-foreground">Omzet</p>
                      <p className="mt-1 font-semibold tabular-nums">{formatCurrency(metrics.revenue)}</p>
                    </div>
                    <div className="rounded-xl bg-muted/55 p-3">
                      <p className="text-xs text-muted-foreground">Laba bersih</p>
                      <p className="mt-1 font-semibold tabular-nums">{formatCurrency(metrics.netProfit)}</p>
                    </div>
                  </div>

                  <div className="grid gap-2 rounded-xl border border-border/60 p-3 text-sm sm:grid-cols-3">
                    <div><span className="text-muted-foreground">PCM</span><p className="font-medium tabular-nums">{formatCurrency(metrics.pcmShare)}</p></div>
                    <div><span className="text-muted-foreground">Cadangan</span><p className="font-medium tabular-nums">{formatCurrency(metrics.reserveShare)}</p></div>
                    <div><span className="text-muted-foreground">Investor</span><p className="font-medium tabular-nums">{formatCurrency(metrics.investorPayout)}</p></div>
                  </div>

                  <div className="flex flex-wrap gap-2">
                          <Button
                            size="sm"
                            variant="outline"
                            className="rounded-full"
                            onClick={() => setSelectedId(report.id)}
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
                          ) : (
                            <Button
                              size="sm"
                              variant="outline"
                              className="rounded-full"
                              disabled={isReopening === report.id}
                              onClick={() => void handleReopen(report)}
                            >
                              {isReopening === report.id ? (
                                <Loader2 className="size-4 animate-spin" />
                              ) : (
                                <RotateCcw className="size-4" />
                              )}
                              Buka kembali
                            </Button>
                          )}
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
          <CardHeader>
            <CardTitle>Preview PDF</CardTitle>
            <CardDescription>
              Tampilan dokumen resmi yang akan diunduh atau dicetak.
            </CardDescription>
          </CardHeader>
          <CardContent className="min-h-0">
            {previewUrl ? (
              <div className="h-[clamp(520px,72dvh,900px)] overflow-hidden rounded-lg border bg-background">
                <iframe
                  key={previewUrl}
                  title="Preview laporan PCM"
                  src={`${previewUrl}#toolbar=1&navpanes=0&scrollbar=1&view=FitH`}
                  className="block h-full w-full touch-pan-y bg-background"
                />
              </div>
            ) : (
              <div className="flex h-[420px] items-center justify-center rounded-lg border text-sm text-muted-foreground">
                Pilih atau buat laporan untuk menampilkan preview.
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
