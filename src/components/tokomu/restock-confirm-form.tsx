"use client";

import { useMemo, useState } from "react";
import { AlertTriangle, CheckCircle2, Loader2, RotateCcw, Save } from "lucide-react";
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
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { formatCurrency } from "@/lib/format";
import { cn } from "@/lib/utils";
import type { Product } from "@/lib/types";
import type { ReceiptScanConfidence, ReceiptScanItem } from "@/components/tokomu/receipt-scanner";

type RowState = {
  id: string;
  rawName: string;
  quantity: number;
  unitPrice: number;
  lineTotal?: number | null;
  productId: string;
  included: boolean;
  confidence: ReceiptScanConfidence;
  suggestedProduct: Product | null;
  alternatives: Product[];
  search: string;
};

type CommitResult = {
  restockedCount: number;
  totalQuantity: number;
  logs: Array<{ id: string; productId: string; quantity: number }>;
};

function shouldInclude(confidence: ReceiptScanConfidence) {
  return confidence === "high" || confidence === "medium";
}

function confidenceVariant(confidence: ReceiptScanConfidence) {
  if (confidence === "high") return "default";
  if (confidence === "medium") return "secondary";
  return "outline";
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

export function RestockConfirmForm({
  imageDataUrl,
  items,
  products,
  onCancel,
  onSuccess,
}: Readonly<{
  imageDataUrl: string;
  items: ReceiptScanItem[];
  products: Product[];
  onCancel: () => void;
  onSuccess: (result: CommitResult) => void;
}>) {
  const [rows, setRows] = useState<RowState[]>(() =>
    items.map((item, index) => ({
      id: `${index}-${item.rawName}`,
      rawName: item.rawName,
      quantity: Math.max(1, Math.round(Number(item.quantity) || 1)),
      unitPrice: Math.max(0, Math.round(Number(item.unitPrice ?? 0) || 0)),
      lineTotal: item.lineTotal,
      productId: item.confidence === "none" ? "" : item.suggestedProduct?.id ?? "",
      included: shouldInclude(item.confidence),
      confidence: item.confidence,
      suggestedProduct: item.suggestedProduct,
      alternatives: item.alternatives,
      search: "",
    }))
  );
  const [isSaving, setIsSaving] = useState(false);

  const selectedRows = rows.filter((row) => row.included);
  const totalQuantity = selectedRows.reduce((sum, row) => sum + row.quantity, 0);

  function updateRow(id: string, patch: Partial<RowState>) {
    setRows((current) =>
      current.map((row) => (row.id === id ? { ...row, ...patch } : row))
    );
  }

  async function handleCommit() {
    const commitRows = rows.filter((row) => row.included);
    if (commitRows.length === 0) {
      toast.error("Centang minimal satu item untuk restok.");
      return;
    }

    const missingProduct = commitRows.find((row) => !row.productId);
    if (missingProduct) {
      toast.error(`Pilih produk toko untuk ${missingProduct.rawName}.`);
      return;
    }

    setIsSaving(true);
    try {
      const result = await requestJson<CommitResult>("/api/restock/batch", {
        method: "POST",
        body: JSON.stringify({
          receiptImageUrl: imageDataUrl,
          ocrRaw: { items },
          items: commitRows.map((row) => ({
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

  return (
    <Card className="border-border/60 bg-card/80">
      <CardHeader>
        <CardTitle className="font-heading text-2xl">Konfirmasi hasil scan</CardTitle>
        <CardDescription>
          Setiap baris wajib dicek. Item dengan confidence rendah tidak otomatis disertakan.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <Table className="min-w-[1060px]">
          <TableHeader>
            <TableRow>
              <TableHead className="w-[26%]">Item struk</TableHead>
              <TableHead className="w-[30%]">Produk toko</TableHead>
              <TableHead>Qty</TableHead>
              <TableHead>Harga beli</TableHead>
              <TableHead>Confidence</TableHead>
              <TableHead className="text-right">Sertakan</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {rows.map((row) => (
              <ConfirmRow
                key={row.id}
                row={row}
                products={products}
                onChange={(patch) => updateRow(row.id, patch)}
              />
            ))}
            {rows.length === 0 ? (
              <TableRow>
                <TableCell colSpan={6} className="h-28 text-center text-muted-foreground">
                  AI belum menemukan item dari struk. Coba foto ulang dengan pencahayaan lebih jelas.
                </TableCell>
              </TableRow>
            ) : null}
          </TableBody>
        </Table>

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
                Total tambahan stok {totalQuantity} pcs.
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
  onChange,
}: Readonly<{
  row: RowState;
  products: Product[];
  onChange: (patch: Partial<RowState>) => void;
}>) {
  const selectProducts = useMemo(() => {
    const query = row.search.trim().toLowerCase();
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
  }, [products, row.alternatives, row.search, row.suggestedProduct]);

  const needsWarning = row.confidence === "low" || row.confidence === "none";

  return (
    <TableRow className={cn(needsWarning && "bg-primary/6")}>
      <TableCell className="align-top">
        <div className="space-y-1">
          <p className="font-medium">{row.rawName}</p>
          <p className="text-sm text-muted-foreground">
            OCR: {row.quantity} pcs
            {row.unitPrice ? ` x ${formatCurrency(row.unitPrice)}` : ""}
            {row.lineTotal ? ` = ${formatCurrency(row.lineTotal)}` : ""}
          </p>
          {needsWarning ? (
            <div className="flex items-center gap-2 text-xs text-primary">
              <AlertTriangle className="size-3.5" />
              Perlu dipilih manual sebelum disertakan.
            </div>
          ) : null}
        </div>
      </TableCell>
      <TableCell className="align-top">
        <div className="space-y-2">
          <Select value={row.productId} onValueChange={(value) => onChange({ productId: value ?? "" })}>
            <SelectTrigger className="h-10 w-full rounded-2xl bg-card">
              <SelectValue placeholder="Pilih produk toko" />
            </SelectTrigger>
            <SelectContent>
              {selectProducts.alternatives.length > 0 ? (
                <SelectGroup>
                  <SelectLabel>Saran AI</SelectLabel>
                  {selectProducts.alternatives.map((product) => (
                    <SelectItem key={product.id} value={product.id}>
                      {product.name}
                    </SelectItem>
                  ))}
                </SelectGroup>
              ) : null}
              <SelectSeparator />
              <SelectGroup>
                <SelectLabel>Cari produk lain...</SelectLabel>
                {selectProducts.remaining.map((product) => (
                  <SelectItem key={product.id} value={product.id}>
                    {product.name}
                  </SelectItem>
                ))}
              </SelectGroup>
            </SelectContent>
          </Select>
          <Input
            value={row.search}
            onChange={(event) => onChange({ search: event.target.value })}
            placeholder="Cari produk lain..."
            className="h-9 rounded-2xl"
          />
        </div>
      </TableCell>
      <TableCell className="align-top">
        <Input
          type="number"
          min={1}
          value={row.quantity}
          onChange={(event) =>
            onChange({ quantity: Math.max(1, Math.round(Number(event.target.value) || 1)) })
          }
          className="h-10 w-24 rounded-2xl"
        />
      </TableCell>
      <TableCell className="align-top">
        <Input
          type="number"
          min={0}
          value={row.unitPrice}
          onChange={(event) =>
            onChange({ unitPrice: Math.max(0, Math.round(Number(event.target.value) || 0)) })
          }
          className="h-10 w-36 rounded-2xl"
        />
      </TableCell>
      <TableCell className="align-top">
        <Badge variant={confidenceVariant(row.confidence)} className="rounded-full">
          {row.confidence}
        </Badge>
      </TableCell>
      <TableCell className="text-right align-top">
        <input
          type="checkbox"
          checked={row.included}
          onChange={(event) => onChange({ included: event.target.checked })}
          className="mt-3 size-5 accent-primary"
          aria-label={`Sertakan ${row.rawName}`}
        />
      </TableCell>
    </TableRow>
  );
}
