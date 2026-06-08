"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { Loader2, PackagePlus, Plus, WalletCards } from "lucide-react";
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
import { cn } from "@/lib/utils";

export type InvestmentProductOption = {
  id: string;
  name: string;
  stock: number;
  buyPrice: number;
  sellPrice: number;
};

type InvestmentType = "uang" | "barang_titip_jual";

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
  const [type, setType] = useState<InvestmentType>("uang");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [productSearch, setProductSearch] = useState("");
  const [draft, setDraft] = useState({
    amount: "",
    profitSharePct: "10",
    productId: "",
    unitCount: "",
    unitCost: "",
    profitSharePerUnitPct: "15",
  });

  const filteredProducts = useMemo(() => {
    const keyword = productSearch.trim().toLowerCase();
    if (!keyword) return products;

    return products.filter((product) => product.name.toLowerCase().includes(keyword));
  }, [productSearch, products]);

  const selectedProduct = products.find((product) => product.id === draft.productId);

  function buildPayload() {
    if (type === "uang") {
      return {
        investorId,
        type,
        amount: Number(draft.amount),
        profitSharePct: Number(draft.profitSharePct),
      };
    }

    return {
      investorId,
      type,
      productId: draft.productId,
      unitCount: Number(draft.unitCount),
      unitCost: Number(draft.unitCost),
      profitSharePerUnitPct: Number(draft.profitSharePerUnitPct),
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
      setDraft({
        amount: "",
        profitSharePct: "10",
        productId: "",
        unitCount: "",
        unitCost: "",
        profitSharePerUnitPct: "15",
      });
      setType("uang");
      setProductSearch("");
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
        <Label>Tipe investasi</Label>
        <div className="grid gap-2 sm:grid-cols-2">
          <button
            type="button"
            className={cn(
              "flex min-h-20 items-center gap-3 rounded-2xl border px-4 text-left transition-colors",
              type === "uang"
                ? "border-primary bg-primary/8 text-foreground"
                : "border-border bg-background/55 text-muted-foreground hover:text-foreground"
            )}
            onClick={() => setType("uang")}
          >
            <WalletCards className="size-5" />
            <span>
              <span className="block font-medium">Uang</span>
              <span className="text-xs">Modal nominal dengan persentase bagi hasil.</span>
            </span>
          </button>
          <button
            type="button"
            className={cn(
              "flex min-h-20 items-center gap-3 rounded-2xl border px-4 text-left transition-colors",
              type === "barang_titip_jual"
                ? "border-primary bg-primary/8 text-foreground"
                : "border-border bg-background/55 text-muted-foreground hover:text-foreground"
            )}
            onClick={() => setType("barang_titip_jual")}
          >
            <PackagePlus className="size-5" />
            <span>
              <span className="block font-medium">Barang titip jual</span>
              <span className="text-xs">Stok produk otomatis bertambah saat disimpan.</span>
            </span>
          </button>
        </div>
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
          <div className="grid gap-2">
            <Label htmlFor="investment-share">Bagi hasil (%)</Label>
            <Input
              id="investment-share"
              type="number"
              min={0}
              max={100}
              value={draft.profitSharePct}
              onChange={(event) => setDraft((current) => ({ ...current, profitSharePct: event.target.value }))}
              className="h-11 rounded-2xl"
              required
            />
          </div>
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
                Stok sekarang {selectedProduct.stock} pcs · harga beli default {formatCurrency(selectedProduct.buyPrice)}
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
            Pilih modal uang atau barang titip jual. Barang titip jual akan menambah stok produk.
          </DialogDescription>
        </DialogHeader>
        <div className="p-6 pt-4">
          <InvestmentForm investorId={investorId} products={products} onCreated={() => setOpen(false)} />
        </div>
      </DialogContent>
    </Dialog>
  );
}
