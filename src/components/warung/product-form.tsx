"use client";

import { Sparkles } from "lucide-react";
import { InfoHint } from "@/components/tokomu/info-hint";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { FIELD_HELP } from "@/lib/field-help";
import { formatCurrency } from "@/lib/format";
import { generateSku } from "@/lib/sku";
import type { ProductCategory, ProductDraft } from "@/lib/types";

type ProductFormProps = {
  draft: ProductDraft;
  onChange: (draft: ProductDraft) => void;
  existingSkus?: Array<string | null | undefined>;
};

function FieldLabel({
  htmlFor,
  children,
  help,
}: {
  htmlFor?: string;
  children: string;
  help: string;
}) {
  return (
    <div className="flex items-center gap-2">
      <Label htmlFor={htmlFor}>{children}</Label>
      <InfoHint text={help} label={`Penjelasan ${children}`} />
    </div>
  );
}

export function ProductForm({ draft, onChange, existingSkus = [] }: ProductFormProps) {
  const margin = Math.max(0, draft.sellPrice - draft.buyPrice);
  const marginPct = draft.sellPrice > 0 ? Math.round((margin / draft.sellPrice) * 100) : 0;

  function makeSku() {
    onChange({
      ...draft,
      sku: generateSku(draft.name, draft.category, existingSkus),
    });
  }

  return (
    <div className="grid gap-4">
      <div className="grid gap-2">
        <FieldLabel htmlFor="product-sku" help={FIELD_HELP.sku}>
          SKU
        </FieldLabel>
        <div className="flex flex-col gap-2 sm:flex-row">
          <Input
            id="product-sku"
            value={draft.sku ?? ""}
            onChange={(event) => onChange({ ...draft, sku: event.target.value.toUpperCase() })}
            placeholder="Contoh: MIG-MKN-001"
            className="h-11 rounded-2xl"
          />
          <Button
            type="button"
            variant="outline"
            className="h-11 shrink-0 rounded-2xl"
            onClick={makeSku}
          >
            <Sparkles className="size-4" />
            Buatkan otomatis
          </Button>
        </div>
      </div>

      <div className="grid gap-2">
        <Label htmlFor="product-name">Nama barang</Label>
        <Input
          id="product-name"
          value={draft.name}
          onChange={(event) => onChange({ ...draft, name: event.target.value })}
          placeholder="Contoh: Mi Instan Goreng"
          className="h-11 rounded-2xl"
        />
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <div className="grid gap-2">
          <FieldLabel help={FIELD_HELP.category}>Kategori</FieldLabel>
          <Select
            value={draft.category}
            onValueChange={(value) => onChange({ ...draft, category: value as ProductCategory })}
          >
            <SelectTrigger className="h-11 w-full rounded-2xl bg-card">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="Makanan">Makanan</SelectItem>
              <SelectItem value="Minuman">Minuman</SelectItem>
              <SelectItem value="Sembako">Sembako</SelectItem>
              <SelectItem value="Kebutuhan Harian">Kebutuhan Harian</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div className="grid gap-2">
          <FieldLabel htmlFor="product-stock" help={FIELD_HELP.initialStock}>
            Stok awal
          </FieldLabel>
          <Input
            id="product-stock"
            type="number"
            min={0}
            value={draft.stock}
            onChange={(event) => onChange({ ...draft, stock: Number(event.target.value) })}
            className="h-11 rounded-2xl"
          />
        </div>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <div className="grid gap-2">
          <FieldLabel htmlFor="product-buy-price" help={FIELD_HELP.costPrice}>
            Harga beli
          </FieldLabel>
          <Input
            id="product-buy-price"
            type="number"
            min={0}
            value={draft.buyPrice}
            onChange={(event) => onChange({ ...draft, buyPrice: Number(event.target.value) })}
            className="h-11 rounded-2xl"
          />
        </div>
        <div className="grid gap-2">
          <FieldLabel htmlFor="product-sell-price" help={FIELD_HELP.sellPrice}>
            Harga jual
          </FieldLabel>
          <Input
            id="product-sell-price"
            type="number"
            min={0}
            value={draft.sellPrice}
            onChange={(event) => onChange({ ...draft, sellPrice: Number(event.target.value) })}
            className="h-11 rounded-2xl"
          />
        </div>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <div className="grid gap-2">
          <FieldLabel htmlFor="product-minimum-stock" help={FIELD_HELP.reorderPoint}>
            Stok minimum
          </FieldLabel>
          <Input
            id="product-minimum-stock"
            type="number"
            min={0}
            value={draft.minimumStock}
            onChange={(event) => onChange({ ...draft, minimumStock: Number(event.target.value) })}
            className="h-11 rounded-2xl"
          />
        </div>
        <div className="grid gap-2">
          <FieldLabel help={FIELD_HELP.margin}>Margin</FieldLabel>
          <div className="flex h-11 items-center rounded-2xl border border-border bg-muted/45 px-3 text-sm font-medium">
            {formatCurrency(margin)} {marginPct > 0 ? `(${marginPct}%)` : ""}
          </div>
        </div>
      </div>

      <div className="grid gap-2">
        <Label htmlFor="product-description">Catatan singkat</Label>
        <Input
          id="product-description"
          value={draft.description}
          onChange={(event) => onChange({ ...draft, description: event.target.value })}
          placeholder="Penempatan rak, paket laris, atau info kasir"
          className="h-11 rounded-2xl"
        />
      </div>
    </div>
  );
}
