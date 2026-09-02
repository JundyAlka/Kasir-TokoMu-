"use client";

import { type ChangeEvent, type DragEvent, useEffect, useMemo, useRef, useState } from "react";
import {
  AlertTriangle,
  CalendarDays,
  CheckCircle2,
  Download,
  FileSpreadsheet,
  Loader2,
  RotateCcw,
  Search,
  Sparkles,
  UploadCloud,
  X,
} from "lucide-react";
import { toast } from "sonner";
import { useAppState } from "@/components/providers/app-state-provider";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { formatCurrency, formatDate, formatDateTime } from "@/lib/format";
import { cn } from "@/lib/utils";
import {
  canContinueTransactionImport,
  importIssueLabel,
  type ImportIssueCode,
} from "@/lib/transaction-import-ui";

const templateColumns = [
  "Tanggal",
  "No Nota",
  "Metode Bayar",
  "Nama Produk",
  "Jumlah",
  "Harga Jual",
  "Subtotal",
  "Catatan",
] as const;

type ImportIssue = {
  row: number;
  code: ImportIssueCode;
  message: string;
  rowData?: Record<string, unknown>;
  productId?: string;
  productName?: string;
  suggestions?: Array<{ id: string; name: string; score: number }>;
};

type ImportPreview = {
  source: { rowCount: number; invoiceCount: number; totalAmount: number };
  invoiceCount: number;
  itemCount: number;
  totalAmount: number;
  errorRowCount: number;
  dateRange: { start: string; end: string } | null;
  errors: ImportIssue[];
  warnings: ImportIssue[];
  warningGroups: Array<{ code: ImportIssueCode; productName: string; productId?: string; count: number; issues: ImportIssue[] }>;
  excludedNames: Array<{ name: string; rowCount: number; totalAmount: number }>;
  invoices: Array<{
    note: string;
    externalRef: string;
    occurredAt: string;
    paymentMethod: string;
    total: number;
    items: Array<{ row: number; productName: string; quantity: number; unitPrice: number }>;
  }>;
  byDate: Array<{ date: string; invoiceCount: number; rowCount: number; totalAmount: number; adjustmentCount: number }>;
};

type ImportBatch = {
  id: string;
  fileName: string;
  invoiceCount: number;
  itemCount: number;
  totalAmount: number;
  importedByName: string;
  createdAt: string;
  rolledBackAt: string | null;
};

type CommitResult = { batchId: string; createdInvoices: number; skippedInvoices: number };

async function readJson<T>(input: RequestInfo, init?: RequestInit): Promise<T> {
  const response = await fetch(input, init);
  const data = (await response.json().catch(() => null)) as (T & { error?: string; code?: string }) | null;
  if (!response.ok) {
    throw new Error(data?.error ?? "Permintaan ke server gagal.");
  }
  return data as T;
}

function dateRangeLabel(range: ImportPreview["dateRange"]) {
  if (!range) return "-";
  const start = formatDate(range.start);
  const end = formatDate(range.end);
  return start === end ? start : `${start} – ${end}`;
}

function rowValues(rowData?: Record<string, unknown>) {
  if (!rowData) return "Isi baris tidak tersedia.";
  return templateColumns.map((column) => `${column}: ${String(rowData[column] ?? "-")}`).join(" · ");
}

export function TransactionImportPanel() {
  const { products: storeProducts } = useAppState();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const previewRef = useRef<HTMLDivElement>(null);
  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<ImportPreview | null>(null);
  const [batches, setBatches] = useState<ImportBatch[]>([]);
  const [isPreviewing, setIsPreviewing] = useState(false);
  const [isCommitting, setIsCommitting] = useState(false);
  const [isRollingBack, setIsRollingBack] = useState(false);
  const [warningsAcknowledged, setWarningsAcknowledged] = useState(false);
  const [createHistoricalShifts, setCreateHistoricalShifts] = useState(false);
  const [confirmCommitOpen, setConfirmCommitOpen] = useState(false);
  const [rollbackTarget, setRollbackTarget] = useState<ImportBatch | null>(null);
  const [commitResult, setCommitResult] = useState<CommitResult | null>(null);
  const [nonProductNames, setNonProductNames] = useState<string[]>([]);
  const [selectedSuggestions, setSelectedSuggestions] = useState<Record<string, string>>({});
  const [searchModalIssue, setSearchModalIssue] = useState<ImportIssue | null>(null);
  const [searchQuery, setSearchQuery] = useState("");

  const filteredStoreProducts = useMemo(() => {
    if (!searchQuery.trim()) return storeProducts.slice(0, 30);
    const q = searchQuery.toLowerCase().trim();
    return storeProducts
      .filter(
        (p) =>
          p.name.toLowerCase().includes(q) ||
          (p.category && p.category.toLowerCase().includes(q)) ||
          (p.sku && p.sku.toLowerCase().includes(q))
      )
      .slice(0, 40);
  }, [searchQuery, storeProducts]);

  function openProductSearch(issue: ImportIssue) {
    setSearchModalIssue(issue);
    setSearchQuery(issue.productName || "");
  }

  const errorsByDate = useMemo(() => {
    if (!preview || !preview.errors.length) return [];
    const map = new Map<string, ImportIssue[]>();
    for (const issue of preview.errors) {
      const rawDate = String(issue.rowData?.Tanggal ?? "").trim() || "Lainnya";
      const current = map.get(rawDate) ?? [];
      current.push(issue);
      map.set(rawDate, current);
    }
    return [...map.entries()].map(([dateKey, issues]) => ({
      dateKey,
      formattedDate:
        dateKey !== "Lainnya"
          ? formatDate(dateKey)
          : "Tanggal Tidak Diketahui",
      issues,
    }));
  }, [preview]);

  const distinctIssuesWithSuggestions = useMemo(() => {
    if (!preview) return 0;
    const set = new Set<string>();
    for (const issue of preview.errors) {
      if (issue.code === "PRODUK_TIDAK_DITEMUKAN" && issue.productName && issue.suggestions?.length) {
        set.add(issue.productName);
      }
    }
    return set.size;
  }, [preview]);

  const selectedCount = useMemo(() => {
    return Object.values(selectedSuggestions).filter(Boolean).length;
  }, [selectedSuggestions]);

  async function loadHistory() {
    try {
      const result = await readJson<{ batches: ImportBatch[] }>("/api/transactions/import", { cache: "no-store" });
      setBatches(result.batches);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Gagal memuat riwayat impor.");
    }
  }

  useEffect(() => {
    void loadHistory();
  }, []);

  useEffect(() => {
    if (!preview) return;
    const frame = window.requestAnimationFrame(() => {
      previewRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
    });
    return () => window.cancelAnimationFrame(frame);
  }, [preview]);

  function selectFile(nextFile: File | null) {
    if (!nextFile) return;
    const lowerName = nextFile.name.toLocaleLowerCase();
    if (!lowerName.endsWith(".xlsx") && !lowerName.endsWith(".xls") && !lowerName.endsWith(".csv")) {
      toast.error("Gunakan file Excel (.xlsx) atau CSV.");
      return;
    }
    setFile(nextFile);
    setPreview(null);
    setCommitResult(null);
    setWarningsAcknowledged(false);
    setNonProductNames([]);
    setSelectedSuggestions({});
  }

  function onFileInput(event: ChangeEvent<HTMLInputElement>) {
    selectFile(event.target.files?.[0] ?? null);
  }

  function onDrop(event: DragEvent<HTMLButtonElement>) {
    event.preventDefault();
    selectFile(event.dataTransfer.files?.[0] ?? null);
  }

  async function downloadTemplate() {
    const XLSX = await import("xlsx");
    const worksheet = XLSX.utils.aoa_to_sheet([[...templateColumns]]);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, "Transaksi");
    XLSX.writeFile(workbook, "template-impor-transaksi.xlsx");
  }

  async function previewFile(names = nonProductNames) {
    if (!file) {
      toast.error("Pilih file transaksi terlebih dahulu.");
      return;
    }
    setIsPreviewing(true);
    try {
      const form = new FormData();
      form.append("file", file);
      form.append("createHistoricalShifts", String(createHistoricalShifts));
      form.append("nonProductNames", JSON.stringify(names));
      const result = await readJson<ImportPreview>("/api/transactions/import/preview", { method: "POST", body: form });
      setPreview(result);
      setWarningsAcknowledged(false);
      setCommitResult(null);
      if (result.errors.length > 0) {
        toast.error("Pratinjau menemukan baris yang harus diperbaiki.");
      } else {
        toast.success("Pratinjau impor siap diperiksa.");
      }
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Gagal membaca file impor.");
    } finally {
      setIsPreviewing(false);
    }
  }

  const canContinue = preview
    ? canContinueTransactionImport(preview.errors.length, preview.warnings.length, warningsAcknowledged)
    : false;

  async function commitImport() {
    if (!file || !preview || !canContinue) return;
    setIsCommitting(true);
    try {
      const form = new FormData();
      form.append("file", file);
      form.append("createHistoricalShifts", String(createHistoricalShifts));
      form.append("nonProductNames", JSON.stringify(nonProductNames));
      const result = await readJson<CommitResult>("/api/transactions/import/commit", { method: "POST", body: form });
      setCommitResult(result);
      setConfirmCommitOpen(false);
      await loadHistory();
      toast.success("Impor transaksi berhasil disimpan.");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Gagal menyimpan impor transaksi.");
    } finally {
      setIsCommitting(false);
    }
  }

  async function rollbackImport() {
    if (!rollbackTarget) return;
    setIsRollingBack(true);
    try {
      await readJson("/api/transactions/import/rollback", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ batchId: rollbackTarget.id }),
      });
      setRollbackTarget(null);
      await loadHistory();
      toast.success("Impor dibatalkan. Transaksi dihapus dan stok dikembalikan.");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Gagal membatalkan impor transaksi.");
    } finally {
      setIsRollingBack(false);
    }
  }

  function resetImport() {
    setFile(null);
    setPreview(null);
    setCommitResult(null);
    setWarningsAcknowledged(false);
    setCreateHistoricalShifts(false);
    setNonProductNames([]);
    setSelectedSuggestions({});
    if (fileInputRef.current) fileInputRef.current.value = "";
  }

  const [isApplyingSelections, setIsApplyingSelections] = useState(false);

  function selectProduct(productName: string, productId: string) {
    if (!productName || !productId) return;
    setSelectedSuggestions((curr) => ({
      ...curr,
      [productName]: productId,
    }));
  }

  function unselectProduct(productName: string) {
    setSelectedSuggestions((curr) => {
      const copy = { ...curr };
      delete copy[productName];
      return copy;
    });
  }

  function autoSelectAllTopSuggestions() {
    if (!preview) return;
    const next: Record<string, string> = { ...selectedSuggestions };
    let count = 0;
    for (const issue of preview.errors) {
      if (issue.code === "PRODUK_TIDAK_DITEMUKAN" && issue.productName && !next[issue.productName]) {
        const top = issue.suggestions?.[0];
        if (top) {
          next[issue.productName] = top.id;
          count += 1;
        }
      }
    }
    setSelectedSuggestions(next);
    if (count > 0) {
      toast.success(`${count} produk otomatis dipilihkan rekomendasi teratas. Periksa dan klik 'Terapkan Semua Pilihan' jika sudah sesuai.`);
    } else {
      toast.info("Semua baris dengan rekomendasi sudah terpilih.");
    }
  }

  async function applySingleMapping(productName: string) {
    const productId = selectedSuggestions[productName];
    if (!productName || !productId) return;
    try {
      await readJson("/api/transactions/import/aliases", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ alias: productName, productId }),
      });
      unselectProduct(productName);
      toast.success(`Pemetaan "${productName}" berhasil disimpan.`);
      await previewFile();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Gagal menyimpan pemetaan produk.");
    }
  }

  async function applyAllSelectedMappings() {
    const entries = Object.entries(selectedSuggestions).filter(([_, id]) => Boolean(id));
    if (entries.length === 0) {
      toast.info("Belum ada produk yang dipilih.");
      return;
    }

    setIsApplyingSelections(true);
    try {
      for (const [alias, productId] of entries) {
        await readJson("/api/transactions/import/aliases", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ alias, productId }),
        });
      }
      setSelectedSuggestions({});
      toast.success(`${entries.length} pemetaan produk berhasil disimpan!`);
      await previewFile();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Gagal menyimpan pemetaan.");
    } finally {
      setIsApplyingSelections(false);
    }
  }

  async function saveMapping(issue: ImportIssue) {
    if (!issue.productName) return;
    await applySingleMapping(issue.productName);
  }

  async function markNotProduct(issue: ImportIssue) {
    if (!issue.productName) return;
    const next = [...new Set([...nonProductNames, issue.productName])];
    setNonProductNames(next);
    await previewFile(next);
  }

  function downloadUnknownNames() {
    if (!preview) return;
    const grouped = new Map<string, { count: number; total: number }>();
    for (const issue of preview.errors) {
      if (issue.code !== "PRODUK_TIDAK_DITEMUKAN" || !issue.productName) continue;
      const current = grouped.get(issue.productName) ?? { count: 0, total: 0 };
      const raw = String(issue.rowData?.Subtotal ?? "").replace(/[Rp\s.]/g, "").replace(",", ".");
      current.count += 1;
      current.total += Number(raw) || 0;
      grouped.set(issue.productName, current);
    }
    const escape = (value: string | number) => `"${String(value).replaceAll('"', '""')}"`;
    const csv = ["Nama Produk,Jumlah Kemunculan,Total Nilai", ...[...grouped.entries()].sort((a, b) => b[1].total - a[1].total).map(([name, value]) => [name, value.count, value.total].map(escape).join(","))].join("\n");
    const url = URL.createObjectURL(new Blob([csv], { type: "text/csv;charset=utf-8" }));
    const link = document.createElement("a"); link.href = url; link.download = "nama-produk-tidak-dikenal.csv"; link.click(); URL.revokeObjectURL(url);
  }

  function scrollToPreview() {
    previewRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
  }

  return (
    <div className="space-y-6">
      <Card className="border-border/60 bg-card/74">
        <CardHeader>
          <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
            <div>
              <CardTitle className="flex items-center gap-2 font-heading text-2xl"><FileSpreadsheet className="size-5 text-primary" /> Impor transaksi mundur</CardTitle>
              <CardDescription className="mt-1">Unggah rekap penjualan lama. Sistem akan mencatat tanggal kejadian sesuai file dan memperbarui stok.</CardDescription>
            </div>
            <Button type="button" variant="outline" onClick={() => void downloadTemplate()}>
              <Download className="size-4" /> Unduh template XLSX
            </Button>
          </div>
        </CardHeader>
        <CardContent className="pt-0">
          <label className="flex items-start gap-3 rounded-xl border border-border/70 bg-muted/25 p-3 text-sm">
            <input type="checkbox" checked={createHistoricalShifts} onChange={(event) => setCreateHistoricalShifts(event.target.checked)} className="mt-1" />
            <span><span className="font-medium">Buat shift otomatis dari kolom Catatan</span><br /><span className="text-muted-foreground">Membuat shift historis tertutup untuk setiap tanggal + prefiks “Shift X”. Tanpa sheet “Kas &amp; Tabungan”, shift ditandai perlu ditinjau.</span></span>
          </label>
        </CardContent>
        <CardContent className="space-y-5">
          <div className="space-y-2">
            <Label>Langkah 1 — Unggah file</Label>
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              onDragOver={(event) => event.preventDefault()}
              onDrop={onDrop}
              className="flex min-h-36 w-full flex-col items-center justify-center gap-2 rounded-2xl border border-dashed border-primary/40 bg-primary/5 px-5 text-center transition hover:bg-primary/10"
            >
              <UploadCloud className="size-7 text-primary" />
              <span className="font-medium">Seret file Excel/CSV ke sini atau pilih berkas</span>
              <span className="text-xs text-muted-foreground">Kolom wajib: {templateColumns.join(" · ")}</span>
            </button>
            <input ref={fileInputRef} type="file" accept=".xlsx,.xls,.csv" onChange={onFileInput} className="hidden" />
            {file ? <p className="text-sm text-muted-foreground">File dipilih: <span className="font-medium text-foreground">{file.name}</span></p> : null}
          </div>

          <div className="flex flex-wrap gap-2">
            <Button type="button" onClick={() => void previewFile()} disabled={!file || isPreviewing}>
              {isPreviewing ? <Loader2 className="size-4 animate-spin" /> : <FileSpreadsheet className="size-4" />}
              Buat pratinjau
            </Button>
            {preview ? <Button type="button" variant="outline" onClick={scrollToPreview}>Lihat pratinjau</Button> : null}
            {(preview || commitResult) ? <Button type="button" variant="ghost" onClick={resetImport}>Pilih file lain</Button> : null}
          </div>
        </CardContent>
      </Card>

      {preview ? (
        <div ref={previewRef} id="import-preview" className="scroll-mt-4">
        <Card className="border-border/60 bg-card/74">
          <CardHeader>
            <CardTitle className="font-heading text-xl">Langkah 2 — Pratinjau</CardTitle>
            <CardDescription>Periksa ringkasan, baris bermasalah, dan isi setiap nota sebelum disimpan.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-5">
            <div className="sticky top-3 z-20 rounded-2xl border border-primary/45 bg-card/95 p-3 shadow-lg backdrop-blur">
              <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                <div><p className="text-sm font-semibold">Pratinjau aktif</p><p className="text-xs text-muted-foreground">Terbaca {preview.source.rowCount.toLocaleString("id-ID")} baris · Siap impor {preview.itemCount.toLocaleString("id-ID")} baris</p></div>
                <div className="flex items-center gap-2"><span className={preview.errorRowCount > 0 ? "text-sm font-semibold text-destructive" : "text-sm font-semibold text-emerald-600"}>{preview.errorRowCount > 0 ? `${preview.errorRowCount.toLocaleString("id-ID")} perlu diperbaiki` : "Siap disimpan"}</span><Button type="button" size="sm" variant="outline" onClick={scrollToPreview}>Ke ringkasan</Button></div>
              </div>
            </div>
            <div className="grid gap-3 sm:grid-cols-2">
              <div className="rounded-xl border border-border/60 bg-muted/35 p-3">
                <p className="text-xs text-muted-foreground">Terbaca dari file</p>
                <p className="mt-1 font-semibold">{preview.source.rowCount.toLocaleString("id-ID")} baris / {formatCurrency(preview.source.totalAmount)}</p>
                <p className="text-xs text-muted-foreground">{preview.source.invoiceCount.toLocaleString("id-ID")} nota terdeteksi</p>
              </div>
              <div className="rounded-xl border border-primary/40 bg-primary/5 p-3">
                <p className="text-xs text-muted-foreground">Siap impor</p>
                <p className="mt-1 font-semibold">{preview.itemCount.toLocaleString("id-ID")} baris / {formatCurrency(preview.totalAmount)}</p>
                <p className="text-xs text-muted-foreground">{preview.invoiceCount.toLocaleString("id-ID")} nota valid</p>
              </div>
            </div>
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
              {[
                ["Jumlah nota", `${preview.invoiceCount} nota`],
                ["Jumlah item", `${preview.itemCount} item`],
                ["Total nilai", formatCurrency(preview.totalAmount)],
                ["Rentang tanggal", dateRangeLabel(preview.dateRange)],
              ].map(([label, value]) => (
                <div key={label} className="rounded-xl border border-border/60 bg-muted/35 p-3">
                  <p className="text-xs text-muted-foreground">{label}</p><p className="mt-1 font-semibold">{value}</p>
                </div>
              ))}
            </div>

            {preview.byDate.length > 0 ? <div className="rounded-2xl border border-border/60 p-4"><h3 className="font-semibold">Ringkasan per tanggal</h3><Table className="mt-2"><TableHeader><TableRow><TableHead>Tanggal</TableHead><TableHead>Nota</TableHead><TableHead>Baris</TableHead><TableHead>Penyesuaian</TableHead><TableHead className="text-right">Total</TableHead></TableRow></TableHeader><TableBody>{preview.byDate.map((day) => <TableRow key={day.date}><TableCell>{formatDate(day.date)}</TableCell><TableCell>{day.invoiceCount}</TableCell><TableCell>{day.rowCount}</TableCell><TableCell>{day.adjustmentCount}</TableCell><TableCell className="text-right">{formatCurrency(day.totalAmount)}</TableCell></TableRow>)}</TableBody></Table></div> : null}

            {preview.errors.length > 0 ? (
              <div className="rounded-2xl border border-destructive/40 bg-destructive/10 p-4 sm:p-5 space-y-4">
                <div className="flex flex-wrap items-center justify-between gap-3 text-destructive pb-3 border-b border-destructive/20">
                  <div className="flex items-center gap-2.5">
                    <AlertTriangle className="size-5 shrink-0" />
                    <div>
                      <p className="font-semibold text-base">
                        {preview.errorRowCount} baris harus diperbaiki sebelum impor
                      </p>
                      <p className="text-xs opacity-85">
                        Pilih produk yang sesuai pada baris di bawah, lalu terapkan semua sekaligus.
                      </p>
                    </div>
                  </div>
                  <div className="flex flex-wrap items-center gap-2">
                    {selectedCount > 0 ? (
                      <Button
                        type="button"
                        size="sm"
                        className="h-8.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-semibold shadow-sm gap-1.5 animate-in fade-in"
                        disabled={isApplyingSelections}
                        onClick={() => void applyAllSelectedMappings()}
                      >
                        {isApplyingSelections ? (
                          <Loader2 className="size-3.5 animate-spin" />
                        ) : (
                          <CheckCircle2 className="size-3.5" />
                        )}
                        Terapkan Semua Pilihan ({selectedCount} Produk)
                      </Button>
                    ) : null}

                    {distinctIssuesWithSuggestions > 0 ? (
                      <Button
                        type="button"
                        size="sm"
                        variant="outline"
                        className="h-8.5 rounded-xl bg-card border-primary/40 text-primary hover:bg-primary/10 gap-1.5 font-medium"
                        onClick={autoSelectAllTopSuggestions}
                        title="Pilih otomatis rekomendasi teratas untuk seluruh baris yang memiliki saran"
                      >
                        <Sparkles className="size-3.5" />
                        Pilihkan Semua Rekomendasi
                      </Button>
                    ) : null}

                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      className="h-8.5 rounded-xl bg-card border-destructive/40 text-destructive hover:bg-destructive hover:text-white"
                      onClick={downloadUnknownNames}
                    >
                      <Download className="size-3.5 mr-1" />
                      Unduh CSV
                    </Button>
                  </div>
                </div>

                {errorsByDate.map((dateGroup, groupIdx) => (
                  <div
                    key={dateGroup.dateKey}
                    className={cn(
                      "space-y-3",
                      groupIdx > 0 && "pt-5 mt-5 border-t border-destructive/25"
                    )}
                  >
                    {/* Header Tanggal Pemisah */}
                    <div className="flex flex-wrap items-center justify-between gap-2 rounded-xl bg-destructive/15 px-3.5 py-2 text-destructive border border-destructive/30 shadow-xs">
                      <div className="flex items-center gap-2 font-semibold text-sm">
                        <CalendarDays className="size-4 shrink-0 text-destructive" />
                        <span>Tanggal Transaksi: {dateGroup.formattedDate}</span>
                      </div>
                      <Badge variant="outline" className="text-xs bg-background/50 border-destructive/30">
                        {dateGroup.issues.length} baris
                      </Badge>
                    </div>

                    <div className="overflow-x-auto rounded-2xl border border-destructive/30 bg-card shadow-xs">
                      <Table>
                        <TableHeader>
                          <TableRow className="border-destructive/20 hover:bg-transparent">
                            <TableHead className="w-14 text-center">Baris</TableHead>
                            <TableHead className="w-44">Nota &amp; Metode</TableHead>
                            <TableHead className="min-w-[200px]">Data Barang di File</TableHead>
                            <TableHead className="min-w-[170px]">Masalah / Kendala</TableHead>
                            <TableHead className="min-w-[320px]">Aksi Pemetaan Produk</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {dateGroup.issues.map((issue) => {
                            const rawNote = String(issue.rowData?.Catatan ?? "").trim();
                            const rawShift = String(issue.rowData?.Shift ?? "").trim();
                            const isSelected = Boolean(issue.productName && selectedSuggestions[issue.productName]);
                            const selectedProductId = issue.productName ? selectedSuggestions[issue.productName] : undefined;
                            const selectedProductName = selectedProductId
                              ? storeProducts.find((p) => p.id === selectedProductId)?.name ||
                                issue.suggestions?.find((s) => s.id === selectedProductId)?.name ||
                                "Produk dipilih"
                              : "";

                            return (
                              <TableRow
                                key={`${issue.row}-${issue.code}-${issue.productName ?? ""}`}
                                className={cn(
                                  "border-destructive/15 transition-colors",
                                  isSelected
                                    ? "bg-emerald-500/10 hover:bg-emerald-500/15"
                                    : "hover:bg-destructive/5"
                                )}
                              >
                                {/* 1. Nomor Baris */}
                                <TableCell className="text-center font-mono text-xs font-semibold text-muted-foreground align-top pt-3">
                                  #{issue.row}
                                </TableCell>

                                {/* 2. No Nota & Metode Bayar */}
                                <TableCell className="align-top pt-3">
                                  <div className="space-y-1">
                                    <p className="font-mono text-xs font-semibold text-foreground">
                                      {String(issue.rowData?.["No Nota"] ?? "-")}
                                    </p>
                                    <Badge
                                      variant="secondary"
                                      className="text-[10px] px-2 py-0 font-medium capitalize"
                                    >
                                      {String(issue.rowData?.["Metode Bayar"] ?? "Tunai")}
                                    </Badge>
                                  </div>
                                </TableCell>

                                {/* 3. Detail Data Barang di File */}
                                <TableCell className="align-top pt-3 space-y-1">
                                  <p className="font-semibold text-sm text-foreground">
                                    {String(issue.rowData?.["Nama Produk"] ?? issue.productName ?? "-")}
                                  </p>
                                  <div className="flex flex-wrap items-center gap-x-2 text-xs text-muted-foreground">
                                    <span>{String(issue.rowData?.Jumlah ?? 1)} pcs</span>
                                    <span>×</span>
                                    <span>{formatCurrency(Number(issue.rowData?.["Harga Jual"]) || 0)}</span>
                                    <span>=</span>
                                    <span className="font-semibold text-foreground">
                                      {formatCurrency(Number(issue.rowData?.Subtotal) || 0)}
                                    </span>
                                  </div>
                                  {rawShift && (
                                    <p className="text-[11px] text-muted-foreground/80">
                                      Shift: {rawShift}
                                    </p>
                                  )}
                                  {rawNote && (
                                    <p
                                      className="text-xs text-muted-foreground/90 italic line-clamp-2 max-w-xs pt-0.5"
                                      title={rawNote}
                                    >
                                      📝 {rawNote}
                                    </p>
                                  )}
                                </TableCell>

                                {/* 4. Kendala */}
                                <TableCell className="align-top pt-3">
                                  <span className="text-xs font-semibold text-destructive leading-tight block">
                                    {importIssueLabel[issue.code] || issue.message}
                                  </span>
                                </TableCell>

                                {/* 5. Aksi Pemetaan Produk */}
                                <TableCell className="align-top pt-3">
                                  {issue.code === "PRODUK_TIDAK_DITEMUKAN" && issue.productName ? (
                                    <div className="flex flex-col gap-2 min-w-[300px]">
                                      {/* Tampilkan produk yang sedang dipilih */}
                                      {isSelected ? (
                                        <div className="flex items-center justify-between gap-2 rounded-xl bg-emerald-500/15 border border-emerald-500/40 px-3 py-1.5 text-xs shadow-2xs animate-in fade-in">
                                          <div className="flex items-center gap-1.5 overflow-hidden">
                                            <span className="font-bold text-emerald-700 dark:text-emerald-400 shrink-0">
                                              Pilihan:
                                            </span>
                                            <span
                                              className="font-semibold text-foreground truncate"
                                              title={selectedProductName}
                                            >
                                              {selectedProductName}
                                            </span>
                                          </div>
                                          <button
                                            type="button"
                                            onClick={() => unselectProduct(issue.productName!)}
                                            className="text-muted-foreground hover:text-destructive p-0.5 rounded cursor-pointer transition-colors"
                                            title="Batal pilihan ini"
                                          >
                                            <X className="size-3.5" />
                                          </button>
                                        </div>
                                      ) : null}

                                      {/* Quick Suggestion Badges */}
                                      {issue.suggestions && issue.suggestions.length > 0 ? (
                                        <div className="flex flex-wrap items-center gap-1.5">
                                          <span className="text-[11px] font-medium text-muted-foreground">
                                            Rekomendasi:
                                          </span>
                                          {issue.suggestions.slice(0, 3).map((sug) => {
                                            const isThisActive = selectedProductId === sug.id;
                                            return (
                                              <button
                                                key={`quick-${sug.id}`}
                                                type="button"
                                                onClick={() => selectProduct(issue.productName!, sug.id)}
                                                className={cn(
                                                  "inline-flex items-center gap-1 rounded-lg px-2.5 py-1 text-xs font-semibold transition-all cursor-pointer shadow-2xs",
                                                  isThisActive
                                                    ? "bg-emerald-600 text-white border border-emerald-600 shadow-sm"
                                                    : "bg-amber-500/15 border border-amber-500/40 text-amber-900 dark:text-amber-200 hover:bg-amber-500/25 hover:border-amber-500/70"
                                                )}
                                                title={`Pilih "${sug.name}"`}
                                              >
                                                <span>⭐ {sug.name}</span>
                                              </button>
                                            );
                                          })}
                                        </div>
                                      ) : null}

                                      {/* Dropdown Rekomendasi Terdekat + Tombol Cari Manual + Tombol Terapkan */}
                                      <div className="flex items-center gap-1.5">
                                        {issue.suggestions && issue.suggestions.length > 0 ? (
                                          <select
                                            aria-label={`Rekomendasi untuk ${issue.productName}`}
                                            className="h-9 flex-1 rounded-xl border border-border/80 bg-background px-2.5 text-xs font-medium focus:ring-2 focus:ring-primary shadow-xs cursor-pointer"
                                            value={selectedProductId ?? ""}
                                            onChange={(event) => {
                                              if (event.target.value) {
                                                selectProduct(issue.productName!, event.target.value);
                                              } else {
                                                unselectProduct(issue.productName!);
                                              }
                                            }}
                                          >
                                            <option value="">-- Pilih rekomendasi ({issue.suggestions.length}) --</option>
                                            {issue.suggestions.map((suggestion) => (
                                              <option key={`sug-${suggestion.id}`} value={suggestion.id}>
                                                ⭐ {suggestion.name}
                                              </option>
                                            ))}
                                          </select>
                                        ) : null}

                                        <Button
                                          type="button"
                                          size="sm"
                                          variant="outline"
                                          className="h-9 rounded-xl text-xs gap-1 shrink-0 font-medium hover:bg-primary/10 hover:text-primary border-border"
                                          onClick={() => openProductSearch(issue)}
                                        >
                                          <Search className="size-3.5" />
                                          Cari Manual
                                        </Button>

                                        {isSelected ? (
                                          <Button
                                            type="button"
                                            size="sm"
                                            className="h-9 rounded-xl text-xs font-semibold bg-primary hover:bg-primary/90 shrink-0"
                                            onClick={() => void applySingleMapping(issue.productName!)}
                                            title={`Terapkan pemetaan untuk semua baris "${issue.productName}" sekarang`}
                                          >
                                            Terapkan
                                          </Button>
                                        ) : null}

                                        <Button
                                          type="button"
                                          size="sm"
                                          variant="ghost"
                                          className="h-9 rounded-xl text-xs text-muted-foreground hover:text-destructive hover:bg-destructive/10 shrink-0"
                                          onClick={() => void markNotProduct(issue)}
                                          title="Abaikan baris ini jika bukan barang toko (pengeluaran kas/operasional)"
                                        >
                                          Bukan produk
                                        </Button>
                                      </div>
                                    </div>
                                  ) : (
                                    <span className="text-xs text-muted-foreground">-</span>
                                  )}
                                </TableCell>
                              </TableRow>
                            );
                          })}
                        </TableBody>
                      </Table>
                    </div>
                  </div>
                ))}
              </div>
            ) : null}

            {preview.excludedNames.length > 0 ? <div className="rounded-2xl border border-sky-500/40 bg-sky-500/10 p-4 text-sm"><p className="font-semibold">Baris bukan produk dikeluarkan dari transaksi</p><p className="mt-1 text-muted-foreground">Baris ini dapat ditinjau dan dicatat sebagai pengeluaran terpisah.</p><ul className="mt-2 space-y-1">{preview.excludedNames.map((item) => <li key={item.name}>{item.name}: {item.rowCount} baris / {formatCurrency(item.totalAmount)}</li>)}</ul></div> : null}

            {preview.warnings.length > 0 ? (
              <div className="rounded-2xl border border-amber-500/50 bg-amber-500/10 p-4">
                <div className="flex items-center gap-2 text-amber-900 dark:text-amber-200"><AlertTriangle className="size-5" /><p className="font-semibold">{preview.warnings.length} peringatan perlu diperiksa</p></div>
                <div className="mt-3 space-y-2 text-sm">{preview.warningGroups.map((group) => <details key={`${group.code}-${group.productId ?? group.productName}`} className="rounded-lg border border-amber-500/25 px-3 py-2"><summary className="cursor-pointer font-medium">{group.productName}: {group.count} baris {importIssueLabel[group.code].toLocaleLowerCase()} {group.code === "MARGIN_MINUS" && group.productId ? <a href={`/inventaris?productId=${group.productId}`} className="ml-2 underline" onClick={(event) => event.stopPropagation()}>Buka Inventaris</a> : null}</summary><ul className="mt-2 space-y-1 text-muted-foreground">{group.issues.map((issue, index) => <li key={`${issue.row}-${index}`}>{issue.row ? `Baris ${issue.row}: ` : ""}{issue.message}</li>)}</ul></details>)}</div>
                <label className="mt-4 flex cursor-pointer items-start gap-2 text-sm font-medium">
                  <input type="checkbox" checked={warningsAcknowledged} onChange={(event) => setWarningsAcknowledged(event.target.checked)} className="mt-0.5 size-4 accent-primary" />
                  Saya sudah memeriksa peringatan di atas.
                </label>
              </div>
            ) : null}

            <div className="space-y-3">
              <h3 className="font-semibold">Daftar nota</h3>
              {preview.invoices.length === 0 ? <p className="text-sm text-muted-foreground">Belum ada nota valid untuk ditampilkan.</p> : preview.invoices.map((invoice) => (
                <div key={invoice.externalRef} className="rounded-xl border border-border/60 p-3">
                  <div className="flex flex-wrap items-center justify-between gap-2"><div><p className="font-semibold">Nota {invoice.note}</p><p className="text-xs text-muted-foreground">{formatDate(invoice.occurredAt)} · {invoice.paymentMethod}</p></div><p className="font-semibold">{formatCurrency(invoice.total)}</p></div>
                  <ul className="mt-2 space-y-1 text-sm text-muted-foreground">{invoice.items.map((item) => <li key={`${invoice.externalRef}-${item.row}`}>{item.productName} × {item.quantity} — {formatCurrency(item.unitPrice * item.quantity)}</li>)}</ul>
                </div>
              ))}
            </div>

            <Button type="button" onClick={() => setConfirmCommitOpen(true)} disabled={!canContinue || Boolean(commitResult)}>
              {preview.errorRowCount > 0 ? `Perbaiki ${preview.errorRowCount.toLocaleString("id-ID")} baris dulu` : `Simpan ${preview.invoiceCount} nota`}
            </Button>
            {!canContinue ? <p className="text-sm text-muted-foreground">{preview.errorRowCount > 0 ? "Impor bersifat semua-atau-tidak: tidak ada nota yang dapat disimpan sebelum seluruh error diperbaiki." : "Centang konfirmasi peringatan sebelum melanjutkan."}</p> : null}
          </CardContent>
        </Card>
        </div>
      ) : null}

      {commitResult && preview ? (
        <Card className="border-emerald-500/40 bg-emerald-500/10">
          <CardContent className="flex flex-col gap-2 p-5 sm:flex-row sm:items-center"><CheckCircle2 className="size-7 text-emerald-700 dark:text-emerald-300" /><div><p className="font-semibold">Impor berhasil disimpan</p><p className="text-sm">{commitResult.createdInvoices} nota masuk, {commitResult.skippedInvoices} dilewati karena sudah pernah diimpor. Batch: <span className="font-mono">{commitResult.batchId}</span></p></div></CardContent>
        </Card>
      ) : null}

      <Card className="border-border/60 bg-card/74">
        <CardHeader><CardTitle className="font-heading text-xl">Riwayat impor</CardTitle><CardDescription>Batch yang sudah dibatalkan tetap dicatat sebagai jejak audit.</CardDescription></CardHeader>
        <CardContent className="overflow-x-auto">
          <Table className="min-w-[780px]">
            <TableHeader><TableRow><TableHead>Tanggal impor</TableHead><TableHead>Nama file</TableHead><TableHead>Nota</TableHead><TableHead>Total nilai</TableHead><TableHead>Diimpor oleh</TableHead><TableHead className="text-right">Aksi</TableHead></TableRow></TableHeader>
            <TableBody>{batches.length === 0 ? <TableRow><TableCell colSpan={6} className="h-24 text-center text-muted-foreground">Belum ada riwayat impor transaksi.</TableCell></TableRow> : batches.map((batch) => <TableRow key={batch.id}><TableCell>{formatDateTime(batch.createdAt)}</TableCell><TableCell className="font-medium">{batch.fileName}</TableCell><TableCell>{batch.invoiceCount} nota / {batch.itemCount} item</TableCell><TableCell>{formatCurrency(batch.totalAmount)}</TableCell><TableCell>{batch.importedByName}</TableCell><TableCell className="text-right">{batch.rolledBackAt ? <span className="text-sm text-muted-foreground">Dibatalkan</span> : <Button size="sm" variant="outline" onClick={() => setRollbackTarget(batch)}><RotateCcw className="size-3.5" /> Batalkan impor</Button>}</TableCell></TableRow>)}</TableBody>
          </Table>
        </CardContent>
      </Card>

      <Dialog open={confirmCommitOpen} onOpenChange={setConfirmCommitOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>Konfirmasi impor transaksi</DialogTitle><DialogDescription>Pastikan ringkasan ini sesuai buku penjualan sebelum transaksi ditulis ke database.</DialogDescription></DialogHeader>
          {preview ? <div className="rounded-xl bg-muted/50 p-4 text-sm"><p>{preview.invoiceCount} nota · {preview.itemCount} item</p><p className="mt-1 font-semibold">{formatCurrency(preview.totalAmount)}</p><p className="mt-1 text-muted-foreground">{dateRangeLabel(preview.dateRange)}</p></div> : null}
          <DialogFooter><Button type="button" variant="outline" onClick={() => setConfirmCommitOpen(false)}>Kembali</Button><Button type="button" onClick={() => void commitImport()} disabled={isCommitting}>{isCommitting ? <Loader2 className="size-4 animate-spin" /> : null} Konfirmasi & simpan</Button></DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={Boolean(rollbackTarget)} onOpenChange={(open) => !open && setRollbackTarget(null)}>
        <DialogContent>
          <DialogHeader><DialogTitle>Batalkan impor transaksi?</DialogTitle><DialogDescription>Transaksi dari batch <span className="font-mono">{rollbackTarget?.id}</span> akan dihapus dan stok produk dikembalikan seperti sebelum impor. Transaksi POS tidak akan disentuh.</DialogDescription></DialogHeader>
          <DialogFooter><Button type="button" variant="outline" onClick={() => setRollbackTarget(null)}>Kembali</Button><Button type="button" variant="destructive" onClick={() => void rollbackImport()} disabled={isRollingBack}>{isRollingBack ? <Loader2 className="size-4 animate-spin" /> : <RotateCcw className="size-4" />} Batalkan impor</Button></DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Dialog Pencarian Cepat Produk Master */}
      <Dialog open={Boolean(searchModalIssue)} onOpenChange={(open) => !open && setSearchModalIssue(null)}>
        <DialogContent className="sm:max-w-xl md:max-w-2xl w-full rounded-[28px] p-6 shadow-2xl">
          <DialogHeader>
            <DialogTitle className="font-heading text-xl flex items-center gap-2">
              <Search className="size-5 text-primary" />
              Cari Produk Master untuk &quot;{searchModalIssue?.productName}&quot;
            </DialogTitle>
            <DialogDescription>
              Ketik nama barang, SKU, atau kategori untuk memilih produk yang tepat di katalog toko.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 pt-2">
            <div className="relative">
              <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 size-4 text-muted-foreground" />
              <Input
                autoFocus
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Ketik nama produk, SKU, atau kategori (contoh: Pucuk, Aqua)..."
                className="h-11 pl-10 pr-9 rounded-xl text-sm font-medium"
              />
              {searchQuery && (
                <button
                  type="button"
                  onClick={() => setSearchQuery("")}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                >
                  <X className="size-4" />
                </button>
              )}
            </div>

            <div className="max-h-[340px] overflow-y-auto space-y-1.5 pr-1">
              {filteredStoreProducts.length === 0 ? (
                <div className="text-center py-8 text-sm text-muted-foreground">
                  Tidak ada produk master yang sesuai dengan &quot;{searchQuery}&quot;.
                </div>
              ) : (
                filteredStoreProducts.map((p) => (
                  <div
                    key={p.id}
                    className="flex items-center justify-between gap-3 p-3 rounded-xl border border-border/60 bg-muted/20 hover:bg-primary/5 hover:border-primary/40 transition-colors"
                  >
                    <div className="space-y-0.5 overflow-hidden">
                      <p className="font-semibold text-sm text-foreground truncate">{p.name}</p>
                      <div className="flex items-center gap-2 text-xs text-muted-foreground">
                        {p.category && (
                          <span className="bg-muted px-1.5 py-0.5 rounded text-[11px] font-medium">
                            {p.category}
                          </span>
                        )}
                        {p.sku && <span>SKU: {p.sku}</span>}
                        <span>Stok: {p.stock}</span>
                      </div>
                    </div>
                    <div className="flex items-center gap-3 shrink-0">
                      <span className="font-bold text-sm text-foreground tabular-nums">
                        {formatCurrency(p.sellPrice)}
                      </span>
                      <Button
                        type="button"
                        size="sm"
                        className="h-8 rounded-lg text-xs font-semibold"
                        onClick={() => {
                          if (searchModalIssue?.productName) {
                            selectProduct(searchModalIssue.productName, p.id);
                            toast.info(`"${p.name}" dipilih untuk "${searchModalIssue.productName}".`);
                          }
                          setSearchModalIssue(null);
                        }}
                      >
                        Pilih Produk
                      </Button>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>

          <DialogFooter className="pt-2">
            <Button
              type="button"
              variant="outline"
              className="rounded-xl h-10"
              onClick={() => setSearchModalIssue(null)}
            >
              Tutup
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
