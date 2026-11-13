"use client";

import { Fragment, useEffect, useMemo, useState } from "react";
import {
  BanknoteArrowDown,
  Calendar,
  CalendarDays,
  Check,
  ChevronLeft,
  ChevronRight,
  ChevronsLeft,
  ChevronsRight,
  Clock,
  Coins,
  Filter,
  Handshake,
  Landmark,
  Loader2,
  PackageCheck,
  Plus,
  Search,
  ShoppingBag,
  Sparkles,
  Trash2,
  Users,
  Wallet,
  Wrench,
  X,
} from "lucide-react";
import { toast } from "sonner";
import { useCurrentRole } from "@/components/role-gate";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { DatePicker } from "@/components/ui/custom-calendar";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { StatCard } from "@/components/stat-card";
import { formatCompactCurrency, formatCurrency } from "@/lib/format";
import { cn } from "@/lib/utils";

type RestockPlan = {
  id: string;
  productName: string;
  note: string;
  estimatedPrice: number;
  isDone: number;
  createdAt: string;
};

const EXPENSE_CATEGORIES = [
  {
    value: "operasional",
    label: "Beban Operasional Toko",
    shortLabel: "Operasional",
    desc: "Biaya rutin yang mengurangi laba (Listrik, Wifi, Plastik/Cup, Kebersihan)",
    icon: Wrench,
    badge: "Mengurangi Laba",
    tone: "rose",
  },
  {
    value: "sales_toko",
    label: "Bayar Nota / Kulakan Stok Supplier",
    shortLabel: "Kulakan / Nota",
    desc: "Belanja stok barang dagangan / bayar nota sales (Perputaran Modal, Non-Beban)",
    icon: ShoppingBag,
    badge: "Modal Stok (Non-Beban)",
    tone: "amber",
  },
  {
    value: "sales_titipan",
    label: "Bayar Barang Titipan (Konsinyasi)",
    shortLabel: "Barang Titipan",
    desc: "Setor hasil jualan barang titipan ke penitip & catat untung toko (Non-Beban)",
    icon: Handshake,
    badge: "Titipan (Non-Beban)",
    tone: "emerald",
  },
  {
    value: "gaji_sosial",
    label: "Gaji & Upah Karyawan",
    shortLabel: "Gaji / Upah",
    desc: "Gaji harian kasir/karyawan, lembur, dan insentif",
    icon: Users,
    badge: "Mengurangi Laba",
    tone: "rose",
  },
  {
    value: "setoran_tabungan",
    label: "Setor Kas / Tabungan",
    shortLabel: "Mutasi Kas",
    desc: "Pindah kas laci ke brankas/rekening bank toko (Non-Beban)",
    icon: Landmark,
    badge: "Mutasi Kas (Non-Beban)",
    tone: "blue",
  },
  {
    value: "bagi_hasil_investor",
    label: "Bagi Hasil Investor",
    shortLabel: "Bagi Hasil",
    desc: "Penyaluran bagi hasil keuntungan modal investor",
    icon: Coins,
    badge: "Distribusi Laba",
    tone: "slate",
    adminOnly: true,
  },
];

export function ExpenseRecordDialog({
  open,
  onOpenChange,
  onRecorded,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onRecorded?: () => void;
}) {
  const role = useCurrentRole();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [title, setTitle] = useState("");
  const [amount, setAmount] = useState("");
  const [category, setCategory] = useState<string>("operasional");
  const [supplierOrPartnerName, setSupplierOrPartnerName] = useState("");
  const [notaNumber, setNotaNumber] = useState("");
  const [titipanGrossSales, setTitipanGrossSales] = useState("");
  const [titipanStoreProfit, setTitipanStoreProfit] = useState("");
  const [partners, setPartners] = useState<Array<{ id: string; name: string; partnerType: string }>>([]);
  const [products, setProducts] = useState<Array<{ id: string; name: string; buyPrice: number }>>([]);
  const [investorId, setInvestorId] = useState("");
  const [intakes, setIntakes] = useState<Array<{ id: string; productName: string | null; qtySold: number; unitCost: number; settledAmount: number }>>([]);
  const [settleIntakeIds, setSettleIntakeIds] = useState<string[]>([]);
  const [restockEnabled, setRestockEnabled] = useState(false);
  const [restockProductId, setRestockProductId] = useState("");
  const [restockQuantity, setRestockQuantity] = useState("");
  const isCashier = role === "kasir";

  const computedTitipanProfit = useMemo(() => {
    const manualProfit = Number(titipanStoreProfit || 0);
    if (manualProfit > 0) return manualProfit;
    const gross = Number(titipanGrossSales || 0);
    const payOut = Number(amount || 0);
    if (gross > 0 && gross > payOut) return gross - payOut;
    return 0;
  }, [amount, titipanGrossSales, titipanStoreProfit]);

  useEffect(() => {
    if (!open) return;
    void fetch("/api/bootstrap").then(async (response) => {
      if (response.ok) setProducts((await response.json()).products ?? []);
    });
    if (!isCashier) {
      void fetch("/api/investors?status=active").then(async (response) => {
        if (response.ok) setPartners((await response.json()).investors ?? []);
      });
    }
  }, [isCashier, open]);

  useEffect(() => {
    if (category !== "sales_titipan" || !investorId) {
      setIntakes([]);
      setSettleIntakeIds([]);
      return;
    }
    void fetch(`/api/titipan-intakes?investorId=${encodeURIComponent(investorId)}`).then(async (response) => {
      if (response.ok) setIntakes((await response.json()).intakes ?? []);
    });
  }, [category, investorId]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const cleanTitle = title.trim();
    const numAmount = parseInt(amount, 10);

    if (!cleanTitle) {
      toast.error("Keterangan pengeluaran wajib diisi.");
      return;
    }
    if (!amount || isNaN(numAmount) || numAmount <= 0) {
      toast.error("Jumlah nominal pengeluaran harus lebih dari Rp 0.");
      return;
    }

    if (category === "bagi_hasil_investor" && !investorId) {
      toast.error("Investor pemodal wajib dipilih.");
      return;
    }

    if (category === "sales_toko" && restockEnabled) {
      if (!restockProductId) {
        toast.error("Pilih produk yang ingin direstok.");
        return;
      }
      if (!restockQuantity || Number(restockQuantity) <= 0) {
        toast.error("Jumlah unit restok harus lebih dari 0.");
        return;
      }
    }

    setIsSubmitting(true);
    try {
      const payload = {
        title: cleanTitle,
        amount: numAmount,
        expenseType: category,
        investorId: investorId || undefined,
        settleIntakeIds,
        supplierOrPartnerName: supplierOrPartnerName.trim() || undefined,
        notaNumber: notaNumber.trim() || undefined,
        titipanGrossSales:
          category === "sales_titipan" && Number(titipanGrossSales || 0) > 0
            ? Number(titipanGrossSales)
            : undefined,
        titipanStoreProfit:
          category === "sales_titipan" && computedTitipanProfit > 0
            ? computedTitipanProfit
            : undefined,
        restock:
          category === "sales_toko" && restockEnabled
            ? {
                productId: restockProductId,
                quantity: Number(restockQuantity),
                unitCost: products.find((product) => product.id === restockProductId)?.buyPrice ?? 0,
              }
            : undefined,
      };
      const response = await fetch("/api/expenses", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => null);
        throw new Error(errorData?.error?.issues?.[0]?.message || errorData?.error || "Gagal mencatat pengeluaran");
      }

      toast.success("Catatan kas keluar berhasil disimpan");
      onOpenChange(false);
      setTitle("");
      setAmount("");
      setCategory("operasional");
      setSupplierOrPartnerName("");
      setNotaNumber("");
      setTitipanGrossSales("");
      setTitipanStoreProfit("");
      setInvestorId("");
      setSettleIntakeIds([]);
      setRestockEnabled(false);
      setRestockProductId("");
      setRestockQuantity("");
      onRecorded?.();
    } catch (err: any) {
      toast.error(err.message);
    } finally {
      setIsSubmitting(false);
    }
  }

  const selectedCategoryMeta = EXPENSE_CATEGORIES.find((c) => c.value === category) || EXPENSE_CATEGORIES[0];
  const CategoryIcon = selectedCategoryMeta.icon;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-xl md:max-w-2xl w-full max-h-[92vh] sm:max-h-[88vh] rounded-2xl border border-border/80 bg-card p-0 gap-0 shadow-2xl flex flex-col overflow-hidden">
        <DialogHeader className="p-5 sm:p-6 pb-4 border-b border-border/60 shrink-0 bg-card text-left">
          <div className="flex items-center gap-3.5">
            <div className="flex size-11 items-center justify-center rounded-2xl bg-primary/10 text-primary border border-primary/20 shrink-0">
              <BanknoteArrowDown className="size-5" />
            </div>
            <div>
              <DialogTitle className="font-heading text-xl font-bold tracking-tight text-foreground">
                Catat Pengeluaran
              </DialogTitle>
              <DialogDescription className="text-xs sm:text-sm text-muted-foreground mt-0.5">
                Pengeluaran tercatat langsung memotong kas fisik laci shift yang sedang berjalan.
              </DialogDescription>
            </div>
          </div>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="flex flex-col flex-1 min-h-0 overflow-hidden">
          <div className="overflow-y-auto px-5 sm:px-6 py-4 space-y-4 sm:space-y-4.5 flex-1 min-h-0">
            {/* Pilih Cepat 3 Jenis Kas Keluar Utama agar Kasir Tidak Keliru */}
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <label className="text-xs sm:text-sm font-semibold text-foreground">
                  Pilih Jenis Kas Keluar <span className="text-destructive">*</span>
                </label>
                <span className="text-[11px] font-normal text-muted-foreground">Bedakan beban vs kulakan &amp; titipan</span>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                {EXPENSE_CATEGORIES.slice(0, 3).map((cat) => {
                  const CatIcon = cat.icon;
                  const isActive = category === cat.value;
                  return (
                    <button
                      key={cat.value}
                      type="button"
                      onClick={() => setCategory(cat.value)}
                      className={cn(
                        "flex flex-col items-start text-left p-3 rounded-xl border transition-all cursor-pointer",
                        isActive
                          ? "border-primary bg-primary/10 ring-2 ring-primary/20 shadow-xs"
                          : "border-border/70 bg-background/70 hover:bg-muted/50"
                      )}
                    >
                      <div className="flex items-center gap-2 w-full">
                        <CatIcon className={cn("size-4 shrink-0", isActive ? "text-primary" : "text-muted-foreground")} />
                        <span className="font-bold text-xs text-foreground truncate">{cat.shortLabel}</span>
                      </div>
                      <span
                        className={cn(
                          "mt-1.5 text-[10px] font-semibold px-1.5 py-0.5 rounded-md border",
                          cat.value === "operasional"
                            ? "bg-rose-500/10 text-rose-700 dark:text-rose-300 border-rose-500/25"
                            : "bg-emerald-500/10 text-emerald-700 dark:text-emerald-300 border-emerald-500/25"
                        )}
                      >
                        {cat.badge}
                      </span>
                    </button>
                  );
                })}
              </div>

              <Select value={category} onValueChange={(val) => setCategory(val || "operasional")}>
                <SelectTrigger className="w-full h-10 rounded-xl border border-input bg-background/90 px-3.5 cursor-pointer hover:bg-accent/40 transition-colors">
                  <div className="flex items-center gap-2.5 truncate text-left w-full">
                    <CategoryIcon className="size-4 text-primary shrink-0" />
                    <span className="font-medium text-xs text-foreground truncate">
                      Kategori lain / detail: {selectedCategoryMeta.label}
                    </span>
                    <span className="ml-auto mr-1 text-[10px] font-medium px-2 py-0.5 rounded-md bg-muted text-muted-foreground border border-border/50 shrink-0 hidden sm:inline-block">
                      {selectedCategoryMeta.badge}
                    </span>
                  </div>
                </SelectTrigger>
                <SelectContent className="rounded-xl border border-border/80 bg-popover p-1.5 shadow-2xl max-h-72 w-[calc(100vw-2.5rem)] sm:w-[440px]">
                  {EXPENSE_CATEGORIES.filter((cat) => !cat.adminOnly || !isCashier).map((cat) => {
                    const CatIcon = cat.icon;
                    return (
                      <SelectItem
                        key={cat.value}
                        value={cat.value}
                        className="py-2.5 px-3 rounded-lg cursor-pointer transition-colors"
                      >
                        <div className="flex items-start gap-3 w-full py-0.5">
                          <CatIcon className="size-4.5 text-primary mt-0.5 shrink-0" />
                          <div className="flex flex-col min-w-0 text-left">
                            <div className="flex items-center gap-2">
                              <span className="font-semibold text-xs sm:text-sm text-foreground">
                                {cat.label}
                              </span>
                              <span className="text-[10px] font-medium px-1.5 py-0.2 rounded bg-muted text-muted-foreground border border-border/50">
                                {cat.badge}
                              </span>
                            </div>
                            <span className="text-[11px] text-muted-foreground mt-0.5 line-clamp-1 leading-tight">
                              {cat.desc}
                            </span>
                          </div>
                        </div>
                      </SelectItem>
                    );
                  })}
                </SelectContent>
              </Select>
              <p className="text-[11px] text-muted-foreground pl-0.5">
                {selectedCategoryMeta.desc}
              </p>
            </div>

            {/* Nama Mitra/Supplier & No. Nota (Khusus Kulakan & Titipan) */}
            {(category === "sales_toko" || category === "sales_titipan") && (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 rounded-xl border border-border/70 bg-muted/20 p-3.5">
                <div className="space-y-1">
                  <label className="text-[11px] font-semibold text-foreground">
                    {category === "sales_titipan" ? "Nama Penitip / Produk Titipan" : "Nama Sales / Agen Supplier"}
                  </label>
                  <Input
                    value={supplierOrPartnerName}
                    onChange={(e) => setSupplierOrPartnerName(e.target.value)}
                    placeholder={category === "sales_titipan" ? "Misal: Mba Lilik, Roti Larissa, Bu Dewi" : "Misal: Agen Telur, Sales Yakult, Grosir"}
                    className="h-10 rounded-xl bg-background border-border/80 text-xs font-medium"
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-[11px] font-semibold text-foreground">
                    No. Nota / Referensi (Opsional)
                  </label>
                  <Input
                    value={notaNumber}
                    onChange={(e) => setNotaNumber(e.target.value)}
                    placeholder="Misal: Nota #104 / Bon Harian"
                    className="h-10 rounded-xl bg-background border-border/80 text-xs font-medium"
                  />
                </div>
              </div>
            )}

            {/* Keterangan / Keperluan */}
            <div className="space-y-1.5">
              <label className="text-xs sm:text-sm font-semibold text-foreground">
                {category === "sales_titipan"
                  ? "Rincian Barang Titipan yang Dibayar *"
                  : category === "sales_toko"
                    ? "Rincian Barang Nota / Kulakan *"
                    : "Keterangan / Keperluan Pengeluaran *"}
              </label>
              <Input
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder={
                  category === "sales_titipan"
                    ? "Contoh: Peyek 15 bks, Kue Basah 20 pcs"
                    : category === "sales_toko"
                      ? "Contoh: Telur 2 peti, Galon 10 bh, Minyak 1 dus"
                      : "Contoh: Token Listrik PLN, Beli Plastik & Lakban, Wifi"
                }
                className="h-11 rounded-xl border border-input bg-background/90 text-sm font-medium px-3.5 focus-visible:ring-2 focus-visible:ring-primary/20"
              />
            </div>

            {/* Kalkulator Untung Titipan (Khusus Barang Titipan) */}
            {category === "sales_titipan" && (
              <div className="space-y-3 rounded-xl border border-emerald-500/30 bg-emerald-500/5 p-3.5">
                <div className="flex items-center justify-between gap-2">
                  <p className="text-xs font-bold text-emerald-800 dark:text-emerald-300">
                    Hitung Otomatis Keuntungan Toko dari Titipan
                  </p>
                  <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-emerald-500/15 text-emerald-700 dark:text-emerald-300">
                    Bukan Beban Rugi
                  </span>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div className="space-y-1">
                    <label className="text-[11px] font-medium text-muted-foreground">
                      Total Uang Penjualan Titipan (Laku Rp)
                    </label>
                    <Input
                      type="text"
                      inputMode="numeric"
                      value={titipanGrossSales ? new Intl.NumberFormat("id-ID").format(Number(titipanGrossSales)) : ""}
                      onChange={(e) => setTitipanGrossSales(e.target.value.replace(/\D/g, ""))}
                      placeholder="Misal: 100.000 (Opsional)"
                      className="h-10 rounded-xl bg-background border-border/80 text-xs font-semibold tabular-nums"
                    />
                  </div>
                  <div className="space-y-1">
                    <label className="text-[11px] font-medium text-muted-foreground">
                      Atau Isi Langsung Untung Toko (Rp)
                    </label>
                    <Input
                      type="text"
                      inputMode="numeric"
                      value={titipanStoreProfit ? new Intl.NumberFormat("id-ID").format(Number(titipanStoreProfit)) : ""}
                      onChange={(e) => setTitipanStoreProfit(e.target.value.replace(/\D/g, ""))}
                      placeholder={computedTitipanProfit > 0 ? new Intl.NumberFormat("id-ID").format(computedTitipanProfit) : "Otomatis: Laku - Setor"}
                      className="h-10 rounded-xl bg-background border-border/80 text-xs font-semibold tabular-nums"
                    />
                  </div>
                </div>
                {computedTitipanProfit > 0 && (
                  <div className="rounded-lg bg-emerald-500/15 border border-emerald-500/30 px-3 py-2 text-xs font-semibold text-emerald-900 dark:text-emerald-200 flex items-center justify-between">
                    <span>Keuntungan Bersih Toko dari Titipan Ini:</span>
                    <span className="font-bold tabular-nums">+{formatCurrency(computedTitipanProfit)}</span>
                  </div>
                )}
              </div>
            )}

            {/* Kolom Harga / Jumlah Nominal (Hero Section) */}
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <label className="text-xs sm:text-sm font-semibold text-foreground">
                  Jumlah Nominal Pengeluaran <span className="text-destructive">*</span>
                </label>
                <span className="text-[11px] text-muted-foreground font-medium">Potong kas laci shift</span>
              </div>
              <div className="relative flex h-13 sm:h-14 items-center rounded-xl border-2 border-border/80 bg-background/95 focus-within:border-primary focus-within:ring-4 focus-within:ring-primary/15 transition-all shadow-xs overflow-hidden">
                <div className="flex h-full items-center justify-center px-4 bg-primary/10 border-r border-border/70 text-primary font-bold text-sm sm:text-base select-none shrink-0">
                  Rp
                </div>
                <input
                  type="text"
                  inputMode="numeric"
                  value={amount ? new Intl.NumberFormat("id-ID").format(Number(amount)) : ""}
                  onChange={(e) => {
                    const digits = e.target.value.replace(/\D/g, "");
                    setAmount(digits);
                  }}
                  placeholder="0"
                  className="w-full h-full px-4 bg-transparent text-xl sm:text-2xl font-extrabold tracking-tight tabular-nums text-foreground outline-none placeholder:text-muted-foreground/30"
                />
                {amount && Number(amount) > 0 ? (
                  <button
                    type="button"
                    onClick={() => setAmount("")}
                    className="mr-3 p-1 rounded-full text-muted-foreground hover:text-foreground hover:bg-muted/80 transition-colors"
                    title="Hapus nominal"
                  >
                    <X className="size-4" />
                  </button>
                ) : null}
              </div>

              {/* Tombol Pilihan Nominal Cepat */}
              <div className="flex flex-wrap items-center gap-1.5 pt-1">
                <span className="text-[11px] font-medium text-muted-foreground mr-1">Pilihan Cepat:</span>
                {[10000, 20000, 50000, 100000, 200000, 500000].map((preset) => (
                  <button
                    key={preset}
                    type="button"
                    onClick={() => {
                      const current = Number(amount || 0);
                      setAmount(String(current + preset));
                    }}
                    className="px-2.5 py-1 rounded-lg text-xs font-semibold bg-muted/70 hover:bg-muted text-foreground border border-border/60 hover:border-primary/50 transition-all active:scale-95 cursor-pointer"
                  >
                    +{new Intl.NumberFormat("id-ID").format(preset)}
                  </button>
                ))}
                {amount && Number(amount) > 0 ? (
                  <button
                    type="button"
                    onClick={() => setAmount("")}
                    className="px-2.5 py-1 rounded-lg text-xs font-semibold text-destructive hover:bg-destructive/10 border border-transparent transition-all cursor-pointer"
                  >
                    Reset
                  </button>
                ) : null}
              </div>

              {amount && Number(amount) > 0 ? (
                <div className="flex items-center gap-2 text-xs font-medium text-muted-foreground bg-muted/30 px-3 py-1.5 rounded-lg border border-border/40">
                  <span className="size-1.5 rounded-full bg-emerald-500 shrink-0" />
                  <span>Terbilang: <strong className="text-foreground">{formatCurrency(Number(amount))}</strong> akan dipotong dari kas laci shift aktif.</span>
                </div>
              ) : null}
            </div>

            {/* Conditional helper message based on category */}
            {category === "setoran_tabungan" && (
              <div className="flex items-start gap-3 rounded-xl border border-blue-500/30 bg-blue-500/10 p-3.5 text-xs text-blue-900 dark:text-blue-200">
                <Landmark className="size-4.5 text-blue-600 dark:text-blue-400 shrink-0 mt-0.5" />
                <div className="space-y-0.5">
                  <p className="font-semibold text-xs sm:text-sm">Mutasi Kas / Setor Tabungan</p>
                  <p className="text-muted-foreground dark:text-blue-300/80 leading-relaxed">
                    Pengeluaran ini berstatus <strong>Non-Beban</strong>. Tidak akan mengurangi laba bersih usaha warung, melainkan memindahkan fisik kas laci kasir ke rekening bank/tabungan toko.
                  </p>
                </div>
              </div>
            )}

            {(category === "bagi_hasil_investor" || (category === "sales_titipan" && !isCashier && partners.some((p) => p.partnerType === "titipan_bagihasil" || p.partnerType === "sales_harian"))) && (
              <div className="space-y-2.5 rounded-xl border border-border/70 bg-muted/20 p-4">
                <label className="text-xs sm:text-sm font-semibold text-foreground">
                  {category === "sales_titipan" ? "Hubungkan ke Mitra Terdaftar (Opsional)" : "Pilih Investor Pemodal *"}
                </label>
                <Select value={investorId} onValueChange={(value) => setInvestorId(value ?? "")}>
                  <SelectTrigger className="h-10.5 rounded-xl bg-background border-border/80 text-xs font-medium">
                    <SelectValue placeholder={category === "sales_titipan" ? "Opsional: pilih mitra jika ada pencatatan intake..." : "Pilih nama investor pemodal..."} />
                  </SelectTrigger>
                  <SelectContent className="rounded-xl">
                    {partners
                      .filter((partner) => category !== "sales_titipan" || partner.partnerType === "titipan_bagihasil" || partner.partnerType === "sales_harian")
                      .map((partner) => (
                        <SelectItem key={partner.id} value={partner.id}>
                          {partner.name}
                        </SelectItem>
                      ))}
                  </SelectContent>
                </Select>
                {category === "bagi_hasil_investor" && (
                  <p className="text-[11px] text-muted-foreground pt-0.5">
                    Penyaluran bagi hasil dihitung sebagai distribusi laba usaha ke pemodal (bukan beban operasional warung).
                  </p>
                )}
              </div>
            )}

            {category === "sales_titipan" && investorId && (
              <div className="space-y-2.5 rounded-xl border border-border/70 bg-muted/20 p-4">
                <p className="text-xs sm:text-sm font-semibold text-foreground">Daftar Barang Titipan Belum Disetor</p>
                {intakes.length === 0 ? (
                  <p className="text-xs text-muted-foreground italic">Tidak ada barang titipan yang perlu dilunasi untuk mitra ini.</p>
                ) : (
                  <div className="space-y-2 max-h-44 overflow-y-auto pr-1">
                    {intakes.map((intake) => (
                      <label key={intake.id} className="flex items-center gap-2.5 text-xs text-foreground bg-background/80 p-2.5 rounded-xl border border-border/60 cursor-pointer hover:bg-accent/40 transition-colors">
                        <input
                          type="checkbox"
                          checked={settleIntakeIds.includes(intake.id)}
                          onChange={(event) =>
                            setSettleIntakeIds((current) =>
                              event.target.checked ? [...current, intake.id] : current.filter((id) => id !== intake.id)
                            )
                          }
                          className="rounded border-border size-4 accent-primary"
                        />
                        <span className="flex-1 truncate">
                          <strong>{intake.productName ?? "Barang titipan"}</strong>
                          <span className="text-muted-foreground ml-1.5">({intake.qtySold} terjual)</span>
                        </span>
                        <span className="font-bold tabular-nums text-primary shrink-0">
                          {formatCurrency(intake.settledAmount || intake.qtySold * intake.unitCost)}
                        </span>
                      </label>
                    ))}
                  </div>
                )}
              </div>
            )}

            {category === "sales_toko" && (
              <div className="space-y-3 rounded-xl border border-border/70 bg-muted/20 p-4">
                <label className="flex items-center gap-2.5 text-xs font-semibold text-foreground cursor-pointer">
                  <input
                    type="checkbox"
                    checked={restockEnabled}
                    onChange={(event) => setRestockEnabled(event.target.checked)}
                    className="rounded border-border size-4 accent-primary"
                  />
                  <span>Sekalian catat sebagai restok barang ke inventaris toko</span>
                </label>
                {restockEnabled && (
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1">
                    <div className="space-y-1">
                      <label className="text-[11px] font-medium text-muted-foreground">Pilih Produk Toko</label>
                      <Select value={restockProductId} onValueChange={(value) => setRestockProductId(value ?? "")}>
                        <SelectTrigger className="h-10 rounded-xl bg-background border-border/80 text-xs font-medium">
                          <SelectValue placeholder="Pilih Produk" />
                        </SelectTrigger>
                        <SelectContent className="rounded-xl max-h-56">
                          {products.map((product) => (
                            <SelectItem key={product.id} value={product.id}>
                              {product.name}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-1">
                      <label className="text-[11px] font-medium text-muted-foreground">Jumlah Unit (pcs)</label>
                      <Input
                        type="number"
                        value={restockQuantity}
                        onChange={(event) => setRestockQuantity(event.target.value)}
                        placeholder="Contoh: 10"
                        className="h-10 rounded-xl bg-background border-border/80 text-xs font-medium"
                      />
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>

          <DialogFooter className="p-4 sm:p-5 border-t border-border/60 bg-muted/20 shrink-0 flex flex-col-reverse sm:flex-row items-center gap-2.5 sm:gap-3">
            <Button
              type="button"
              variant="outline"
              className="h-11 rounded-xl px-5 font-medium border-border/80 w-full sm:w-auto hover:bg-muted cursor-pointer"
              onClick={() => onOpenChange(false)}
            >
              Batal
            </Button>
            <Button
              type="submit"
              className="h-11 rounded-xl px-6 font-bold shadow-md w-full sm:flex-1 bg-primary text-primary-foreground hover:bg-primary/95 cursor-pointer disabled:opacity-60"
              disabled={isSubmitting}
            >
              {isSubmitting ? (
                <span className="flex items-center justify-center gap-2">
                  <Loader2 className="size-4 animate-spin" />
                  Menyimpan...
                </span>
              ) : (
                <span className="flex items-center justify-center gap-2">
                  <Check className="size-4" />
                  Simpan Pengeluaran
                </span>
              )}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

interface CategoryMeta {
  key: string;
  name: string;
  badgeLabel: string;
  desc: string;
  badgeClass: string;
  avatarBg: string;
  avatarText: string;
  icon: typeof BanknoteArrowDown;
  impactLabel: string;
  impactClass: string;
}

const CATEGORY_MAP: Record<string, CategoryMeta> = {
  operasional: {
    key: "operasional",
    name: "Operasional Warung",
    badgeLabel: "Operasional",
    desc: "Beban rutin, listrik, wifi, perlengkapan",
    badgeClass: "bg-rose-500/10 text-rose-700 dark:text-rose-300 border-rose-500/30",
    avatarBg: "bg-rose-500/10 text-rose-600",
    avatarText: "text-rose-600",
    icon: Wrench,
    impactLabel: "Mengurangi Laba",
    impactClass: "text-rose-600 dark:text-rose-400 font-medium",
  },
  sales_toko: {
    key: "sales_toko",
    name: "Kulakan / Nota Supplier",
    badgeLabel: "Kulakan / Nota",
    desc: "Pembelian stok persediaan barang dagang (Non-Beban)",
    badgeClass: "bg-amber-500/10 text-amber-800 dark:text-amber-300 border-amber-500/30",
    avatarBg: "bg-amber-500/10 text-amber-700",
    avatarText: "text-amber-700",
    icon: ShoppingBag,
    impactLabel: "Modal Stok (Non-Beban)",
    impactClass: "text-amber-700 dark:text-amber-300 font-medium",
  },
  sales_titipan: {
    key: "sales_titipan",
    name: "Bayar Barang Titipan",
    badgeLabel: "Barang Titipan",
    desc: "Setor uang hasil jual barang titipan ke penitip (Non-Beban)",
    badgeClass: "bg-emerald-500/10 text-emerald-700 dark:text-emerald-300 border-emerald-500/30",
    avatarBg: "bg-emerald-500/10 text-emerald-600",
    avatarText: "text-emerald-600",
    icon: Handshake,
    impactLabel: "Titipan (Non-Beban)",
    impactClass: "text-emerald-700 dark:text-emerald-300 font-medium",
  },
  gaji_sosial: {
    key: "gaji_sosial",
    name: "Upah & Gaji Karyawan",
    badgeLabel: "Upah & Gaji",
    desc: "Upah harian karyawan, lembur, infak/sosial",
    badgeClass: "bg-rose-500/10 text-rose-700 dark:text-rose-300 border-rose-500/30",
    avatarBg: "bg-rose-500/10 text-rose-600",
    avatarText: "text-rose-600",
    icon: Users,
    impactLabel: "Mengurangi Laba",
    impactClass: "text-rose-600 dark:text-rose-400 font-medium",
  },
  setoran_tabungan: {
    key: "setoran_tabungan",
    name: "Setor Kas / Tabungan",
    badgeLabel: "Mutasi Kas",
    desc: "Setor kas shift ke bank/tabungan (Non-Beban)",
    badgeClass: "bg-blue-500/10 text-blue-700 dark:text-blue-300 border-blue-500/30",
    avatarBg: "bg-blue-500/10 text-blue-600",
    avatarText: "text-blue-600",
    icon: Landmark,
    impactLabel: "Mutasi Kas (Non-Beban)",
    impactClass: "text-blue-600 dark:text-blue-400 font-medium",
  },
  bagi_hasil_investor: {
    key: "bagi_hasil_investor",
    name: "Bagi Hasil Investor",
    badgeLabel: "Bagi Hasil",
    desc: "Penyaluran bagi hasil keuntungan modal usaha",
    badgeClass: "bg-muted/70 text-foreground border-border/70",
    avatarBg: "bg-muted text-foreground",
    avatarText: "text-foreground",
    icon: Coins,
    impactLabel: "Distribusi Laba",
    impactClass: "text-muted-foreground font-medium",
  },
};

function formatDayHeader(dateKeyOrIso: string) {
  try {
    const d = new Date(dateKeyOrIso);
    return new Intl.DateTimeFormat("id-ID", {
      weekday: "long",
      day: "numeric",
      month: "long",
      year: "numeric",
    }).format(d);
  } catch {
    return dateKeyOrIso;
  }
}

function isTodayOrYesterday(dateKeyOrIso: string): "today" | "yesterday" | null {
  try {
    const d = new Date(dateKeyOrIso);
    const now = new Date();
    const isSameDay =
      d.getDate() === now.getDate() &&
      d.getMonth() === now.getMonth() &&
      d.getFullYear() === now.getFullYear();
    if (isSameDay) return "today";

    const yesterday = new Date(now);
    yesterday.setDate(now.getDate() - 1);
    const isYesterday =
      d.getDate() === yesterday.getDate() &&
      d.getMonth() === yesterday.getMonth() &&
      d.getFullYear() === yesterday.getFullYear();
    if (isYesterday) return "yesterday";
    return null;
  } catch {
    return null;
  }
}

function getCategoryMeta(expense: { category?: string; expenseType?: string; isCashMovement?: boolean }): CategoryMeta {
  const rawKey = (expense.expenseType || expense.category || "operasional").toLowerCase().trim();
  if (rawKey === "titipan" || rawKey === "sales_titipan") return CATEGORY_MAP.sales_titipan;
  if (rawKey === "kulakan" || rawKey === "stok" || rawKey === "sales_toko") return CATEGORY_MAP.sales_toko;
  if (rawKey === "gaji" || rawKey === "upah" || rawKey === "gaji_sosial") return CATEGORY_MAP.gaji_sosial;
  if (rawKey === "tabungan" || rawKey === "setoran_tabungan" || expense.isCashMovement) return CATEGORY_MAP.setoran_tabungan;
  if (rawKey === "investor" || rawKey === "bagi_hasil" || rawKey === "bagi_hasil_investor") return CATEGORY_MAP.bagi_hasil_investor;
  return CATEGORY_MAP.operasional;
}

function getLocalDateString(dateInput: string | Date | number): string {
  const d = new Date(dateInput);
  if (isNaN(d.getTime())) return "";
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

export function PengeluaranRestokView() {
  const [plans, setPlans] = useState<RestockPlan[]>([]);
  const [expenses, setExpenses] = useState<any[]>([]);
  const [isLoadingPlans, setIsLoadingPlans] = useState(true);
  const [isLoadingExpenses, setIsLoadingExpenses] = useState(true);
  const [expenseDialogOpen, setExpenseDialogOpen] = useState(false);
  const [activeMainTab, setActiveMainTab] = useState<string>("pengeluaran");

  // Search, Date & Filter state for Expenses
  const [expenseSearch, setExpenseSearch] = useState("");
  const [selectedCategoryFilter, setSelectedCategoryFilter] = useState<string>("all");
  const [selectedDateFilter, setSelectedDateFilter] = useState<string>("");
  const [pageSize, setPageSize] = useState<number>(25);
  const [page, setPage] = useState<number>(1);

  const todayStr = useMemo(() => getLocalDateString(new Date()), []);
  const yesterdayStr = useMemo(() => {
    const d = new Date();
    d.setDate(d.getDate() - 1);
    return getLocalDateString(d);
  }, []);

  // Filter state for Restock Plans
  const [planFilter, setPlanFilter] = useState<"all" | "pending" | "done">("all");

  // Add Plan form state
  const [productName, setProductName] = useState("");
  const [note, setNote] = useState("");
  const [estimatedPrice, setEstimatedPrice] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    fetchPlans();
    fetchExpenses();
  }, []);

  async function fetchExpenses() {
    setIsLoadingExpenses(true);
    try {
      const res = await fetch("/api/expenses", { cache: "no-store" });
      const data = await res.json();
      if (res.ok && data.expenses) {
        setExpenses(data.expenses);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setIsLoadingExpenses(false);
    }
  }

  async function fetchPlans() {
    setIsLoadingPlans(true);
    try {
      const res = await fetch("/api/restock-plans", { cache: "no-store" });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      setPlans(data.plans || []);
    } catch (err: any) {
      toast.error(err.message || "Gagal memuat rencana restok.");
    } finally {
      setIsLoadingPlans(false);
    }
  }

  async function handleAddPlan(e: React.FormEvent) {
    e.preventDefault();
    if (!productName.trim()) return;

    setIsSubmitting(true);
    try {
      const res = await fetch("/api/restock-plans", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          productName: productName.trim(),
          note: note.trim(),
          estimatedPrice: parseInt(estimatedPrice, 10) || 0,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);

      toast.success("Berhasil ditambahkan ke rencana belanja restok");
      setPlans([data.plan, ...plans]);
      setProductName("");
      setNote("");
      setEstimatedPrice("");
    } catch (err: any) {
      toast.error(err.message || "Gagal menambahkan data.");
    } finally {
      setIsSubmitting(false);
    }
  }

  async function handleToggleDone(id: string, currentStatus: number) {
    const newStatus = currentStatus === 1 ? 0 : 1;
    setPlans(plans.map((p) => (p.id === id ? { ...p, isDone: newStatus } : p)));
    try {
      const res = await fetch("/api/restock-plans", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id, isDone: newStatus }),
      });
      if (!res.ok) throw new Error("Gagal mengupdate");
    } catch (err) {
      toast.error("Gagal mengubah status restok.");
      setPlans(plans.map((p) => (p.id === id ? { ...p, isDone: currentStatus } : p)));
    }
  }

  async function handleDeletePlan(plan: RestockPlan) {
    try {
      const res = await fetch(`/api/restock-plans?id=${encodeURIComponent(plan.id)}`, {
        method: "DELETE",
      });
      if (!res.ok) throw new Error("Gagal menghapus.");
      setPlans((prev) => prev.filter((p) => p.id !== plan.id));
      toast.success("Rencana restok dihapus.", {
        action: {
          label: "Urungkan",
          onClick: async () => {
            try {
              const addRes = await fetch("/api/restock-plans", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                  productName: plan.productName,
                  note: plan.note || "",
                  estimatedPrice: plan.estimatedPrice || 0,
                }),
              });
              const addData = await addRes.json();
              if (addRes.ok && addData.plan) {
                setPlans((prev) => [addData.plan, ...prev]);
                toast.success("Rencana restok berhasil dipulihkan.");
              }
            } catch {
              toast.error("Gagal memulihkan rencana restok.");
            }
          },
        },
        duration: 8000,
      });
    } catch (err: any) {
      toast.error(err.message || "Gagal menghapus rencana restok.");
    }
  }

  async function handleReclassifyExpense(expenseId: string, nextType: string) {
    try {
      const res = await fetch("/api/expenses", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: expenseId, expenseType: nextType }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data?.error || "Gagal mengubah kategori pengeluaran.");
      setExpenses((prev) =>
        prev.map((item) =>
          item.id === expenseId
            ? {
                ...item,
                expenseType: data.expense?.expenseType ?? nextType,
                category: data.expense?.category ?? nextType,
                isCashMovement: data.expense?.isCashMovement ?? nextType === "setoran_tabungan",
              }
            : item
        )
      );
      toast.success("Klasifikasi pengeluaran berhasil diperbarui.");
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : "Gagal mengubah jenis pengeluaran.");
    }
  }

  // Statistics (dipisah agar Beban Operasional tidak tercampur dengan Kulakan & Titipan)
  const operationalExpensesAmount = expenses
    .filter((e) => {
      const meta = getCategoryMeta(e);
      return meta.key === "operasional" || meta.key === "gaji_sosial";
    })
    .reduce((acc, e) => acc + (e.amount || 0), 0);
  const kulakanExpensesAmount = expenses
    .filter((e) => getCategoryMeta(e).key === "sales_toko")
    .reduce((acc, e) => acc + (e.amount || 0), 0);
  const titipanExpensesAmount = expenses
    .filter((e) => getCategoryMeta(e).key === "sales_titipan")
    .reduce((acc, e) => acc + (e.amount || 0), 0);
  const titipanRecordedProfitAmount = expenses
    .filter((e) => getCategoryMeta(e).key === "sales_titipan")
    .reduce((acc, e) => {
      const match = /untung\s*toko\s*:?\s*rp\.?\s*([\d.]+)/i.exec(e.title || "");
      const parsed = match?.[1] ? Number(match[1].replace(/\./g, "")) : 0;
      return acc + (Number.isFinite(parsed) ? parsed : 0);
    }, 0);

  const pendingPlans = plans.filter((p) => p.isDone === 0);
  const completedPlans = plans.filter((p) => p.isDone === 1);
  const estimatedRestokCost = pendingPlans.reduce((acc, p) => acc + (p.estimatedPrice || 0), 0);

  // Filtered expenses
  const filteredExpenses = useMemo(() => {
    return expenses.filter((item) => {
      // Date filter (spesifik hari YYYY-MM-DD untuk riwayat hari lampau)
      if (selectedDateFilter) {
        const itemDateStr = getLocalDateString(item.createdAt);
        if (itemDateStr !== selectedDateFilter) {
          return false;
        }
      }

      // Category filter
      if (selectedCategoryFilter !== "all") {
        const meta = getCategoryMeta(item);
        if (selectedCategoryFilter === "lainnya") {
          if (["operasional", "sales_toko", "sales_titipan", "gaji_sosial"].includes(meta.key)) {
            return false;
          }
        } else if (meta.key !== selectedCategoryFilter) {
          return false;
        }
      }

      // Text search
      if (expenseSearch.trim()) {
        const query = expenseSearch.toLowerCase();
        const titleMatch = item.title?.toLowerCase().includes(query);
        const catMatch = item.category?.toLowerCase().includes(query);
        const meta = getCategoryMeta(item);
        const metaMatch = meta.name.toLowerCase().includes(query) || meta.badgeLabel.toLowerCase().includes(query);
        if (!titleMatch && !catMatch && !metaMatch) return false;
      }

      return true;
    });
  }, [expenses, selectedDateFilter, selectedCategoryFilter, expenseSearch]);

  // Pagination calculation
  const totalPages = pageSize === -1 ? 1 : Math.max(1, Math.ceil(filteredExpenses.length / pageSize));
  const currentPage = Math.min(Math.max(1, page), totalPages);

  const paginatedExpenses = useMemo(() => {
    if (pageSize === -1) return filteredExpenses;
    const start = (currentPage - 1) * pageSize;
    return filteredExpenses.slice(start, start + pageSize);
  }, [filteredExpenses, currentPage, pageSize]);

  type DayExpenseGroup = {
    dateKey: string;
    dateStr: string;
    fullDateHeader: string;
    relativeDay: "today" | "yesterday" | null;
    totalAmount: number;
    items: any[];
  };

  const groupedExpenses = useMemo(() => {
    const groups: DayExpenseGroup[] = [];
    const map = new Map<string, DayExpenseGroup>();

    for (const exp of paginatedExpenses) {
      const dateKey = exp.createdAt ? exp.createdAt.slice(0, 10) : "unknown";
      let group = map.get(dateKey);
      if (!group) {
        const createdDate = new Date(exp.createdAt);
        group = {
          dateKey,
          dateStr: new Intl.DateTimeFormat("id-ID", {
            day: "numeric",
            month: "short",
            year: "numeric",
          }).format(createdDate),
          fullDateHeader: formatDayHeader(exp.createdAt),
          relativeDay: isTodayOrYesterday(exp.createdAt),
          totalAmount: 0,
          items: [],
        };
        map.set(dateKey, group);
        groups.push(group);
      }
      group.totalAmount += exp.amount || 0;
      group.items.push(exp);
    }

    return groups;
  }, [paginatedExpenses]);

  const filteredTotalAmount = useMemo(() => {
    return filteredExpenses.reduce((sum, item) => sum + (item.amount || 0), 0);
  }, [filteredExpenses]);

  // Filtered plans
  const filteredPlans = useMemo(() => {
    if (planFilter === "pending") return plans.filter((p) => p.isDone === 0);
    if (planFilter === "done") return plans.filter((p) => p.isDone === 1);
    return plans;
  }, [plans, planFilter]);

  const restokProgressPercent = plans.length > 0 ? Math.round((completedPlans.length / plans.length) * 100) : 0;

  return (
    <div className="w-full space-y-6 animate-in fade-in slide-in-from-bottom-2 duration-500">
      <ExpenseRecordDialog
        open={expenseDialogOpen}
        onOpenChange={setExpenseDialogOpen}
        onRecorded={() => {
          void fetchExpenses();
        }}
      />

      {/* Top Stat Cards */}
      <section className="grid gap-4 grid-cols-2 lg:grid-cols-4">
        <StatCard
          title="Beban Operasional Murni"
          value={formatCurrency(operationalExpensesAmount)}
          description="Listrik, plastik, wifi & upah (mengurangi laba)."
          tone="warn"
        />
        <StatCard
          title="Kulakan / Nota Supplier"
          value={formatCurrency(kulakanExpensesAmount)}
          description="Modal belanja stok barang (Non-Beban rugi)."
        />
        <StatCard
          title="Setoran Barang Titipan"
          value={formatCurrency(titipanExpensesAmount)}
          description={
            titipanRecordedProfitAmount > 0
              ? `Tercatat untung titipan +${formatCurrency(titipanRecordedProfitAmount)}`
              : "Bayar hasil jual barang titipan ke penitip."
          }
          tone="accent"
        />
        <StatCard
          title="Rencana Belanja Restok"
          value={`${pendingPlans.length} Item`}
          description={`Est: ${formatCurrency(estimatedRestokCost)} (${completedPlans.length} selesai)`}
        />
      </section>

      {/* Panduan Pembeda Kasir: Beban vs Nota Kulakan vs Barang Titipan */}
      <div className="rounded-2xl border border-amber-500/30 bg-amber-500/5 p-3.5 sm:p-4">
        <div className="flex items-center gap-2 text-xs sm:text-sm font-bold text-foreground mb-2">
          <Sparkles className="size-4 text-primary shrink-0" />
          <span>Panduan Kasir: Bedakan 3 Jenis Kas Keluar Agar Laporan Laba Akurat</span>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-2.5 text-xs">
          <div className="rounded-xl border border-rose-500/25 bg-card/80 p-2.5">
            <p className="font-bold text-rose-700 dark:text-rose-300 flex items-center gap-1.5">
              <Wrench className="size-3.5" /> 1. Operasional Toko (Mengurangi Laba)
            </p>
            <p className="text-muted-foreground mt-0.5 leading-snug">
              Khusus biaya toko habis pakai: token listrik, plastik/kresek, cup, lakban, wifi, bensin, gaji.
            </p>
          </div>
          <div className="rounded-xl border border-amber-500/25 bg-card/80 p-2.5">
            <p className="font-bold text-amber-800 dark:text-amber-300 flex items-center gap-1.5">
              <ShoppingBag className="size-3.5" /> 2. Nota Kulakan Supplier (Non-Beban)
            </p>
            <p className="text-muted-foreground mt-0.5 leading-snug">
              Bayar nota belanja barang dagangan/agen (telur, galon, gas, beras, snack). Masuk modal stok, bukan beban rugi!
            </p>
          </div>
          <div className="rounded-xl border border-emerald-500/25 bg-card/80 p-2.5">
            <p className="font-bold text-emerald-700 dark:text-emerald-300 flex items-center gap-1.5">
              <Handshake className="size-3.5" /> 3. Bayar Barang Titipan (Non-Beban)
            </p>
            <p className="text-muted-foreground mt-0.5 leading-snug">
              Setor uang barang titipan ke penitip (roti, peyek, kue). Bisa catat total laku &amp; otomatis hitung untung toko!
            </p>
          </div>
        </div>
      </div>

      {/* Header with Title and Action Button */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 py-1">
        <div>
          <h2 className="font-heading text-2xl sm:text-3xl font-bold tracking-tight text-foreground">
            Pengeluaran & Restok
          </h2>
          <p className="text-sm text-muted-foreground mt-0.5">
            Kelola pencatatan beban operasional, kas keluar, dan rencana belanja kulakan toko.
          </p>
        </div>

        <Button
          onClick={() => setExpenseDialogOpen(true)}
          className="rounded-2xl gap-2 font-semibold shadow-md shadow-primary/20 shrink-0 h-11 px-5"
        >
          <BanknoteArrowDown className="size-4" />
          Catat Pengeluaran
        </Button>
      </div>

      {/* MAIN SWITCHABLE TABS (Matches Riwayat Operasional & Rekap Harian) */}
      <Tabs
        defaultValue="pengeluaran"
        value={activeMainTab}
        onValueChange={(val) => setActiveMainTab(String(val))}
        className="w-full space-y-4"
      >
        <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4 border-b border-border/40 pb-4">
          <div className="space-y-1">
            <h3 className="font-heading text-lg font-semibold text-foreground tracking-tight">
              Riwayat Pengeluaran & Rencana Belanja
            </h3>
            <p className="text-xs text-muted-foreground">
              Gunakan tab di bawah untuk melihat rincian pengeluaran operasional toko atau rencana belanja restok barang.
            </p>
          </div>
          <TabsList className="grid grid-cols-2 sm:inline-flex w-full sm:w-auto group-data-horizontal/tabs:h-auto p-1.5 bg-muted/60 dark:bg-muted/40 rounded-full border border-border/70 shadow-2xs shrink-0 gap-1.5 overflow-hidden">
            <TabsTrigger
              value="pengeluaran"
              className="rounded-full text-xs sm:text-sm font-semibold h-10 px-3 sm:px-5 flex items-center justify-center gap-1.5 sm:gap-2 transition-all cursor-pointer hover:text-foreground data-[state=active]:bg-primary data-[state=active]:text-primary-foreground dark:data-[state=active]:bg-primary dark:data-[state=active]:text-amber-950 data-[state=active]:shadow-xs"
            >
              <BanknoteArrowDown className="size-4 shrink-0" />
              <span className="hidden sm:inline">Riwayat Pengeluaran</span>
              <span className="sm:hidden">Pengeluaran</span>
              {expenses.length > 0 && (
                <span
                  className={cn(
                    "ml-1 inline-flex items-center justify-center min-w-5 h-5 px-1.5 rounded-full text-[11px] font-bold tabular-nums shrink-0 transition-colors shadow-2xs",
                    activeMainTab === "pengeluaran"
                      ? "bg-white text-primary dark:bg-amber-100 dark:text-amber-950 font-extrabold shadow-xs"
                      : "bg-background text-foreground/80 border border-border/70 font-semibold"
                  )}
                >
                  {expenses.length}
                </span>
              )}
            </TabsTrigger>
            <TabsTrigger
              value="restok"
              className="rounded-full text-xs sm:text-sm font-semibold h-10 px-3 sm:px-5 flex items-center justify-center gap-1.5 sm:gap-2 transition-all cursor-pointer hover:text-foreground data-[state=active]:bg-primary data-[state=active]:text-primary-foreground dark:data-[state=active]:bg-primary dark:data-[state=active]:text-amber-950 data-[state=active]:shadow-xs"
            >
              <ShoppingBag className="size-4 shrink-0" />
              <span className="hidden sm:inline">Rencana Belanja Restok</span>
              <span className="sm:hidden">Rencana Restok</span>
              {pendingPlans.length > 0 && (
                <span
                  className={cn(
                    "ml-1 inline-flex items-center justify-center min-w-5 h-5 px-1.5 rounded-full text-[11px] font-bold tabular-nums shrink-0 transition-colors shadow-2xs",
                    activeMainTab === "restok"
                      ? "bg-white text-primary dark:bg-amber-100 dark:text-amber-950 font-extrabold shadow-xs"
                      : "bg-background text-foreground/80 border border-border/70 font-semibold"
                  )}
                >
                  {pendingPlans.length}
                </span>
              )}
            </TabsTrigger>
          </TabsList>
        </div>

        {/* TAB 1: RIWAYAT PENGELUARAN */}
        <TabsContent value="pengeluaran" className="space-y-4 mt-0 focus-visible:outline-none">
          {/* Filter Bar & Search */}
          <div className="rounded-2xl border border-border/60 bg-card/60 p-4 shadow-sm space-y-3">
            <div className="flex flex-col lg:flex-row gap-3 items-stretch lg:items-center justify-between">
              {/* Search Bar */}
              <div className="relative flex-1 max-w-md">
                <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 size-4 text-muted-foreground" />
                <Input
                  placeholder="Cari pengeluaran (nama, catatan, kategori)..."
                  value={expenseSearch}
                  onChange={(e) => {
                    setExpenseSearch(e.target.value);
                    setPage(1);
                  }}
                  className="pl-9.5 pr-8 h-10 rounded-xl text-sm bg-background/80"
                />
                {expenseSearch && (
                  <button
                    type="button"
                    onClick={() => {
                      setExpenseSearch("");
                      setPage(1);
                    }}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground cursor-pointer"
                  >
                    <X className="size-3.5" />
                  </button>
                )}
              </div>

              {/* Custom Themed Calendar Picker & Quick Jump Days */}
              <div className="flex flex-wrap items-center gap-2">
                <DatePicker
                  value={selectedDateFilter}
                  placeholder="Pilih Hari..."
                  onChange={(val) => {
                    setSelectedDateFilter(val);
                    setPage(1);
                  }}
                />

                {/* Day Quick Presets */}
                <div className="inline-flex rounded-xl border border-border/50 bg-background/50 p-0.5">
                  <button
                    type="button"
                    onClick={() => {
                      setSelectedDateFilter("");
                      setPage(1);
                    }}
                    className={cn(
                      "px-2.5 py-1 rounded-lg text-xs font-semibold transition-all cursor-pointer",
                      !selectedDateFilter
                        ? "bg-primary text-primary-foreground dark:text-amber-950 font-bold shadow-xs"
                        : "text-muted-foreground hover:text-foreground"
                    )}
                  >
                    Semua
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setSelectedDateFilter(todayStr);
                      setPage(1);
                    }}
                    className={cn(
                      "px-2.5 py-1 rounded-lg text-xs font-semibold transition-all cursor-pointer",
                      selectedDateFilter === todayStr
                        ? "bg-primary text-primary-foreground dark:text-amber-950 font-bold shadow-xs"
                        : "text-muted-foreground hover:text-foreground"
                    )}
                  >
                    Hari Ini
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setSelectedDateFilter(yesterdayStr);
                      setPage(1);
                    }}
                    className={cn(
                      "px-2.5 py-1 rounded-lg text-xs font-semibold transition-all cursor-pointer",
                      selectedDateFilter === yesterdayStr
                        ? "bg-primary text-primary-foreground dark:text-amber-950 font-bold shadow-xs"
                        : "text-muted-foreground hover:text-foreground"
                    )}
                  >
                    Kemarin
                  </button>
                </div>

                {/* Total counter info */}
                <div className="flex items-center gap-1.5 text-xs text-muted-foreground ml-auto lg:ml-2">
                  <Filter className="size-3.5" />
                  <span>
                    <strong className="text-foreground">{filteredExpenses.length}</strong> dari {expenses.length}
                  </span>
                </div>
              </div>
            </div>

            {/* Selected Date Active Notification Banner */}
            {selectedDateFilter && (
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 px-3.5 py-2 rounded-xl bg-primary/10 border border-primary/20 text-xs animate-in fade-in duration-300">
                <div className="flex items-center gap-2">
                  <Calendar className="size-4 text-primary shrink-0" />
                  <span className="text-foreground">
                    Riwayat tanggal:{" "}
                    <strong className="capitalize">
                      {(() => {
                        try {
                          const [y, m, d] = selectedDateFilter.split("-").map(Number);
                          const dateObj = new Date(y, m - 1, d);
                          return new Intl.DateTimeFormat("id-ID", {
                            weekday: "long",
                            day: "numeric",
                            month: "long",
                            year: "numeric",
                          }).format(dateObj);
                        } catch {
                          return selectedDateFilter;
                        }
                      })()}
                    </strong>
                  </span>
                  <Badge variant="outline" className="text-[11px] bg-background border-primary/30 text-primary font-bold">
                    {filteredExpenses.length} catatan
                  </Badge>
                </div>
                <div className="flex items-center gap-3">
                  <span className="font-bold text-red-600 dark:text-red-400 tabular-nums">
                    Total: {formatCurrency(filteredTotalAmount)}
                  </span>
                  <button
                    type="button"
                    onClick={() => {
                      setSelectedDateFilter("");
                      setPage(1);
                    }}
                    className="text-xs text-muted-foreground hover:text-foreground underline cursor-pointer"
                  >
                    Tampilkan Semua Hari
                  </button>
                </div>
              </div>
            )}

            {/* Quick Category Filter Chips */}
            <div className="flex flex-wrap items-center gap-1.5 pt-1 border-t border-border/40">
              <span className="text-xs text-muted-foreground mr-1 hidden sm:inline">Kategori:</span>
              <button
                type="button"
                onClick={() => {
                  setSelectedCategoryFilter("all");
                  setPage(1);
                }}
                className={cn(
                  "px-3 py-1.5 rounded-xl text-xs font-medium transition-all cursor-pointer",
                  selectedCategoryFilter === "all"
                    ? "bg-primary text-primary-foreground shadow-sm font-bold"
                    : "bg-muted/50 text-muted-foreground hover:bg-muted hover:text-foreground"
                )}
              >
                Semua ({expenses.length})
              </button>

              {[
                { key: "operasional", label: "Operasional", icon: Wrench },
                { key: "sales_toko", label: "Kulakan Stok", icon: ShoppingBag },
                { key: "sales_titipan", label: "Titipan Mitra", icon: Handshake },
                { key: "gaji_sosial", label: "Upah & Gaji", icon: Users },
                { key: "lainnya", label: "Mutasi Kas & Lainnya", icon: Landmark },
              ].map((cat) => {
                const Icon = cat.icon;
                const active = selectedCategoryFilter === cat.key;
                return (
                  <button
                    key={cat.key}
                    type="button"
                    onClick={() => {
                      setSelectedCategoryFilter(cat.key);
                      setPage(1);
                    }}
                    className={cn(
                      "inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-medium transition-all cursor-pointer border",
                      active
                        ? "bg-primary text-primary-foreground border-primary font-semibold shadow-2xs"
                        : "bg-card text-muted-foreground border-border/60 hover:bg-muted/60 hover:text-foreground"
                    )}
                  >
                    <Icon className="size-3" />
                    <span>{cat.label}</span>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Expenses List View: Row Barisan & Table */}
          {isLoadingExpenses ? (
            <div className="py-16 flex flex-col items-center justify-center gap-3 rounded-2xl border border-border/60 bg-card/40 text-muted-foreground">
              <Loader2 className="size-7 animate-spin text-primary" />
              <p className="text-sm font-medium">Memuat riwayat pengeluaran...</p>
            </div>
          ) : filteredExpenses.length === 0 ? (
            <div className="text-center py-16 rounded-2xl border border-border/60 bg-card/40">
              <div className="flex size-14 mx-auto mb-3 items-center justify-center rounded-2xl bg-muted text-muted-foreground">
                <BanknoteArrowDown className="size-7 opacity-60" />
              </div>
              <h4 className="font-heading text-base font-semibold">Tidak ada riwayat pengeluaran</h4>
              <p className="text-xs text-muted-foreground mt-1 max-w-sm mx-auto">
                {expenseSearch || selectedCategoryFilter !== "all" || selectedDateFilter
                  ? "Tidak ada data yang cocok dengan kriteria filter, tanggal, atau pencarian Anda."
                  : "Belum ada catatan pengeluaran. Klik 'Catat Pengeluaran' untuk menambahkan data."}
              </p>
              {(expenseSearch || selectedCategoryFilter !== "all" || selectedDateFilter) && (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => {
                    setExpenseSearch("");
                    setSelectedCategoryFilter("all");
                    setSelectedDateFilter("");
                    setPage(1);
                  }}
                  className="mt-4 rounded-xl text-xs cursor-pointer"
                >
                  Reset Semua Filter
                </Button>
              )}
            </div>
          ) : (
            <div className="space-y-4">
              {/* List of Rounded Day Cards */}
              <div className="space-y-3.5">
                {groupedExpenses.map((group) => (
                  <div
                    key={group.dateKey}
                    className={cn(
                      "rounded-2xl border border-border/70 bg-card/90 overflow-hidden shadow-2xs transition-all hover:border-border",
                      group.relativeDay === "today" && "border-primary/40 ring-1 ring-primary/20"
                    )}
                  >
                    {/* Header Section Per Hari */}
                    <div
                      className={cn(
                        "px-4 py-2.5 border-b border-border/50 flex flex-wrap items-center justify-between gap-2.5",
                        group.relativeDay === "today" ? "bg-primary/10" : "bg-muted/30"
                      )}
                    >
                      <div className="flex items-center gap-2.5">
                        <div
                          className={cn(
                            "flex size-6 items-center justify-center rounded-lg border",
                            group.relativeDay === "today"
                              ? "bg-primary/20 text-primary border-primary/30"
                              : "bg-background text-muted-foreground border-border/60"
                          )}
                        >
                          <Calendar className="size-3" />
                        </div>
                        <h4 className="font-heading font-semibold text-xs sm:text-sm text-foreground tracking-tight">
                          {group.fullDateHeader}
                        </h4>
                        {group.relativeDay === "today" && (
                          <Badge
                            variant="default"
                            className="text-[10px] h-4.5 px-2 font-bold shadow-xs"
                          >
                            Hari Ini
                          </Badge>
                        )}
                        {group.relativeDay === "yesterday" && (
                          <Badge
                            variant="secondary"
                            className="text-[10px] h-4.5 px-2 font-medium"
                          >
                            Kemarin
                          </Badge>
                        )}
                      </div>

                      <div className="flex items-center gap-2 text-xs">
                        <span className="text-muted-foreground font-medium">
                          {group.items.length} catatan
                        </span>
                        <span className="text-muted-foreground/40">•</span>
                        <span className="font-semibold text-foreground tabular-nums bg-background/80 px-2.5 py-0.5 rounded-lg border border-border/60 text-xs">
                          Total: <span className="font-bold text-foreground">{formatCurrency(group.totalAmount)}</span>
                        </span>
                      </div>
                    </div>

                    {/* Table Transaksi di Hari Tersebut */}
                    <div className="overflow-x-auto">
                      <Table className="min-w-[720px]">
                        <TableBody>
                          {group.items.map((expense) => {
                            const meta = getCategoryMeta(expense);
                            const CategoryIcon = meta.icon;
                            const createdDate = new Date(expense.createdAt);
                            const timeStr = new Intl.DateTimeFormat("id-ID", {
                              hour: "2-digit",
                              minute: "2-digit",
                              hour12: false,
                            }).format(createdDate);

                            return (
                              <TableRow
                                key={expense.id}
                                className="hover:bg-muted/20 transition-colors border-b border-border/30 last:border-b-0"
                              >
                                <TableCell className="w-[110px] whitespace-nowrap py-3 pl-4">
                                  <span className="inline-flex items-center gap-1.5 text-xs font-medium text-muted-foreground tabular-nums">
                                    <Clock className="size-3 text-muted-foreground/70" />
                                    {timeStr}
                                  </span>
                                </TableCell>
                                <TableCell className="py-3">
                                  <div className="flex items-center gap-2.5">
                                    <div className="flex size-7 shrink-0 items-center justify-center rounded-lg bg-muted/60 text-muted-foreground border border-border/40">
                                      <CategoryIcon className="size-3.5" />
                                    </div>
                                    <div className="min-w-0">
                                      <p className="font-medium text-xs sm:text-sm text-foreground leading-snug line-clamp-2">
                                        {expense.title}
                                      </p>
                                      {expense.investorName && (
                                        <p className="text-[11px] text-muted-foreground">
                                          Mitra: {expense.investorName}
                                        </p>
                                      )}
                                    </div>
                                  </div>
                                </TableCell>
                                <TableCell className="w-[165px] whitespace-nowrap py-3">
                                  <span className={cn("px-2.5 py-1 text-[11px] font-medium rounded-lg border inline-flex items-center gap-1.5", meta.badgeClass)}>
                                    <CategoryIcon className="size-3" />
                                    <span>{meta.badgeLabel}</span>
                                  </span>
                                </TableCell>
                                <TableCell className="w-[155px] whitespace-nowrap py-3">
                                  <span className={cn("text-xs", meta.impactClass)}>
                                    {meta.impactLabel}
                                  </span>
                                </TableCell>
                                <TableCell className="w-[130px] whitespace-nowrap text-right py-3 font-semibold text-foreground tabular-nums text-xs sm:text-sm">
                                  {formatCurrency(expense.amount)}
                                </TableCell>
                                <TableCell className="w-[150px] whitespace-nowrap text-center py-3 pr-4">
                                  <Select
                                    value={meta.key}
                                    onValueChange={(nextVal) => {
                                      if (nextVal && nextVal !== meta.key) {
                                        void handleReclassifyExpense(expense.id, nextVal);
                                      }
                                    }}
                                  >
                                    <SelectTrigger className="h-7.5 w-[136px] rounded-lg border-border/70 bg-background/80 text-[11px] font-medium px-2">
                                      <SelectValue placeholder="Ubah Jenis" />
                                    </SelectTrigger>
                                    <SelectContent className="rounded-xl text-xs">
                                      <SelectItem value="operasional">Operasional (Beban)</SelectItem>
                                      <SelectItem value="sales_toko">Kulakan / Nota</SelectItem>
                                      <SelectItem value="sales_titipan">Barang Titipan</SelectItem>
                                      <SelectItem value="gaji_sosial">Upah &amp; Gaji</SelectItem>
                                      <SelectItem value="setoran_tabungan">Mutasi Kas</SelectItem>
                                    </SelectContent>
                                  </Select>
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

              {/* Pagination Controls Footer */}
              <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between rounded-2xl border border-border/60 p-3.5 sm:px-4 text-xs text-muted-foreground bg-card/60 shadow-2xs">
                <div className="flex flex-wrap items-center gap-2">
                  <span>Baris per halaman:</span>
                  <div className="inline-flex rounded-lg border border-border/50 bg-background/50 p-0.5">
                    {[25, 50, 100, -1].map((size) => (
                      <button
                        key={size}
                        type="button"
                        onClick={() => {
                          setPageSize(size);
                          setPage(1);
                        }}
                        className={cn(
                          "rounded-md px-2.5 py-1 text-xs font-medium transition-colors cursor-pointer",
                          pageSize === size
                            ? "bg-primary text-primary-foreground shadow-xs font-bold"
                            : "text-muted-foreground hover:text-foreground"
                        )}
                      >
                        {size === -1 ? "Semua" : size}
                      </button>
                    ))}
                  </div>
                  <span className="text-muted-foreground/80 pl-1 sm:pl-2">
                    Menampilkan {filteredExpenses.length === 0 ? 0 : (currentPage - 1) * (pageSize === -1 ? filteredExpenses.length : pageSize) + 1} -{" "}
                    {pageSize === -1 ? filteredExpenses.length : Math.min(currentPage * pageSize, filteredExpenses.length)} dari{" "}
                    {filteredExpenses.length} catatan
                  </span>
                </div>

                {pageSize !== -1 && totalPages > 1 && (
                  <div className="flex items-center gap-1.5 self-end sm:self-auto">
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      disabled={currentPage <= 1}
                      onClick={() => setPage(1)}
                      className="h-8 w-8 p-0 rounded-lg cursor-pointer"
                      title="Halaman pertama"
                    >
                      <ChevronsLeft className="size-3.5" />
                    </Button>
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      disabled={currentPage <= 1}
                      onClick={() => setPage((p) => Math.max(1, p - 1))}
                      className="h-8 w-8 p-0 rounded-lg cursor-pointer"
                      title="Halaman sebelumnya"
                    >
                      <ChevronLeft className="size-3.5" />
                    </Button>
                    <span className="px-2 font-medium text-foreground">
                      Halaman {currentPage} dari {totalPages}
                    </span>
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      disabled={currentPage >= totalPages}
                      onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                      className="h-8 w-8 p-0 rounded-lg cursor-pointer"
                      title="Halaman berikutnya"
                    >
                      <ChevronRight className="size-3.5" />
                    </Button>
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      disabled={currentPage >= totalPages}
                      onClick={() => setPage(totalPages)}
                      className="h-8 w-8 p-0 rounded-lg cursor-pointer"
                      title="Halaman terakhir"
                    >
                      <ChevronsRight className="size-3.5" />
                    </Button>
                  </div>
                )}
              </div>
            </div>
          )}
        </TabsContent>

        {/* TAB 2: RENCANA BELANJA RESTOK */}
        <TabsContent value="restok" className="space-y-4 mt-0 focus-visible:outline-none">
          {/* Quick Input Form for Restock */}
          <div className="rounded-2xl border border-border/60 bg-card/60 p-4 sm:p-5 shadow-sm space-y-3">
            <div className="flex items-center gap-2.5 pb-2 border-b border-border/40">
              <div className="flex size-8 items-center justify-center rounded-xl bg-amber-500/15 text-amber-600 dark:text-amber-400">
                <Plus className="size-4" />
              </div>
              <div>
                <h4 className="font-heading text-sm font-semibold text-foreground">
                  Tambah Rencana Belanja Restok
                </h4>
                <p className="text-xs text-muted-foreground">
                  Catat barang yang menipis atau perlu segera dibeli ke distributor / pasar.
                </p>
              </div>
            </div>

            <form onSubmit={handleAddPlan} className="space-y-3 pt-1">
              <div className="grid grid-cols-1 sm:grid-cols-12 gap-3">
                <div className="sm:col-span-5">
                  <Input
                    placeholder="Nama barang (cth: Beras Pandan Wangi 5kg)"
                    value={productName}
                    onChange={(e) => setProductName(e.target.value)}
                    className="h-10 rounded-xl"
                  />
                </div>
                <div className="sm:col-span-3">
                  <Input
                    placeholder="Est. Harga (opsional)"
                    type="number"
                    value={estimatedPrice}
                    onChange={(e) => setEstimatedPrice(e.target.value)}
                    className="h-10 rounded-xl"
                  />
                </div>
                <div className="sm:col-span-4">
                  <Input
                    placeholder="Catatan (cth: beli 2 karung di Toko Sejahtera)"
                    value={note}
                    onChange={(e) => setNote(e.target.value)}
                    className="h-10 rounded-xl"
                  />
                </div>
              </div>

              <div className="flex justify-end">
                <Button
                  type="submit"
                  disabled={isSubmitting || !productName.trim()}
                  className="rounded-xl h-10 px-5 gap-1.5 font-medium shadow-sm"
                >
                  <Plus className="size-4" /> Tambah ke Rencana Belanja
                </Button>
              </div>
            </form>
          </div>

          {/* Restock Progress and Filter Bar */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-4 rounded-2xl border border-border/60 bg-card/60 shadow-sm">
            <div className="space-y-1.5 flex-1 max-w-md">
              <div className="flex items-center justify-between text-xs">
                <span className="font-medium text-foreground">
                  Progres Belanja: {completedPlans.length} dari {plans.length} barang ({restokProgressPercent}%)
                </span>
                <span className="font-bold text-amber-700 dark:text-amber-400 tabular-nums">
                  Est. Perlu Dibeli: {formatCurrency(estimatedRestokCost)}
                </span>
              </div>
              <div className="h-2 w-full rounded-full bg-muted overflow-hidden">
                <div
                  className="h-full bg-gradient-to-r from-amber-500 to-emerald-500 rounded-full transition-all duration-500"
                  style={{ width: `${restokProgressPercent}%` }}
                />
              </div>
            </div>

            {/* Status Filter Chips */}
            <div className="flex items-center gap-1.5 self-start sm:self-center">
              <button
                type="button"
                onClick={() => setPlanFilter("all")}
                className={cn(
                  "px-3 py-1.5 rounded-xl text-xs font-medium transition-all",
                  planFilter === "all"
                    ? "bg-primary text-primary-foreground shadow-sm"
                    : "bg-muted/50 text-muted-foreground hover:bg-muted hover:text-foreground"
                )}
              >
                Semua ({plans.length})
              </button>
              <button
                type="button"
                onClick={() => setPlanFilter("pending")}
                className={cn(
                  "px-3 py-1.5 rounded-xl text-xs font-medium transition-all",
                  planFilter === "pending"
                    ? "bg-amber-600 text-white shadow-sm"
                    : "bg-amber-500/10 text-amber-700 dark:text-amber-400 hover:bg-amber-500/20"
                )}
              >
                Perlu Dibeli ({pendingPlans.length})
              </button>
              <button
                type="button"
                onClick={() => setPlanFilter("done")}
                className={cn(
                  "px-3 py-1.5 rounded-xl text-xs font-medium transition-all",
                  planFilter === "done"
                    ? "bg-emerald-600 text-white shadow-sm"
                    : "bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 hover:bg-emerald-500/20"
                )}
              >
                Sudah Terbeli ({completedPlans.length})
              </button>
            </div>
          </div>

          {/* Restock Plans List */}
          {isLoadingPlans ? (
            <div className="py-16 flex flex-col items-center justify-center gap-3 rounded-2xl border border-border/60 bg-card/40 text-muted-foreground">
              <Loader2 className="size-7 animate-spin text-primary" />
              <p className="text-sm font-medium">Memuat rencana belanja restok...</p>
            </div>
          ) : filteredPlans.length === 0 ? (
            <div className="text-center py-16 rounded-2xl border border-border/60 bg-card/40">
              <div className="flex size-14 mx-auto mb-3 items-center justify-center rounded-2xl bg-muted text-muted-foreground">
                <ShoppingBag className="size-7 opacity-60" />
              </div>
              <h4 className="font-heading text-base font-semibold">Belum ada daftar rencana belanja</h4>
              <p className="text-xs text-muted-foreground mt-1 max-w-sm mx-auto">
                {planFilter !== "all"
                  ? "Tidak ada item dalam kategori status ini."
                  : "Tulis barang kebutuhan toko pada formulir di atas untuk memulai daftar kulakan."}
              </p>
            </div>
          ) : (
            <div className="grid gap-2.5 sm:grid-cols-2 lg:grid-cols-3">
              {filteredPlans.map((plan) => (
                <div
                  key={plan.id}
                  className={cn(
                    "flex flex-col justify-between p-4 rounded-2xl border transition-all shadow-sm",
                    plan.isDone === 1
                      ? "bg-muted/30 border-border/40 opacity-70"
                      : "bg-card border-border hover:border-primary/40 hover:shadow-md"
                  )}
                >
                  <div className="flex items-start gap-3">
                    <button
                      type="button"
                      onClick={() => handleToggleDone(plan.id, plan.isDone)}
                      aria-label={plan.isDone === 1 ? "Tandai belum selesai" : "Tandai sudah terbeli"}
                      className={cn(
                        "mt-0.5 flex size-6 shrink-0 items-center justify-center rounded-lg border transition-all",
                        plan.isDone === 1
                          ? "bg-emerald-600 text-white border-emerald-600"
                          : "border-muted-foreground/40 hover:border-primary"
                      )}
                    >
                      {plan.isDone === 1 && <Check className="size-3.5 stroke-[3]" />}
                    </button>

                    <div className="min-w-0 flex-1">
                      <p
                        className={cn(
                          "font-semibold text-sm leading-snug break-words",
                          plan.isDone === 1 ? "line-through text-muted-foreground" : "text-foreground"
                        )}
                      >
                        {plan.productName}
                      </p>

                      {plan.note && (
                        <p className="text-xs text-muted-foreground mt-1 break-words">
                          {plan.note}
                        </p>
                      )}

                      {plan.estimatedPrice > 0 && (
                        <p className="text-xs font-bold text-amber-700 dark:text-amber-400 mt-2 tabular-nums">
                          Est: {formatCurrency(plan.estimatedPrice)}
                        </p>
                      )}
                    </div>
                  </div>

                  <div className="flex items-center justify-between pt-3 mt-3 border-t border-border/30 text-[11px] text-muted-foreground">
                    <span className="capitalize">
                      {new Intl.DateTimeFormat("id-ID", {
                        day: "numeric",
                        month: "short",
                      }).format(new Date(plan.createdAt))}
                    </span>

                    <button
                      type="button"
                      onClick={() => handleDeletePlan(plan)}
                      className="text-muted-foreground/60 hover:text-destructive p-1 rounded-lg hover:bg-destructive/10 transition-colors"
                      title="Hapus dari rencana"
                    >
                      <Trash2 className="size-3.5" />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
}
