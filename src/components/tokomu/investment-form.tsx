"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { Check, Loader2, Pencil, Plus, Trash2, WalletCards, PackageOpen } from "lucide-react";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { formatCurrency, formatDate } from "@/lib/format";
import type { AkadType } from "@/lib/server/profit-sharing";

export type InvestmentProductOption = {
  id: string;
  name: string;
  stock: number;
  buyPrice: number;
  sellPrice: number;
};

export type InvestmentRowData = {
  id: string;
  investorId: string;
  investorName?: string | null;
  type: string;
  akadType: string;
  amount: number | null;
  monthlyReturnRatePct: number | null;
  profitSharePct: number | null;
  productId: string | null;
  productName?: string | null;
  unitCount: number | null;
  unitCost: number | null;
  profitSharePerUnitPct: number | null;
  profitSharePerUnitAmount: number | null;
  startDate: string;
  endDate?: string | null;
  isActive: number;
};

const akadLabels: Record<AkadType, string> = {
  murabahah_bil_wakalah: "Murabahah bil Wakalah",
  mudharabah: "Mudharabah",
  musyarakah: "Musyarakah",
  barang_titip_jual: "Barang Titip Jual",
  sales_titipan: "Sales Titipan",
  pinjaman_qardh: "Pinjaman Qardh",
};

export const akadExplanations: Record<AkadType, { title: string; desc: string }> = {
  murabahah_bil_wakalah: {
    title: "Murabahah bil Wakalah (Modal Uang - Imbal Hasil Flat)",
    desc: "Dana dari investor digunakan oleh toko untuk membelanjakan barang dagangan secara aman. Keuntungan atau imbal hasil dikembalikan berupa bunga/keuntungan bulanan tetap (flat) sesuai kesepakatan.",
  },
  mudharabah: {
    title: "Mudharabah (Modal Uang - Bagi Hasil Laba Bersih)",
    desc: "Pembiayaan penuh 100% dari pihak investor, sedangkan toko bertindak sebagai pengelola usaha. Laba bersih yang dihasilkan akan dibagi berkala sesuai persentase (%) nisbah bagi hasil yang disepakati.",
  },
  musyarakah: {
    title: "Musyarakah (Kerjasama Uang Bersama)",
    desc: "Investor dan toko sama-sama menyetorkan modal finansial. Keuntungan maupun risiko kerugian ditanggung bersama secara proporsional sesuai porsi penyertaan modal masing-masing.",
  },
  pinjaman_qardh: {
    title: "Pinjaman Qardh (Pinjaman Pokok Tanpa Bunga)",
    desc: "Pinjaman kebajikan murni tanpa tambahan bunga, biaya, atau bagi hasil. Toko berkomitmen mengembalikan dana pokok secara utuh 100% saat tanggal jatuh tempo kerjasama.",
  },
  barang_titip_jual: {
    title: "Barang Titip Jual (Konsinyasi dengan Bagi Hasil Margin)",
    desc: "Investor menitipkan produk fisik untuk dijual di Toko. Ketika barang terjual, keuntungan dari selisih harga (margin) dibagi berdasarkan kesepakatan persentase (%) atau rupiah flat per unit.",
  },
  sales_titipan: {
    title: "Sales Titipan (Penjualan Komisi Barang Titipan)",
    desc: "Mirip konsinyasi barang titip jual, di mana investor menitipkan barang retail dan toko memperoleh komisi langsung/persentase keuntungan tetap dari setiap unit yang berhasil dipasarkan.",
  },
};

const moneyAkads: AkadType[] = [
  "murabahah_bil_wakalah",
  "mudharabah",
  "musyarakah",
  "pinjaman_qardh",
];

const goodsAkads: AkadType[] = ["barang_titip_jual", "sales_titipan"];

function todayInputValue() {
  return new Date().toISOString().slice(0, 10);
}

function isGoodsAkad(akadType: AkadType) {
  return goodsAkads.includes(akadType);
}

type ProfitScheme = "percentage" | "flat_nominal" | "consignment_pure";

type BatchProductItem = {
  productId: string;
  name: string;
  stock: number;
  buyPrice: number;
  sellPrice: number;
  unitCount: string;
  unitCost: string;
  scheme: ProfitScheme;
  profitSharePerUnitPct: string;
  profitSharePerUnitAmount: string;
  flatNominalRp: string;
};

export function InvestmentForm({
  investorId,
  products,
  initialData,
  onFinished,
}: Readonly<{
  investorId: string;
  products: InvestmentProductOption[];
  initialData?: InvestmentRowData;
  onFinished?: () => void;
}>) {
  const router = useRouter();
  const isEdit = Boolean(initialData);

  const [akadType, setAkadType] = useState<AkadType>(() => {
    if (initialData?.akadType) return initialData.akadType as AkadType;
    return "murabahah_bil_wakalah";
  });

  const [type, setType] = useState<"uang" | "barang_titip_jual">(() => {
    if (initialData?.type) return initialData.type as "uang" | "barang_titip_jual";
    const initialAkad = initialData?.akadType ? (initialData.akadType as AkadType) : "murabahah_bil_wakalah";
    return isGoodsAkad(initialAkad) ? "barang_titip_jual" : "uang";
  });

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [productSearch, setProductSearch] = useState("");

  const [draft, setDraft] = useState(() => ({
    amount: initialData?.amount ? String(initialData.amount) : "",
    monthlyReturnRatePct: initialData?.monthlyReturnRatePct ? String(initialData.monthlyReturnRatePct) : "2.5",
    profitSharePct: initialData?.profitSharePct ? String(initialData.profitSharePct) : "30",
    startDate: initialData?.startDate ? initialData.startDate.slice(0, 10) : todayInputValue(),
  }));

  const [moneyScheme, setMoneyScheme] = useState<"percentage" | "flat_nominal">("percentage");
  const [moneyFlatRp, setMoneyFlatRp] = useState("");

  const [batchItems, setBatchItems] = useState<BatchProductItem[]>(() => {
    if (initialData && initialData.productId) {
      const prod = products.find((p) => p.id === initialData.productId);
      const buyPrice = initialData.unitCost ?? prod?.buyPrice ?? 0;
      const sellPrice = prod?.sellPrice ?? buyPrice * 1.2;
      const margin = Math.max(sellPrice - buyPrice, 1);
      const sharePct = initialData.profitSharePerUnitPct ?? 15;
      const nominalPerUnit = initialData.profitSharePerUnitAmount;
      const flatRp = Math.round(margin * (sharePct / 100));

      let scheme: ProfitScheme = nominalPerUnit !== null && nominalPerUnit !== undefined
        ? "flat_nominal"
        : "percentage";
      if (nominalPerUnit === 0 || (nominalPerUnit === null && sharePct === 0)) scheme = "consignment_pure";

      return [
        {
          productId: initialData.productId,
          name: initialData.productName ?? prod?.name ?? "Produk",
          stock: prod?.stock ?? 0,
          buyPrice,
          sellPrice,
          unitCount: initialData.unitCount ? String(initialData.unitCount) : "1",
          unitCost: String(buyPrice),
          scheme,
          profitSharePerUnitPct: String(sharePct),
          profitSharePerUnitAmount: String(nominalPerUnit ?? 0),
          flatNominalRp: String(nominalPerUnit ?? flatRp),
        },
      ];
    }
    return [];
  });

  const filteredProducts = useMemo(() => {
    const keyword = productSearch.trim().toLowerCase();
    const alreadySelected = new Set(batchItems.map((item) => item.productId));
    const available = products.filter((p) => !alreadySelected.has(p.id));
    if (!keyword) return available.slice(0, 8);
    return available.filter((p) => p.name.toLowerCase().includes(keyword)).slice(0, 12);
  }, [productSearch, products, batchItems]);


  function handleAddBatchProduct(product: InvestmentProductOption) {
    const margin = Math.max(product.sellPrice - product.buyPrice, 1);
    const defaultSharePct = 15;
    const defaultFlatRp = Math.round(margin * (defaultSharePct / 100));

    setBatchItems((prev) => [
      ...prev,
      {
        productId: product.id,
        name: product.name,
        stock: product.stock,
        buyPrice: product.buyPrice,
        sellPrice: product.sellPrice,
        unitCount: "10",
        unitCost: String(product.buyPrice > 0 ? product.buyPrice : 1000),
        scheme: "percentage",
        profitSharePerUnitPct: String(defaultSharePct),
        profitSharePerUnitAmount: "0",
        flatNominalRp: String(defaultFlatRp),
      },
    ]);
    setProductSearch("");
  }

  function handleRemoveBatchProduct(index: number) {
    setBatchItems((prev) => prev.filter((_, i) => i !== index));
  }

  function updateBatchItem(index: number, field: keyof BatchProductItem, val: string) {
    setBatchItems((prev) =>
      prev.map((item, i) => {
        if (i !== index) return item;
        const updated = { ...item, [field]: val };

        if (field === "scheme") {
          if (val === "consignment_pure") {
            updated.profitSharePerUnitPct = "0";
            updated.profitSharePerUnitAmount = "0";
            updated.flatNominalRp = "0";
          }
        } else if (field === "flatNominalRp" && updated.scheme === "flat_nominal") {
          const cost = Number(updated.unitCost) || item.buyPrice;
          const margin = Math.max(item.sellPrice - cost, 1);
          const flat = Number(val) || 0;
          const pct = Math.min(Math.round((flat / margin) * 1000) / 10, 100);
          updated.profitSharePerUnitPct = String(pct);
        } else if (field === "profitSharePerUnitPct" && updated.scheme === "percentage") {
          const cost = Number(updated.unitCost) || item.buyPrice;
          const margin = Math.max(item.sellPrice - cost, 1);
          const pct = Number(val) || 0;
          const flat = Math.round(margin * (pct / 100));
          updated.flatNominalRp = String(flat);
        }

        return updated;
      })
    );
  }

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setIsSubmitting(true);

    try {
      if (type === "barang_titip_jual" && batchItems.length === 0) {
        throw new Error("Pilih minimal 1 produk titipan untuk ditambahkan.");
      }

      if (isEdit && initialData) {
        const payload: Record<string, unknown> = {
          type,
          akadType,
          startDate: draft.startDate,
        };

        if (type === "uang") {
          let effectiveReturnPct = Number(draft.monthlyReturnRatePct);
          if (akadType === "murabahah_bil_wakalah" && moneyScheme === "flat_nominal") {
            const amount = Number(draft.amount) || 1;
            const flat = Number(moneyFlatRp) || 0;
            effectiveReturnPct = Math.round((flat / amount) * 10000) / 100;
          }

          payload.amount = Number(draft.amount);
          payload.monthlyReturnRatePct = akadType === "murabahah_bil_wakalah" ? effectiveReturnPct : undefined;
          payload.profitSharePct =
            akadType === "mudharabah" || akadType === "musyarakah" ? Number(draft.profitSharePct) : undefined;
        } else {
          const item = batchItems[0];
          if (!item) throw new Error("Data produk tidak boleh kosong.");
          payload.productId = item.productId;
          payload.unitCount = Number(item.unitCount);
          payload.unitCost = Number(item.unitCost);
          if (item.scheme === "flat_nominal") {
            payload.profitSharePerUnitAmount = Number(item.flatNominalRp);
          } else {
            payload.profitSharePerUnitPct = Number(item.profitSharePerUnitPct);
            payload.profitSharePerUnitAmount = null;
          }
        }

        const res = await fetch(`/api/investments/${initialData.id}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        });

        const data = (await res.json()) as { error?: string };
        if (!res.ok) throw new Error(data.error ?? "Gagal memperbarui investasi.");
        toast.success("Investasi berhasil diperbarui.");
      } else if (type === "uang") {
        let effectiveReturnPct = Number(draft.monthlyReturnRatePct);
        if (akadType === "murabahah_bil_wakalah" && moneyScheme === "flat_nominal") {
          const amount = Number(draft.amount) || 1;
          const flat = Number(moneyFlatRp) || 0;
          effectiveReturnPct = Math.round((flat / amount) * 10000) / 100;
        }

        const res = await fetch("/api/investments", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            investorId,
            type,
            akadType,
            amount: Number(draft.amount),
            monthlyReturnRatePct: akadType === "murabahah_bil_wakalah" ? effectiveReturnPct : undefined,
            profitSharePct:
              akadType === "mudharabah" || akadType === "musyarakah" ? Number(draft.profitSharePct) : undefined,
            startDate: draft.startDate,
          }),
        });

        const data = (await res.json()) as { error?: string };
        if (!res.ok) throw new Error(data.error ?? "Gagal menambah investasi.");
        toast.success("Investasi uang berhasil ditambahkan.");
      } else {
        const payloadItems = batchItems.map((item) => ({
          type: "barang_titip_jual" as const,
          akadType,
          productId: item.productId,
          unitCount: Number(item.unitCount),
          unitCost: Number(item.unitCost),
          ...(item.scheme === "flat_nominal"
            ? { profitSharePerUnitAmount: Number(item.flatNominalRp) }
            : {
                profitSharePerUnitPct: Number(item.profitSharePerUnitPct),
                profitSharePerUnitAmount: null,
              }),
          startDate: draft.startDate,
        }));

        const res = await fetch("/api/investments/batch", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            investorId,
            investments: payloadItems,
          }),
        });

        const data = (await res.json()) as { error?: string };
        if (!res.ok) throw new Error(data.error ?? "Gagal menyimpan investasi massal.");
        toast.success(`Berhasil menambahkan ${batchItems.length} produk titipan secara massal.`);
      }

      onFinished?.();
      router.refresh();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Gagal memproses investasi.");
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <form className="space-y-6" onSubmit={(event) => void handleSubmit(event)}>
      <div className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-1.5">
          <Label className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Akad Investasi</Label>
          <Select
            value={akadType}
            onValueChange={(value) => {
              const nextAkad = value as AkadType;
              setAkadType(nextAkad);
              setType(isGoodsAkad(nextAkad) ? "barang_titip_jual" : "uang");
            }}
          >
            <SelectTrigger className="h-11 w-full rounded-xl border-border/80 bg-card text-sm font-medium shadow-sm">
              <SelectValue>
                {akadLabels[akadType] 
                  ? `${akadLabels[akadType]} (${isGoodsAkad(akadType) ? 'Barang Titipan' : 'Modal Uang'})` 
                  : "Pilih Akad"}
              </SelectValue>
            </SelectTrigger>
            <SelectContent>
              {moneyAkads.map((item) => (
                <SelectItem key={item} value={item}>
                  {akadLabels[item]} (Modal Uang)
                </SelectItem>
              ))}
              {goodsAkads.map((item) => (
                <SelectItem key={item} value={item}>
                  {akadLabels[item]} (Barang Titipan)
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="investment-start-date" className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
            Tanggal Mulai
          </Label>
          <Input
            id="investment-start-date"
            type="date"
            value={draft.startDate}
            onChange={(event) => setDraft((current) => ({ ...current, startDate: event.target.value }))}
            className="h-11 rounded-xl border-border/80 bg-card text-sm font-medium shadow-sm"
            required
          />
        </div>
      </div>

      {/* Dynamic Akad Explanation Banner */}
      {akadExplanations[akadType] && (
        <div className="rounded-xl border border-primary/20 bg-primary/5 p-4 text-sm text-foreground shadow-sm transition-all duration-300">
          <h5 className="font-semibold text-primary flex items-center gap-1.5 mb-1 text-sm">
            <WalletCards className="size-4 shrink-0 text-primary" />
            Detail Akad: {akadExplanations[akadType].title}
          </h5>
          <p className="text-xs text-muted-foreground leading-relaxed">
            {akadExplanations[akadType].desc}
          </p>
        </div>
      )}

      {type === "uang" ? (
        <div className="grid gap-4 sm:grid-cols-2 items-end">
          <div className="space-y-1.5">
            <Label htmlFor="investment-amount" className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              Nominal Modal (Rp)
            </Label>
            <Input
              id="investment-amount"
              type="number"
              min={1}
              value={draft.amount}
              onChange={(event) => setDraft((current) => ({ ...current, amount: event.target.value }))}
              placeholder="5000000"
              className="h-11 rounded-xl border-border/80 bg-white dark:bg-background text-sm font-semibold text-primary shadow-sm"
              required
            />
          </div>

          {akadType === "murabahah_bil_wakalah" ? (
            <div className="space-y-1.5">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <Label htmlFor="investment-fixed-return" className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                  Imbal Hasil
                </Label>
                <div className="inline-flex rounded-full bg-muted p-0.5">
                  <button
                    type="button"
                    onClick={() => setMoneyScheme("percentage")}
                    className={`rounded-full px-3 py-1 text-xs font-medium transition-all ${
                      moneyScheme === "percentage"
                        ? "bg-card text-foreground shadow-sm"
                        : "text-muted-foreground hover:text-foreground"
                    }`}
                  >
                    Persentase (%)
                  </button>
                  <button
                    type="button"
                    onClick={() => setMoneyScheme("flat_nominal")}
                    className={`rounded-full px-3 py-1 text-xs font-medium transition-all ${
                      moneyScheme === "flat_nominal"
                        ? "bg-card text-foreground shadow-sm"
                        : "text-muted-foreground hover:text-foreground"
                    }`}
                  >
                    Nominal (Rp)
                  </button>
                </div>
              </div>

              {moneyScheme === "percentage" ? (
                <div className="relative">
                  <Input
                    id="investment-fixed-return"
                    type="number"
                    min={0}
                    max={100}
                    step="0.1"
                    value={draft.monthlyReturnRatePct}
                    onChange={(event) =>
                      setDraft((current) => ({ ...current, monthlyReturnRatePct: event.target.value }))
                    }
                    className="h-11 rounded-xl border-border/80 bg-white dark:bg-background text-sm font-semibold shadow-sm pr-20"
                    required
                  />
                  <span className="absolute right-4 top-3 text-sm font-medium text-muted-foreground">% / bln</span>
                </div>
              ) : (
                <div className="relative">
                  <Input
                    id="investment-fixed-return-rp"
                    type="number"
                    min={0}
                    value={moneyFlatRp}
                    onChange={(event) => setMoneyFlatRp(event.target.value)}
                    placeholder="125000"
                    className="h-11 rounded-xl border-border/80 bg-white dark:bg-background text-sm font-semibold shadow-sm pr-24"
                    required
                  />
                  <span className="absolute right-4 top-3 text-sm font-medium text-muted-foreground">Rp / bln</span>
                </div>
              )}
            </div>
          ) : null}

          {akadType === "mudharabah" || akadType === "musyarakah" ? (
            <div className="space-y-1.5">
              <Label htmlFor="investment-profit-share" className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                Bagi Hasil Laba Bersih
              </Label>
              <div className="relative">
                <Input
                  id="investment-profit-share"
                  type="number"
                  min={0}
                  max={100}
                  step="0.1"
                  value={draft.profitSharePct}
                  onChange={(event) => setDraft((current) => ({ ...current, profitSharePct: event.target.value }))}
                  className="h-11 rounded-xl border-border/80 bg-white dark:bg-background text-sm font-semibold shadow-sm pr-24"
                  required
                />
                <span className="absolute right-4 top-3 text-sm font-medium text-muted-foreground">% laba</span>
              </div>
            </div>
          ) : null}

          {akadType === "pinjaman_qardh" ? (
            <div className="rounded-xl border border-border/70 bg-muted/45 p-4 text-sm text-muted-foreground sm:col-span-2">
              <strong>Info Qardh:</strong> Dicatat murni sebagai pinjaman/kasbon modal tanpa imbal hasil/payout bagi hasil.
            </div>
          ) : null}
        </div>
      ) : (
        <div className="space-y-4 rounded-2xl border border-border/80 bg-muted/20 p-5 shadow-inner">
          <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <h4 className="font-heading text-base font-semibold text-foreground">Daftar Produk Titipan / Massal</h4>
              <p className="text-xs text-muted-foreground">
                {isEdit
                  ? "Atur jumlah, modal per unit, dan skema bagi hasil produk titipan."
                  : "Cari dan pilih beberapa produk sekaligus untuk ditambahkan dalam 1 kali simpan."}
              </p>
            </div>
            {!isEdit && (
              <Badge variant="outline" className="w-fit bg-card px-3 py-1 font-medium shadow-sm">
                Terpilih: {batchItems.length} produk
              </Badge>
            )}
          </div>

          {(!isEdit || batchItems.length === 0) && (
            <div className="space-y-2">
              <div className="relative">
                <Input
                  value={productSearch}
                  onChange={(event) => setProductSearch(event.target.value)}
                  placeholder="Ketik nama produk untuk mencari..."
                  className="h-11 rounded-xl border-border/80 bg-card pr-10 text-sm shadow-sm"
                />
              </div>
              <div className="min-h-[110px] max-h-[110px] overflow-y-auto border border-border/60 bg-card/45 rounded-xl p-3 shadow-inner">
                <div className="flex flex-wrap gap-2">
                  {filteredProducts.map((product) => (
                    <button
                      key={product.id}
                      type="button"
                      onClick={() => handleAddBatchProduct(product)}
                      className="inline-flex items-center gap-1.5 rounded-full border border-border/80 bg-card px-3.5 py-1.5 text-[11px] font-medium text-foreground shadow-sm transition-all hover:border-primary hover:bg-primary/5"
                    >
                      <Plus className="size-3 text-primary" />
                      <span>{product.name}</span>
                      <span className="text-muted-foreground">({formatCurrency(product.buyPrice)})</span>
                    </button>
                  ))}
                  {productSearch && filteredProducts.length === 0 && (
                    <span className="text-xs italic text-muted-foreground p-1">
                      Produk tidak ditemukan atau sudah ditambahkan.
                    </span>
                  )}
                  {!productSearch && filteredProducts.length === 0 && (
                    <span className="text-xs italic text-muted-foreground p-1">
                      Semua produk sudah masuk daftar.
                    </span>
                  )}
                  {!productSearch && filteredProducts.length > 0 && (
                    <span className="w-full text-[10px] font-semibold tracking-wide uppercase text-muted-foreground/60 mb-1 px-1">
                      Rekomendasi Produk (Ketik untuk mencari):
                    </span>
                  )}
                </div>
              </div>
            </div>
          )}

          {batchItems.length > 0 ? (
            <div className="space-y-4 pt-2">
              {batchItems.map((item, idx) => (
                <div
                  key={item.productId}
                  className="flex flex-col gap-4 rounded-xl border border-border/80 bg-card p-5 shadow-sm transition-all hover:border-border"
                >
                  <div className="flex items-start justify-between gap-4">
                    <div>
                      <p className="font-heading text-base font-semibold text-foreground">{item.name}</p>
                      <p className="text-xs text-muted-foreground mt-0.5">
                        Stok Toko: {item.stock} pcs | Harga Jual Default: {formatCurrency(item.sellPrice)}
                      </p>
                    </div>
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      onClick={() => handleRemoveBatchProduct(idx)}
                      className="size-8 shrink-0 rounded-full text-muted-foreground hover:bg-destructive/10 hover:text-destructive"
                    >
                      <Trash2 className="size-4" />
                    </Button>
                  </div>

                  <div className="grid gap-4 grid-cols-1 sm:grid-cols-2 lg:grid-cols-[120px_150px_minmax(0,1fr)]">
                    <div className="space-y-1.5">
                      <Label className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Jumlah Unit</Label>
                      <Input
                        type="number"
                        min={1}
                        value={item.unitCount}
                        onChange={(e) => updateBatchItem(idx, "unitCount", e.target.value)}
                        className="h-10 rounded-xl border-border/80 bg-background shadow-sm text-sm font-medium"
                      />
                    </div>
                    
                    <div className="space-y-1.5">
                      <Label className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Modal / Unit (Rp)</Label>
                      <Input
                        type="number"
                        min={0}
                        value={item.unitCost}
                        onChange={(e) => updateBatchItem(idx, "unitCost", e.target.value)}
                        className="h-10 rounded-xl border-border/80 bg-background shadow-sm text-sm font-medium"
                      />
                    </div>

                    <div className="space-y-1.5">
                      <Label className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Skema Imbal Hasil</Label>
                      
                      {item.scheme === "percentage" ? (
                        <div className="flex gap-2">
                          <Select
                            value={item.scheme}
                            onValueChange={(val) => updateBatchItem(idx, "scheme", val as ProfitScheme)}
                          >
                            <SelectTrigger className="h-10 w-24 shrink-0 rounded-xl text-xs font-medium bg-background border-border/80 shadow-sm">
                              <SelectValue>Persen</SelectValue>
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="percentage">Persentase</SelectItem>
                              <SelectItem value="flat_nominal">Rp Flat</SelectItem>
                              <SelectItem value="consignment_pure">Setoran</SelectItem>
                            </SelectContent>
                          </Select>
                          <div className="relative flex-1">
                            <Input
                              type="number"
                              min={0}
                              max={100}
                              step="0.1"
                              value={item.profitSharePerUnitPct}
                              onChange={(e) => updateBatchItem(idx, "profitSharePerUnitPct", e.target.value)}
                              className="h-10 rounded-xl border-border/80 bg-background shadow-sm pr-8 text-sm font-semibold text-primary"
                            />
                            <span className="absolute right-3 top-2.5 text-xs font-semibold text-muted-foreground">%</span>
                          </div>
                        </div>
                      ) : item.scheme === "flat_nominal" ? (
                        <div className="flex gap-2">
                          <Select
                            value={item.scheme}
                            onValueChange={(val) => updateBatchItem(idx, "scheme", val as ProfitScheme)}
                          >
                            <SelectTrigger className="h-10 w-24 shrink-0 rounded-xl text-xs font-medium bg-background border-border/80 shadow-sm">
                              <SelectValue>Rp Flat</SelectValue>
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="percentage">Persentase</SelectItem>
                              <SelectItem value="flat_nominal">Rp Flat</SelectItem>
                              <SelectItem value="consignment_pure">Setoran</SelectItem>
                            </SelectContent>
                          </Select>
                          <div className="relative flex-1">
                            <span className="absolute left-3 top-2.5 text-xs font-semibold text-muted-foreground">Rp</span>
                            <Input
                              type="number"
                              min={0}
                              value={item.flatNominalRp}
                              onChange={(e) => updateBatchItem(idx, "flatNominalRp", e.target.value)}
                              className="h-10 rounded-xl border-border/80 bg-background shadow-sm pl-8 text-sm font-semibold text-primary"
                            />
                          </div>
                        </div>
                      ) : (
                        <div className="flex gap-2">
                          <Select
                            value={item.scheme}
                            onValueChange={(val) => updateBatchItem(idx, "scheme", val as ProfitScheme)}
                          >
                            <SelectTrigger className="h-10 flex-1 rounded-xl text-xs font-medium bg-primary/10 text-primary border-primary/20">
                              <SelectValue>Setoran Murni</SelectValue>
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="percentage">Persentase</SelectItem>
                              <SelectItem value="flat_nominal">Rp Flat</SelectItem>
                              <SelectItem value="consignment_pure">Setoran Murni</SelectItem>
                            </SelectContent>
                          </Select>
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="flex flex-col items-center justify-center rounded-xl border border-dashed border-border/80 bg-card/50 py-8 text-center">
              <PackageOpen className="size-8 text-muted-foreground/60" />
              <p className="mt-2 text-sm font-medium text-foreground">Belum ada produk titipan terpilih</p>
              <p className="mt-1 text-xs text-muted-foreground">
                Gunakan pencarian di atas untuk memilih dan menambahkan produk secara massal.
              </p>
            </div>
          )}
        </div>
      )}

      <div className="flex items-center justify-end border-t border-border/60 pt-4">
        <Button type="submit" size="lg" className="rounded-xl font-semibold shadow-md px-6" disabled={isSubmitting}>
          {isSubmitting ? (
            <Loader2 className="size-4 animate-spin" />
          ) : isEdit ? (
            <Check className="size-4" />
          ) : (
            <Plus className="size-4" />
          )}
          {isEdit
            ? "Simpan Perubahan"
            : type === "uang"
            ? "Simpan Investasi"
            : `Simpan Investasi Massal (${batchItems.length} Produk)`}
        </Button>
      </div>
    </form>
  );
}

export function InvestmentFormDialog({
  investorId,
  products,
}: Readonly<{
  investorId: string;
  products: InvestmentProductOption[];
}>) {
  const [open, setOpen] = useState(false);

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger render={<Button size="lg" className="rounded-2xl font-semibold shadow-sm" />}>
        <Plus className="size-4" />
        Investasi Baru
      </DialogTrigger>
      <DialogContent className="w-[calc(100vw-1rem)] max-w-[960px] sm:max-w-[960px] rounded-2xl p-0 shadow-2xl">
        <DialogHeader className="p-6 sm:p-8 pb-2">
          <DialogTitle className="font-heading text-2xl font-bold">Tambah Investasi & Titip Jual</DialogTitle>
          <DialogDescription className="text-sm text-muted-foreground mt-1">
            Pilih akad modal uang atau barang titip jual. Untuk produk titipan, Anda dapat memilih banyak produk langsung secara massal.
          </DialogDescription>
        </DialogHeader>
        <div className="max-h-[78vh] overflow-y-auto p-6 sm:p-8 pt-4">
          <InvestmentForm investorId={investorId} products={products} onFinished={() => setOpen(false)} />
        </div>
      </DialogContent>
    </Dialog>
  );
}

export function InvestmentEditDialog({
  investment,
  products,
}: Readonly<{
  investment: InvestmentRowData;
  products: InvestmentProductOption[];
}>) {
  const [open, setOpen] = useState(false);
  const router = useRouter();
  const [isDeactivating, setIsDeactivating] = useState(false);

  async function handleDeactivate() {
    if (!confirm(`Nonaktifkan / tutup investasi ini secara permanen?`)) return;
    setIsDeactivating(true);
    try {
      const res = await fetch(`/api/investments/${investment.id}`, {
        method: "DELETE",
      });
      if (!res.ok) throw new Error("Gagal menutup investasi.");
      toast.success("Investasi berhasil dinonaktifkan.");
      setOpen(false);
      router.refresh();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Terjadi kesalahan.");
    } finally {
      setIsDeactivating(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger
        render={
          <Button variant="outline" size="sm" className="rounded-full px-3.5 py-1 text-xs font-semibold shadow-sm transition-all hover:bg-primary/10 hover:border-primary/50">
            <Pencil className="size-3 text-primary mr-1" />
            Edit
          </Button>
        }
      />
      <DialogContent className="w-[calc(100vw-1rem)] max-w-[960px] sm:max-w-[960px] rounded-2xl p-0 shadow-2xl">
        <DialogHeader className="p-6 sm:p-8 pb-2">
          <div className="flex items-center justify-between pr-8">
            <DialogTitle className="font-heading text-2xl font-bold">Kelola Investasi</DialogTitle>
            {investment.isActive === 1 && (
              <Button
                type="button"
                variant="destructive"
                size="sm"
                onClick={() => void handleDeactivate()}
                disabled={isDeactivating}
                className="rounded-full px-3.5 text-xs font-semibold shadow-sm"
              >
                {isDeactivating ? <Loader2 className="size-3.5 animate-spin mr-1" /> : <Trash2 className="size-3.5 mr-1" />}
                Nonaktifkan
              </Button>
            )}
          </div>
          <DialogDescription className="text-sm text-muted-foreground mt-1">
            Atur ulang parameter, nominal modal, atau persentase imbal hasil untuk investasi yang sudah berjalan.
          </DialogDescription>
        </DialogHeader>
        <div className="max-h-[78vh] overflow-y-auto p-6 sm:p-8 pt-4">
          <InvestmentForm
            investorId={investment.investorId}
            products={products}
            initialData={investment}
            onFinished={() => setOpen(false)}
          />
        </div>
      </DialogContent>
    </Dialog>
  );
}
