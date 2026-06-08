"use client";

import { useEffect, useMemo, useState } from "react";
import { Download, Eye, FileText, Loader2, Lock, Plus, RefreshCw } from "lucide-react";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button, buttonVariants } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
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
  const [isFinalizing, setIsFinalizing] = useState<string | null>(null);

  const selectedReport = useMemo(
    () => reports.find((report) => report.id === selectedId) ?? reports[0] ?? null,
    [reports, selectedId]
  );
  const previewUrl = selectedReport
    ? `/api/reports/monthly-pcm/${selectedReport.id}/pdf`
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

  async function handleCreateCurrentMonth() {
    setIsCreating(true);
    try {
      const payload = currentMonthPayload();
      const data = await requestJson<{ report: ReportRow }>("/api/reports/monthly-pcm", {
        method: "POST",
        body: JSON.stringify({ ...payload, note }),
      });
      await loadReports(data.report.id);
      toast.success("Draft laporan bulan ini berhasil dibuat.");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Gagal membuat laporan PCM.");
    } finally {
      setIsCreating(false);
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
      toast.success("Laporan berhasil difinalkan.");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Gagal finalize laporan.");
    } finally {
      setIsFinalizing(null);
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
            <div className="flex gap-2">
              <Button
                className="rounded-2xl"
                onClick={() => void handleCreateCurrentMonth()}
                disabled={isCreating}
              >
                {isCreating ? <Loader2 className="size-4 animate-spin" /> : <Plus className="size-4" />}
                Buat Laporan Bulan Ini
              </Button>
              <Button
                variant="outline"
                className="rounded-2xl"
                onClick={() => void loadReports()}
                disabled={isLoading}
              >
                <RefreshCw className="size-4" />
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
              Laporan final tidak dapat diedit, tetapi tetap bisa dipreview dan diunduh.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Table className="min-w-[860px]">
              <TableHeader>
                <TableRow>
                  <TableHead>Periode</TableHead>
                  <TableHead>Omzet</TableHead>
                  <TableHead>Laba bersih</TableHead>
                  <TableHead>Alokasi</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="text-right">Aksi</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {reports.map((report) => {
                  const metrics = getReportMetrics(report);
                  const isSelected = selectedReport?.id === report.id;

                  return (
                    <TableRow key={report.id} className={isSelected ? "bg-muted/50" : undefined}>
                      <TableCell className="font-medium">{metrics.label}</TableCell>
                      <TableCell>{formatCurrency(metrics.revenue)}</TableCell>
                      <TableCell>{formatCurrency(metrics.netProfit)}</TableCell>
                      <TableCell>
                        <div className="space-y-1 text-sm text-muted-foreground">
                          <div>PCM: {formatCurrency(metrics.pcmShare)}</div>
                          <div>Cadangan: {formatCurrency(metrics.reserveShare)}</div>
                          <div>Investor: {formatCurrency(metrics.investorPayout)}</div>
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="space-y-1">
                          <Badge variant={report.status === "final" ? "default" : "secondary"}>
                            {report.status}
                          </Badge>
                          {report.finalizedAt ? (
                            <div className="text-xs text-muted-foreground">
                              {formatDate(report.finalizedAt)}
                            </div>
                          ) : null}
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="flex justify-end gap-2">
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
                      </TableCell>
                    </TableRow>
                  );
                })}
                {!isLoading && reports.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={6} className="h-28 text-center text-muted-foreground">
                      Belum ada laporan. Buat laporan bulan ini untuk mulai preview PDF.
                    </TableCell>
                  </TableRow>
                ) : null}
                {isLoading ? (
                  <TableRow>
                    <TableCell colSpan={6} className="h-28 text-center text-muted-foreground">
                      Memuat laporan...
                    </TableCell>
                  </TableRow>
                ) : null}
              </TableBody>
            </Table>
          </CardContent>
        </Card>

        <Card className="border-border/60 bg-card/80">
          <CardHeader>
            <CardTitle>Preview PDF</CardTitle>
            <CardDescription>
              Tampilan dokumen resmi yang akan diunduh atau dicetak.
            </CardDescription>
          </CardHeader>
          <CardContent>
            {previewUrl ? (
              <iframe
                title="Preview laporan PCM"
                src={previewUrl}
                className="h-[760px] w-full rounded-lg border bg-background"
              />
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
