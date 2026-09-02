"use client";

import { useState, useMemo, useRef } from "react";
import { useRouter } from "next/navigation";
import {
  CalendarDays,
  Check,
  CheckCircle2,
  Clock,
  FileSpreadsheet,
  Loader2,
  MessageSquareQuote,
  MessageSquareText,
  Plus,
  RefreshCw,
  Sparkles,
  Trash2,
  UploadCloud,
  Users,
  Wallet,
  X,
} from "lucide-react";
import * as XLSX from "xlsx";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
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
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { formatCurrency } from "@/lib/format";
import { cn } from "@/lib/utils";

export type ParsedDebtRow = {
  id: string;
  borrowerName: string;
  amount: number;
  whatsapp: string;
  dueDate: string | null;
  createdAt: string;
  note: string;
  selected: boolean;
};

const SAMPLE_WHATSAPP_TEXT = `Mbk idah Rp.219.500
Mbk nining Rp. 41.500
Mak camut Rp. 90.500
Mbah rubinem Rp. 50.000
Mbokde lami Rp. 163.500
Alifa Rp. 30.000
Mbk sri Rp. 56.000
Lek watik Rp. 70.500
Lek andi Rp.139.500
Mbh muslim Rp. 21.000
Mak Ndut Rp.77.500
Lek par Rp. 62.500
Mbak iik Rp.345.500
Lek hartono Rp. 61.000 12.41`;

function getFutureDate(days: number) {
  const date = new Date();
  date.setDate(date.getDate() + days);
  return date.toISOString().slice(0, 10);
}

function todayDate() {
  return new Date().toISOString().slice(0, 10);
}

export function parseDebtText(input: string): ParsedDebtRow[] {
  const lines = input.split(/\r?\n/).map((l) => l.trim()).filter(Boolean);
  const rows: ParsedDebtRow[] = [];
  const defaultDueDate = getFutureDate(14);
  const defaultCreated = todayDate();

  for (const line of lines) {
    // Strip trailing whatsapp timestamp if any, e.g. " 12.41" or " 12:41"
    const cleaned = line.replace(/\s+\d{1,2}[:.]\d{2}$/, "").trim();

    // Match name and amount
    const match = /(.*?)(?:(?:\s+Rp\.?\s*|\s*[:=-]\s*|\s+))([0-9][0-9.,]*)\s*(?:$|\s*\((.*?)\)$)/i.exec(cleaned);
    if (match) {
      const rawName = match[1].replace(/^[0-9]+[\.\)\-]\s*/, "").trim();
      const rawAmount = match[2];
      const note = match[3] ? match[3].trim() : "";
      const numStr = rawAmount.replace(/[Rp\s.]/gi, "").replace(",", ".");
      const amount = Math.round(Number(numStr)) || 0;

      if (rawName && amount > 0) {
        rows.push({
          id: crypto.randomUUID(),
          borrowerName: rawName,
          amount,
          whatsapp: "",
          dueDate: defaultDueDate,
          createdAt: defaultCreated,
          note,
          selected: true,
        });
      }
    }
  }

  return rows;
}

export function DebtImportDialog({ onImportSuccess }: { onImportSuccess?: () => void }) {
  const router = useRouter();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [open, setOpen] = useState(false);
  const [activeTab, setActiveTab] = useState<"text" | "file">("text");
  const [rawText, setRawText] = useState("");
  const [parsedRows, setParsedRows] = useState<ParsedDebtRow[]>([]);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Batch control states
  const [batchDueDatePreset, setBatchDueDatePreset] = useState<string>("14");
  const [batchCustomDueDate, setBatchCustomDueDate] = useState<string>(getFutureDate(14));
  const [batchCreatedAt, setBatchCreatedAt] = useState<string>(todayDate());

  function reset() {
    setRawText("");
    setParsedRows([]);
    setBatchDueDatePreset("14");
    setBatchCustomDueDate(getFutureDate(14));
    setBatchCreatedAt(todayDate());
    if (fileInputRef.current) fileInputRef.current.value = "";
  }

  function handleOpenChange(nextOpen: boolean) {
    setOpen(nextOpen);
    if (!nextOpen && !isSubmitting) {
      reset();
    }
  }

  function handleProcessText() {
    if (!rawText.trim()) {
      toast.error("Teks catatan hutang masih kosong.");
      return;
    }
    const rows = parseDebtText(rawText);
    if (rows.length === 0) {
      toast.error("Tidak ada baris hutang yang berhasil dibaca. Pastikan format: [Nama] Rp.[Nominal]");
      return;
    }
    setParsedRows(rows);
    toast.success(`${rows.length} catatan hutang berhasil dibaca.`);
  }

  function handleLoadSample() {
    setRawText(SAMPLE_WHATSAPP_TEXT);
    const rows = parseDebtText(SAMPLE_WHATSAPP_TEXT);
    setParsedRows(rows);
    toast.info("Contoh pesan WhatsApp berhasil dimuat (14 hutang).");
  }

  async function handleFileSelect(file: File) {
    try {
      const buffer = await file.arrayBuffer();
      const wb = XLSX.read(buffer, { type: "array" });
      const sheet = wb.Sheets[wb.SheetNames[0]];
      const json = XLSX.utils.sheet_to_json<Record<string, unknown>>(sheet, { defval: "" });

      if (json.length === 0) {
        throw new Error("File tidak memiliki baris data.");
      }

      const rows: ParsedDebtRow[] = [];
      const defaultDue = getFutureDate(14);
      const defaultCreated = todayDate();

      for (const r of json) {
        const name = String(r["Nama"] || r["nama"] || r["Nama Peminjam"] || r["Peminjam"] || r["Pelanggan"] || "").trim();
        const rawAmount = String(r["Nominal"] || r["nominal"] || r["Jumlah"] || r["Hutang"] || r["Total"] || "0");
        const cleanAmount = Math.round(Number(rawAmount.replace(/[Rp\s.]/gi, "").replace(",", "."))) || 0;
        const wa = String(r["WhatsApp"] || r["whatsapp"] || r["No WA"] || r["No HP"] || "").trim();
        const note = String(r["Catatan"] || r["catatan"] || r["Keterangan"] || "").trim();
        const due = String(r["Jatuh Tempo"] || r["dueDate"] || "").trim() || defaultDue;

        if (name && cleanAmount > 0) {
          rows.push({
            id: crypto.randomUUID(),
            borrowerName: name,
            amount: cleanAmount,
            whatsapp: wa,
            dueDate: due.slice(0, 10),
            createdAt: defaultCreated,
            note,
            selected: true,
          });
        }
      }

      if (rows.length === 0) {
        throw new Error("Tidak ada baris yang memenuhi kolom Nama dan Nominal.");
      }

      setParsedRows(rows);
      toast.success(`${rows.length} data kasbon berhasil dibaca dari file.`);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Gagal membaca file.");
    }
  }

  // Select all / deselect all
  const allSelected = useMemo(
    () => parsedRows.length > 0 && parsedRows.every((r) => r.selected),
    [parsedRows]
  );
  const selectedCount = useMemo(
    () => parsedRows.filter((r) => r.selected).length,
    [parsedRows]
  );
  const totalSelectedAmount = useMemo(
    () => parsedRows.filter((r) => r.selected).reduce((sum, r) => sum + r.amount, 0),
    [parsedRows]
  );

  function toggleSelectAll() {
    const nextVal = !allSelected;
    setParsedRows((prev) => prev.map((r) => ({ ...r, selected: nextVal })));
  }

  function toggleRowSelected(id: string) {
    setParsedRows((prev) =>
      prev.map((r) => (r.id === id ? { ...r, selected: !r.selected } : r))
    );
  }

  function updateRow(id: string, patch: Partial<ParsedDebtRow>) {
    setParsedRows((prev) =>
      prev.map((r) => (r.id === id ? { ...r, ...patch } : r))
    );
  }

  function deleteRow(id: string) {
    setParsedRows((prev) => prev.filter((r) => r.id !== id));
  }

  // Batch Apply Due Date to all or all selected
  function applyBatchDueDate() {
    let nextDueDate: string | null = null;
    if (batchDueDatePreset === "none") {
      nextDueDate = null;
    } else if (batchDueDatePreset === "custom") {
      nextDueDate = batchCustomDueDate || null;
    } else {
      const days = Number(batchDueDatePreset) || 14;
      nextDueDate = getFutureDate(days);
    }

    setParsedRows((prev) =>
      prev.map((r) => (r.selected ? { ...r, dueDate: nextDueDate } : r))
    );
    toast.success(
      `Jatuh tempo diterapkan ke ${selectedCount} baris terpilih.`
    );
  }

  // Batch Apply Created Date to all selected
  function applyBatchCreatedAt() {
    if (!batchCreatedAt) return;
    setParsedRows((prev) =>
      prev.map((r) => (r.selected ? { ...r, createdAt: batchCreatedAt } : r))
    );
    toast.success(`Tanggal hutang diterapkan ke ${selectedCount} baris terpilih.`);
  }

  async function handleCommit() {
    const selectedRows = parsedRows.filter((r) => r.selected);
    if (selectedRows.length === 0) {
      toast.error("Pilih minimal 1 catatan kasbon yang ingin disimpan.");
      return;
    }

    setIsSubmitting(true);
    try {
      const payload = {
        debts: selectedRows.map((r) => ({
          borrowerName: r.borrowerName.trim(),
          amount: r.amount,
          whatsapp: r.whatsapp.trim(),
          dueDate: r.dueDate,
          createdAt: r.createdAt,
          note: r.note.trim(),
        })),
      };

      const res = await fetch("/api/debts/import", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error ?? "Gagal menyimpan daftar hutang.");
      }

      toast.success(
        `Berhasil mengimpor ${data.count} kasbon pelanggan (Total ${formatCurrency(data.totalAmount)})!`
      );
      setOpen(false);
      reset();
      if (onImportSuccess) onImportSuccess();
      router.refresh();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Gagal menyimpan kasbon.");
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogTrigger render={<Button variant="outline" className="rounded-2xl gap-2 font-medium h-11" />}>
        <MessageSquareQuote className="size-4 text-emerald-600 dark:text-emerald-400" />
        Impor Kasbon
      </DialogTrigger>

      <DialogContent className="sm:max-w-3xl md:max-w-4xl lg:max-w-5xl max-h-[92vh] flex flex-col p-6 rounded-[28px] shadow-2xl">
        <DialogHeader className="pb-3 border-b border-border/60">
          <DialogTitle className="font-heading text-2xl flex items-center gap-2.5">
            <span className="p-2 rounded-xl bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20">
              <Wallet className="size-5" />
            </span>
            Impor Kasbon / Hutang Pelanggan
          </DialogTitle>
          <DialogDescription className="text-sm text-muted-foreground">
            Salin-tempel teks WhatsApp catatan kasbon atau unggah file spreadsheet. Anda dapat mengatur jatuh tempo massal atau per pelanggan.
          </DialogDescription>
        </DialogHeader>

        <div className="flex-1 overflow-y-auto py-4 space-y-5 pr-1">
          {/* Input Section (If no rows parsed yet) */}
          {parsedRows.length === 0 ? (
            <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as "text" | "file")} className="space-y-4">
              <TabsList className="rounded-xl p-1 bg-muted/70">
                <TabsTrigger value="text" className="rounded-lg gap-2 text-xs font-semibold px-4">
                  <MessageSquareText className="size-3.5" />
                  Tempel Teks WhatsApp / Catatan
                </TabsTrigger>
                <TabsTrigger value="file" className="rounded-lg gap-2 text-xs font-semibold px-4">
                  <FileSpreadsheet className="size-3.5" />
                  Unggah Excel / CSV
                </TabsTrigger>
              </TabsList>

              <TabsContent value="text" className="space-y-3 pt-1">
                <div className="space-y-1.5">
                  <div className="flex items-center justify-between">
                    <Label className="text-xs font-semibold text-foreground">
                      Teks Catatan Kasbon (1 baris per pelanggan)
                    </Label>
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      className="h-7 text-xs rounded-lg text-primary gap-1 font-semibold hover:bg-primary/10"
                      onClick={handleLoadSample}
                    >
                      <Sparkles className="size-3 text-amber-500" />
                      Muat Contoh WhatsApp (14 Kasbon)
                    </Button>
                  </div>
                  <Textarea
                    rows={9}
                    value={rawText}
                    onChange={(e) => setRawText(e.target.value)}
                    placeholder={"Contoh:\nMbk idah Rp.219.500\nMbk nining Rp. 41.500\nMak camut Rp. 90.500\nAlifa Rp. 30.000"}
                    className="font-mono text-xs rounded-2xl p-3.5 bg-muted/20 border-border/70 focus:border-primary"
                  />
                  <p className="text-[11px] text-muted-foreground">
                    💡 Sistem otomatis memisahkan nama, mendeteksi nominal angka, dan membuang cap waktu WhatsApp (contoh: &quot;12.41&quot;).
                  </p>
                </div>

                <Button
                  type="button"
                  className="rounded-xl h-10 px-5 font-semibold text-xs bg-primary hover:bg-primary/90 text-primary-foreground gap-1.5"
                  onClick={handleProcessText}
                >
                  <Sparkles className="size-3.5" />
                  Proses &amp; Tinjau Kasbon
                </Button>
              </TabsContent>

              <TabsContent value="file" className="space-y-3 pt-1">
                <div
                  onClick={() => fileInputRef.current?.click()}
                  onDragOver={(e) => e.preventDefault()}
                  onDrop={(e) => {
                    e.preventDefault();
                    if (e.dataTransfer.files?.[0]) {
                      void handleFileSelect(e.dataTransfer.files[0]);
                    }
                  }}
                  className="border-2 border-dashed border-border/80 hover:border-emerald-500/60 bg-muted/20 hover:bg-emerald-500/5 rounded-3xl p-8 text-center transition-all cursor-pointer flex flex-col items-center justify-center gap-3"
                >
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept=".xlsx,.xls,.csv"
                    className="hidden"
                    onChange={(e) => {
                      if (e.target.files?.[0]) {
                        void handleFileSelect(e.target.files[0]);
                      }
                    }}
                  />
                  <div className="size-14 rounded-2xl bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 flex items-center justify-center shadow-xs">
                    <UploadCloud className="size-7" />
                  </div>
                  <div>
                    <p className="font-semibold text-base text-foreground">
                      Tarik file spreadsheet ke sini atau klik untuk memilih
                    </p>
                    <p className="text-xs text-muted-foreground mt-1">
                      Mendukung format (.xlsx, .xls, .csv) dengan kolom Nama dan Nominal hutang
                    </p>
                  </div>
                </div>
              </TabsContent>
            </Tabs>
          ) : (
            /* Parsed Rows View with Batch Actions and Editable Table */
            <div className="space-y-4">
              {/* Top Summary & Reset */}
              <div className="flex flex-wrap items-center justify-between gap-3 p-3.5 rounded-2xl bg-emerald-500/10 border border-emerald-500/20 text-xs">
                <div className="flex items-center gap-2 text-emerald-950 dark:text-emerald-200">
                  <CheckCircle2 className="size-4 text-emerald-600 dark:text-emerald-400 shrink-0" />
                  <span>
                    Terbaca <strong>{parsedRows.length} kasbon</strong>. Dipilih <strong>{selectedCount} pelanggan</strong> dengan total hutang:{" "}
                    <strong className="text-sm font-bold text-emerald-700 dark:text-emerald-300">
                      {formatCurrency(totalSelectedAmount)}
                    </strong>
                  </span>
                </div>
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  className="h-7 text-xs rounded-lg text-emerald-800 dark:text-emerald-200 hover:bg-emerald-500/20"
                  onClick={() => setParsedRows([])}
                >
                  <RefreshCw className="size-3 mr-1" />
                  Ganti Teks / File
                </Button>
              </div>

              {/* Bilah Aksi Massal (Batch Setter / Select All) */}
              <div className="p-3.5 rounded-2xl border border-border/80 bg-muted/30 space-y-3">
                <div className="flex flex-wrap items-center justify-between gap-2 border-b border-border/60 pb-2">
                  <span className="text-xs font-bold text-foreground flex items-center gap-1.5">
                    <Clock className="size-3.5 text-primary" />
                    Atur Kriteria Massal (Terapkan ke Semua Baris Terpilih)
                  </span>
                  <button
                    type="button"
                    onClick={toggleSelectAll}
                    className="text-xs font-semibold text-primary hover:underline cursor-pointer"
                  >
                    {allSelected ? "Batalkan Pilih Semua" : "Pilih Semua Kasbon"}
                  </button>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-3 pt-0.5">
                  {/* Batch Due Date */}
                  <div className="flex flex-wrap items-center gap-2">
                    <Label className="text-xs text-muted-foreground shrink-0">Jatuh Tempo:</Label>
                    <select
                      value={batchDueDatePreset}
                      onChange={(e) => setBatchDueDatePreset(e.target.value)}
                      className="text-xs h-8 rounded-lg bg-background border border-border px-2 font-medium cursor-pointer"
                    >
                      <option value="none">Tanpa Jatuh Tempo</option>
                      <option value="7">7 Hari Lagi</option>
                      <option value="14">14 Hari Lagi</option>
                      <option value="30">30 Hari Lagi</option>
                      <option value="custom">Pilih Tanggal...</option>
                    </select>

                    {batchDueDatePreset === "custom" && (
                      <Input
                        type="date"
                        value={batchCustomDueDate}
                        onChange={(e) => setBatchCustomDueDate(e.target.value)}
                        className="h-8 text-xs w-36 rounded-lg bg-background"
                      />
                    )}

                    <Button
                      type="button"
                      size="sm"
                      variant="secondary"
                      className="h-8 text-xs rounded-lg font-semibold"
                      onClick={applyBatchDueDate}
                      disabled={selectedCount === 0}
                    >
                      Terapkan
                    </Button>
                  </div>

                  {/* Batch Created Date */}
                  <div className="flex flex-wrap items-center gap-2 md:justify-end">
                    <Label className="text-xs text-muted-foreground shrink-0">Tanggal Kasbon:</Label>
                    <Input
                      type="date"
                      value={batchCreatedAt}
                      onChange={(e) => setBatchCreatedAt(e.target.value)}
                      className="h-8 text-xs w-36 rounded-lg bg-background"
                    />
                    <Button
                      type="button"
                      size="sm"
                      variant="secondary"
                      className="h-8 text-xs rounded-lg font-semibold"
                      onClick={applyBatchCreatedAt}
                      disabled={selectedCount === 0}
                    >
                      Terapkan
                    </Button>
                  </div>
                </div>
              </div>

              {/* Editable Table */}
              <div className="rounded-2xl border border-border/70 overflow-x-auto bg-card shadow-2xs">
                <Table>
                  <TableHeader>
                    <TableRow className="hover:bg-transparent bg-muted/40 text-xs">
                      <TableHead className="w-12 text-center">
                        <input
                          type="checkbox"
                          checked={allSelected}
                          onChange={toggleSelectAll}
                          className="size-4 rounded accent-primary cursor-pointer align-middle"
                          title="Pilih / Batalkan semua"
                        />
                      </TableHead>
                      <TableHead className="min-w-[180px]">Nama Peminjam</TableHead>
                      <TableHead className="min-w-[150px]">Nominal Hutang (Rp)</TableHead>
                      <TableHead className="min-w-[130px]">No. WhatsApp</TableHead>
                      <TableHead className="min-w-[140px]">Jatuh Tempo</TableHead>
                      <TableHead className="min-w-[140px]">Tanggal Hutang</TableHead>
                      <TableHead className="min-w-[150px]">Catatan</TableHead>
                      <TableHead className="w-12 text-center"></TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {parsedRows.map((row, idx) => (
                      <TableRow
                        key={row.id}
                        className={cn(
                          "text-xs transition-colors",
                          !row.selected && "opacity-50 bg-muted/10"
                        )}
                      >
                        {/* Checkbox */}
                        <TableCell className="text-center align-middle">
                          <input
                            type="checkbox"
                            checked={row.selected}
                            onChange={() => toggleRowSelected(row.id)}
                            className="size-4 rounded accent-primary cursor-pointer align-middle"
                          />
                        </TableCell>

                        {/* Nama */}
                        <TableCell className="align-middle">
                          <Input
                            value={row.borrowerName}
                            onChange={(e) => updateRow(row.id, { borrowerName: e.target.value })}
                            className="h-8 text-xs font-semibold rounded-lg bg-background"
                            placeholder="Nama Peminjam"
                          />
                        </TableCell>

                        {/* Nominal */}
                        <TableCell className="align-middle">
                          <Input
                            type="number"
                            value={row.amount || ""}
                            onChange={(e) =>
                              updateRow(row.id, { amount: Math.max(0, Math.round(Number(e.target.value))) })
                            }
                            className="h-8 text-xs font-bold tabular-nums rounded-lg bg-background text-emerald-600 dark:text-emerald-400"
                            placeholder="Nominal"
                          />
                        </TableCell>

                        {/* WhatsApp */}
                        <TableCell className="align-middle">
                          <Input
                            value={row.whatsapp}
                            onChange={(e) => updateRow(row.id, { whatsapp: e.target.value })}
                            className="h-8 text-xs rounded-lg bg-background"
                            placeholder="08..."
                          />
                        </TableCell>

                        {/* Jatuh Tempo */}
                        <TableCell className="align-middle">
                          <div className="flex items-center gap-1.5">
                            <Input
                              type="date"
                              value={row.dueDate || ""}
                              onChange={(e) => updateRow(row.id, { dueDate: e.target.value || null })}
                              className="h-8 text-xs rounded-lg bg-background"
                            />
                            {row.dueDate && (
                              <button
                                type="button"
                                onClick={() => updateRow(row.id, { dueDate: null })}
                                className="text-muted-foreground hover:text-destructive p-1"
                                title="Hapus jatuh tempo"
                              >
                                <X className="size-3.5" />
                              </button>
                            )}
                          </div>
                        </TableCell>

                        {/* Tanggal Kasbon */}
                        <TableCell className="align-middle">
                          <Input
                            type="date"
                            value={row.createdAt}
                            onChange={(e) => updateRow(row.id, { createdAt: e.target.value })}
                            className="h-8 text-xs rounded-lg bg-background"
                          />
                        </TableCell>

                        {/* Catatan */}
                        <TableCell className="align-middle">
                          <Input
                            value={row.note}
                            onChange={(e) => updateRow(row.id, { note: e.target.value })}
                            className="h-8 text-xs rounded-lg bg-background"
                            placeholder="Opsional"
                          />
                        </TableCell>

                        {/* Hapus */}
                        <TableCell className="text-center align-middle">
                          <Button
                            type="button"
                            variant="ghost"
                            size="icon"
                            className="h-7 w-7 text-muted-foreground hover:text-destructive rounded-lg"
                            onClick={() => deleteRow(row.id)}
                            title="Hapus baris ini"
                          >
                            <Trash2 className="size-3.5" />
                          </Button>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            </div>
          )}
        </div>

        <DialogFooter className="pt-3 border-t border-border/60 flex flex-wrap items-center justify-between gap-2">
          <Button
            type="button"
            variant="outline"
            className="rounded-xl h-10 text-xs font-semibold"
            disabled={isSubmitting}
            onClick={() => setOpen(false)}
          >
            Batal
          </Button>

          {parsedRows.length > 0 && (
            <Button
              type="button"
              className="rounded-xl h-10 text-xs font-semibold bg-emerald-600 hover:bg-emerald-700 text-white gap-2 shadow-xs"
              disabled={isSubmitting || selectedCount === 0}
              onClick={() => void handleCommit()}
            >
              {isSubmitting ? (
                <Loader2 className="size-4 animate-spin" />
              ) : (
                <CheckCircle2 className="size-4" />
              )}
              Simpan {selectedCount} Kasbon ({formatCurrency(totalSelectedAmount)})
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
