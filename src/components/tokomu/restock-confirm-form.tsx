"use client";

import { useMemo, useState, useCallback, useEffect } from "react";
import {
  AlertTriangle,
  CheckCircle2,
  ChevronDown,
  ChevronUp,
  Eye,
  Loader2,
  RotateCcw,
  Save,
  Search,
  X,
  Plus,
} from "lucide-react";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectLabel,
  SelectSeparator,
  SelectTrigger,
} from "@/components/ui/select";
import { formatCurrency } from "@/lib/format";
import { cn } from "@/lib/utils";
import type { Product } from "@/lib/types";
import type { ReceiptScanConfidence, ReceiptScanItem } from "@/components/tokomu/receipt-scanner";

type RowState = {
  id: string;
  rawName: string;
  quantity: number;
  unit: string;
  unitPrice: number;
  lineTotal?: number | null;
  productId: string;
  createProduct: boolean;
  included: boolean;
  confidence: ReceiptScanConfidence;
  suggestedProduct: Product | null;
  alternatives: Product[];
};

type CommitResult = {
  restockedCount: number;
  totalQuantity: number;
  logs: Array<{ id: string; productId: string; quantity: number }>;
};

const UNIT_STORAGE_KEY = "tokomu.restock.units.v1";
const CREATE_PRODUCT_SELECT_VALUE = "__tokomu_create_product__";
const DEFAULT_UNIT_OPTIONS = [
  "Pcs",
  "Unit",
  "Kg",
  "Gram",
  "Liter",
  "Ml",
  "Bungkus",
  "Dus",
  "Karton",
  "Box",
  "Sachet",
] as const;

function shouldInclude() {
  return true;
}

function matchVariant(confidence: ReceiptScanConfidence, productId: string, createProduct: boolean) {
  if (createProduct) return "outline";
  if (productId && (confidence === "low" || confidence === "none")) return "secondary";
  if (confidence === "high") return "default";
  if (confidence === "medium") return "secondary";
  return "outline";
}

function matchLabel(confidence: ReceiptScanConfidence, productId: string, createProduct: boolean) {
  if (createProduct) return "Produk baru";
  if (productId && confidence === "low") return "Cocok rendah";
  if (productId && confidence === "none") return "Dipilih manual";
  if (confidence === "high") return "Cocok";
  if (confidence === "medium") return "Perlu dicek";
  if (confidence === "low") return "Ragu";
  return "Belum cocok";
}

function normalizeUnit(value: string | null | undefined) {
  const unit = value?.trim();
  return unit ? unit.slice(0, 16) : "Unit";
}

function mergeUnits(...groups: Array<Array<string | null | undefined>>) {
  const units = new Map<string, string>();
  for (const value of groups.flat()) {
    const unit = normalizeUnit(value);
    units.set(unit.toLowerCase(), unit);
  }

  return Array.from(units.values()).sort((left, right) => {
    const leftIndex = DEFAULT_UNIT_OPTIONS.findIndex(
      (unit) => unit.toLowerCase() === left.toLowerCase()
    );
    const rightIndex = DEFAULT_UNIT_OPTIONS.findIndex(
      (unit) => unit.toLowerCase() === right.toLowerCase()
    );
    if (leftIndex !== -1 || rightIndex !== -1) {
      return (leftIndex === -1 ? 999 : leftIndex) - (rightIndex === -1 ? 999 : rightIndex);
    }

    return left.localeCompare(right);
  });
}

function readSavedUnits() {
  if (typeof window === "undefined") return [];

  try {
    const parsed = JSON.parse(window.localStorage.getItem(UNIT_STORAGE_KEY) ?? "[]");
    return Array.isArray(parsed) ? parsed.filter((unit): unit is string => typeof unit === "string") : [];
  } catch {
    return [];
  }
}

function formatQuantityUnit(quantity: number, unit: string) {
  return `${quantity} ${normalizeUnit(unit)}`;
}

function inferCategory(rawName: string): Product["category"] {
  const name = rawName.toLowerCase();
  if (/(air|teh|kopi|susu|sirup|minum|jus|soda)/i.test(name)) return "Minuman";
  if (/(beras|gula|minyak|telur|tepung|garam|mie|mi\b)/i.test(name)) return "Sembako";
  if (/(sabun|sampo|shampoo|odol|tisu|detergen|pewangi|pembersih)/i.test(name)) {
    return "Kebutuhan Harian";
  }

  return "Makanan";
}

async function requestJson<T>(input: RequestInfo, init?: RequestInit): Promise<T> {
  const response = await fetch(input, {
    ...init,
    headers: {
      "Content-Type": "application/json",
      ...(init?.headers ?? {}),
    },
  });
  const data = (await response.json().catch(() => null)) as (T & { error?: string }) | null;
  if (!response.ok) {
    throw new Error(data?.error ?? "Permintaan gagal.");
  }

  return data as T;
}

function uniqueProducts(products: Product[]) {
  const map = new Map<string, Product>();
  for (const product of products) {
    map.set(product.id, product);
  }
  return Array.from(map.values());
}

// --- Stat summary component ---
function ScanSummary({ rows }: Readonly<{ rows: RowState[]; products: Product[] }>) {
  const included = rows.filter((r) => r.included);
  const matched = included.filter((r) => r.productId && !r.createProduct);
  const newProducts = included.filter((r) => r.createProduct);
  const totalQty = included.reduce((sum, r) => sum + r.quantity, 0);
  const totalValue = included.reduce((sum, r) => sum + r.quantity * r.unitPrice, 0);

  return (
    <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
      <div className="rounded-2xl border border-border/60 bg-card/60 px-4 py-3">
        <p className="text-xs text-muted-foreground">Total item</p>
        <p className="mt-1 font-heading text-xl font-semibold">{rows.length}</p>
      </div>
      <div className="rounded-2xl border border-accent/40 bg-accent/10 px-4 py-3">
        <p className="text-xs text-muted-foreground">Siap restok</p>
        <p className="mt-1 font-heading text-xl font-semibold text-accent-foreground">
          {matched.length}
        </p>
      </div>
      <div className="rounded-2xl border border-primary/30 bg-primary/8 px-4 py-3">
        <p className="text-xs text-muted-foreground">Produk baru</p>
        <p className="mt-1 font-heading text-xl font-semibold text-primary">
          {newProducts.length}
        </p>
      </div>
      <div className="rounded-2xl border border-border/60 bg-card/60 px-4 py-3">
        <p className="text-xs text-muted-foreground">Est. total</p>
        <p className="mt-1 font-heading text-lg font-semibold">
          {totalValue > 0 ? formatCurrency(totalValue) : `${totalQty} unit`}
        </p>
      </div>
    </div>
  );
}

// --- Receipt preview pane ---
function ReceiptPreview({
  imageDataUrl,
  isExpanded,
  onToggle,
}: Readonly<{
  imageDataUrl: string;
  isExpanded: boolean;
  onToggle: () => void;
}>) {
  return (
    <div className="rounded-2xl border border-border/60 bg-card/50">
      <button
        type="button"
        className="flex w-full items-center justify-between px-4 py-3 text-left"
        onClick={onToggle}
      >
        <div className="flex items-center gap-2">
          <Eye className="size-4 text-muted-foreground" />
          <span className="text-sm font-medium">Preview struk yang discan</span>
        </div>
        {isExpanded ? (
          <ChevronUp className="size-4 text-muted-foreground" />
        ) : (
          <ChevronDown className="size-4 text-muted-foreground" />
        )}
      </button>
      {isExpanded && (
        <div className="border-t border-border/40 p-4">
          <div className="max-h-[min(72vh,760px)] min-h-72 resize-y overflow-auto overscroll-contain rounded-xl bg-muted/20">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={imageDataUrl}
              alt="Struk yang discan"
              className="mx-auto h-auto max-w-none rounded-xl border border-border/40 object-contain"
            />
          </div>
        </div>
      )}
    </div>
  );
}

export function RestockConfirmForm({
  imageDataUrl,
  items,
  products,
  knownUnits = [],
  onCancel,
  onSuccess,
}: Readonly<{
  imageDataUrl: string;
  items: ReceiptScanItem[];
  products: Product[];
  knownUnits?: string[];
  onCancel: () => void;
  onSuccess: (result: CommitResult) => void;
}>) {
  const [rows, setRows] = useState<RowState[]>(() =>
    items.map((item, index) => {
      const suggestedProduct = item.suggestedProduct;
      return {
        id: `${index}-${item.rawName}`,
        rawName: item.rawName,
        quantity: Math.max(1, Math.round(Number(item.quantity) || 1)),
        unit: normalizeUnit(item.unit),
        unitPrice: Math.max(0, Math.round(Number(item.unitPrice ?? 0) || 0)),
        lineTotal: item.lineTotal,
        productId: suggestedProduct?.id ?? "",
        createProduct: !suggestedProduct,
        included: shouldInclude(),
        confidence: item.confidence,
        suggestedProduct,
        alternatives: item.alternatives,
      };
    })
  );
  const [isSaving, setIsSaving] = useState(false);
  const [previewExpanded, setPreviewExpanded] = useState(false);
  const [globalSearch, setGlobalSearch] = useState("");
  const [savedUnits, setSavedUnits] = useState<string[]>([]);

  const selectedRows = rows.filter((row) => row.included);
  const totalQuantity = selectedRows.reduce((sum, row) => sum + row.quantity, 0);
  const selectedUnits = Array.from(new Set(selectedRows.map((row) => normalizeUnit(row.unit))));
  const totalUnitLabel = selectedUnits.length === 1 ? selectedUnits[0] : "unit";
  const unitOptions = useMemo(
    () => mergeUnits([...DEFAULT_UNIT_OPTIONS], knownUnits, savedUnits, rows.map((row) => row.unit)),
    [knownUnits, rows, savedUnits]
  );

  useEffect(() => {
    setSavedUnits(readSavedUnits());
  }, []);

  const updateRow = useCallback(
    (id: string, patch: Partial<RowState>) => {
      setRows((current) =>
        current.map((row) => (row.id === id ? { ...row, ...patch } : row))
      );
    },
    []
  );

  const rememberUnit = useCallback((value: string) => {
    const nextUnits = mergeUnits([...DEFAULT_UNIT_OPTIONS], savedUnits, [value]);
    setSavedUnits(nextUnits);
    if (typeof window !== "undefined") {
      window.localStorage.setItem(UNIT_STORAGE_KEY, JSON.stringify(nextUnits));
    }
  }, [savedUnits]);

  async function handleCommit() {
    const commitRows = rows.filter((row) => row.included);
    if (commitRows.length === 0) {
      toast.error("Centang minimal satu item untuk restok.");
      return;
    }

    const missingName = commitRows.find((row) => row.rawName.trim().length === 0);
    if (missingName) {
      toast.error("Nama item struk wajib diisi.");
      return;
    }

    const missingProduct = commitRows.find((row) => !row.createProduct && !row.productId);
    if (missingProduct) {
      toast.error(`Pilih produk toko untuk ${missingProduct.rawName || "baris terpilih"}.`);
      return;
    }

    setIsSaving(true);
    try {
      const newProductsMap = new Map<string, string>();
      for (const row of commitRows) {
        if (row.createProduct) {
          const buyPrice = row.unitPrice || 0;
          const res = await fetch("/api/products", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              name: row.rawName.trim(),
              category: inferCategory(row.rawName),
              buyPrice,
              sellPrice: Math.max(1, Math.round((buyPrice || 1) * 1.2)),
              stock: 0,
              minimumStock: 5,
              description: `Dibuat dari scan struk restok. Satuan awal: ${normalizeUnit(row.unit)}.`,
            }),
          });
          const data = await res.json();
          if (!res.ok) throw new Error(data.error || "Gagal membuat produk baru.");
          newProductsMap.set(row.id, data.product.id);
        }
      }

      const finalRows = commitRows.map((row) => ({
        ...row,
        productId: row.createProduct ? newProductsMap.get(row.id)! : row.productId,
      }));
      finalRows.forEach((row) => rememberUnit(row.unit));

      const result = await requestJson<CommitResult>("/api/restock/batch", {
        method: "POST",
        body: JSON.stringify({
          receiptImageUrl: imageDataUrl,
          ocrRaw: {
            originalItems: items,
            editedItems: finalRows.map((row) => ({
              rawName: row.rawName.trim(),
              quantity: row.quantity,
              unit: normalizeUnit(row.unit),
              unitPrice: row.unitPrice || null,
              lineTotal: row.unitPrice ? row.quantity * row.unitPrice : row.lineTotal ?? null,
              productId: row.productId,
            })),
          },
          items: finalRows.map((row) => ({
            productId: row.productId,
            quantity: row.quantity,
            unitCost: row.unitPrice || null,
          })),
        }),
      });
      onSuccess(result);
      toast.success(`${result.restockedCount} item berhasil direstok.`);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Gagal menyimpan restok.");
    } finally {
      setIsSaving(false);
    }
  }

  // Filter rows by global search
  const visibleRows = globalSearch.trim()
    ? rows.filter((row) => row.rawName.toLowerCase().includes(globalSearch.toLowerCase()))
    : rows;

  return (
    <Card className="border-border/60 bg-card/80">
      <CardHeader>
        <CardTitle className="font-heading text-2xl">Konfirmasi hasil scan</CardTitle>
        <CardDescription>
          Setiap baris bisa diedit. Pilih produk toko yang sesuai sebelum stok ditambahkan.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Summary stats */}
        <ScanSummary rows={rows} products={products} />

        {/* Global search filter */}
        <div className="relative">
          <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={globalSearch}
            onChange={(e) => setGlobalSearch(e.target.value)}
            placeholder="Cari item struk..."
            className="h-10 rounded-2xl pl-9"
          />
          {globalSearch && (
            <button
              type="button"
              className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
              onClick={() => setGlobalSearch("")}
            >
              <X className="size-4" />
            </button>
          )}
        </div>

        {/* Scrollable table container */}
        <div className="overflow-hidden rounded-2xl border border-border/60">
          <div className="max-h-[70vh] min-h-[380px] resize-y overflow-auto">
            <table className="w-full min-w-[1180px] table-fixed">
              <colgroup>
                <col className="w-[52px]" />
                <col className="w-[25%]" />
                <col className="w-[36%]" />
                <col className="w-[17%]" />
                <col className="w-[12%]" />
                <col className="w-[10%]" />
              </colgroup>
              <thead className="sticky top-0 z-10 bg-popover/98 backdrop-blur-sm">
                <tr className="border-b border-border/60">
                  <th className="px-3 py-3 text-left text-xs font-medium text-muted-foreground">
                    <input
                      type="checkbox"
                      checked={rows.every((r) => r.included)}
                      onChange={(e) => {
                        const checked = e.target.checked;
                        setRows((current) =>
                          current.map((r) => ({ ...r, included: checked }))
                        );
                      }}
                      className="size-4 accent-primary"
                      aria-label="Pilih semua"
                    />
                  </th>
                  <th className="px-3 py-3 text-left text-xs font-medium text-muted-foreground">
                    Item dari struk
                  </th>
                  <th className="px-3 py-3 text-left text-xs font-medium text-muted-foreground">
                    Produk toko
                  </th>
                  <th className="px-3 py-3 text-left text-xs font-medium text-muted-foreground">
                    Jumlah
                  </th>
                  <th className="px-3 py-3 text-left text-xs font-medium text-muted-foreground">
                    Harga beli
                  </th>
                  <th className="px-3 py-3 text-left text-xs font-medium text-muted-foreground">
                    Status
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border/40">
                {visibleRows.map((row) => (
                  <ConfirmRow
                    key={row.id}
                    row={row}
                    products={products}
                    unitOptions={unitOptions}
                    onChange={(patch) => updateRow(row.id, patch)}
                    onRememberUnit={rememberUnit}
                  />
                ))}
                {visibleRows.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="h-28 text-center text-muted-foreground">
                      {globalSearch
                        ? "Tidak ada item yang cocok dengan pencarian."
                        : "AI belum menemukan item dari struk."}
                    </td>
                  </tr>
                ) : null}
              </tbody>
            </table>
          </div>
        </div>

        {/* Receipt preview */}
        <ReceiptPreview
          imageDataUrl={imageDataUrl}
          isExpanded={previewExpanded}
          onToggle={() => setPreviewExpanded((p) => !p)}
        />

        {/* Sticky bottom action bar */}
        <div className="sticky bottom-0 flex flex-col gap-3 rounded-[24px] border border-border/70 bg-popover/95 p-4 shadow-lg backdrop-blur md:flex-row md:items-center md:justify-between">
          <div className="flex items-center gap-3">
            <div className="flex size-10 items-center justify-center rounded-2xl bg-primary/12 text-primary">
              <CheckCircle2 className="size-5" />
            </div>
            <div>
              <p className="font-medium">
                {selectedRows.length} item akan direstok
              </p>
              <p className="text-sm text-muted-foreground">
                Total tambahan stok {totalQuantity} {totalUnitLabel}.
              </p>
            </div>
          </div>
          <div className="flex gap-2">
            <Button type="button" variant="outline" className="rounded-2xl" onClick={onCancel}>
              <RotateCcw className="size-4" />
              Batal
            </Button>
            <Button
              type="button"
              className="rounded-2xl"
              disabled={isSaving}
              onClick={() => void handleCommit()}
            >
              {isSaving ? <Loader2 className="size-4 animate-spin" /> : <Save className="size-4" />}
              Konfirmasi & Restok
            </Button>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

function ConfirmRow({
  row,
  products,
  unitOptions,
  onChange,
  onRememberUnit,
}: Readonly<{
  row: RowState;
  products: Product[];
  unitOptions: string[];
  onChange: (patch: Partial<RowState>) => void;
  onRememberUnit: (unit: string) => void;
}>) {
  const [searchQuery, setSearchQuery] = useState("");

  const selectProducts = useMemo(() => {
    const query = searchQuery.trim().toLowerCase();
    const alternatives = uniqueProducts([
      ...(row.suggestedProduct ? [row.suggestedProduct] : []),
      ...row.alternatives,
    ]);
    const remaining = products.filter((product) => {
      if (alternatives.some((alt) => alt.id === product.id)) {
        return false;
      }

      if (!query) {
        return true;
      }

      return (
        product.name.toLowerCase().includes(query) ||
        product.category.toLowerCase().includes(query)
      );
    });

    return { alternatives, remaining: remaining.slice(0, query ? 20 : 8) };
  }, [products, row.alternatives, searchQuery, row.suggestedProduct]);

  const candidateProducts = uniqueProducts([
    ...(row.suggestedProduct ? [row.suggestedProduct] : []),
    ...row.alternatives,
    ...products,
  ]);
  const selectedProduct = candidateProducts.find((product) => product.id === row.productId) ?? null;
  const isNewProduct = row.createProduct;
  const needsWarning = !row.createProduct && !row.productId;
  const displayLineTotal = row.unitPrice ? row.quantity * row.unitPrice : row.lineTotal;
  const selectValue = isNewProduct ? CREATE_PRODUCT_SELECT_VALUE : row.productId;
  const newProductName = row.rawName.trim() || "produk baru";

  return (
    <tr className={cn("transition-colors", needsWarning && row.included && "bg-primary/6", !row.included && "opacity-50")}>
      {/* Checkbox */}
      <td className="px-3 py-3 align-top">
        <input
          type="checkbox"
          checked={row.included}
          onChange={(event) => onChange({ included: event.target.checked })}
          className="mt-1 size-4 accent-primary"
          aria-label={`Sertakan ${row.rawName}`}
        />
      </td>

      {/* Item name from receipt */}
      <td className="px-3 py-3 align-top">
        <div className="space-y-1.5">
          <Input
            value={row.rawName}
            onChange={(event) => onChange({ rawName: event.target.value })}
            placeholder="Nama item struk"
            className="h-9 rounded-xl text-sm"
          />
          <p className="text-xs text-muted-foreground">
            {formatQuantityUnit(row.quantity, row.unit)}
            {row.unitPrice ? ` x ${formatCurrency(row.unitPrice)}` : ""}
            {displayLineTotal ? ` = ${formatCurrency(displayLineTotal)}` : ""}
          </p>
          {needsWarning && row.included ? (
            <div className="flex items-center gap-1.5 text-xs text-primary">
              <AlertTriangle className="size-3" />
              Pilih produk toko
            </div>
          ) : null}
        </div>
      </td>

      {/* Product selector with built-in search */}
      <td className="px-3 py-3 align-top">
        <div className="space-y-1.5">
          <div className="flex items-center gap-1.5">
            <Select
              value={selectValue}
              onValueChange={(value) => {
                if (value === CREATE_PRODUCT_SELECT_VALUE) {
                  onChange({ productId: "", createProduct: true, included: true });
                  return;
                }

                onChange({
                  productId: value ?? "",
                  createProduct: false,
                  included: Boolean(value) || row.included,
                });
              }}
            >
              <SelectTrigger className="h-9 w-full rounded-xl bg-card text-sm">
                <span
                  className={cn(
                    "min-w-0 flex-1 truncate text-left",
                    !selectedProduct && !isNewProduct && "text-muted-foreground",
                    isNewProduct && "text-primary font-medium"
                  )}
                >
                  {isNewProduct ? `[Baru] ${newProductName}` : selectedProduct?.name ?? "Pilih produk..."}
                </span>
              </SelectTrigger>
              <SelectContent>
                {/* Built-in search */}
                <div className="sticky top-0 z-10 border-b border-border/40 bg-popover p-2">
                  <div className="relative">
                    <Search className="absolute left-2 top-1/2 size-3.5 -translate-y-1/2 text-muted-foreground" />
                    <input
                      type="text"
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                      placeholder="Cari produk..."
                      className="w-full rounded-md bg-muted/50 py-1.5 pl-7 pr-2 text-sm outline-none placeholder:text-muted-foreground focus:ring-1 focus:ring-ring/50"
                      onClick={(e) => e.stopPropagation()}
                      onKeyDown={(e) => e.stopPropagation()}
                    />
                  </div>
                  <SelectItem
                    value={CREATE_PRODUCT_SELECT_VALUE}
                    className="mt-2 text-xs text-primary focus:text-primary"
                  >
                    <div className="flex items-center gap-1.5">
                      <Plus className="size-3" />
                      <span>Buat &quot;{newProductName}&quot; sebagai produk baru</span>
                    </div>
                  </SelectItem>
                </div>

                {selectProducts.alternatives.length > 0 ? (
                  <SelectGroup>
                    <SelectLabel>Saran AI</SelectLabel>
                    {selectProducts.alternatives.map((product) => (
                      <SelectItem key={product.id} value={product.id}>
                        <div className="flex flex-col">
                          <span>{product.name}</span>
                          <span className="text-xs text-muted-foreground">
                            Stok: {product.stock} - {formatCurrency(product.buyPrice)}
                          </span>
                        </div>
                      </SelectItem>
                    ))}
                  </SelectGroup>
                ) : null}
                {selectProducts.alternatives.length > 0 && selectProducts.remaining.length > 0 && (
                  <SelectSeparator />
                )}
                {selectProducts.remaining.length > 0 && (
                  <SelectGroup>
                    <SelectLabel>
                      {searchQuery ? "Hasil pencarian" : "Produk lain"}
                    </SelectLabel>
                    {selectProducts.remaining.map((product) => (
                      <SelectItem key={product.id} value={product.id}>
                        <div className="flex flex-col">
                          <span>{product.name}</span>
                          <span className="text-xs text-muted-foreground">
                            Stok: {product.stock} - {formatCurrency(product.buyPrice)}
                          </span>
                        </div>
                      </SelectItem>
                    ))}
                  </SelectGroup>
                )}
              </SelectContent>
            </Select>
            {/* Clear button for deselecting product */}
            {(selectedProduct || isNewProduct) && (
              <button
                type="button"
                className="flex size-9 shrink-0 items-center justify-center rounded-xl border border-border/60 bg-card text-muted-foreground transition-colors hover:bg-destructive/10 hover:text-destructive"
                onClick={() => onChange({ productId: "", createProduct: false })}
                aria-label="Hapus pilihan produk"
                title="Hapus pilihan produk"
              >
                <X className="size-3.5" />
              </button>
            )}
          </div>
          {isNewProduct ? (
            <p className="text-xs text-primary/80">
              Produk baru akan ditambahkan ke toko secara otomatis.
            </p>
          ) : selectedProduct ? (
            <p className="text-xs text-muted-foreground">
              Stok saat ini: <span className="font-medium">{selectedProduct.stock}</span>
              {" - "}Harga beli: <span className="font-medium">{formatCurrency(selectedProduct.buyPrice)}</span>
            </p>
          ) : null}
        </div>
      </td>

      {/* Quantity + unit */}
      <td className="px-3 py-3 align-top">
        <div className="flex items-center gap-1.5">
          <Input
            type="number"
            min={1}
            value={row.quantity}
            onChange={(event) =>
              onChange({ quantity: Math.max(1, Math.round(Number(event.target.value) || 1)) })
            }
            className="h-9 w-20 rounded-xl text-sm"
            aria-label={`Jumlah ${row.rawName}`}
          />
          <Input
            list={`unit-list-${row.id}`}
            value={row.unit}
            onChange={(event) => onChange({ unit: event.target.value.slice(0, 16) })}
            onBlur={() => onRememberUnit(row.unit)}
            className="h-9 w-24 rounded-xl text-sm"
            aria-label={`Satuan ${row.rawName}`}
            placeholder="Pcs"
          />
          <datalist id={`unit-list-${row.id}`}>
            {unitOptions.map((unit) => (
              <option key={unit} value={unit} />
            ))}
          </datalist>
        </div>
      </td>

      {/* Unit price */}
      <td className="px-3 py-3 align-top">
        <Input
          type="number"
          min={0}
          value={row.unitPrice}
          onChange={(event) =>
            onChange({ unitPrice: Math.max(0, Math.round(Number(event.target.value) || 0)) })
          }
          className="h-9 w-28 rounded-xl text-sm"
        />
      </td>

      {/* Match status badge */}
      <td className="px-3 py-3 align-top">
        <Badge
          variant={matchVariant(row.confidence, row.productId, row.createProduct)}
          className="rounded-full text-[11px]"
        >
          {matchLabel(row.confidence, row.productId, row.createProduct)}
        </Badge>
      </td>
    </tr>
  );
}
