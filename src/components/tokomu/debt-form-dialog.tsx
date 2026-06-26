"use client";

import { useMemo, useState } from "react";
import { CalendarDays, Plus, Search, Trash2, WalletCards } from "lucide-react";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogClose,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { formatCurrency } from "@/lib/format";
import { cn } from "@/lib/utils";
import type { DebtDraft, Product } from "@/lib/types";

type DebtFormDialogProps = {
  products: Product[];
  onSubmit: (draft: DebtDraft) => Promise<void>;
};

type ItemDraft = {
  id: string;
  productId?: string | null;
  name: string;
  quantity: number;
  unitPrice: number;
  query: string;
};

function defaultDueDate() {
  const date = new Date();
  date.setDate(date.getDate() + 7);
  return date.toISOString().slice(0, 10);
}

function formatNumberInput(value: number) {
  if (!value) {
    return "";
  }

  return new Intl.NumberFormat("id-ID").format(value);
}

function parseNumberInput(value: string) {
  return Number(value.replace(/[^\d]/g, ""));
}

function emptyItem(): ItemDraft {
  return {
    id: crypto.randomUUID(),
    productId: null,
    name: "",
    quantity: 1,
    unitPrice: 0,
    query: "",
  };
}

export function DebtFormDialog({ products, onSubmit }: DebtFormDialogProps) {
  const [open, setOpen] = useState(false);
  const [borrowerName, setBorrowerName] = useState("");
  const [whatsapp, setWhatsapp] = useState("");
  const [amount, setAmount] = useState(0);
  const [dueDate, setDueDate] = useState(defaultDueDate());
  const [withItems, setWithItems] = useState(false);
  const [items, setItems] = useState<ItemDraft[]>([emptyItem()]);
  const [saving, setSaving] = useState(false);

  const itemTotal = useMemo(
    () => items.reduce((sum, item) => sum + Math.max(0, item.quantity) * Math.max(0, item.unitPrice), 0),
    [items]
  );
  const effectiveAmount = withItems ? itemTotal : amount;

  function reset() {
    setBorrowerName("");
    setWhatsapp("");
    setAmount(0);
    setDueDate(defaultDueDate());
    setWithItems(false);
    setItems([emptyItem()]);
  }

  function handleOpenChange(nextOpen: boolean) {
    setOpen(nextOpen);
    if (!nextOpen && !saving) {
      reset();
    }
  }

  function updateItem(id: string, patch: Partial<ItemDraft>) {
    setItems((current) => current.map((item) => (item.id === id ? { ...item, ...patch } : item)));
  }

  function selectProduct(itemId: string, product: Product) {
    updateItem(itemId, {
      productId: product.id,
      name: product.name,
      unitPrice: product.sellPrice,
      query: product.name,
    });
  }

  async function handleSubmit() {
    try {
      if (borrowerName.trim().length === 0) {
        toast.error("Nama peminjam wajib diisi.");
        return;
      }

      if (whatsapp.trim().length < 10) {
        toast.error("Nomor WhatsApp minimal 10 karakter.");
        return;
      }

      if (effectiveAmount <= 0) {
        toast.error("Nominal hutang harus lebih dari 0.");
        return;
      }

      const cleanedItems = items
        .filter((item) => item.name.trim().length > 0 && item.quantity > 0 && item.unitPrice > 0)
        .map((item) => ({
          productId: item.productId ?? null,
          name: item.name.trim(),
          quantity: item.quantity,
          unitPrice: item.unitPrice,
          lineTotal: item.quantity * item.unitPrice,
        }));

      if (withItems && cleanedItems.length === 0) {
        toast.error("Tambahkan minimal satu rincian barang.");
        return;
      }

      setSaving(true);
      await onSubmit({
        borrowerName: borrowerName.trim(),
        whatsapp: whatsapp.trim(),
        amount: effectiveAmount,
        dueDate,
        items: withItems ? cleanedItems : [],
      });
      reset();
      setOpen(false);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Gagal menyimpan kasbon.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogTrigger render={<Button size="lg" className="h-11 rounded-2xl" />}>
        <WalletCards className="size-4" />
        Tambah kasbon
      </DialogTrigger>
      <DialogContent
        className={cn(
          "max-h-[calc(100dvh-2rem)] w-[calc(100vw-2rem)] overflow-x-hidden rounded-[28px] p-0 sm:max-w-3xl",
          withItems ? "overflow-y-auto" : "overflow-y-hidden"
        )}
      >
        <DialogHeader className="border-b border-border/70 px-5 pt-5 pb-4 sm:px-6">
          <DialogTitle className="font-heading text-2xl">Catat hutang baru</DialogTitle>
          <DialogDescription>Isi data peminjam, nominal, jatuh tempo, dan rincian barang bila diperlukan.</DialogDescription>
        </DialogHeader>

        <div className="grid gap-4 px-5 py-4 sm:px-6">
          <section className="grid min-w-0 gap-3">
            <div className="flex items-center gap-2">
              <Badge variant="outline" className="rounded-full">Data Peminjam</Badge>
            </div>
            <div className="grid min-w-0 gap-3 sm:grid-cols-2">
              <div className="grid min-w-0 gap-2">
                <Label htmlFor="debt-borrower-name">Nama peminjam</Label>
                <Input
                  id="debt-borrower-name"
                  value={borrowerName}
                  onChange={(event) => setBorrowerName(event.target.value)}
                  className="h-11 rounded-2xl"
                />
              </div>
              <div className="grid min-w-0 gap-2">
                <Label htmlFor="debt-whatsapp">Nomor WhatsApp</Label>
                <Input
                  id="debt-whatsapp"
                  value={whatsapp}
                  onChange={(event) => setWhatsapp(event.target.value)}
                  placeholder="08xxxxxxxxxx"
                  className="h-11 rounded-2xl"
                />
              </div>
            </div>
          </section>

          <section className="grid min-w-0 gap-3">
            <div className="flex items-center gap-2">
              <Badge variant="outline" className="rounded-full">Detail Hutang</Badge>
            </div>
            <div className="grid min-w-0 gap-3 sm:grid-cols-2">
              <div className="grid min-w-0 gap-2">
                <Label htmlFor="debt-amount">Nominal hutang</Label>
                <Input
                  id="debt-amount"
                  inputMode="numeric"
                  value={formatNumberInput(effectiveAmount)}
                  onChange={(event) => setAmount(parseNumberInput(event.target.value))}
                  readOnly={withItems}
                  className="h-11 rounded-2xl"
                />
              </div>
              <div className="grid min-w-0 gap-2">
                <Label htmlFor="debt-due-date">Jatuh tempo</Label>
                <div className="relative min-w-0">
                  <CalendarDays className="absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground" />
                  <Input
                    id="debt-due-date"
                    type="date"
                    value={dueDate}
                    onChange={(event) => setDueDate(event.target.value)}
                    className="h-11 w-full min-w-0 rounded-2xl pl-9"
                  />
                </div>
              </div>
            </div>

            <Button
              type="button"
              variant={withItems ? "default" : "outline"}
              className="w-fit rounded-full"
              onClick={() => setWithItems((value) => !value)}
            >
              <Plus className="size-4" />
              Tambahkan rincian barang
            </Button>
          </section>

          {withItems ? (
            <section className="grid gap-3 rounded-[22px] border border-border/70 bg-muted/35 p-4">
              {items.map((item, index) => {
                const keyword = item.query.trim().toLowerCase();
                const matches = keyword.length > 0
                  ? products
                      .filter((product) => product.name.toLowerCase().includes(keyword))
                      .slice(0, 4)
                  : [];

                return (
                  <div key={item.id} className="grid gap-3 rounded-[18px] bg-card/80 p-3">
                    <div className="flex items-center justify-between gap-3">
                      <p className="font-medium">Barang {index + 1}</p>
                      {items.length > 1 ? (
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon-sm"
                          onClick={() => setItems((current) => current.filter((row) => row.id !== item.id))}
                        >
                          <Trash2 className="size-4" />
                        </Button>
                      ) : null}
                    </div>

                    <div className="grid gap-3 md:grid-cols-[1fr_100px_150px_150px]">
                      <div className="grid gap-2">
                        <Label>Produk atau nama manual</Label>
                        <div className="relative">
                          <Search className="absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground" />
                          <Input
                            value={item.query}
                            onChange={(event) =>
                              updateItem(item.id, {
                                query: event.target.value,
                                name: event.target.value,
                                productId: null,
                              })
                            }
                            placeholder="Cari produk atau ketik manual"
                            className="h-10 rounded-2xl pl-9"
                          />
                        </div>
                        {matches.length > 0 ? (
                          <div className="flex flex-wrap gap-2">
                            {matches.map((product) => (
                              <Button
                                key={product.id}
                                type="button"
                                variant="outline"
                                size="sm"
                                className="rounded-full"
                                onClick={() => selectProduct(item.id, product)}
                              >
                                {product.name}
                              </Button>
                            ))}
                          </div>
                        ) : null}
                      </div>
                      <div className="grid gap-2">
                        <Label>Qty</Label>
                        <Input
                          type="number"
                          min={1}
                          value={item.quantity}
                          onChange={(event) => updateItem(item.id, { quantity: Number(event.target.value) })}
                          className="h-10 rounded-2xl"
                        />
                      </div>
                      <div className="grid gap-2">
                        <Label>Harga</Label>
                        <Input
                          inputMode="numeric"
                          value={formatNumberInput(item.unitPrice)}
                          onChange={(event) => updateItem(item.id, { unitPrice: parseNumberInput(event.target.value) })}
                          className="h-10 rounded-2xl"
                        />
                      </div>
                      <div className="grid gap-2">
                        <Label>Subtotal</Label>
                        <div className="flex h-10 items-center rounded-2xl border border-border bg-muted/50 px-3 text-sm font-medium">
                          {formatCurrency(item.quantity * item.unitPrice)}
                        </div>
                      </div>
                    </div>
                  </div>
                );
              })}

              <div className="flex flex-wrap items-center justify-between gap-3">
                <Button type="button" variant="outline" className="rounded-full" onClick={() => setItems((current) => [...current, emptyItem()])}>
                  <Plus className="size-4" />
                  Tambah baris
                </Button>
                <p className="text-sm font-medium">Total rincian: {formatCurrency(itemTotal)}</p>
              </div>
            </section>
          ) : null}
        </div>

        <DialogFooter className="m-0 rounded-b-[28px] px-5 py-4 sm:px-6">
          <DialogClose
            render={<Button type="button" variant="outline" disabled={saving} />}
          >
            Batal
          </DialogClose>
          <Button type="button" onClick={() => void handleSubmit()} disabled={saving}>
            {saving ? "Menyimpan..." : "Simpan kasbon"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
