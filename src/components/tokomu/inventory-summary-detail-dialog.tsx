"use client";

import {
  AlertTriangle,
  Boxes,
  CircleDollarSign,
  PackageCheck,
  PackageX,
  Warehouse,
} from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Badge } from "@/components/ui/badge";
import { formatCurrency } from "@/lib/format";
import type { Product } from "@/lib/types";
import { cn } from "@/lib/utils";

export type InventorySummaryMetric =
  | "total_sku"
  | "stok_menipis"
  | "nilai_stok"
  | "produk_aktif";

type InventorySummaryDetailDialogProps = {
  canViewInventoryValue?: boolean;
  lowStockProducts: Product[];
  metric: InventorySummaryMetric | null;
  onClose: () => void;
  products: Product[];
};

const titles: Record<InventorySummaryMetric, string> = {
  total_sku: "Detail Total SKU",
  stok_menipis: "Detail Stok Menipis",
  nilai_stok: "Detail Nilai Stok",
  produk_aktif: "Detail Produk Aktif",
};

const descriptions: Record<InventorySummaryMetric, string> = {
  total_sku: "Jumlah produk yang masih tercatat aktif pada inventaris.",
  stok_menipis: "Produk dengan stok saat ini sama dengan atau di bawah stok minimum.",
  nilai_stok: "Perkiraan modal yang tersimpan di stok berdasarkan harga beli dan jumlah stok.",
  produk_aktif: "Produk yang masih memiliki stok lebih dari nol dan dapat dipilih di kasir.",
};

function SummaryRow({
  label,
  tone,
  value,
}: {
  label: string;
  tone?: "default" | "positive" | "warn" | "danger";
  value: string;
}) {
  return (
    <div className="flex items-center justify-between gap-4 py-2 text-sm">
      <span className="text-muted-foreground">{label}</span>
      <span
        className={cn(
          "text-right font-medium tabular-nums",
          tone === "positive" && "text-emerald-600 dark:text-emerald-400",
          tone === "warn" && "text-amber-600 dark:text-amber-400",
          tone === "danger" && "text-red-600 dark:text-red-400"
        )}
      >
        {value}
      </span>
    </div>
  );
}

function stockStatus(product: Product) {
  if (product.stock <= 0) return "Kosong";
  if (product.stock <= product.minimumStock) return "Menipis";
  return "Aman";
}

function stockBadgeClass(product: Product) {
  if (product.stock <= 0) return "bg-red-600 text-white";
  if (product.stock <= product.minimumStock) return "bg-primary text-primary-foreground";
  return "bg-accent text-accent-foreground";
}

function categoryCounts(products: Product[]) {
  return Object.entries(
    products.reduce<Record<string, { count: number; stock: number; value: number }>>(
      (acc, product) => {
        const current = acc[product.category] ?? { count: 0, stock: 0, value: 0 };
        current.count += 1;
        current.stock += product.stock;
        current.value += product.buyPrice * product.stock;
        acc[product.category] = current;
        return acc;
      },
      {}
    )
  ).sort(([, a], [, b]) => b.count - a.count);
}

function shortageToMinimum(product: Product) {
  return Math.max(product.minimumStock - product.stock, 0);
}

function EmptyState({ text }: { text: string }) {
  return (
    <div className="rounded-xl bg-muted/50 px-4 py-6 text-center text-sm text-muted-foreground">
      {text}
    </div>
  );
}

function ProductList({
  products,
  showValue,
}: {
  products: Product[];
  showValue?: boolean;
}) {
  if (products.length === 0) {
    return <EmptyState text="Belum ada produk untuk ditampilkan." />;
  }

  return (
    <div className="space-y-2">
      {products.map((product) => (
        <div key={product.id} className="rounded-xl border border-border/60 p-3">
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <p className="truncate font-medium">{product.name}</p>
              <p className="mt-0.5 text-xs text-muted-foreground">
                {product.sku || "-"} - {product.category}
              </p>
            </div>
            <Badge className={cn("rounded-full border-0", stockBadgeClass(product))}>
              {stockStatus(product)}
            </Badge>
          </div>
          <div className="mt-3 grid gap-2 text-xs text-muted-foreground sm:grid-cols-3">
            <span>Stok: {product.stock} pcs</span>
            <span>Stok min: {product.minimumStock} pcs</span>
            {showValue ? (
              <span className="sm:text-right">
                Nilai: {formatCurrency(product.buyPrice * product.stock)}
              </span>
            ) : (
              <span className="sm:text-right">
                Defisit min: {shortageToMinimum(product)} pcs
              </span>
            )}
          </div>
        </div>
      ))}
    </div>
  );
}

export function InventorySummaryDetailDialog({
  canViewInventoryValue = true,
  lowStockProducts,
  metric,
  onClose,
  products,
}: InventorySummaryDetailDialogProps) {
  const sellableProducts = products.filter((product) => product.stock > 0);
  const outOfStockProducts = products.filter((product) => product.stock <= 0);
  const totalStockUnits = products.reduce((sum, product) => sum + product.stock, 0);
  const totalInventoryValue = products.reduce(
    (sum, product) => sum + product.buyPrice * product.stock,
    0
  );
  const lowStockShortage = lowStockProducts.reduce(
    (sum, product) => sum + shortageToMinimum(product),
    0
  );
  const lowStockEmptyCount = lowStockProducts.filter((product) => product.stock <= 0).length;
  const categoryRows = categoryCounts(
    metric === "produk_aktif" ? sellableProducts : products
  );
  const lowStockRows = [...lowStockProducts]
    .sort((a, b) => shortageToMinimum(b) - shortageToMinimum(a) || a.stock - b.stock)
    .slice(0, 8);
  const valueRows = [...products]
    .filter((product) => product.stock > 0)
    .sort((a, b) => b.buyPrice * b.stock - a.buyPrice * a.stock)
    .slice(0, 8);
  const activeRows = [...sellableProducts].sort((a, b) => b.stock - a.stock).slice(0, 8);

  const metricValue =
    metric === "total_sku"
      ? `${products.length} produk`
      : metric === "stok_menipis"
        ? `${lowStockProducts.length} item`
        : metric === "nilai_stok"
          ? canViewInventoryValue
            ? formatCurrency(totalInventoryValue)
            : "Tidak tersedia"
          : `${sellableProducts.length} siap jual`;

  return (
    <Dialog
      open={metric !== null}
      onOpenChange={(open) => {
        if (!open) onClose();
      }}
    >
      <DialogContent className="sm:max-w-lg">
        {metric ? (
          <>
            <DialogHeader>
              <DialogTitle className="text-lg">{titles[metric]}</DialogTitle>
              <DialogDescription>{descriptions[metric]}</DialogDescription>
            </DialogHeader>

            <ScrollArea className="max-h-[62vh]">
              <div className="space-y-4 pr-2">
                <div className="rounded-2xl border border-primary/15 bg-primary/5 p-4 dark:bg-primary/10">
                  <div className="flex items-center gap-2 text-sm text-muted-foreground">
                    {metric === "total_sku" ? (
                      <Boxes className="size-4 text-primary" />
                    ) : metric === "stok_menipis" ? (
                      <AlertTriangle className="size-4 text-amber-500" />
                    ) : metric === "nilai_stok" ? (
                      <CircleDollarSign className="size-4 text-emerald-500" />
                    ) : (
                      <PackageCheck className="size-4 text-primary" />
                    )}
                    Data inventaris aktif
                  </div>
                  <p className="mt-2 font-heading text-3xl font-semibold">{metricValue}</p>
                  <p className="mt-1 text-xs text-muted-foreground">
                    Dihitung dari produk yang sedang tercatat dan belum dalam proses hapus.
                  </p>
                </div>

                <div className="rounded-xl border border-border/60 p-3">
                  {metric === "total_sku" ? (
                    <>
                      <SummaryRow label="Produk tercatat" value={`${products.length} produk`} />
                      <SummaryRow
                        label="Produk siap jual"
                        value={`${sellableProducts.length} produk`}
                        tone="positive"
                      />
                      <SummaryRow
                        label="Produk stok kosong"
                        value={`${outOfStockProducts.length} produk`}
                        tone={outOfStockProducts.length > 0 ? "danger" : "positive"}
                      />
                      <SummaryRow label="Total unit stok" value={`${totalStockUnits} pcs`} />
                    </>
                  ) : null}

                  {metric === "stok_menipis" ? (
                    <>
                      <SummaryRow
                        label="Item stok <= stok minimum"
                        value={`${lowStockProducts.length} item`}
                        tone={lowStockProducts.length > 0 ? "warn" : "positive"}
                      />
                      <SummaryRow
                        label="Item stok kosong"
                        value={`${lowStockEmptyCount} item`}
                        tone={lowStockEmptyCount > 0 ? "danger" : "positive"}
                      />
                      <SummaryRow
                        label="Defisit sampai stok minimum"
                        value={`${lowStockShortage} pcs`}
                        tone={lowStockShortage > 0 ? "warn" : "positive"}
                      />
                    </>
                  ) : null}

                  {metric === "nilai_stok" ? (
                    <>
                      <SummaryRow
                        label="Nilai modal stok"
                        value={
                          canViewInventoryValue
                            ? formatCurrency(totalInventoryValue)
                            : "Tidak tersedia"
                        }
                        tone="positive"
                      />
                      <SummaryRow label="Total unit stok" value={`${totalStockUnits} pcs`} />
                      <SummaryRow
                        label="Produk dengan stok > 0"
                        value={`${sellableProducts.length} produk`}
                      />
                    </>
                  ) : null}

                  {metric === "produk_aktif" ? (
                    <>
                      <SummaryRow
                        label="Produk siap jual"
                        value={`${sellableProducts.length} produk`}
                        tone="positive"
                      />
                      <SummaryRow
                        label="Produk stok kosong"
                        value={`${outOfStockProducts.length} produk`}
                        tone={outOfStockProducts.length > 0 ? "danger" : "positive"}
                      />
                      <SummaryRow
                        label="Total unit tersedia"
                        value={`${sellableProducts.reduce((sum, product) => sum + product.stock, 0)} pcs`}
                      />
                    </>
                  ) : null}
                </div>

                {metric === "stok_menipis" ? (
                  <div className="space-y-2">
                    <p className="text-xs font-medium text-muted-foreground">
                      Produk yang perlu dicek
                    </p>
                    {lowStockRows.length > 0 ? (
                      <ProductList products={lowStockRows} />
                    ) : (
                      <EmptyState text="Tidak ada produk yang berada di bawah atau sama dengan stok minimum." />
                    )}
                  </div>
                ) : null}

                {metric === "nilai_stok" ? (
                  <div className="space-y-2">
                    <p className="text-xs font-medium text-muted-foreground">
                      Kontributor nilai stok terbesar
                    </p>
                    {canViewInventoryValue ? (
                      <ProductList products={valueRows} showValue />
                    ) : (
                      <EmptyState text="Nilai stok tidak ditampilkan untuk peran ini." />
                    )}
                  </div>
                ) : null}

                {metric === "produk_aktif" ? (
                  <div className="space-y-2">
                    <p className="text-xs font-medium text-muted-foreground">
                      Produk siap jual dengan stok terbanyak
                    </p>
                    <ProductList products={activeRows} />
                  </div>
                ) : null}

                {metric === "total_sku" || metric === "produk_aktif" ? (
                  <div className="space-y-2">
                    <p className="text-xs font-medium text-muted-foreground">
                      Rincian kategori
                    </p>
                    {categoryRows.length > 0 ? (
                      categoryRows.map(([category, data]) => (
                        <div
                          key={category}
                          className="rounded-xl border border-border/60 p-3 text-sm"
                        >
                          <div className="flex items-center justify-between gap-3">
                            <span className="font-medium">{category}</span>
                            <span className="tabular-nums">{data.count} produk</span>
                          </div>
                          <div className="mt-2 flex items-center justify-between gap-3 text-xs text-muted-foreground">
                            <span>{data.stock} pcs stok</span>
                            {canViewInventoryValue ? (
                              <span>{formatCurrency(data.value)}</span>
                            ) : null}
                          </div>
                        </div>
                      ))
                    ) : (
                      <EmptyState text="Belum ada kategori produk yang tercatat." />
                    )}
                  </div>
                ) : null}

                {metric === "total_sku" ? (
                  <div className="grid gap-3 sm:grid-cols-2">
                    <div className="rounded-xl border border-border/60 p-3">
                      <div className="flex items-center gap-2 text-xs text-muted-foreground">
                        <PackageCheck className="size-3.5 text-primary" />
                        Siap jual
                      </div>
                      <p className="mt-2 text-sm font-medium">
                        {sellableProducts.length} dari {products.length} produk
                      </p>
                    </div>
                    <div className="rounded-xl border border-border/60 p-3">
                      <div className="flex items-center gap-2 text-xs text-muted-foreground">
                        <PackageX className="size-3.5 text-red-500" />
                        Stok kosong
                      </div>
                      <p className="mt-2 text-sm font-medium">
                        {outOfStockProducts.length} produk
                      </p>
                    </div>
                  </div>
                ) : null}

                {metric === "stok_menipis" ? (
                  <div className="rounded-xl border border-border/60 p-3">
                    <div className="flex items-center gap-2 text-sm font-medium">
                      <Warehouse className="size-4 text-primary" />
                      Dasar status
                    </div>
                    <p className="mt-3 text-sm text-muted-foreground">
                      Status menipis memakai aturan sistem: stok produk saat ini kurang dari
                      atau sama dengan stok minimum produk tersebut.
                    </p>
                  </div>
                ) : null}
              </div>
            </ScrollArea>
          </>
        ) : null}
      </DialogContent>
    </Dialog>
  );
}
