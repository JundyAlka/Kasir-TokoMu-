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
    label: "Operasional Toko",
    desc: "Biaya rutin (Listrik, Wifi, Air, Kebersihan, Perlengkapan)",
    icon: Wrench,
    badge: "Beban Operasional",
  },
  {
    value: "sales_toko",
    label: "Belanja Stok / Kulakan",
    desc: "Pembelian stok persediaan barang dagang toko",
    icon: ShoppingBag,
    badge: "Kulakan Stok",
  },
  {
    value: "gaji_sosial",
    label: "Gaji & Upah Karyawan",
    desc: "Gaji harian kasir/karyawan, lembur, dan insentif",
    icon: Users,
    badge: "Beban Upah",
  },
  {
    value: "setoran_tabungan",
    label: "Setor Kas / Tabungan",
    desc: "Pindah kas laci ke brankas/rekening bank toko",
    icon: Landmark,
    badge: "Mutasi Kas (Non-Beban)",
  },
  {
    value: "sales_titipan",
    label: "Setor Titipan Mitra",
    desc: "Pelunasan penjualan barang konsinyasi mitra",
    icon: Handshake,
    badge: "Konsinyasi Mitra",
    adminOnly: true,
  },
  {
    value: "bagi_hasil_investor",
    label: "Bagi Hasil Investor",
    desc: "Penyaluran bagi hasil keuntungan modal investor",
    icon: Coins,
    badge: "Distribusi Laba",
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
  const [partners, setPartners] = useState<Array<{ id: string; name: string; partnerType: string }>>([]);
  const [products, setProducts] = useState<Array<{ id: string; name: string; buyPrice: number }>>([]);
  const [investorId, setInvestorId] = useState("");
  const [intakes, setIntakes] = useState<Array<{ id: string; productName: string | null; qtySold: number; unitCost: number; settledAmount: number }>>([]);
  const [settleIntakeIds, setSettleIntakeIds] = useState<string[]>([]);
  const [restockEnabled, setRestockEnabled] = useState(false);
  const [restockProductId, setRestockProductId] = useState("");
  const [restockQuantity, setRestockQuantity] = useState("");
  const isCashier = role === "kasir";

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

    if (category === "sales_titipan") {
      if (!investorId) {
        toast.error("Mitra titipan wajib dipilih.");
        return;
      }
      if (settleIntakeIds.length === 0) {
        toast.error("Pilih minimal satu barang titipan yang dilunasi.");
        return;
      }
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

      toast.success("Pengeluaran berhasil dicatat");
      onOpenChange(false);
      setTitle("");
      setAmount("");
      setCategory("operasional");
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
            {/* Kategori Pengeluaran */}
            <div className="space-y-1.5">
              <label className="text-xs sm:text-sm font-semibold text-foreground flex items-center justify-between">
                <span>Kategori Pengeluaran <span className="text-destructive">*</span></span>
                <span className="text-[11px] font-normal text-muted-foreground">Pilih jenis alokasi kas</span>
              </label>
              <Select value={category} onValueChange={(val) => setCategory(val || "operasional")}>
                <SelectTrigger className="w-full h-11 sm:h-12 rounded-xl border border-input bg-background/90 px-3.5 cursor-pointer hover:bg-accent/40 transition-colors">
                  <div className="flex items-center gap-2.5 truncate text-left w-full">
                    <CategoryIcon className="size-4.5 text-primary shrink-0" />
                    <span className="font-semibold text-xs sm:text-sm text-foreground truncate">
                      {selectedCategoryMeta.label}
                    </span>
                    <span className="ml-auto mr-1 text-[11px] font-medium px-2 py-0.5 rounded-md bg-muted text-muted-foreground border border-border/50 shrink-0 hidden sm:inline-block">
                      {selectedCategoryMeta.badge}
                    </span>
                  </div>
                </SelectTrigger>
                <SelectContent className="rounded-xl border border-border/80 bg-popover p-1.5 shadow-2xl max-h-72 w-[calc(100vw-2.5rem)] sm:w-[420px]">
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

            {/* Keterangan / Keperluan */}
            <div className="space-y-1.5">
              <label className="text-xs sm:text-sm font-semibold text-foreground">
                Keterangan / Keperluan Pengeluaran <span className="text-destructive">*</span>
              </label>
              <Input
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="Contoh: Token Listrik PLN, Beli Lakban & Plastik, Galon Toko"
                className="h-11 rounded-xl border border-input bg-background/90 text-sm font-medium px-3.5 focus-visible:ring-2 focus-visible:ring-primary/20"
              />
            </div>

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

            {(category === "bagi_hasil_investor" || category === "sales_titipan") && (
              <div className="space-y-2.5 rounded-xl border border-border/70 bg-muted/20 p-4">
                <label className="text-xs sm:text-sm font-semibold text-foreground">
                  {category === "sales_titipan" ? "Pilih Mitra Titipan (Konsinyasi)" : "Pilih Investor Pemodal"} <span className="text-destructive">*</span>
                </label>
                <Select value={investorId} onValueChange={(value) => setInvestorId(value ?? "")}>
                  <SelectTrigger className="h-10.5 rounded-xl bg-background border-border/80 text-xs font-medium">
                    <SelectValue placeholder={category === "sales_titipan" ? "Pilih mitra titip jual..." : "Pilih nama investor pemodal..."} />
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
    badgeClass: "bg-muted/70 text-foreground border-border/70",
    avatarBg: "bg-muted text-foreground",
    avatarText: "text-foreground",
    icon: Wrench,
    impactLabel: "Beban Laba/Rugi",
    impactClass: "bg-muted/50 text-muted-foreground",
  },
  sales_toko: {
    key: "sales_toko",
    name: "Kulakan / Belanja Stok",
    badgeLabel: "Kulakan Stok",
    desc: "Pembelian stok persediaan barang dagang",
    badgeClass: "bg-muted/70 text-foreground border-border/70",
    avatarBg: "bg-muted text-foreground",
    avatarText: "text-foreground",
    icon: ShoppingBag,
    impactLabel: "Belanja Kulakan",
    impactClass: "bg-muted/50 text-muted-foreground",
  },
  sales_titipan: {
    key: "sales_titipan",
    name: "Setor Titipan Mitra",
    badgeLabel: "Titipan Konsinyasi",
    desc: "Pelunasan barang titipan pihak ketiga",
    badgeClass: "bg-muted/70 text-foreground border-border/70",
    avatarBg: "bg-muted text-foreground",
    avatarText: "text-foreground",
    icon: Handshake,
    impactLabel: "Setoran Konsinyasi",
    impactClass: "bg-muted/50 text-muted-foreground",
  },
  gaji_sosial: {
    key: "gaji_sosial",
    name: "Upah & Gaji Karyawan",
    badgeLabel: "Upah & Gaji",
    desc: "Upah harian karyawan, lembur, infak/sosial",
    badgeClass: "bg-muted/70 text-foreground border-border/70",
    avatarBg: "bg-muted text-foreground",
    avatarText: "text-foreground",
    icon: Users,
    impactLabel: "Beban Upah",
    impactClass: "bg-muted/50 text-muted-foreground",
  },
  setoran_tabungan: {
    key: "setoran_tabungan",
    name: "Setor Kas / Tabungan",
    badgeLabel: "Mutasi Kas",
    desc: "Setor kas shift ke bank/tabungan (Non-Beban)",
    badgeClass: "bg-muted/70 text-foreground border-border/70",
    avatarBg: "bg-muted text-foreground",
    avatarText: "text-foreground",
    icon: Landmark,
    impactLabel: "Non-Beban / Mutasi",
    impactClass: "bg-muted/50 text-muted-foreground",
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
    impactClass: "bg-muted/50 text-muted-foreground",
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

  // Statistics
  const totalExpensesAmount = expenses.reduce((acc, e) => acc + (e.amount || 0), 0);
  const operationalExpensesAmount = expenses
    .filter((e) => {
      const meta = getCategoryMeta(e);
      return meta.key === "operasional" || meta.key === "gaji_sosial";
    })
    .reduce((acc, e) => acc + (e.amount || 0), 0);

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
          title="Beban Operasional"
          value={formatCurrency(operationalExpensesAmount)}
          description="Listrik, upah & perlengkapan toko."
          tone="warn"
        />
        <StatCard
          title="Total Kas Keluar"
          value={formatCurrency(totalExpensesAmount)}
          description={`${expenses.length} total transaksi tercatat.`}
        />
        <StatCard
          title="Rencana Belanja Restok"
          value={`${pendingPlans.length} Item`}
          description={`Est: ${formatCurrency(estimatedRestokCost)}`}
          tone="accent"
        />
        <StatCard
          title="Restok Terbeli"
          value={`${completedPlans.length} Selesai`}
          description={`${restokProgressPercent}% dari rencana terbeli.`}
        />
      </section>

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
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 border-b border-border/40 pb-3">
          <div>
            <h3 className="font-heading text-lg font-semibold text-foreground">
              Riwayat Pengeluaran & Rencana Belanja
            </h3>
            <p className="text-xs text-muted-foreground">
              Gunakan tab di bawah untuk melihat rincian pengeluaran operasional toko atau rencana belanja restok barang.
            </p>
          </div>
          <TabsList className="grid grid-cols-2 w-full sm:w-[450px] h-11 p-1 bg-muted/70 rounded-xl border border-border/60">
            <TabsTrigger
              value="pengeluaran"
              className="rounded-lg text-xs sm:text-sm font-semibold h-9 flex items-center justify-center gap-2 transition-all"
            >
              <BanknoteArrowDown className="size-4 shrink-0" />
              <span>Riwayat Pengeluaran</span>
              {expenses.length > 0 && (
                <span
                  className={cn(
                    "ml-1 inline-flex items-center justify-center min-w-5 h-5 px-1.5 rounded-full text-[11px] font-bold tabular-nums transition-colors shadow-2xs",
                    activeMainTab === "pengeluaran"
                      ? "bg-white text-primary dark:bg-amber-950 dark:text-amber-100 font-extrabold"
                      : "bg-background text-foreground/80 border border-border/70 font-semibold"
                  )}
                >
                  {expenses.length}
                </span>
              )}
            </TabsTrigger>
            <TabsTrigger
              value="restok"
              className="rounded-lg text-xs sm:text-sm font-semibold h-9 flex items-center justify-center gap-2 transition-all"
            >
              <ShoppingBag className="size-4 shrink-0" />
              <span>Rencana Belanja Restok</span>
              {pendingPlans.length > 0 && (
                <span
                  className={cn(
                    "ml-1 inline-flex items-center justify-center min-w-5 h-5 px-1.5 rounded-full text-[11px] font-bold tabular-nums transition-colors shadow-2xs",
                    activeMainTab === "restok"
                      ? "bg-white text-primary dark:bg-amber-950 dark:text-amber-100 font-extrabold"
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
                                <TableCell className="w-[150px] whitespace-nowrap py-3">
                                  <span className="px-2.5 py-1 text-[11px] font-medium rounded-lg border bg-background/80 text-muted-foreground border-border/70 inline-flex items-center gap-1.5">
                                    <CategoryIcon className="size-3 text-muted-foreground" />
                                    <span>{meta.badgeLabel}</span>
                                  </span>
                                </TableCell>
                                <TableCell className="w-[140px] whitespace-nowrap py-3">
                                  <span className="text-xs text-muted-foreground font-normal">
                                    {meta.impactLabel}
                                  </span>
                                </TableCell>
                                <TableCell className="w-[140px] whitespace-nowrap text-right py-3 font-semibold text-foreground tabular-nums text-xs sm:text-sm">
                                  {formatCurrency(expense.amount)}
                                </TableCell>
                                <TableCell className="w-[120px] whitespace-nowrap text-center py-3 pr-4">
                                  <span className="inline-flex items-center gap-1 text-[10px] font-medium text-emerald-700 dark:text-emerald-300 bg-emerald-500/10 px-2 py-0.5 rounded-full border border-emerald-500/20">
                                    <Check className="size-3" />
                                    Masuk Laporan
                                  </span>
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
