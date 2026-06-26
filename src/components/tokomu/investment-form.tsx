"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { Loader2, Plus } from "lucide-react";
import { toast } from "sonner";
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
import { formatCurrency } from "@/lib/format";
import type { AkadType } from "@/lib/server/profit-sharing";

export type InvestmentProductOption = {
  id: string;
  name: string;
  stock: number;
  buyPrice: number;
  sellPrice: number;
};

const akadLabels: Record<AkadType, string> = {
  murabahah_bil_wakalah: "Murabahah bil Wakalah",
  mudharabah: "Mudharabah",
  musyarakah: "Musyarakah",
  barang_titip_jual: "Barang Titip Jual",
  sales_titipan: "Sales Titipan",
  pinjaman_qardh: "Pinjaman Qardh",
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

export function InvestmentForm({
  investorId,
  products,
  onCreated,
}: Readonly<{
  investorId: string;
  products: InvestmentProductOption[];
  onCreated?: () => void;
}>) {
  const router = useRouter();
  const [akadType, setAkadType] = useState<AkadType>("murabahah_bil_wakalah");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [productSearch, setProductSearch] = useState("");
  const [draft, setDraft] = useState({
    amount: "",
    monthlyReturnRatePct: "2.5",
    profitSharePct: "30",
    productId: "",
    unitCount: "",
    unitCost: "",
    profitSharePerUnitPct: "15",
    startDate: todayInputValue(),
  });

  const filteredProducts = useMemo(() => {
    const keyword = productSearch.trim().toLowerCase();
    if (!keyword) return products;

    return products.filter((product) => product.name.toLowerCase().includes(keyword));
  }, [productSearch, products]);

  const selectedProduct = products.find((product) => product.id === draft.productId);
  const type = isGoodsAkad(akadType) ? "barang_titip_jual" : "uang";

  function resetForm() {
    setDraft({
      amount: "",
      monthlyReturnRatePct: "2.5",
      profitSharePct: "30",
      productId: "",
      unitCount: "",
      unitCost: "",
      profitSharePerUnitPct: "15",
      startDate: todayInputValue(),
    });
    setAkadType("murabahah_bil_wakalah");
    setProductSearch("");
  }

  function buildPayload() {
    if (type === "uang") {
      return {
        investorId,
        type,
        akadType,
        amount: Number(draft.amount),
        monthlyReturnRatePct:
          akadType === "murabahah_bil_wakalah" ? Number(draft.monthlyReturnRatePct) : undefined,
        profitSharePct:
          akadType === "mudharabah" || akadType === "musyarakah"
            ? Number(draft.profitSharePct)
            : undefined,
        startDate: draft.startDate,
      };
    }

    return {
      investorId,
      type,
      akadType,
      productId: draft.productId,
      unitCount: Number(draft.unitCount),
      unitCost: Number(draft.unitCost),
      profitSharePerUnitPct: Number(draft.profitSharePerUnitPct),
      startDate: draft.startDate,
    };
  }

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setIsSubmitting(true);

    try {
      const response = await fetch("/api/investments", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(buildPayload()),
      });
      const data = (await response.json()) as { error?: string };

      if (!response.ok) {
        throw new Error(data.error ?? "Gagal menambah investasi.");
      }

      toast.success(
        type === "uang"
          ? "Investasi uang berhasil ditambahkan."
          : "Investasi barang titip jual berhasil ditambahkan dan stok produk sudah bertambah."
      );
      resetForm();
      onCreated?.();
      router.refresh();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Gagal menambah investasi.");
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <form className="grid gap-4" onSubmit={(event) => void handleSubmit(event)}>
      <div className="grid gap-2">
        <Label>Akad</Label>
        <Select value={akadType} onValueChange={(value) => setAkadType(value as AkadType)}>
          <SelectTrigger className="h-11 w-full rounded-2xl bg-card">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {moneyAkads.map((item) => (
              <SelectItem key={item} value={item}>
                {akadLabels[item]}
              </SelectItem>
            ))}
            {goodsAkads.map((item) => (
              <SelectItem key={item} value={item}>
                {akadLabels[item]}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <div className="grid gap-2">
        <Label htmlFor="investment-start-date">Tanggal mulai</Label>
        <Input
          id="investment-start-date"
          type="date"
          value={draft.startDate}
          onChange={(event) => setDraft((current) => ({ ...current, startDate: event.target.value }))}
          className="h-11 rounded-2xl"
          required
        />
      </div>

      {type === "uang" ? (
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="grid gap-2">
            <Label htmlFor="investment-amount">Nominal modal</Label>
            <Input
              id="investment-amount"
              type="number"
              min={1}
              value={draft.amount}
              onChange={(event) => setDraft((current) => ({ ...current, amount: event.target.value }))}
              placeholder="5000000"
              className="h-11 rounded-2xl"
              required
            />
          </div>
          {akadType === "murabahah_bil_wakalah" ? (
            <div className="grid gap-2">
              <Label htmlFor="investment-fixed-return">Return tetap / bulan (%)</Label>
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
                className="h-11 rounded-2xl"
                required
              />
            </div>
          ) : null}
          {akadType === "mudharabah" || akadType === "musyarakah" ? (
            <div className="grid gap-2">
              <Label htmlFor="investment-profit-share">Bagi hasil (%)</Label>
              <Input
                id="investment-profit-share"
                type="number"
                min={0}
                max={100}
                step="0.1"
                value={draft.profitSharePct}
                onChange={(event) => setDraft((current) => ({ ...current, profitSharePct: event.target.value }))}
                className="h-11 rounded-2xl"
                required
              />
            </div>
          ) : null}
          {akadType === "pinjaman_qardh" ? (
            <div className="rounded-2xl border border-border/70 bg-muted/45 p-4 text-sm text-muted-foreground">
              Qardh dicatat sebagai modal pinjaman tanpa payout bagi hasil.
            </div>
          ) : null}
        </div>
      ) : (
        <div className="grid gap-4">
          <div className="grid gap-2">
            <Label htmlFor="product-search">Cari produk</Label>
            <Input
              id="product-search"
              value={productSearch}
              onChange={(event) => setProductSearch(event.target.value)}
              placeholder="Ketik nama produk titipan"
              className="h-11 rounded-2xl"
            />
          </div>

          <div className="grid gap-2">
            <Label>Produk</Label>
            <Select
              value={draft.productId}
              onValueChange={(value) => setDraft((current) => ({ ...current, productId: value ?? "" }))}
            >
              <SelectTrigger className="h-11 w-full rounded-2xl bg-card">
                <SelectValue placeholder="Pilih produk" />
              </SelectTrigger>
              <SelectContent>
                {filteredProducts.map((product) => (
                  <SelectItem key={product.id} value={product.id}>
                    {product.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            {selectedProduct ? (
              <p className="text-xs text-muted-foreground">
                Stok sekarang {selectedProduct.stock} pcs - harga beli default {formatCurrency(selectedProduct.buyPrice)}
              </p>
            ) : null}
          </div>

          <div className="grid gap-4 sm:grid-cols-3">
            <div className="grid gap-2">
              <Label htmlFor="unit-count">Jumlah unit</Label>
              <Input
                id="unit-count"
                type="number"
                min={1}
                value={draft.unitCount}
                onChange={(event) => setDraft((current) => ({ ...current, unitCount: event.target.value }))}
                className="h-11 rounded-2xl"
                required
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="unit-cost">Modal/unit</Label>
              <Input
                id="unit-cost"
                type="number"
                min={1}
                value={draft.unitCost}
                onChange={(event) => setDraft((current) => ({ ...current, unitCost: event.target.value }))}
                className="h-11 rounded-2xl"
                required
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="unit-share">Bagi hasil (%)</Label>
              <Input
                id="unit-share"
                type="number"
                min={0}
                max={100}
                step="0.1"
                value={draft.profitSharePerUnitPct}
                onChange={(event) =>
                  setDraft((current) => ({ ...current, profitSharePerUnitPct: event.target.value }))
                }
                className="h-11 rounded-2xl"
                required
              />
            </div>
          </div>
        </div>
      )}

      <div className="flex justify-end">
        <Button type="submit" size="lg" className="rounded-2xl" disabled={isSubmitting}>
          {isSubmitting ? <Loader2 className="size-4 animate-spin" /> : <Plus className="size-4" />}
          Simpan investasi
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
      <DialogTrigger render={<Button size="lg" className="rounded-2xl" />}>
        <Plus className="size-4" />
        Investasi Baru
      </DialogTrigger>
      <DialogContent className="max-w-2xl rounded-[28px] p-0">
        <DialogHeader className="p-6 pb-0">
          <DialogTitle className="font-heading text-2xl">Tambah investasi</DialogTitle>
          <DialogDescription>
            Pilih akad uang atau titipan. Barang titipan akan menambah stok produk saat disimpan.
          </DialogDescription>
        </DialogHeader>
        <div className="p-6 pt-4">
          <InvestmentForm investorId={investorId} products={products} onCreated={() => setOpen(false)} />
        </div>
      </DialogContent>
    </Dialog>
  );
}
