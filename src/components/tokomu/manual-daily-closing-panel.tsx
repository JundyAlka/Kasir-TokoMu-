"use client";

import { useEffect, useMemo, useState } from "react";
import {
  AlertCircle,
  ArrowRight,
  BookOpen,
  CalendarDays,
  CheckCircle2,
  Coins,
  DollarSign,
  FileSpreadsheet,
  HelpCircle,
  Info,
  Loader2,
  Lock,
  Minus,
  Pencil,
  PiggyBank,
  Plus,
  RefreshCw,
  ShoppingBag,
  Sparkles,
  Store,
  Trash2,
  TrendingDown,
  TrendingUp,
  Wallet,
} from "lucide-react";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { formatCurrency, formatDate } from "@/lib/format";
import { cn } from "@/lib/utils";

type ExpenseLine = {
  id: string;
  name: string;
  amount: number;
};

type ManualClosingRecord = {
  id: string;
  reportDate: string;
  openingCash: number;
  openingCoins: number;
  openingSavings: number;
  openingTotal: number;
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
  note: string;
  status: "locked";
  updatedAt: string;
};

function pad2(n: number) {
  return String(n).padStart(2, "0");
}

function getTodayString() {
  const d = new Date();
  return `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`;
}

export function ManualDailyClosingPanel() {
  const [reportDate, setReportDate] = useState<string>(getTodayString);
  const [openingCash, setOpeningCash] = useState<number>(0);
  const [cashierIncome, setCashierIncome] = useState<number>(0);
  const [otherIncome, setOtherIncome] = useState<number>(0);

  const [storeExpenses, setStoreExpenses] = useState<ExpenseLine[]>([
    { id: "1", name: "", amount: 0 },
  ]);
  const [titipanExpenses, setTitipanExpenses] = useState<ExpenseLine[]>([
    { id: "1", name: "", amount: 0 },
  ]);

  const [closingCash, setClosingCash] = useState<number>(0);
  const [closingCoins, setClosingCoins] = useState<number>(0);
  const [closingSavings, setClosingSavings] = useState<number>(0);
  const [note, setNote] = useState<string>("");

  const [previousClosingInfo, setPreviousClosingInfo] = useState<{
    reportDate: string;
    closingCash: number;
    closingCoins: number;
    closingSavings: number;
    closingTotal: number;
  } | null>(null);

  const [isLoadingDate, setIsLoadingDate] = useState<boolean>(false);
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);
  const [monthClosings, setMonthClosings] = useState<ManualClosingRecord[]>([]);
  const [isLoadingMonth, setIsLoadingMonth] = useState<boolean>(true);

  // Perhitungan Otomatis
  const totalRevenue = cashierIncome + otherIncome;
  const totalStoreExpense = useMemo(
    () => storeExpenses.reduce((sum, e) => sum + (Number(e.amount) || 0), 0),
    [storeExpenses]
  );
  const totalTitipanExpense = useMemo(
    () => titipanExpenses.reduce((sum, e) => sum + (Number(e.amount) || 0), 0),
    [titipanExpenses]
  );
  const totalExpense = totalStoreExpense + totalTitipanExpense;
  const netCash = totalRevenue - totalExpense;
  const totalAllocated = closingCash + closingCoins + closingSavings;
  const variance = netCash - totalAllocated;
  const isBalanced = variance === 0;

  // Fetch data tanggal terpilih & riwayat bulan berjalan
  useEffect(() => {
    let active = true;
    setIsLoadingDate(true);

    fetch(`/api/daily-reports/manual-close?date=${reportDate}`)
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => {
        if (!active || !data) return;

        setPreviousClosingInfo(data.previousClosing ?? null);

        if (data.closing) {
          // Data tanggal ini sudah ada (mode edit)
          const c: ManualClosingRecord = data.closing;
          setOpeningCash(c.openingCash);
          setCashierIncome(c.cashierIncome || c.revenue);
          setOtherIncome(c.otherIncome || 0);

          setStoreExpenses(
            c.storeExpenses.length > 0
              ? c.storeExpenses.map((e, idx) => ({ id: String(idx + 1), ...e }))
              : [{ id: "1", name: "", amount: 0 }]
          );
          setTitipanExpenses(
            c.titipanExpenses.length > 0
              ? c.titipanExpenses.map((e, idx) => ({ id: String(idx + 1), ...e }))
              : [{ id: "1", name: "", amount: 0 }]
          );

          setClosingCash(c.closingCash);
          setClosingCoins(c.closingCoins);
          setClosingSavings(c.closingSavings);
          setNote(c.note || "");
        } else {
          // Data tanggal baru: otomatis ambil kas awal dari kas tutup hari kemarin jika ada
          if (data.previousClosing) {
            setOpeningCash(data.previousClosing.closingCash);
          } else {
            setOpeningCash(0);
          }
          setCashierIncome(0);
          setOtherIncome(0);
          setStoreExpenses([{ id: "1", name: "", amount: 0 }]);
          setTitipanExpenses([{ id: "1", name: "", amount: 0 }]);
          setClosingCash(0);
          setClosingCoins(0);
          setClosingSavings(0);
          setNote("");
        }
      })
      .catch((err) => console.error(err))
      .finally(() => {
        if (active) setIsLoadingDate(false);
      });

    return () => {
      active = false;
    };
  }, [reportDate]);

  // Muat riwayat bulan terpilih
  const loadMonthData = () => {
    setIsLoadingMonth(true);
    const [year, month] = reportDate.split("-");
    const start = `${year}-${month}-01`;
    const lastDay = new Date(Number(year), Number(month), 0).getDate();
    const end = `${year}-${month}-${pad2(lastDay)}`;

    fetch(`/api/daily-reports/manual-close?start=${start}&end=${end}`)
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => {
        if (data?.closings) {
          setMonthClosings(data.closings);
        }
      })
      .catch((err) => console.error(err))
      .finally(() => setIsLoadingMonth(false));
  };

  useEffect(() => {
    loadMonthData();
  }, [reportDate.slice(0, 7)]);

  // Tambah / Hapus Baris Belanja Toko
  const addStoreExpenseRow = () => {
    setStoreExpenses((prev) => [...prev, { id: String(Date.now()), name: "", amount: 0 }]);
  };
  const removeStoreExpenseRow = (id: string) => {
    setStoreExpenses((prev) => (prev.length > 1 ? prev.filter((r) => r.id !== id) : prev));
  };
  const updateStoreExpenseRow = (id: string, field: "name" | "amount", value: any) => {
    setStoreExpenses((prev) =>
      prev.map((r) => (r.id === id ? { ...r, [field]: value } : r))
    );
  };

  // Tambah / Hapus Baris Belanja Titipan
  const addTitipanExpenseRow = () => {
    setTitipanExpenses((prev) => [...prev, { id: String(Date.now()), name: "", amount: 0 }]);
  };
  const removeTitipanExpenseRow = (id: string) => {
    setTitipanExpenses((prev) => (prev.length > 1 ? prev.filter((r) => r.id !== id) : prev));
  };
  const updateTitipanExpenseRow = (id: string, field: "name" | "amount", value: any) => {
    setTitipanExpenses((prev) =>
      prev.map((r) => (r.id === id ? { ...r, [field]: value } : r))
    );
  };

  // Tombol Isi Contoh Sesuai Buku Catatan (Foto)
  const fillSampleFromNotebook = () => {
    setCashierIncome(1638800);
    setOtherIncome(257500); // Pemasukan D
    setStoreExpenses([
      { id: "1", name: "Plastik", amount: 143000 },
      { id: "2", name: "Telur", amount: 470000 },
      { id: "3", name: "TOKEN LISTRIK", amount: 54000 },
    ]);
    setTitipanExpenses([
      { id: "1", name: "Roti padimor", amount: 27000 },
      { id: "2", name: "Parfum arshaka", amount: 17000 },
    ]);
    setClosingCash(150000); // Kas tutup (jadi kas awal besok)
    setClosingCoins(135300); // Receh
    setClosingSavings(900000); // Tabungan
    setNote("Sesuai buku kas harian warung (Plastik, Telur, Listrik, Roti, Parfum, Kas Tutup 150rb, Receh, Tabungan)");
    toast.info("Data contoh sesuai buku catatan berhasil diisi!", {
      description: "Total Pemasukan Rp 1.896.300, Pengeluaran Rp 711.000, Bersih Rp 1.185.300 (Klop!).",
    });
  };

  // Submit Tutup Buku
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (totalRevenue <= 0 && totalExpense <= 0) {
      toast.error("Harap masukkan pemasukan atau pengeluaran hari ini.");
      return;
    }

    setIsSubmitting(true);
    try {
      const payload = {
        reportDate,
        openingCash: Number(openingCash) || 0,
        revenue: totalRevenue,
        cashierIncome,
        otherIncome,
        storeExpenses: storeExpenses
          .filter((e) => e.name.trim() && e.amount > 0)
          .map((e) => ({ name: e.name.trim(), amount: Number(e.amount) })),
        titipanExpenses: titipanExpenses
          .filter((e) => e.name.trim() && e.amount > 0)
          .map((e) => ({ name: e.name.trim(), amount: Number(e.amount) })),
        closingCash: Number(closingCash) || 0,
        closingCoins: Number(closingCoins) || 0,
        closingSavings: Number(closingSavings) || 0,
        note: note.trim(),
      };

      const res = await fetch("/api/daily-reports/manual-close", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data?.error || "Gagal menyimpan tutup buku.");

      toast.success(`Tutup buku tanggal ${formatDate(reportDate)} berhasil disimpan & dikunci!`, {
        description: `Kas Tutup ${formatCurrency(payload.closingCash)} akan otomatis menjadi Kas Awal hari berikutnya.`,
      });

      window.dispatchEvent(new CustomEvent("pcm-reports-updated", { detail: { action: "updated" } }));
      loadMonthData();
    } catch (err: any) {
      toast.error(err.message || "Gagal menyimpan tutup buku.");
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDelete = async (targetDate: string) => {
    if (!confirm(`Hapus rekap tutup buku tanggal ${formatDate(targetDate)}?`)) return;
    try {
      const res = await fetch(`/api/daily-reports/manual-close?date=${targetDate}`, {
        method: "DELETE",
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data?.error || "Gagal menghapus data.");

      toast.success(`Data tanggal ${formatDate(targetDate)} dihapus.`);
      loadMonthData();
      if (reportDate === targetDate) {
        setReportDate(targetDate); // refresh current view
      }
    } catch (err: any) {
      toast.error(err.message || "Gagal menghapus data.");
    }
  };

  // Akumulasi bulanan
  const monthTotals = useMemo(() => {
    return monthClosings.reduce(
      (acc, row) => ({
        revenue: acc.revenue + row.revenue,
        storeExpense: acc.storeExpense + row.totalStoreExpense,
        titipanExpense: acc.titipanExpense + row.totalTitipanExpense,
        totalExpense: acc.totalExpense + row.totalExpense,
        netCash: acc.netCash + row.netCash,
        savings: acc.savings + row.closingSavings,
      }),
      { revenue: 0, storeExpense: 0, titipanExpense: 0, totalExpense: 0, netCash: 0, savings: 0 }
    );
  }, [monthClosings]);

  return (
    <div className="space-y-6">
      {/* Banner Rekomendasi Buku Kas */}
      <div className="rounded-2xl border border-primary/30 bg-primary/5 p-4 shadow-sm">
        <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
          <div className="flex items-start gap-3">
            <div className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-primary/15 text-primary">
              <BookOpen className="size-5" />
            </div>
            <div>
              <h2 className="font-heading text-lg font-bold text-foreground">
                Rekap Tutup Buku Harian (Buku Kas Fisik)
              </h2>
              <p className="text-xs sm:text-sm text-muted-foreground mt-0.5">
                Cukup catat total omzet dan pengeluaran per hari seperti di buku catatan harian Anda.
                Kas Tutup hari ini otomatis berkesinambungan menjadi Kas Awal hari berikutnya.
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={fillSampleFromNotebook}
              className="gap-1.5 rounded-xl border-primary/30 bg-card hover:bg-primary/10 text-xs font-semibold text-primary"
            >
              <Sparkles className="size-3.5" />
              Isi Contoh Buku Catatan
            </Button>
          </div>
        </div>
      </div>

      {/* Formulir Input Tutup Buku */}
      <form onSubmit={handleSubmit}>
        <Card className="border-border/70 shadow-sm">
          <CardHeader className="pb-4">
            <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
              <div className="space-y-1">
                <CardTitle className="font-heading text-xl">
                  Formulir Tutup Buku Tanggal: {formatDate(reportDate)}
                </CardTitle>
                <CardDescription>
                  Masukkan ringkasan pemasukan, pengeluaran toko/titipan, dan hitungan kas akhir hari.
                </CardDescription>
              </div>

              {/* Selector Tanggal */}
              <div className="flex items-center gap-2">
                <CalendarDays className="size-4 text-muted-foreground" />
                <Input
                  type="date"
                  value={reportDate}
                  onChange={(e) => setReportDate(e.target.value)}
                  className="h-10 w-44 rounded-xl font-medium"
                  required
                />
              </div>
            </div>

            {/* Kesinambungan Kas Awal Indicator */}
            <div className="mt-3 flex flex-wrap items-center gap-2 text-xs">
              <Badge variant="outline" className="gap-1.5 rounded-lg border-primary/40 bg-primary/10 py-1 text-primary">
                <Coins className="size-3.5" />
                {previousClosingInfo ? (
                  <span>
                    Kas Awal otomatis dari Kas Tutup {formatDate(previousClosingInfo.reportDate)}:{" "}
                    <strong>{formatCurrency(previousClosingInfo.closingCash)}</strong>
                  </span>
                ) : (
                  <span>Belum ada kas tutup dari hari sebelumnya (Kas Awal manual: {formatCurrency(openingCash)})</span>
                )}
              </Badge>
              {isLoadingDate && <Loader2 className="size-3.5 animate-spin text-muted-foreground" />}
            </div>
          </CardHeader>

          <CardContent className="space-y-6">
            {/* Bagian 1: Kas Awal & Pemasukan */}
            <div className="grid gap-4 md:grid-cols-3">
              <div className="space-y-2 rounded-2xl border border-border/70 bg-card/60 p-4">
                <div className="flex items-center justify-between">
                  <Label htmlFor="openingCash" className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                    Kas Awal Hari Ini (Modal)
                  </Label>
                  <Coins className="size-4 text-primary" />
                </div>
                <Input
                  id="openingCash"
                  type="number"
                  min="0"
                  value={openingCash || ""}
                  onChange={(e) => setOpeningCash(Number(e.target.value) || 0)}
                  placeholder="Rp 0"
                  className="h-11 rounded-xl text-base font-bold font-mono"
                />
                <p className="text-[11px] text-muted-foreground">
                  Bawaan kas tutup kemarin / modal kembalian di laci.
                </p>
              </div>

              <div className="space-y-2 rounded-2xl border border-border/70 bg-card/60 p-4">
                <div className="flex items-center justify-between">
                  <Label htmlFor="cashierIncome" className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                    Pemasukan / Omzet Toko
                  </Label>
                  <TrendingUp className="size-4 text-emerald-500" />
                </div>
                <Input
                  id="cashierIncome"
                  type="number"
                  min="0"
                  value={cashierIncome || ""}
                  onChange={(e) => setCashierIncome(Number(e.target.value) || 0)}
                  placeholder="Contoh: 1638800"
                  className="h-11 rounded-xl text-base font-bold font-mono text-emerald-600 dark:text-emerald-400"
                />
                <p className="text-[11px] text-muted-foreground">
                  Total penjualan / kasir hari itu.
                </p>
              </div>

              <div className="space-y-2 rounded-2xl border border-border/70 bg-card/60 p-4">
                <div className="flex items-center justify-between">
                  <Label htmlFor="otherIncome" className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                    Pemasukan Lainnya (Opsional - D)
                  </Label>
                  <DollarSign className="size-4 text-emerald-500" />
                </div>
                <Input
                  id="otherIncome"
                  type="number"
                  min="0"
                  value={otherIncome || ""}
                  onChange={(e) => setOtherIncome(Number(e.target.value) || 0)}
                  placeholder="Contoh: 257500"
                  className="h-11 rounded-xl text-base font-bold font-mono"
                />
                <p className="text-[11px] text-muted-foreground">
                  Pemasukan tambahan (misal transfer/kas masuk lain).
                </p>
              </div>
            </div>

            {/* Total Pemasukan Pill */}
            <div className="flex items-center justify-between rounded-xl bg-emerald-500/10 px-4 py-2.5 border border-emerald-500/25">
              <span className="text-xs sm:text-sm font-semibold text-emerald-800 dark:text-emerald-300">
                Total Pemasukan (Omzet Toko + Pemasukan Lain):
              </span>
              <span className="font-mono text-base sm:text-lg font-extrabold text-emerald-700 dark:text-emerald-400">
                {formatCurrency(totalRevenue)}
              </span>
            </div>

            {/* Bagian 2: Pengeluaran Toko & Titipan */}
            <div className="grid gap-6 lg:grid-cols-2">
              {/* Kolom 1: Pengeluaran Toko (Sales Toko) */}
              <div className="space-y-3 rounded-2xl border border-border/80 bg-muted/25 p-4">
                <div className="flex items-center justify-between border-b border-border/60 pb-2">
                  <div>
                    <h3 className="font-heading text-sm font-bold text-foreground flex items-center gap-2">
                      <Store className="size-4 text-rose-500" />
                      1. Pengeluaran Toko (Sales Toko)
                    </h3>
                    <p className="text-[11px] text-muted-foreground">
                      Belanja operasional, plastik, telur, listrik, dll.
                    </p>
                  </div>
                  <Badge variant="outline" className="font-mono text-xs font-bold text-rose-600 dark:text-rose-400">
                    {formatCurrency(totalStoreExpense)}
                  </Badge>
                </div>

                <div className="space-y-2 max-h-60 overflow-y-auto pr-1">
                  {storeExpenses.map((item, index) => (
                    <div key={item.id} className="flex items-center gap-2">
                      <Input
                        type="text"
                        placeholder={`Nama item (misal: Plastik)`}
                        value={item.name}
                        onChange={(e) => updateStoreExpenseRow(item.id, "name", e.target.value)}
                        className="h-9 rounded-xl text-xs flex-1"
                      />
                      <Input
                        type="number"
                        min="0"
                        placeholder="Rp 0"
                        value={item.amount || ""}
                        onChange={(e) =>
                          updateStoreExpenseRow(item.id, "amount", Number(e.target.value) || 0)
                        }
                        className="h-9 w-32 rounded-xl text-xs font-mono font-semibold"
                      />
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        onClick={() => removeStoreExpenseRow(item.id)}
                        disabled={storeExpenses.length <= 1}
                        className="size-9 shrink-0 text-muted-foreground hover:text-destructive"
                      >
                        <Trash2 className="size-3.5" />
                      </Button>
                    </div>
                  ))}
                </div>

                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={addStoreExpenseRow}
                  className="w-full h-8 rounded-xl border-dashed border-border/80 text-xs gap-1.5"
                >
                  <Plus className="size-3.5" /> Tambah Item Toko
                </Button>
              </div>

              {/* Kolom 2: Pengeluaran Titipan (Sales Titipan) */}
              <div className="space-y-3 rounded-2xl border border-border/80 bg-muted/25 p-4">
                <div className="flex items-center justify-between border-b border-border/60 pb-2">
                  <div>
                    <h3 className="font-heading text-sm font-bold text-foreground flex items-center gap-2">
                      <ShoppingBag className="size-4 text-amber-500" />
                      2. Pengeluaran Titipan (Sales Titipan)
                    </h3>
                    <p className="text-[11px] text-muted-foreground">
                      Setoran barang titipan / konsinyasi (roti, parfum, dll).
                    </p>
                  </div>
                  <Badge variant="outline" className="font-mono text-xs font-bold text-amber-600 dark:text-amber-400">
                    {formatCurrency(totalTitipanExpense)}
                  </Badge>
                </div>

                <div className="space-y-2 max-h-60 overflow-y-auto pr-1">
                  {titipanExpenses.map((item, index) => (
                    <div key={item.id} className="flex items-center gap-2">
                      <Input
                        type="text"
                        placeholder={`Nama titipan (misal: Roti padimor)`}
                        value={item.name}
                        onChange={(e) => updateTitipanExpenseRow(item.id, "name", e.target.value)}
                        className="h-9 rounded-xl text-xs flex-1"
                      />
                      <Input
                        type="number"
                        min="0"
                        placeholder="Rp 0"
                        value={item.amount || ""}
                        onChange={(e) =>
                          updateTitipanExpenseRow(item.id, "amount", Number(e.target.value) || 0)
                        }
                        className="h-9 w-32 rounded-xl text-xs font-mono font-semibold"
                      />
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        onClick={() => removeTitipanExpenseRow(item.id)}
                        disabled={titipanExpenses.length <= 1}
                        className="size-9 shrink-0 text-muted-foreground hover:text-destructive"
                      >
                        <Trash2 className="size-3.5" />
                      </Button>
                    </div>
                  ))}
                </div>

                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={addTitipanExpenseRow}
                  className="w-full h-8 rounded-xl border-dashed border-border/80 text-xs gap-1.5"
                >
                  <Plus className="size-3.5" /> Tambah Item Titipan
                </Button>
              </div>
            </div>

            {/* Total Pengeluaran & Sisa Bersih Kas Calculation */}
            <div className="grid gap-3 sm:grid-cols-2">
              <div className="flex items-center justify-between rounded-xl bg-rose-500/10 px-4 py-2.5 border border-rose-500/25">
                <span className="text-xs sm:text-sm font-semibold text-rose-800 dark:text-rose-300">
                  Total Pengeluaran (Toko + Titipan):
                </span>
                <span className="font-mono text-base font-bold text-rose-700 dark:text-rose-400">
                  {formatCurrency(totalExpense)}
                </span>
              </div>

              <div className="flex items-center justify-between rounded-xl bg-primary/10 px-4 py-2.5 border border-primary/25">
                <span className="text-xs sm:text-sm font-semibold text-primary">
                  Sisa Bersih Kas (Pemasukan - Pengeluaran):
                </span>
                <span className="font-mono text-base sm:text-lg font-extrabold text-foreground">
                  {formatCurrency(netCash)}
                </span>
              </div>
            </div>

            {/* Bagian 3: Alokasi Fisik Kas / Tutup Kas */}
            <div className="rounded-2xl border border-border/80 bg-card p-4 space-y-4">
              <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 border-b border-border/60 pb-3">
                <div>
                  <h3 className="font-heading text-base font-bold text-foreground flex items-center gap-2">
                    <Wallet className="size-5 text-primary" />
                    Alokasi Fisik Kas Akhir Hari
                  </h3>
                  <p className="text-xs text-muted-foreground">
                    Bagi uang fisik di kasir ke dalam 3 alokasi: Kas Tutup (modal besok), Receh, dan Tabungan/Setoran.
                  </p>
                </div>

                {/* Status Klop / Seimbang */}
                <Badge
                  className={cn(
                    "px-3 py-1 text-xs font-bold transition-all",
                    isBalanced
                      ? "bg-emerald-500/20 text-emerald-700 border-emerald-500/40 dark:text-emerald-300"
                      : "bg-amber-500/20 text-amber-700 border-amber-500/40 dark:text-amber-300 animate-pulse"
                  )}
                >
                  {isBalanced ? (
                    <span className="flex items-center gap-1.5">
                      <CheckCircle2 className="size-4" />
                      Seimbang / Klop (Selisih Rp 0)
                    </span>
                  ) : (
                    <span className="flex items-center gap-1.5">
                      <AlertCircle className="size-4" />
                      Selisih: {formatCurrency(Math.abs(variance))} ({variance > 0 ? "Kurang Alokasi" : "Lebih Alokasi"})
                    </span>
                  )}
                </Badge>
              </div>

              <div className="grid gap-4 sm:grid-cols-3">
                {/* 1. Kas Tutup */}
                <div className="space-y-2 rounded-xl border border-primary/30 bg-primary/5 p-3.5">
                  <div className="flex items-center justify-between">
                    <Label htmlFor="closingCash" className="text-xs font-bold text-primary flex items-center gap-1.5">
                      <Lock className="size-3.5" />
                      Kas Tutup (Ditinggal)
                    </Label>
                    <span className="text-[10px] text-muted-foreground">Modal Besok</span>
                  </div>
                  <Input
                    id="closingCash"
                    type="number"
                    min="0"
                    value={closingCash || ""}
                    onChange={(e) => setClosingCash(Number(e.target.value) || 0)}
                    placeholder="Contoh: 150000"
                    className="h-10 rounded-lg font-mono font-bold text-base"
                  />
                  <p className="text-[11px] text-muted-foreground leading-tight">
                    Uang yang tetap di laci, otomatis jadi <strong>Kas Awal esok hari</strong>.
                  </p>
                </div>

                {/* 2. Receh */}
                <div className="space-y-2 rounded-xl border border-border/70 bg-card p-3.5">
                  <div className="flex items-center justify-between">
                    <Label htmlFor="closingCoins" className="text-xs font-semibold flex items-center gap-1.5">
                      <Coins className="size-3.5 text-amber-500" />
                      Receh (Uang Koin)
                    </Label>
                  </div>
                  <Input
                    id="closingCoins"
                    type="number"
                    min="0"
                    value={closingCoins || ""}
                    onChange={(e) => setClosingCoins(Number(e.target.value) || 0)}
                    placeholder="Contoh: 135300"
                    className="h-10 rounded-lg font-mono font-bold text-base"
                  />
                  <p className="text-[11px] text-muted-foreground leading-tight">
                    Total uang pecahan kecil/koin yang dipisahkan.
                  </p>
                </div>

                {/* 3. Tabungan */}
                <div className="space-y-2 rounded-xl border border-border/70 bg-card p-3.5">
                  <div className="flex items-center justify-between">
                    <Label htmlFor="closingSavings" className="text-xs font-semibold flex items-center gap-1.5">
                      <PiggyBank className="size-3.5 text-emerald-500" />
                      Tabungan / Disetor
                    </Label>
                  </div>
                  <Input
                    id="closingSavings"
                    type="number"
                    min="0"
                    value={closingSavings || ""}
                    onChange={(e) => setClosingSavings(Number(e.target.value) || 0)}
                    placeholder="Contoh: 900000"
                    className="h-10 rounded-lg font-mono font-bold text-base text-emerald-600 dark:text-emerald-400"
                  />
                  <p className="text-[11px] text-muted-foreground leading-tight">
                    Uang laba/setoran yang ditarik pemilik atau disetor ke bank.
                  </p>
                </div>
              </div>

              {/* Catatan Tambahan */}
              <div className="space-y-1">
                <Label htmlFor="note" className="text-xs font-medium text-muted-foreground">
                  Catatan Harian (Opsional):
                </Label>
                <Input
                  id="note"
                  type="text"
                  placeholder="Keterangan tambahan shift/buku kas..."
                  value={note}
                  onChange={(e) => setNote(e.target.value)}
                  className="h-9 rounded-xl text-xs"
                />
              </div>
            </div>

            {/* Tombol Simpan */}
            <div className="flex flex-col sm:flex-row items-center justify-between gap-3 pt-2">
              <div className="text-xs text-muted-foreground">
                Menyimpan data akan langsung mengunci laporan tanggal <strong>{formatDate(reportDate)}</strong> dan
                mencatatnya ke laporan laba rugi bulanan.
              </div>
              <Button
                type="submit"
                disabled={isSubmitting}
                className="h-11 px-8 rounded-xl font-bold gap-2 text-sm shadow-md"
              >
                {isSubmitting ? <Loader2 className="size-4 animate-spin" /> : <CheckCircle2 className="size-4" />}
                {isSubmitting ? "Menyimpan Tutup Buku..." : "Simpan & Kunci Tutup Buku"}
              </Button>
            </div>
          </CardContent>
        </Card>
      </form>

      {/* Tabel Rantai Tutup Buku Bulanan (Berkesinambungan) */}
      <Card className="border-border/70 shadow-sm">
        <CardHeader className="pb-3">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
            <div>
              <CardTitle className="font-heading text-lg flex items-center gap-2">
                <CalendarDays className="size-5 text-primary" />
                Rekap Pembukuan Harian Berkesinambungan ({reportDate.slice(0, 7)})
              </CardTitle>
              <CardDescription>
                Tabel keterkaitan antar-hari: Kas Tutup hari ini otomatis menjadi Kas Awal hari esok.
              </CardDescription>
            </div>
            <Button
              variant="outline"
              size="sm"
              onClick={loadMonthData}
              disabled={isLoadingMonth}
              className="rounded-xl text-xs gap-1.5"
            >
              <RefreshCw className={cn("size-3.5", isLoadingMonth && "animate-spin")} />
              Perbarui Rekap
            </Button>
          </div>
        </CardHeader>

        <CardContent>
          {isLoadingMonth ? (
            <div className="flex h-32 items-center justify-center text-muted-foreground text-sm gap-2">
              <Loader2 className="size-4 animate-spin text-primary" />
              Memuat data pembukuan bulanan...
            </div>
          ) : monthClosings.length === 0 ? (
            <div className="flex min-h-[160px] flex-col items-center justify-center rounded-2xl border border-dashed border-border/70 p-6 text-center">
              <BookOpen className="size-8 text-muted-foreground/60 mb-2" />
              <p className="text-sm font-semibold text-foreground">Belum ada rekap harian bulan ini</p>
              <p className="text-xs text-muted-foreground mt-1 max-w-sm">
                Isi formulir di atas untuk menyimpan rekap hari pertama. Hari-hari berikutnya akan otomatis saling menyesuaikan.
              </p>
            </div>
          ) : (
            <div className="space-y-4">
              <div className="overflow-x-auto rounded-xl border border-border/60">
                <Table>
                  <TableHeader className="bg-muted/50">
                    <TableRow>
                      <TableHead className="w-28">Tanggal</TableHead>
                      <TableHead className="text-right">Kas Awal</TableHead>
                      <TableHead className="text-right text-emerald-600 dark:text-emerald-400 font-semibold">Pemasukan</TableHead>
                      <TableHead className="text-right text-rose-600 dark:text-rose-400">Pengeluaran</TableHead>
                      <TableHead className="text-right font-semibold">Sisa Kas</TableHead>
                      <TableHead className="text-right text-primary font-bold bg-primary/5">
                        Kas Tutup (Besok)
                      </TableHead>
                      <TableHead className="text-right">Receh</TableHead>
                      <TableHead className="text-right text-emerald-600 dark:text-emerald-400 font-bold">Tabungan</TableHead>
                      <TableHead className="text-center w-24">Status</TableHead>
                      <TableHead className="text-center w-20">Aksi</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {monthClosings.map((row, idx) => {
                      const nextRow = monthClosings[idx + 1];
                      const isConnected = nextRow ? nextRow.openingCash === row.closingCash : true;

                      return (
                        <TableRow key={row.id} className="hover:bg-muted/30">
                          <TableCell className="font-medium text-xs font-mono">
                            {formatDate(row.reportDate)}
                          </TableCell>
                          <TableCell className="text-right font-mono text-xs">
                            {formatCurrency(row.openingCash)}
                          </TableCell>
                          <TableCell className="text-right font-mono text-xs font-semibold text-emerald-600 dark:text-emerald-400">
                            {formatCurrency(row.revenue)}
                          </TableCell>
                          <TableCell className="text-right font-mono text-xs text-rose-600 dark:text-rose-400" title={`Toko: ${formatCurrency(row.totalStoreExpense)} | Titipan: ${formatCurrency(row.totalTitipanExpense)}`}>
                            {formatCurrency(row.totalExpense)}
                          </TableCell>
                          <TableCell className="text-right font-mono text-xs font-semibold">
                            {formatCurrency(row.netCash)}
                          </TableCell>
                          <TableCell className="text-right font-mono text-xs font-bold text-primary bg-primary/5">
                            <span className="inline-flex items-center gap-1 justify-end">
                              {formatCurrency(row.closingCash)}
                              {nextRow && (
                                <ArrowRight className="size-3 text-muted-foreground/60 shrink-0" />
                              )}
                            </span>
                          </TableCell>
                          <TableCell className="text-right font-mono text-xs">
                            {formatCurrency(row.closingCoins)}
                          </TableCell>
                          <TableCell className="text-right font-mono text-xs font-bold text-emerald-600 dark:text-emerald-400">
                            {formatCurrency(row.closingSavings)}
                          </TableCell>
                          <TableCell className="text-center">
                            <Badge variant="outline" className="text-[10px] px-1.5 py-0 border-emerald-500/40 text-emerald-600 bg-emerald-500/10">
                              Terkunci
                            </Badge>
                          </TableCell>
                          <TableCell className="text-center">
                            <div className="flex items-center justify-center gap-1">
                              <Button
                                type="button"
                                variant="ghost"
                                size="icon"
                                onClick={() => {
                                  setReportDate(row.reportDate);
                                  window.scrollTo({ top: 0, behavior: "smooth" });
                                }}
                                title="Buka & Edit"
                                className="size-7 text-muted-foreground hover:text-foreground"
                              >
                                <Pencil className="size-3.5" />
                              </Button>
                              <Button
                                type="button"
                                variant="ghost"
                                size="icon"
                                onClick={() => handleDelete(row.reportDate)}
                                title="Hapus"
                                className="size-7 text-muted-foreground hover:text-destructive"
                              >
                                <Trash2 className="size-3.5" />
                              </Button>
                            </div>
                          </TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              </div>

              {/* Ringkasan Akumulasi Bulan Berjalan */}
              <div className="grid gap-3 sm:grid-cols-4 rounded-xl border border-border/70 bg-card p-4">
                <div>
                  <p className="text-[11px] font-medium text-muted-foreground">Akumulasi Omzet Bulan Ini</p>
                  <p className="text-base font-extrabold font-mono text-emerald-600 dark:text-emerald-400 mt-0.5">
                    {formatCurrency(monthTotals.revenue)}
                  </p>
                </div>
                <div>
                  <p className="text-[11px] font-medium text-muted-foreground">Akumulasi Belanja Toko</p>
                  <p className="text-base font-bold font-mono text-rose-600 dark:text-rose-400 mt-0.5">
                    {formatCurrency(monthTotals.storeExpense)}
                  </p>
                </div>
                <div>
                  <p className="text-[11px] font-medium text-muted-foreground">Akumulasi Belanja Titipan</p>
                  <p className="text-base font-bold font-mono text-amber-600 dark:text-amber-400 mt-0.5">
                    {formatCurrency(monthTotals.titipanExpense)}
                  </p>
                </div>
                <div>
                  <p className="text-[11px] font-medium text-muted-foreground">Total Tabungan / Setoran Bank</p>
                  <p className="text-base font-extrabold font-mono text-primary mt-0.5">
                    {formatCurrency(monthTotals.savings)}
                  </p>
                </div>
              </div>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
