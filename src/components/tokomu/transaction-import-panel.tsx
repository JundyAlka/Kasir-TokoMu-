"use client";

import { type ChangeEvent, type DragEvent, useEffect, useRef, useState } from "react";
import {
  AlertTriangle,
  CheckCircle2,
  Download,
  FileSpreadsheet,
  Loader2,
  RotateCcw,
  UploadCloud,
} from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { formatCurrency, formatDate, formatDateTime } from "@/lib/format";
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
};

type ImportPreview = {
  invoiceCount: number;
  itemCount: number;
  totalAmount: number;
  dateRange: { start: string; end: string } | null;
  errors: ImportIssue[];
  warnings: ImportIssue[];
  invoices: Array<{
    note: string;
    externalRef: string;
    occurredAt: string;
    paymentMethod: string;
    total: number;
    items: Array<{ row: number; productName: string; quantity: number; unitPrice: number }>;
  }>;
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
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<ImportPreview | null>(null);
  const [batches, setBatches] = useState<ImportBatch[]>([]);
  const [isPreviewing, setIsPreviewing] = useState(false);
  const [isCommitting, setIsCommitting] = useState(false);
  const [isRollingBack, setIsRollingBack] = useState(false);
  const [warningsAcknowledged, setWarningsAcknowledged] = useState(false);
  const [confirmCommitOpen, setConfirmCommitOpen] = useState(false);
  const [rollbackTarget, setRollbackTarget] = useState<ImportBatch | null>(null);
  const [commitResult, setCommitResult] = useState<CommitResult | null>(null);

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

  async function previewFile() {
    if (!file) {
      toast.error("Pilih file transaksi terlebih dahulu.");
      return;
    }
    setIsPreviewing(true);
    try {
      const form = new FormData();
      form.append("file", file);
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
    if (fileInputRef.current) fileInputRef.current.value = "";
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
            {(preview || commitResult) ? <Button type="button" variant="ghost" onClick={resetImport}>Pilih file lain</Button> : null}
          </div>
        </CardContent>
      </Card>

      {preview ? (
        <Card className="border-border/60 bg-card/74">
          <CardHeader>
            <CardTitle className="font-heading text-xl">Langkah 2 — Pratinjau</CardTitle>
            <CardDescription>Periksa ringkasan, baris bermasalah, dan isi setiap nota sebelum disimpan.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-5">
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

            {preview.errors.length > 0 ? (
              <div className="rounded-2xl border border-destructive/40 bg-destructive/10 p-4">
                <div className="flex items-center gap-2 text-destructive"><AlertTriangle className="size-5" /><p className="font-semibold">{preview.errors.length} baris harus diperbaiki sebelum impor</p></div>
                <div className="mt-3 overflow-x-auto">
                  <Table className="min-w-[720px]">
                    <TableHeader><TableRow><TableHead>Baris</TableHead><TableHead>Isi baris</TableHead><TableHead>Masalah</TableHead></TableRow></TableHeader>
                    <TableBody>{preview.errors.map((issue, index) => <TableRow key={`${issue.row}-${issue.code}-${index}`}><TableCell>{issue.row}</TableCell><TableCell className="max-w-xl whitespace-normal text-xs">{rowValues(issue.rowData)}</TableCell><TableCell className="font-medium">{importIssueLabel[issue.code]}</TableCell></TableRow>)}</TableBody>
                  </Table>
                </div>
              </div>
            ) : null}

            {preview.warnings.length > 0 ? (
              <div className="rounded-2xl border border-amber-500/50 bg-amber-500/10 p-4">
                <div className="flex items-center gap-2 text-amber-900 dark:text-amber-200"><AlertTriangle className="size-5" /><p className="font-semibold">{preview.warnings.length} peringatan perlu diperiksa</p></div>
                <ul className="mt-3 space-y-1.5 text-sm">
                  {preview.warnings.map((issue, index) => <li key={`${issue.row}-${issue.code}-${index}`}>{issue.row ? `Baris ${issue.row}: ` : ""}{importIssueLabel[issue.code]} <span className="text-muted-foreground">{issue.message}</span></li>)}
                </ul>
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
              Simpan {preview.invoiceCount} nota
            </Button>
            {!canContinue ? <p className="text-sm text-muted-foreground">Perbaiki semua error dan, bila ada peringatan, centang konfirmasi sebelum melanjutkan.</p> : null}
          </CardContent>
        </Card>
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
    </div>
  );
}
