"use client";

import { useMemo, useRef, useState } from "react";
import * as XLSX from "xlsx";
import {
  AlertCircle,
  ArrowRight,
  CheckCircle2,
  Download,
  FileSpreadsheet,
  Loader2,
  UploadCloud,
} from "lucide-react";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { formatCurrency } from "@/lib/format";
import { cn } from "@/lib/utils";

export type ParsedDailyRow = {
  rowNumber: number;
  reportDate: string; // YYYY-MM-DD
  openingCash: number;
  isOpeningAutoChained?: boolean;
  revenue: number;
  cashierIncome: number;
  otherIncome: number;
  storeExpenses: { name: string; amount: number }[];
  titipanExpenses: { name: string; amount: number }[];
  totalStoreExpense: number;
  totalTitipanExpense: number;
  totalExpense: number;
  netCash: number;
  closingCash: number;
  closingCoins: number;
  closingSavings: number;
  closingTotal: number;
  variance: number;
  isBalanced: boolean;
  note: string;
};

interface DailyClosingExcelDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess: () => void;
}

function parseNumber(value: unknown): number {
  if (value === null || value === undefined) return 0;
  if (typeof value === "number") {
    return Number.isFinite(value) ? value : 0;
  }
  const str = String(value).trim();
  if (!str) return 0;
  const clean = str.replace(/[Rp\s]/gi, "").replace(/\./g, "").replace(/,/g, ".");
  const num = Number(clean);
  return Number.isFinite(num) ? num : 0;
}

function parseDateCell(value: unknown): string | null {
  if (!value) return null;
  if (value instanceof Date && !Number.isNaN(value.getTime())) {
    const y = value.getFullYear();
    const m = String(value.getMonth() + 1).padStart(2, "0");
    const d = String(value.getDate()).padStart(2, "0");
    return `${y}-${m}-${d}`;
  }
  if (typeof value === "number" && Number.isFinite(value)) {
    const parts = XLSX.SSF.parse_date_code(value);
    if (parts) {
      const m = String(parts.m).padStart(2, "0");
      const d = String(parts.d).padStart(2, "0");
      return `${parts.y}-${m}-${d}`;
    }
  }
  const s = String(value).trim();
  if (!s) return null;

  const iso = /^(\d{4})[/-](\d{1,2})[/-](\d{1,2})/.exec(s);
  if (iso) {
    const m = String(Number(iso[2])).padStart(2, "0");
    const d = String(Number(iso[3])).padStart(2, "0");
    return `${iso[1]}-${m}-${d}`;
  }

  const dmy = /^(\d{1,2})[/-](\d{1,2})[/-](\d{4})/.exec(s);
  if (dmy) {
    const d = String(Number(dmy[1])).padStart(2, "0");
    const m = String(Number(dmy[2])).padStart(2, "0");
    return `${dmy[3]}-${m}-${d}`;
  }

  return null;
}

function parseExpenseText(raw: unknown, defaultName: string): { name: string; amount: number }[] {
  if (!raw) return [];
  if (typeof raw === "number") {
    const amount = Number.isFinite(raw) ? raw : 0;
    return amount > 0 ? [{ name: defaultName, amount }] : [];
  }
  const str = String(raw).trim();
  if (!str) return [];

  const directNum = parseNumber(str);
  if (directNum > 0 && !str.includes(":") && !str.includes(";") && !str.includes("\n")) {
    return [{ name: defaultName, amount: directNum }];
  }

  const lines = str.split(/[;\n]/).map((l) => l.trim()).filter(Boolean);
  const items: { name: string; amount: number }[] = [];

  for (const line of lines) {
    if (line.includes(":")) {
      const [namePart, ...valParts] = line.split(":");
      const name = namePart.trim() || defaultName;
      const amount = parseNumber(valParts.join(":"));
      if (amount > 0 || name) {
        items.push({ name, amount });
      }
    } else {
      const amount = parseNumber(line);
      if (amount > 0) {
        items.push({ name: defaultName, amount });
      }
    }
  }

  return items.length > 0 ? items : directNum > 0 ? [{ name: defaultName, amount: directNum }] : [];
}

export function DailyClosingExcelDialog({
  open,
  onOpenChange,
  onSuccess,
}: DailyClosingExcelDialogProps) {
  const [file, setFile] = useState<File | null>(null);
  const [parsedRows, setParsedRows] = useState<ParsedDailyRow[]>([]);
  const [parseErrors, setParseErrors] = useState<string[]>([]);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  function downloadTemplate() {
    const wb = XLSX.utils.book_new();

    const sampleData = [
      {
        "Tanggal (YYYY-MM-DD)": "2026-09-01",
        "Kas Awal": 150000,
        "Pemasukan Kasir": 1638800,
        "Pemasukan Lain": 257500,
        "Sales Toko": "Plastik: 143000; Telur: 470000; Token Listrik: 54000",
        "Sales Titipan": "Roti padimor: 27000; Parfum arshaka: 17000",
        "Kas Tutup (Modal Besok)": 150000,
        Receh: 135300,
        Tabungan: 900000,
        Catatan: "Tutup buku tgl 1 - Klop sesuai buku catatan",
      },
      {
        "Tanggal (YYYY-MM-DD)": "2026-09-02",
        "Kas Awal": 150000,
        "Pemasukan Kasir": 1750000,
        "Pemasukan Lain": 0,
        "Sales Toko": "Kantong kresek: 45000; Beras: 620000",
        "Sales Titipan": "Roti: 35000",
        "Kas Tutup (Modal Besok)": 150000,
        Receh: 100000,
        Tabungan: 800000,
        Catatan: "Tutup buku tgl 2",
      },
      {
        "Tanggal (YYYY-MM-DD)": "2026-09-03",
        "Kas Awal": "",
        "Pemasukan Kasir": 1920000,
        "Pemasukan Lain": 100000,
        "Sales Toko": 550000,
        "Sales Titipan": 40000,
        "Kas Tutup (Modal Besok)": 200000,
        Receh: 130000,
        Tabungan: 1100000,
        Catatan: "Tutup buku tgl 3",
      },
    ];

    const ws = XLSX.utils.json_to_sheet(sampleData);
    ws["!cols"] = [
      { wch: 22 },
      { wch: 14 },
      { wch: 18 },
      { wch: 16 },
      { wch: 48 },
      { wch: 38 },
      { wch: 24 },
      { wch: 12 },
      { wch: 14 },
      { wch: 40 },
    ];
    XLSX.utils.book_append_sheet(wb, ws, "Rekap Harian");

    const panduanData = [
      {
        Kolom: "Tanggal (YYYY-MM-DD)",
        Wajib: "Ya",
        Keterangan: "Format tanggal bisa YYYY-MM-DD (contoh: 2026-09-01) atau DD/MM/YYYY.",
      },
      {
        Kolom: "Kas Awal",
        Wajib: "Tidak",
        Keterangan: "Jika dikosongkan, sistem otomatis mengambil saldo 'Kas Tutup' dari tanggal sebelumnya.",
      },
      {
        Kolom: "Pemasukan Kasir",
        Wajib: "Ya",
        Keterangan: "Total omzet penjualan kasir hari itu.",
      },
      {
        Kolom: "Pemasukan Lain",
        Wajib: "Tidak",
        Keterangan: "Pemasukan kas selain kasir (jika ada).",
      },
      {
        Kolom: "Sales Toko",
        Wajib: "Tidak",
        Keterangan: "Pengeluaran belanja toko. Bisa diisi nominal total (contoh: 667000) atau rincian item dengan tanda titik koma (contoh: Plastik: 143000; Telur: 470000).",
      },
      {
        Kolom: "Sales Titipan",
        Wajib: "Tidak",
        Keterangan: "Pengeluaran bayar titipan/konsinyasi. Bisa diisi nominal total atau rincian (contoh: Roti: 27000; Parfum: 17000).",
      },
      {
        Kolom: "Kas Tutup (Modal Besok)",
        Wajib: "Ya",
        Keterangan: "Uang tunai yang ditinggal di laci kasir untuk modal awal esok hari.",
      },
      {
        Kolom: "Receh",
        Wajib: "Tidak",
        Keterangan: "Uang koin/receh yang ada saat tutup kasir.",
      },
      {
        Kolom: "Tabungan",
        Wajib: "Tidak",
        Keterangan: "Uang kas bersih yang disisihkan/ditabung dari hasil penjualan hari itu.",
      },
      {
        Kolom: "Catatan",
        Wajib: "Tidak",
        Keterangan: "Keterangan tambahan untuk hari tersebut.",
      },
    ];
    const wsPanduan = XLSX.utils.json_to_sheet(panduanData);
    wsPanduan["!cols"] = [{ wch: 26 }, { wch: 10 }, { wch: 80 }];
    XLSX.utils.book_append_sheet(wb, wsPanduan, "Panduan Format");

    XLSX.writeFile(wb, "Template_Tutup_Buku_Harian_TokoMu.xlsx");
    toast.success("Template Excel berhasil diunduh.");
  }

  async function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const selected = e.target.files?.[0];
    if (!selected) return;

    setFile(selected);
    setParseErrors([]);
    setParsedRows([]);

    try {
      const buffer = await selected.arrayBuffer();
      const wb = XLSX.read(buffer, { type: "array" });
      const firstSheetName = wb.SheetNames[0];
      if (!firstSheetName) {
        throw new Error("File Excel tidak memiliki lembar kerja (sheet).");
      }

      const sheet = wb.Sheets[firstSheetName];
      const jsonRows = XLSX.utils.sheet_to_json<Record<string, unknown>>(sheet, { defval: "" });

      if (jsonRows.length === 0) {
        throw new Error("Lembar kerja kosong, tidak ada baris data untuk diimpor.");
      }

      const errors: string[] = [];
      const rows: ParsedDailyRow[] = [];

      jsonRows.forEach((row, index) => {
        const rowNum = index + 2;

        let rawDate: unknown = "";
        let rawOpeningCash: unknown = "";
        let rawCashierIncome: unknown = "";
        let rawOtherIncome: unknown = "";
        let rawStoreExpense: unknown = "";
        let rawTitipanExpense: unknown = "";
        let rawClosingCash: unknown = "";
        let rawReceh: unknown = "";
        let rawSavings: unknown = "";
        let rawNote: unknown = "";

        for (const [key, val] of Object.entries(row)) {
          const k = key.toLowerCase().replace(/[\s_()\-]/g, "");
          if (k.includes("tanggal") || k.includes("date") || k.includes("tgl")) rawDate = val;
          else if (k.includes("kasawal") || k.includes("modalawal") || k.includes("saldoawal")) rawOpeningCash = val;
          else if (k.includes("pemasukankasir") || k.includes("omzet") || k.includes("omset") || k.includes("revenue") || (k.includes("pemasukan") && !k.includes("lain"))) rawCashierIncome = val;
          else if (k.includes("pemasukanlain") || k.includes("kasmasuklain") || k.includes("lainnya") || k.includes("otherincome")) rawOtherIncome = val;
          else if (k.includes("salestoko") || k.includes("biayatoko") || k.includes("pengeluarantoko") || (k.includes("toko") && k.includes("beban"))) rawStoreExpense = val;
          else if (k.includes("salestitipan") || k.includes("pengeluarantitipan") || k.includes("titipan") || k.includes("konsinyasi")) rawTitipanExpense = val;
          else if (k.includes("kastutup") || k.includes("modalbesok") || k.includes("kasakhir") || (k.includes("tutup") && k.includes("kas"))) rawClosingCash = val;
          else if (k.includes("receh") || k.includes("koin") || k.includes("coins")) rawReceh = val;
          else if (k.includes("tabungan") || k.includes("setortabungan") || k.includes("savings")) rawSavings = val;
          else if (k.includes("catatan") || k.includes("keterangan") || k.includes("note")) rawNote = val;
        }

        const dateStr = parseDateCell(rawDate);
        if (!dateStr) {
          if (Object.values(row).some(Boolean)) {
            errors.push(`Baris ${rowNum}: Format tanggal tidak dikenali ("${String(rawDate)}").`);
          }
          return;
        }

        const cashierIncome = parseNumber(rawCashierIncome);
        const otherIncome = parseNumber(rawOtherIncome);
        const revenue = cashierIncome + otherIncome;

        const storeExpenses = parseExpenseText(rawStoreExpense, "Belanja Toko");
        const titipanExpenses = parseExpenseText(rawTitipanExpense, "Bayar Titipan");
        const totalStore = storeExpenses.reduce((sum, e) => sum + e.amount, 0);
        const totalTitipan = titipanExpenses.reduce((sum, e) => sum + e.amount, 0);
        const totalExpense = totalStore + totalTitipan;

        const openingCash = parseNumber(rawOpeningCash);
        const closingCash = parseNumber(rawClosingCash);
        const closingCoins = parseNumber(rawReceh);
        const closingSavings = parseNumber(rawSavings);

        const netCash = revenue - totalExpense;
        const closingTotal = closingCash + closingCoins + closingSavings;
        const variance = netCash - closingTotal;

        rows.push({
          rowNumber: rowNum,
          reportDate: dateStr,
          openingCash,
          revenue,
          cashierIncome,
          otherIncome,
          storeExpenses,
          titipanExpenses,
          totalStoreExpense: totalStore,
          totalTitipanExpense: totalTitipan,
          totalExpense,
          netCash,
          closingCash,
          closingCoins,
          closingSavings,
          closingTotal,
          variance,
          isBalanced: variance === 0,
          note: String(rawNote || "").trim(),
        });
      });

      rows.sort((a, b) => a.reportDate.localeCompare(b.reportDate));

      let lastClosingCash: number | null = null;
      for (const r of rows) {
        if (r.openingCash === 0 && lastClosingCash !== null) {
          r.openingCash = lastClosingCash;
          r.isOpeningAutoChained = true;
        }
        lastClosingCash = r.closingCash;
      }

      setParsedRows(rows);
      setParseErrors(errors);

      if (rows.length > 0) {
        toast.success(`Berhasil memproses ${rows.length} hari rekap tutup buku dari file.`);
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Gagal membaca file Excel.";
      setParseErrors([msg]);
      toast.error(msg);
    }
  }

  const summary = useMemo(() => {
    const totalDays = parsedRows.length;
    const totalRevenue = parsedRows.reduce((sum, r) => sum + r.revenue, 0);
    const totalStore = parsedRows.reduce((sum, r) => sum + r.totalStoreExpense, 0);
    const totalTitipan = parsedRows.reduce((sum, r) => sum + r.totalTitipanExpense, 0);
    const totalExpense = totalStore + totalTitipan;
    const totalSavings = parsedRows.reduce((sum, r) => sum + r.closingSavings, 0);
    const balancedDays = parsedRows.filter((r) => r.isBalanced).length;
    const unbalancedDays = totalDays - balancedDays;

    return {
      totalDays,
      totalRevenue,
      totalStore,
      totalTitipan,
      totalExpense,
      totalSavings,
      balancedDays,
      unbalancedDays,
    };
  }, [parsedRows]);

  async function handleSubmit() {
    if (parsedRows.length === 0) {
      toast.error("Tidak ada data untuk disimpan.");
      return;
    }

    setIsSubmitting(true);
    try {
      const payloadBatch = parsedRows.map((r) => ({
        reportDate: r.reportDate,
        openingCash: r.openingCash,
        openingCoins: 0,
        openingSavings: 0,
        revenue: r.revenue,
        cashierIncome: r.cashierIncome,
        otherIncome: r.otherIncome,
        storeExpenses: r.storeExpenses,
        titipanExpenses: r.titipanExpenses,
        closingCash: r.closingCash,
        closingCoins: r.closingCoins,
        closingSavings: r.closingSavings,
        note: r.note || undefined,
      }));

      const response = await fetch("/api/daily-reports/manual-close", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ batch: payloadBatch }),
      });

      const data = await response.json().catch(() => null);
      if (!response.ok) {
        throw new Error(data?.error || "Gagal mengimpor rekap tutup buku.");
      }

      toast.success(`Berhasil menyimpan ${parsedRows.length} hari rekap tutup buku harian!`, {
        description: `Total omzet Rp ${formatCurrency(summary.totalRevenue)} tercatat ke database.`,
      });

      onSuccess();
      onOpenChange(false);
      resetState();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Gagal menyimpan data.");
    } finally {
      setIsSubmitting(false);
    }
  }

  function resetState() {
    setFile(null);
    setParsedRows([]);
    setParseErrors([]);
    if (fileInputRef.current) fileInputRef.current.value = "";
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(isOpen) => {
        if (!isOpen) resetState();
        onOpenChange(isOpen);
      }}
    >
      <DialogContent className="max-w-5xl max-h-[92vh] flex flex-col p-0 overflow-hidden">
        <DialogHeader className="p-6 pb-4 border-b border-border/70 shrink-0">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-center gap-3">
              <div className="flex size-11 items-center justify-center rounded-2xl bg-emerald-500/15 text-emerald-600 dark:text-emerald-400">
                <FileSpreadsheet className="size-6" />
              </div>
              <div>
                <DialogTitle className="font-heading text-xl">
                  Impor Rekap Tutup Buku Harian via Excel
                </DialogTitle>
                <DialogDescription>
                  Upload spreadsheet (.xlsx / .csv) untuk memasukkan rekap tutup buku banyak hari sekaligus.
                </DialogDescription>
              </div>
            </div>
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="gap-2 rounded-xl border-emerald-500/30 text-emerald-700 hover:bg-emerald-500/10 dark:text-emerald-300"
              onClick={downloadTemplate}
            >
              <Download className="size-4" />
              Unduh Template Excel (.xlsx)
            </Button>
          </div>
        </DialogHeader>

        <div className="flex-1 overflow-y-auto p-6 space-y-6 custom-scrollbar">
          <div
            className={cn(
              "relative rounded-3xl border-2 border-dashed border-border/80 p-6 sm:p-8 text-center transition-all bg-card/40 hover:bg-card/70",
              file && "border-primary/50 bg-primary/5"
            )}
          >
            <input
              ref={fileInputRef}
              type="file"
              accept=".xlsx,.xls,.csv"
              onChange={handleFileChange}
              className="absolute inset-0 size-full cursor-pointer opacity-0"
              title="Pilih file Excel"
            />
            <div className="flex flex-col items-center justify-center space-y-2 pointer-events-none">
              <div className="flex size-14 items-center justify-center rounded-2xl bg-primary/10 text-primary mb-1">
                <UploadCloud className="size-7" />
              </div>
              <p className="font-semibold text-base">
                {file ? file.name : "Seret & lepas file Excel di sini atau klik untuk memilih"}
              </p>
              <p className="text-xs text-muted-foreground max-w-md">
                Mendukung file <span className="font-mono font-medium">.xlsx</span>,{" "}
                <span className="font-mono font-medium">.xls</span>, atau{" "}
                <span className="font-mono font-medium">.csv</span>.
              </p>
              {file && (
                <div className="mt-2 inline-flex items-center gap-2 rounded-full bg-primary/15 px-3 py-1 text-xs font-semibold text-primary">
                  <CheckCircle2 className="size-3.5" />
                  {parsedRows.length} hari berhasil diproses
                </div>
              )}
            </div>
          </div>

          {parseErrors.length > 0 && (
            <div className="rounded-2xl border border-destructive/30 bg-destructive/10 p-4 space-y-1">
              <div className="flex items-center gap-2 font-semibold text-destructive text-sm">
                <AlertCircle className="size-4" />
                Catatan Pemeriksaan File:
              </div>
              <ul className="list-disc pl-5 text-xs text-destructive/90 space-y-0.5">
                {parseErrors.map((err, i) => (
                  <li key={i}>{err}</li>
                ))}
              </ul>
            </div>
          )}

          {parsedRows.length > 0 && (
            <div className="space-y-4">
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                <div className="rounded-2xl border border-border/70 bg-card p-3.5 shadow-xs">
                  <p className="text-[11px] font-medium text-muted-foreground uppercase tracking-wider">Total Hari</p>
                  <p className="mt-1 text-xl font-bold">{summary.totalDays} Hari</p>
                  <p className="text-[11px] text-muted-foreground mt-0.5">
                    {summary.balancedDays} klop, {summary.unbalancedDays} selisih
                  </p>
                </div>
                <div className="rounded-2xl border border-emerald-500/20 bg-emerald-500/5 p-3.5 shadow-xs">
                  <p className="text-[11px] font-medium text-emerald-700 dark:text-emerald-400 uppercase tracking-wider">Total Pemasukan</p>
                  <p className="mt-1 text-xl font-bold text-emerald-700 dark:text-emerald-400">
                    {formatCurrency(summary.totalRevenue)}
                  </p>
                  <p className="text-[11px] text-muted-foreground mt-0.5">Omzet kotor</p>
                </div>
                <div className="rounded-2xl border border-rose-500/20 bg-rose-500/5 p-3.5 shadow-xs">
                  <p className="text-[11px] font-medium text-rose-700 dark:text-rose-400 uppercase tracking-wider">Total Pengeluaran</p>
                  <p className="mt-1 text-xl font-bold text-rose-700 dark:text-rose-400">
                    {formatCurrency(summary.totalExpense)}
                  </p>
                  <p className="text-[11px] text-muted-foreground mt-0.5">Toko & titipan</p>
                </div>
                <div className="rounded-2xl border border-blue-500/20 bg-blue-500/5 p-3.5 shadow-xs">
                  <p className="text-[11px] font-medium text-blue-700 dark:text-blue-400 uppercase tracking-wider">Total Tabungan</p>
                  <p className="mt-1 text-xl font-bold text-blue-700 dark:text-blue-400">
                    {formatCurrency(summary.totalSavings)}
                  </p>
                  <p className="text-[11px] text-muted-foreground mt-0.5">Disisihkan</p>
                </div>
              </div>

              <div className="rounded-2xl border border-border/80 overflow-hidden shadow-xs">
                <div className="bg-muted/50 px-4 py-2.5 border-b border-border/70 flex items-center justify-between">
                  <span className="font-semibold text-xs text-foreground uppercase tracking-wider">
                    Pratinjau Data Harian ({parsedRows.length} Baris)
                  </span>
                  <span className="text-xs text-muted-foreground">
                    Diurutkan dari tanggal paling awal
                  </span>
                </div>
                <div className="max-h-[360px] overflow-y-auto custom-scrollbar">
                  <Table>
                    <TableHeader className="bg-card/90 sticky top-0 z-10 backdrop-blur-sm">
                      <TableRow>
                        <TableHead className="w-[120px]">Tanggal</TableHead>
                        <TableHead className="w-[130px]">Kas Awal</TableHead>
                        <TableHead className="text-right">Pemasukan</TableHead>
                        <TableHead className="text-right">Pengeluaran</TableHead>
                        <TableHead className="text-right">Sisa Kas</TableHead>
                        <TableHead className="text-right">Alokasi Fisik</TableHead>
                        <TableHead className="text-center w-[120px]">Status</TableHead>
                        <TableHead>Catatan</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {parsedRows.map((r) => (
                        <TableRow key={r.reportDate} className="hover:bg-muted/30">
                          <TableCell className="font-semibold whitespace-nowrap">
                            <span className="text-xs font-mono">{r.reportDate}</span>
                          </TableCell>
                          <TableCell className="whitespace-nowrap">
                            <div className="text-xs font-medium">
                              {formatCurrency(r.openingCash)}
                            </div>
                            {r.isOpeningAutoChained && (
                              <span className="text-[10px] text-primary flex items-center gap-0.5">
                                <ArrowRight className="size-2.5" /> Sambung kas tutup
                              </span>
                            )}
                          </TableCell>
                          <TableCell className="text-right font-medium text-emerald-600 dark:text-emerald-400 whitespace-nowrap">
                            {formatCurrency(r.revenue)}
                          </TableCell>
                          <TableCell className="text-right text-rose-600 dark:text-rose-400 whitespace-nowrap">
                            <div className="font-medium">{formatCurrency(r.totalExpense)}</div>
                            <div className="text-[10px] text-muted-foreground">
                              Toko: {formatCurrency(r.totalStoreExpense)} | Titipan: {formatCurrency(r.totalTitipanExpense)}
                            </div>
                          </TableCell>
                          <TableCell className="text-right font-bold whitespace-nowrap">
                            {formatCurrency(r.netCash)}
                          </TableCell>
                          <TableCell className="text-right whitespace-nowrap">
                            <div className="font-semibold text-xs">{formatCurrency(r.closingTotal)}</div>
                            <div className="text-[10px] text-muted-foreground">
                              Tutup: {formatCurrency(r.closingCash)} | Tabung: {formatCurrency(r.closingSavings)}
                            </div>
                          </TableCell>
                          <TableCell className="text-center whitespace-nowrap">
                            {r.isBalanced ? (
                              <Badge className="bg-emerald-500/15 text-emerald-700 dark:text-emerald-400 hover:bg-emerald-500/20 text-[10px]">
                                Klop
                              </Badge>
                            ) : (
                              <Badge variant="destructive" className="text-[10px]">
                                Selisih {formatCurrency(Math.abs(r.variance))}
                              </Badge>
                            )}
                          </TableCell>
                          <TableCell className="text-xs text-muted-foreground max-w-[150px] truncate" title={r.note}>
                            {r.note || "-"}
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              </div>
            </div>
          )}
        </div>

        <DialogFooter className="p-4 sm:p-6 border-t border-border/70 bg-card/60 shrink-0 flex items-center justify-between">
          <Button
            type="button"
            variant="ghost"
            onClick={() => onOpenChange(false)}
            disabled={isSubmitting}
          >
            Batal
          </Button>

          <div className="flex items-center gap-2">
            {parsedRows.length > 0 && (
              <Button
                type="button"
                variant="outline"
                onClick={resetState}
                disabled={isSubmitting}
              >
                Ganti File
              </Button>
            )}

            <Button
              type="button"
              onClick={handleSubmit}
              disabled={parsedRows.length === 0 || isSubmitting}
              className="gap-2 bg-emerald-600 hover:bg-emerald-700 text-white"
            >
              {isSubmitting ? (
                <>
                  <Loader2 className="size-4 animate-spin" />
                  Menyimpan ke Database...
                </>
              ) : (
                <>
                  <CheckCircle2 className="size-4" />
                  Simpan Semua {parsedRows.length} Hari ke Buku Kas
                </>
              )}
            </Button>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
