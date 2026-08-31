"use client";

import { useEffect, useMemo, useState } from "react";
import {
  AlertCircle,
  Banknote,
  BookOpen,
  Boxes,
  Calendar,
  CheckCircle2,
  ChevronRight,
  Coins,
  CreditCard,
  DollarSign,
  FileSpreadsheet,
  HandCoins,
  HelpCircle,
  Loader2,
  Package,
  PiggyBank,
  Receipt,
  RotateCcw,
  Scale,
  Search,
  Settings2,
  TrendingDown,
  TrendingUp,
  Users,
  Wallet,
} from "lucide-react";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
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
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { formatCurrency, formatNumber } from "@/lib/format";
import { cn } from "@/lib/utils";

type CategoryStock = {
  category: string;
  categoryValue: number;
  productCount: number;
  unitCount: number;
};

type PaymentChannel = {
  paymentMethod: string;
  total: number;
  count: number;
};

type ExpenseCategory = {
  category: string;
  amount: number;
  count: number;
};

type DebtorItem = {
  borrowerName: string;
  remainingAmount: number;
  whatsapp: string | null;
  count: number;
};

type SupplierPartner = {
  name: string;
  partnerType: string;
  liabilityAmount: number;
};

type CashierLedgerData = {
  period: string;
  cekStok: {
    inventoryCapital: number;
    totalProducts: number;
    totalUnits: number;
    categories: CategoryStock[];
  };
  pemasukan: {
    revenue: number;
    transactionCount: number;
    cogs: number;
    grossProfit: number;
    paymentChannels: PaymentChannel[];
  };
  pengeluaran: {
    total: number;
    categories: ExpenseCategory[];
  };
  piutangToko: {
    total: number;
    debtorCount: number;
    list: DebtorItem[];
  };
  hutangToko: {
    investorMoneyCapital: number;
    consignmentCapital: number;
    dailyConsignmentLiability: number;
    total: number;
    partners: SupplierPartner[];
  };
  cashPositions: {
    cash: number;
    coins: number;
    savings: number;
    total: number;
  };
  neraca: {
    kas: number;
    stokBarang: number;
    piutang: number;
    hutangToko: number;
    hutangTitipan: number;
    hutangInvestor: number;
    totalHutang: number;
    biayaOperasional: number;
    labaBersih: number;
  };
};

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

function currentMonthValue() {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
}

export function BukuKasKasirView() {
  const [period, setPeriod] = useState(currentMonthValue());
  const [data, setData] = useState<CashierLedgerData | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [searchDebtor, setSearchDebtor] = useState("");

  // Custom asset settings (persistent across sessions via localStorage)
  const [modalAwal, setModalAwal] = useState<number>(() => {
    if (typeof window !== "undefined") {
      const saved = localStorage.getItem("tokomu_ledger_modal_awal");
      if (saved) return Number(saved);
    }
    return 10700000; // Default Rp 10.700.000 seperti di catatan fisik
  });

  const [inventarisToko, setInventarisToko] = useState<number>(() => {
    if (typeof window !== "undefined") {
      const saved = localStorage.getItem("tokomu_ledger_inventaris");
      if (saved) return Number(saved);
    }
    return 6200000; // Default Rp 6.200.000 seperti di catatan fisik
  });

  const [showCase, setShowCase] = useState<number>(() => {
    if (typeof window !== "undefined") {
      const saved = localStorage.getItem("tokomu_ledger_showcase");
      if (saved) return Number(saved);
    }
    return 3800000; // Default Rp 3.800.000 seperti di catatan fisik
  });

  const [isConfigOpen, setIsConfigOpen] = useState(false);
  const [tempModalAwal, setTempModalAwal] = useState(modalAwal);
  const [tempInventaris, setTempInventaris] = useState(inventarisToko);
  const [tempShowCase, setTempShowCase] = useState(showCase);

  const [selectedYear, selectedMonth] = period.split("-");

  const currentYear = new Date().getFullYear();
  const yearOptions = useMemo(() => {
    const years = new Set<number>();
    for (let year = currentYear + 1; year >= currentYear - 4; year -= 1) {
      years.add(year);
    }
    years.add(Number(selectedYear));
    return Array.from(years).sort((a, b) => b - a);
  }, [currentYear, selectedYear]);

  const periodLabel = useMemo(() => {
    const m = monthOptions.find((opt) => opt.value === selectedMonth);
    return `${m?.label ?? selectedMonth} ${selectedYear}`;
  }, [selectedMonth, selectedYear]);

  async function fetchLedgerData() {
    setIsLoading(true);
    try {
      const res = await fetch(`/api/reports/cashier-ledger?period=${period}`, {
        cache: "no-store",
      });
      const json = await res.json();
      if (!res.ok) {
        throw new Error(json?.error ?? "Gagal memuat data pembukuan kasir.");
      }
      setData(json);
    } catch (err: any) {
      toast.error(err.message || "Gagal memuat buku kas.");
    } finally {
      setIsLoading(false);
    }
  }

  useEffect(() => {
    void fetchLedgerData();
  }, [period]);

  function handleSaveConfig() {
    setModalAwal(tempModalAwal);
    setInventarisToko(tempInventaris);
    setShowCase(tempShowCase);
    if (typeof window !== "undefined") {
      localStorage.setItem("tokomu_ledger_modal_awal", String(tempModalAwal));
      localStorage.setItem("tokomu_ledger_inventaris", String(tempInventaris));
      localStorage.setItem("tokomu_ledger_showcase", String(tempShowCase));
    }
    setIsConfigOpen(false);
    toast.success("Pengaturan modal dan inventaris berhasil disimpan.");
  }

  // Filtered debtors for search
  const filteredDebtors = useMemo(() => {
    if (!data?.piutangToko.list) return [];
    if (!searchDebtor.trim()) return data.piutangToko.list;
    const q = searchDebtor.toLowerCase();
    return data.piutangToko.list.filter((d) => d.borrowerName.toLowerCase().includes(q));
  }, [data?.piutangToko.list, searchDebtor]);

  // Neraca Physical Calculations (matches Image 2 exact formula)
  const neracaCalculations = useMemo(() => {
    if (!data) return null;

    const kas = data.neraca.kas;
    const stokDagangan = data.cekStok.inventoryCapital;
    const piutang = data.piutangToko.total;
    const inventaris = inventarisToko;
    const showcaseVal = showCase;

    // Total Aset = Kas + Stok + Inventaris + Showcase + Piutang
    const totalAset = kas + stokDagangan + inventaris + showcaseVal + piutang;

    // Hutang
    const hutangToko = data.hutangToko.consignmentCapital;
    const hutangSalesTitipan = data.hutangToko.dailyConsignmentLiability;
    const hutangInvestasi = data.hutangToko.investorMoneyCapital;
    const totalHutang = hutangToko + hutangSalesTitipan + hutangInvestasi;

    // Biaya Operasional / ATK
    const biayaOperasional = data.pengeluaran.total;

    // Formula buku fisik:
    // Laba / Rugi Berjalan = Total Aset - (Modal Awal + Total Hutang + Biaya Operasional)
    const totalKewajibanDanModal = modalAwal + totalHutang + biayaOperasional;
    const labaRugiBerjalan = totalAset - totalKewajibanDanModal;

    return {
      kas,
      stokDagangan,
      inventaris,
      showcaseVal,
      piutang,
      totalAset,
      hutangToko,
      hutangSalesTitipan,
      hutangInvestasi,
      totalHutang,
      biayaOperasional,
      modalAwal,
      totalKewajibanDanModal,
      labaRugiBerjalan,
      isSurplus: labaRugiBerjalan >= 0,
    };
  }, [data, modalAwal, inventarisToko, showCase]);

  return (
    <div className="w-full space-y-6 animate-in fade-in slide-in-from-bottom-2 duration-500">
      {/* Header Bar & Period Selector */}
      <div className="flex flex-col gap-4 rounded-3xl border border-border/70 bg-gradient-to-r from-card via-card/90 to-primary/5 p-5 sm:flex-row sm:items-center sm:justify-between shadow-sm">
        <div className="flex items-center gap-3.5">
          <div className="flex size-12 items-center justify-center rounded-2xl bg-primary/15 text-primary shadow-inner">
            <BookOpen className="size-6" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h2 className="font-heading text-xl sm:text-2xl font-bold tracking-tight text-foreground">
                Buku Laporan Kasir
              </h2>
              <Badge variant="outline" className="rounded-full bg-primary/10 text-primary border-primary/20 text-xs px-2.5 py-0.5 font-semibold">
                Format Pembukuan Toko
              </Badge>
            </div>
            <p className="text-xs sm:text-sm text-muted-foreground mt-0.5">
              Cek Stok, Pemasukan, Pengeluaran, Piutang, Hutang, hingga Neraca Laba/Rugi Berjalan.
            </p>
          </div>
        </div>

        {/* Period Selector & Action */}
        <div className="flex flex-wrap items-center gap-2.5">
          <div className="flex items-center gap-1.5 rounded-2xl border border-border/80 bg-background/80 p-1 shadow-inner">
            <Select
              value={selectedMonth}
              onValueChange={(month) => {
                if (month) setPeriod(`${selectedYear}-${month}`);
              }}
            >
              <SelectTrigger className="h-9 w-[130px] rounded-xl border-0 bg-transparent text-xs font-semibold focus:ring-0">
                <SelectValue />
              </SelectTrigger>
              <SelectContent align="start" className="rounded-xl">
                {monthOptions.map((m) => (
                  <SelectItem key={m.value} value={m.value} className="text-xs">
                    {m.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

            <Select
              value={selectedYear}
              onValueChange={(year) => {
                if (year) setPeriod(`${year}-${selectedMonth}`);
              }}
            >
              <SelectTrigger className="h-9 w-[85px] rounded-xl border-0 bg-muted/50 text-xs font-semibold focus:ring-0">
                <SelectValue />
              </SelectTrigger>
              <SelectContent align="end" className="rounded-xl">
                {yearOptions.map((y) => (
                  <SelectItem key={y} value={String(y)} className="text-xs">
                    {y}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <Button
            variant="outline"
            size="sm"
            className="h-10 rounded-2xl gap-1.5 text-xs font-medium"
            onClick={() => {
              setTempModalAwal(modalAwal);
              setTempInventaris(inventarisToko);
              setTempShowCase(showCase);
              setIsConfigOpen(true);
            }}
          >
            <Settings2 className="size-3.5 text-primary" />
            Atur Modal & Aset
          </Button>

          <Button
            variant="ghost"
            size="icon"
            className="size-10 rounded-2xl"
            disabled={isLoading}
            onClick={() => void fetchLedgerData()}
          >
            <RotateCcw className={cn("size-4", isLoading && "animate-spin")} />
          </Button>
        </div>
      </div>

      {isLoading ? (
        <Card className="border-border/60 bg-card/60">
          <CardContent className="flex min-h-72 flex-col items-center justify-center gap-3 text-muted-foreground">
            <Loader2 className="size-8 animate-spin text-primary" />
            <p className="text-sm font-medium">Memuat data buku laporan kasir periode {periodLabel}...</p>
          </CardContent>
        </Card>
      ) : !data ? (
        <Card className="border-border/60 bg-card/60">
          <CardContent className="flex min-h-60 flex-col items-center justify-center gap-3 text-center">
            <AlertCircle className="size-8 text-destructive" />
            <p className="text-sm font-medium">Gagal memuat rincian laporan periode ini.</p>
            <Button variant="outline" size="sm" onClick={() => void fetchLedgerData()}>
              Coba Lagi
            </Button>
          </CardContent>
        </Card>
      ) : (
        <>
          {/* 4 Stat Cards Ringkasan Atas */}
          <div className="grid gap-4 grid-cols-2 lg:grid-cols-4">
            <Card className="rounded-3xl border-border/70 bg-card/70 backdrop-blur-md shadow-sm transition-all hover:border-primary/40">
              <CardContent className="p-4 sm:p-5">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                    Cek Stok Barang
                  </span>
                  <div className="flex size-7 items-center justify-center rounded-xl bg-blue-500/15 text-blue-600 dark:text-blue-400">
                    <Package className="size-4" />
                  </div>
                </div>
                <p className="mt-2 font-heading text-xl sm:text-2xl font-bold text-foreground tabular-nums">
                  {formatCurrency(data.cekStok.inventoryCapital)}
                </p>
                <p className="mt-1 text-xs text-muted-foreground">
                  {data.cekStok.totalProducts} SKU ({formatNumber(data.cekStok.totalUnits)} unit)
                </p>
              </CardContent>
            </Card>

            <Card className="rounded-3xl border-border/70 bg-card/70 backdrop-blur-md shadow-sm transition-all hover:border-primary/40">
              <CardContent className="p-4 sm:p-5">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                    Total Pemasukan
                  </span>
                  <div className="flex size-7 items-center justify-center rounded-xl bg-emerald-500/15 text-emerald-600 dark:text-emerald-400">
                    <TrendingUp className="size-4" />
                  </div>
                </div>
                <p className="mt-2 font-heading text-xl sm:text-2xl font-bold text-emerald-600 dark:text-emerald-400 tabular-nums">
                  {formatCurrency(data.pemasukan.revenue)}
                </p>
                <p className="mt-1 text-xs text-muted-foreground">
                  {data.pemasukan.transactionCount} transaksi di {periodLabel}
                </p>
              </CardContent>
            </Card>

            <Card className="rounded-3xl border-border/70 bg-card/70 backdrop-blur-md shadow-sm transition-all hover:border-primary/40">
              <CardContent className="p-4 sm:p-5">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                    Total Pengeluaran
                  </span>
                  <div className="flex size-7 items-center justify-center rounded-xl bg-rose-500/15 text-rose-600 dark:text-rose-400">
                    <TrendingDown className="size-4" />
                  </div>
                </div>
                <p className="mt-2 font-heading text-xl sm:text-2xl font-bold text-rose-600 dark:text-rose-400 tabular-nums">
                  {formatCurrency(data.pengeluaran.total)}
                </p>
                <p className="mt-1 text-xs text-muted-foreground">
                  {data.pengeluaran.categories.length} kategori operasional/restok
                </p>
              </CardContent>
            </Card>

            <Card
              className={cn(
                "rounded-3xl border shadow-sm transition-all",
                neracaCalculations?.isSurplus
                  ? "border-emerald-500/30 bg-emerald-500/5 hover:border-emerald-500/50"
                  : "border-rose-500/30 bg-rose-500/5 hover:border-rose-500/50"
              )}
            >
              <CardContent className="p-4 sm:p-5">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                    {neracaCalculations?.isSurplus ? "Laba Berjalan" : "Rugi Berjalan"}
                  </span>
                  <div
                    className={cn(
                      "flex size-7 items-center justify-center rounded-xl",
                      neracaCalculations?.isSurplus
                        ? "bg-emerald-500/20 text-emerald-600 dark:text-emerald-400"
                        : "bg-rose-500/20 text-rose-600 dark:text-rose-400"
                    )}
                  >
                    <Scale className="size-4" />
                  </div>
                </div>
                <p
                  className={cn(
                    "mt-2 font-heading text-xl sm:text-2xl font-bold tabular-nums",
                    neracaCalculations?.isSurplus
                      ? "text-emerald-600 dark:text-emerald-400"
                      : "text-rose-600 dark:text-rose-400"
                  )}
                >
                  {formatCurrency(neracaCalculations?.labaRugiBerjalan ?? 0)}
                </p>
                <p className="mt-1 text-xs text-muted-foreground">
                  Aset − (Modal Awal + Hutang + Biaya)
                </p>
              </CardContent>
            </Card>
          </div>

          {/* Kolom 1 & 2: Cek Stok & Pemasukan */}
          <div className="grid gap-6 lg:grid-cols-2">
            {/* 1. KARTU CEK STOK (Stok Barang Dagangan) */}
            <Card className="rounded-3xl border-border/70 bg-card/75 shadow-sm overflow-hidden flex flex-col">
              <CardHeader className="border-b border-border/50 pb-4 bg-muted/20">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2.5">
                    <div className="flex size-9 items-center justify-center rounded-xl bg-blue-500/15 text-blue-600 dark:text-blue-400">
                      <Boxes className="size-5" />
                    </div>
                    <div>
                      <CardTitle className="font-heading text-lg font-bold">1. Cek Stok Barang Dagangan</CardTitle>
                      <CardDescription className="text-xs">
                        Nilai modal beli (HPP) stok fisik toko
                      </CardDescription>
                    </div>
                  </div>
                  <Badge variant="outline" className="rounded-full bg-emerald-500/10 text-emerald-600 border-emerald-500/20 text-xs px-2.5 py-0.5 gap-1">
                    <CheckCircle2 className="size-3" />
                    Stok Terhitung
                  </Badge>
                </div>
              </CardHeader>

              <CardContent className="p-5 space-y-4 flex-1 flex flex-col justify-between">
                <div>
                  <div className="rounded-2xl bg-muted/40 p-4 border border-border/60 mb-4">
                    <div className="flex items-center justify-between text-xs text-muted-foreground mb-1">
                      <span>Total Nilai Beli Stok (HPP)</span>
                      <span>{data.cekStok.totalProducts} Produk Aktif</span>
                    </div>
                    <p className="font-heading text-2xl sm:text-3xl font-bold text-primary tabular-nums">
                      {formatCurrency(data.cekStok.inventoryCapital)}
                    </p>
                  </div>

                  <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-2">
                    Rincian Nilai per Kategori / Bagian
                  </p>

                  <div className="space-y-2 max-h-56 overflow-y-auto pr-1">
                    {data.cekStok.categories.length > 0 ? (
                      data.cekStok.categories.map((cat, idx) => (
                        <div
                          key={cat.category}
                          className="flex items-center justify-between rounded-xl border border-border/50 bg-card/60 p-2.5 text-xs transition-colors hover:bg-muted/30"
                        >
                          <div className="flex items-center gap-2.5">
                            <span className="flex size-5 items-center justify-center rounded-lg bg-muted text-[10px] font-bold text-muted-foreground">
                              {idx + 1}
                            </span>
                            <div>
                              <p className="font-semibold text-foreground">{cat.category}</p>
                              <p className="text-[10px] text-muted-foreground">
                                {cat.productCount} SKU • {formatNumber(cat.unitCount)} unit
                              </p>
                            </div>
                          </div>
                          <span className="font-bold text-foreground tabular-nums">
                            {formatCurrency(cat.categoryValue)}
                          </span>
                        </div>
                      ))
                    ) : (
                      <p className="text-xs text-muted-foreground py-4 text-center">
                        Belum ada stok barang tercatat di database.
                      </p>
                    )}
                  </div>
                </div>

                <div className="pt-3 border-t border-dashed border-border/70 flex items-center justify-between text-xs font-medium text-muted-foreground">
                  <span>Total Akumulasi Stok Dagangan</span>
                  <span className="font-bold text-foreground tabular-nums">
                    {formatCurrency(data.cekStok.inventoryCapital)}
                  </span>
                </div>
              </CardContent>
            </Card>

            {/* 2. KARTU PEMASUKAN */}
            <Card className="rounded-3xl border-border/70 bg-card/75 shadow-sm overflow-hidden flex flex-col">
              <CardHeader className="border-b border-border/50 pb-4 bg-muted/20">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2.5">
                    <div className="flex size-9 items-center justify-center rounded-xl bg-emerald-500/15 text-emerald-600 dark:text-emerald-400">
                      <TrendingUp className="size-5" />
                    </div>
                    <div>
                      <CardTitle className="font-heading text-lg font-bold">2. Pemasukan (Omzet Penjualan)</CardTitle>
                      <CardDescription className="text-xs">
                        Arus penjualan masuk selama {periodLabel}
                      </CardDescription>
                    </div>
                  </div>
                  <Badge variant="outline" className="rounded-full bg-primary/10 text-primary border-primary/20 text-xs px-2.5 py-0.5">
                    {data.pemasukan.transactionCount} Transaksi
                  </Badge>
                </div>
              </CardHeader>

              <CardContent className="p-5 space-y-4 flex-1 flex flex-col justify-between">
                <div>
                  <div className="rounded-2xl bg-muted/40 p-4 border border-border/60 mb-4">
                    <div className="flex items-center justify-between text-xs text-muted-foreground mb-1">
                      <span>Total Omzet Penjualan</span>
                      <span>Laba Kotor: {formatCurrency(data.pemasukan.grossProfit)}</span>
                    </div>
                    <p className="font-heading text-2xl sm:text-3xl font-bold text-emerald-600 dark:text-emerald-400 tabular-nums">
                      {formatCurrency(data.pemasukan.revenue)}
                    </p>
                  </div>

                  <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-2">
                    Kanal Pembayaran Masuk
                  </p>

                  <div className="space-y-2">
                    {data.pemasukan.paymentChannels.length > 0 ? (
                      data.pemasukan.paymentChannels.map((ch) => {
                        const label =
                          ch.paymentMethod === "cash" || ch.paymentMethod === "Tunai"
                            ? "Tunai / Cash"
                            : ch.paymentMethod === "qris" || ch.paymentMethod === "QRIS"
                            ? "QRIS Digital"
                            : ch.paymentMethod === "transfer" || ch.paymentMethod === "Transfer"
                            ? "Transfer Bank"
                            : ch.paymentMethod === "kasbon" || ch.paymentMethod === "Kasbon"
                            ? "Kasbon Pelanggan (Piutang)"
                            : ch.paymentMethod;

                        return (
                          <div
                            key={ch.paymentMethod}
                            className="flex items-center justify-between rounded-xl border border-border/50 bg-card/60 p-2.5 text-xs transition-colors hover:bg-muted/30"
                          >
                            <div className="flex items-center gap-2">
                              <div className="size-2 rounded-full bg-emerald-500" />
                              <span className="font-semibold text-foreground">{label}</span>
                              <span className="text-[10px] text-muted-foreground">
                                ({ch.count} nota)
                              </span>
                            </div>
                            <span className="font-bold text-foreground tabular-nums">
                              {formatCurrency(ch.total)}
                            </span>
                          </div>
                        );
                      })
                    ) : (
                      <div className="flex items-center justify-between rounded-xl border border-border/50 bg-card/60 p-2.5 text-xs">
                        <span className="font-semibold text-foreground">Pemasukan Penjualan POS</span>
                        <span className="font-bold text-foreground tabular-nums">
                          {formatCurrency(data.pemasukan.revenue)}
                        </span>
                      </div>
                    )}
                  </div>
                </div>

                <div className="pt-3 border-t border-dashed border-border/70 flex items-center justify-between text-xs font-medium text-muted-foreground">
                  <span>Total Pemasukan Periode Ini</span>
                  <span className="font-bold text-emerald-600 dark:text-emerald-400 tabular-nums">
                    {formatCurrency(data.pemasukan.revenue)}
                  </span>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Kolom 3 & 4: Pengeluaran & Piutang Toko */}
          <div className="grid gap-6 lg:grid-cols-2">
            {/* 3. KARTU PENGELUARAN */}
            <Card className="rounded-3xl border-border/70 bg-card/75 shadow-sm overflow-hidden flex flex-col">
              <CardHeader className="border-b border-border/50 pb-4 bg-muted/20">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2.5">
                    <div className="flex size-9 items-center justify-center rounded-xl bg-rose-500/15 text-rose-600 dark:text-rose-400">
                      <Receipt className="size-5" />
                    </div>
                    <div>
                      <CardTitle className="font-heading text-lg font-bold">3. Pengeluaran & Beban Operasional</CardTitle>
                      <CardDescription className="text-xs">
                        Biaya belanja, ATK, dan operasional toko
                      </CardDescription>
                    </div>
                  </div>
                  <Badge variant="outline" className="rounded-full bg-rose-500/10 text-rose-600 border-rose-500/20 text-xs px-2.5 py-0.5">
                    Beban Toko
                  </Badge>
                </div>
              </CardHeader>

              <CardContent className="p-5 space-y-4 flex-1 flex flex-col justify-between">
                <div>
                  <div className="rounded-2xl bg-muted/40 p-4 border border-border/60 mb-4">
                    <div className="flex items-center justify-between text-xs text-muted-foreground mb-1">
                      <span>Total Beban Pengeluaran</span>
                      <span>{data.pengeluaran.categories.length} Pos Pengeluaran</span>
                    </div>
                    <p className="font-heading text-2xl sm:text-3xl font-bold text-rose-600 dark:text-rose-400 tabular-nums">
                      {formatCurrency(data.pengeluaran.total)}
                    </p>
                  </div>

                  <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-2">
                    Rincian Pos Biaya Pengeluaran
                  </p>

                  <div className="space-y-2 max-h-56 overflow-y-auto pr-1">
                    {data.pengeluaran.categories.length > 0 ? (
                      data.pengeluaran.categories.map((exp, idx) => (
                        <div
                          key={exp.category}
                          className="flex items-center justify-between rounded-xl border border-border/50 bg-card/60 p-2.5 text-xs transition-colors hover:bg-muted/30"
                        >
                          <div className="flex items-center gap-2">
                            <span className="flex size-5 items-center justify-center rounded-lg bg-rose-500/10 text-[10px] font-bold text-rose-600">
                              {idx + 1}
                            </span>
                            <div>
                              <p className="font-semibold text-foreground">{exp.category}</p>
                              <p className="text-[10px] text-muted-foreground">{exp.count} kali transaksi</p>
                            </div>
                          </div>
                          <span className="font-bold text-rose-600 dark:text-rose-400 tabular-nums">
                            {formatCurrency(exp.amount)}
                          </span>
                        </div>
                      ))
                    ) : (
                      <p className="text-xs text-muted-foreground py-4 text-center">
                        Belum ada beban pengeluaran pada periode {periodLabel}.
                      </p>
                    )}
                  </div>
                </div>

                <div className="pt-3 border-t border-dashed border-border/70 flex items-center justify-between text-xs font-medium text-muted-foreground">
                  <span>Total Pengeluaran</span>
                  <span className="font-bold text-rose-600 dark:text-rose-400 tabular-nums">
                    {formatCurrency(data.pengeluaran.total)}
                  </span>
                </div>
              </CardContent>
            </Card>

            {/* 4. KARTU PIUTANG TOKO (Kasbon Pelanggan) */}
            <Card className="rounded-3xl border-border/70 bg-card/75 shadow-sm overflow-hidden flex flex-col">
              <CardHeader className="border-b border-border/50 pb-4 bg-muted/20">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2.5">
                    <div className="flex size-9 items-center justify-center rounded-xl bg-orange-500/15 text-orange-600 dark:text-orange-400">
                      <Users className="size-5" />
                    </div>
                    <div>
                      <CardTitle className="font-heading text-lg font-bold">4. Piutang Toko (Kasbon Pelanggan)</CardTitle>
                      <CardDescription className="text-xs">
                        Daftar pelanggan yang masih memiliki tagihan kasbon
                      </CardDescription>
                    </div>
                  </div>
                  <Badge variant="outline" className="rounded-full bg-orange-500/10 text-orange-600 border-orange-500/20 text-xs px-2.5 py-0.5">
                    {data.piutangToko.debtorCount} Orang
                  </Badge>
                </div>
              </CardHeader>

              <CardContent className="p-5 space-y-4 flex-1 flex flex-col justify-between">
                <div>
                  <div className="rounded-2xl bg-muted/40 p-4 border border-border/60 mb-3">
                    <div className="flex items-center justify-between text-xs text-muted-foreground mb-1">
                      <span>Total Piutang Belum Lunas</span>
                      <span>{data.piutangToko.debtorCount} Pelanggan</span>
                    </div>
                    <p className="font-heading text-2xl sm:text-3xl font-bold text-orange-600 dark:text-orange-400 tabular-nums">
                      {formatCurrency(data.piutangToko.total)}
                    </p>
                  </div>

                  <div className="relative mb-2">
                    <Search className="size-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
                    <Input
                      placeholder="Cari nama peminjam..."
                      value={searchDebtor}
                      onChange={(e) => setSearchDebtor(e.target.value)}
                      className="h-8 pl-8 text-xs rounded-xl bg-background/80"
                    />
                  </div>

                  <div className="space-y-1.5 max-h-52 overflow-y-auto pr-1">
                    {filteredDebtors.length > 0 ? (
                      filteredDebtors.map((d, idx) => (
                        <div
                          key={`${d.borrowerName}-${idx}`}
                          className="flex items-center justify-between rounded-xl border border-border/40 bg-card/60 p-2 text-xs transition-colors hover:bg-muted/30"
                        >
                          <div className="flex items-center gap-2">
                            <span className="size-1.5 rounded-full bg-orange-500" />
                            <span className="font-medium text-foreground">{d.borrowerName}</span>
                          </div>
                          <span className="font-bold text-foreground tabular-nums">
                            {formatCurrency(d.remainingAmount)}
                          </span>
                        </div>
                      ))
                    ) : (
                      <p className="text-xs text-muted-foreground py-4 text-center">
                        {searchDebtor ? "Tidak ada nama yang cocok." : "Tidak ada piutang aktif."}
                      </p>
                    )}
                  </div>
                </div>

                <div className="pt-3 border-t border-dashed border-border/70 flex items-center justify-between text-xs font-medium text-muted-foreground">
                  <span>Total Tagihan Piutang Toko</span>
                  <span className="font-bold text-orange-600 dark:text-orange-400 tabular-nums">
                    {formatCurrency(data.piutangToko.total)}
                  </span>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Kolom 5: Hutang Toko & Titipan */}
          <Card className="rounded-3xl border-border/70 bg-card/75 shadow-sm overflow-hidden">
            <CardHeader className="border-b border-border/50 pb-4 bg-muted/20">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2.5">
                  <div className="flex size-9 items-center justify-center rounded-xl bg-amber-500/15 text-amber-600 dark:text-amber-400">
                    <HandCoins className="size-5" />
                  </div>
                  <div>
                    <CardTitle className="font-heading text-lg font-bold">5. Hutang Toko & Titipan Konsinyasi</CardTitle>
                    <CardDescription className="text-xs">
                      Kewajiban pembayaran ke supplier, sales titipan, dan investor
                    </CardDescription>
                  </div>
                </div>
                <span className="font-heading text-lg font-bold text-amber-600 dark:text-amber-400 tabular-nums">
                  Total: {formatCurrency(data.hutangToko.total)}
                </span>
              </div>
            </CardHeader>

            <CardContent className="p-5">
              <div className="grid gap-3 sm:grid-cols-3">
                <div className="rounded-2xl border border-border/60 bg-muted/30 p-4">
                  <p className="text-xs text-muted-foreground">Hutang Toko (Supplier / Kulakan)</p>
                  <p className="mt-1 font-heading text-xl font-bold text-foreground tabular-nums">
                    {formatCurrency(data.hutangToko.consignmentCapital)}
                  </p>
                  <p className="mt-1 text-[11px] text-muted-foreground">Barang titip jual konsinyasi</p>
                </div>

                <div className="rounded-2xl border border-border/60 bg-muted/30 p-4">
                  <p className="text-xs text-muted-foreground">Hutang Sales Titipan Harian</p>
                  <p className="mt-1 font-heading text-xl font-bold text-foreground tabular-nums">
                    {formatCurrency(data.hutangToko.dailyConsignmentLiability)}
                  </p>
                  <p className="mt-1 text-[11px] text-muted-foreground">Kewajiban titipan harian laku</p>
                </div>

                <div className="rounded-2xl border border-border/60 bg-muted/30 p-4">
                  <p className="text-xs text-muted-foreground">Hutang Modal Investasi</p>
                  <p className="mt-1 font-heading text-xl font-bold text-foreground tabular-nums">
                    {formatCurrency(data.hutangToko.investorMoneyCapital)}
                  </p>
                  <p className="mt-1 text-[11px] text-muted-foreground">Suntikan dana modal uang</p>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Kolom 6: NERACA FISIK & LABA/RUGI BERJALAN (Image 2) */}
          {neracaCalculations ? (
            <Card className="rounded-[32px] border-2 border-primary/30 bg-gradient-to-b from-card via-card to-primary/5 shadow-lg overflow-hidden">
              <CardHeader className="border-b border-border/60 bg-primary/10 pb-5 pt-6">
                <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                  <div className="flex items-center gap-3">
                    <div className="flex size-11 items-center justify-center rounded-2xl bg-primary text-primary-foreground shadow-md">
                      <Scale className="size-6" />
                    </div>
                    <div>
                      <h3 className="font-heading text-2xl font-bold text-foreground">
                        Laporan Laba / Rugi Berjalan ({periodLabel})
                      </h3>
                      <p className="text-xs sm:text-sm text-muted-foreground">
                        Neraca fisik toko: Perbandingan Posisi Harta/Aset dengan Modal Awal &amp; Kewajiban
                      </p>
                    </div>
                  </div>

                  <div className="flex items-center gap-2">
                    <div className="rounded-2xl bg-background/90 px-4 py-2 border border-border/70 shadow-sm text-right">
                      <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
                        Modal Awal Toko
                      </p>
                      <p className="font-heading text-base font-bold text-primary tabular-nums">
                        {formatCurrency(neracaCalculations.modalAwal)}
                      </p>
                    </div>
                  </div>
                </div>
              </CardHeader>

              <CardContent className="p-6 sm:p-8 space-y-8">
                <div className="grid gap-8 lg:grid-cols-2">
                  {/* TABEL ASET / HARTA */}
                  <div className="space-y-3 rounded-2xl border border-border/70 bg-card/80 p-5 shadow-sm">
                    <div className="flex items-center justify-between border-b border-border/60 pb-3">
                      <div className="flex items-center gap-2">
                        <Wallet className="size-4 text-emerald-600" />
                        <h4 className="font-heading font-bold text-base text-foreground">A. Posisi Harta / Aset Toko</h4>
                      </div>
                      <Badge variant="outline" className="bg-emerald-500/10 text-emerald-600 border-emerald-500/20 text-xs">
                        Aktiva
                      </Badge>
                    </div>

                    <div className="space-y-2.5 text-sm">
                      <div className="flex justify-between items-center py-1 border-b border-border/40">
                        <span className="text-muted-foreground">1. Kas Toko (Laci kas / receh / tabungan)</span>
                        <span className="font-semibold text-foreground tabular-nums">
                          {formatCurrency(neracaCalculations.kas)}
                        </span>
                      </div>

                      <div className="flex justify-between items-center py-1 border-b border-border/40">
                        <span className="text-muted-foreground">2. Stok Barang Dagangan (Hasil Cek Stok)</span>
                        <span className="font-semibold text-foreground tabular-nums">
                          {formatCurrency(neracaCalculations.stokDagangan)}
                        </span>
                      </div>

                      <div className="flex justify-between items-center py-1 border-b border-border/40">
                        <span className="text-muted-foreground">3. Inventaris Toko</span>
                        <span className="font-semibold text-foreground tabular-nums">
                          {formatCurrency(neracaCalculations.inventaris)}
                        </span>
                      </div>

                      <div className="flex justify-between items-center py-1 border-b border-border/40">
                        <span className="text-muted-foreground">4. Show Case / Rak Peralatan</span>
                        <span className="font-semibold text-foreground tabular-nums">
                          {formatCurrency(neracaCalculations.showcaseVal)}
                        </span>
                      </div>

                      <div className="flex justify-between items-center py-1 border-b border-border/40">
                        <span className="text-muted-foreground">5. Piutang Toko (Kasbon Pelanggan)</span>
                        <span className="font-semibold text-foreground tabular-nums">
                          {formatCurrency(neracaCalculations.piutang)}
                        </span>
                      </div>
                    </div>

                    <div className="mt-4 pt-3 border-t-2 border-emerald-500/40 flex justify-between items-center">
                      <span className="font-bold text-foreground">Total Nilai Harta / Aset</span>
                      <span className="font-heading text-lg font-bold text-emerald-600 dark:text-emerald-400 tabular-nums">
                        {formatCurrency(neracaCalculations.totalAset)}
                      </span>
                    </div>
                  </div>

                  {/* TABEL HUTANG & BIAYA */}
                  <div className="space-y-3 rounded-2xl border border-border/70 bg-card/80 p-5 shadow-sm">
                    <div className="flex items-center justify-between border-b border-border/60 pb-3">
                      <div className="flex items-center gap-2">
                        <Receipt className="size-4 text-rose-600" />
                        <h4 className="font-heading font-bold text-base text-foreground">B. Hutang, Modal &amp; Beban</h4>
                      </div>
                      <Badge variant="outline" className="bg-rose-500/10 text-rose-600 border-rose-500/20 text-xs">
                        Pasiva &amp; Beban
                      </Badge>
                    </div>

                    <div className="space-y-2.5 text-sm">
                      <div className="flex justify-between items-center py-1 border-b border-border/40">
                        <span className="text-muted-foreground">1. Modal Awal Toko</span>
                        <span className="font-semibold text-foreground tabular-nums">
                          {formatCurrency(neracaCalculations.modalAwal)}
                        </span>
                      </div>

                      <div className="flex justify-between items-center py-1 border-b border-border/40">
                        <span className="text-muted-foreground">2. Hutang Toko (Supplier / Kulakan)</span>
                        <span className="font-semibold text-foreground tabular-nums">
                          {formatCurrency(neracaCalculations.hutangToko)}
                        </span>
                      </div>

                      <div className="flex justify-between items-center py-1 border-b border-border/40">
                        <span className="text-muted-foreground">3. Hutang Sales Titipan</span>
                        <span className="font-semibold text-foreground tabular-nums">
                          {formatCurrency(neracaCalculations.hutangSalesTitipan)}
                        </span>
                      </div>

                      <div className="flex justify-between items-center py-1 border-b border-border/40">
                        <span className="text-muted-foreground">4. Hutang Modal Investasi</span>
                        <span className="font-semibold text-foreground tabular-nums">
                          {formatCurrency(neracaCalculations.hutangInvestasi)}
                        </span>
                      </div>

                      <div className="flex justify-between items-center py-1 border-b border-border/40">
                        <span className="text-muted-foreground">5. Biaya ATK &amp; Pengeluaran</span>
                        <span className="font-semibold text-foreground tabular-nums">
                          {formatCurrency(neracaCalculations.biayaOperasional)}
                        </span>
                      </div>
                    </div>

                    <div className="mt-4 pt-3 border-t-2 border-rose-500/40 flex justify-between items-center">
                      <span className="font-bold text-foreground">Total Kewajiban &amp; Modal</span>
                      <span className="font-heading text-lg font-bold text-rose-600 dark:text-rose-400 tabular-nums">
                        {formatCurrency(neracaCalculations.totalKewajibanDanModal)}
                      </span>
                    </div>
                  </div>
                </div>

                {/* HASIL AKHIR: LABA / RUGI BERJALAN CALLOUT */}
                <div
                  className={cn(
                    "rounded-3xl p-6 border-2 flex flex-col md:flex-row items-center justify-between gap-6 shadow-md transition-all",
                    neracaCalculations.isSurplus
                      ? "border-emerald-500 bg-emerald-500/10 text-emerald-950 dark:text-emerald-100"
                      : "border-rose-500 bg-rose-500/10 text-rose-950 dark:text-rose-100"
                  )}
                >
                  <div className="flex items-center gap-4">
                    <div
                      className={cn(
                        "flex size-14 shrink-0 items-center justify-center rounded-2xl shadow-inner",
                        neracaCalculations.isSurplus
                          ? "bg-emerald-500 text-white"
                          : "bg-rose-500 text-white"
                      )}
                    >
                      {neracaCalculations.isSurplus ? (
                        <TrendingUp className="size-8" />
                      ) : (
                        <TrendingDown className="size-8" />
                      )}
                    </div>
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="text-xs font-bold uppercase tracking-wider opacity-80">
                          Hasil Pembukuan Fisik
                        </span>
                        <span
                          className={cn(
                            "rounded-full px-2.5 py-0.5 text-xs font-extrabold",
                            neracaCalculations.isSurplus
                              ? "bg-emerald-600 text-white"
                              : "bg-rose-600 text-white"
                          )}
                        >
                          {neracaCalculations.isSurplus ? "SURPLUS LABA" : "RUGI BERJALAN"}
                        </span>
                      </div>
                      <h4 className="font-heading text-xl sm:text-2xl font-bold mt-1">
                        {neracaCalculations.isSurplus ? "Laba Toko Bulan " : "Rugi Toko Bulan "}
                        {periodLabel}
                      </h4>
                      <p className="text-xs opacity-75 mt-0.5">
                        Rumus: Total Aset ({formatCurrency(neracaCalculations.totalAset)}) − Total Kewajiban &amp; Modal ({formatCurrency(neracaCalculations.totalKewajibanDanModal)})
                      </p>
                    </div>
                  </div>

                  <div className="text-center md:text-right shrink-0">
                    <p
                      className={cn(
                        "font-heading text-3xl sm:text-4xl font-extrabold tabular-nums tracking-tight",
                        neracaCalculations.isSurplus
                          ? "text-emerald-700 dark:text-emerald-300"
                          : "text-rose-700 dark:text-rose-300"
                      )}
                    >
                      {formatCurrency(neracaCalculations.labaRugiBerjalan)}
                    </p>
                    <p className="text-xs opacity-80 mt-1 font-medium">
                      Status: {neracaCalculations.isSurplus ? "Surplus Berjalan" : "Rugi Berjalan"}
                    </p>
                  </div>
                </div>
              </CardContent>
            </Card>
          ) : null}
        </>
      )}

      {/* Modal Pengaturan Modal Awal & Inventaris */}
      <Dialog open={isConfigOpen} onOpenChange={setIsConfigOpen}>
        <DialogContent className="sm:max-w-[480px] rounded-3xl p-6">
          <DialogHeader>
            <DialogTitle className="font-heading text-xl font-bold">
              Atur Nilai Modal &amp; Inventaris
            </DialogTitle>
            <DialogDescription className="text-xs text-muted-foreground">
              Nilai modal awal dan inventaris toko disimpan secara aman untuk menghitung neraca fisik dan laba/rugi berjalan.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-3">
            <div className="space-y-1.5">
              <Label htmlFor="cfg-modal-awal" className="text-xs font-semibold">
                Modal Awal Toko (Rp)
              </Label>
              <Input
                id="cfg-modal-awal"
                type="number"
                value={tempModalAwal || ""}
                onChange={(e) => setTempModalAwal(Number(e.target.value))}
                className="h-10 rounded-xl"
                placeholder="Contoh: 10700000"
              />
              <p className="text-[11px] text-muted-foreground">
                Sesuai catatan fisik: Rp 10.700.000
              </p>
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="cfg-inventaris" className="text-xs font-semibold">
                Inventaris Toko (Rp)
              </Label>
              <Input
                id="cfg-inventaris"
                type="number"
                value={tempInventaris || ""}
                onChange={(e) => setTempInventaris(Number(e.target.value))}
                className="h-10 rounded-xl"
                placeholder="Contoh: 6200000"
              />
              <p className="text-[11px] text-muted-foreground">
                Sesuai catatan fisik: Rp 6.200.000
              </p>
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="cfg-showcase" className="text-xs font-semibold">
                Show Case / Peralatan Toko (Rp)
              </Label>
              <Input
                id="cfg-showcase"
                type="number"
                value={tempShowCase || ""}
                onChange={(e) => setTempShowCase(Number(e.target.value))}
                className="h-10 rounded-xl"
                placeholder="Contoh: 3800000"
              />
              <p className="text-[11px] text-muted-foreground">
                Sesuai catatan fisik: Rp 3.800.000
              </p>
            </div>
          </div>

          <DialogFooter className="gap-2 sm:gap-0">
            <Button
              variant="outline"
              size="sm"
              className="rounded-xl"
              onClick={() => setIsConfigOpen(false)}
            >
              Batal
            </Button>
            <Button
              size="sm"
              className="rounded-xl font-semibold"
              onClick={handleSaveConfig}
            >
              Simpan Perubahan
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
