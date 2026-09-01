"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import {
  AlertTriangle,
  Camera,
  PackagePlus,
  PencilLine,
  Search,
  Trash2,
  Warehouse,
} from "lucide-react";
import { toast } from "sonner";
import { useAppState } from "@/components/providers/app-state-provider";
import { useCurrentRole } from "@/components/role-gate";
import { StatCard } from "@/components/stat-card";
import { InfoHint } from "@/components/tokomu/info-hint";
import { ImportProductDialog } from "@/components/tokomu/import-product-dialog";
import {
  InventorySummaryDetailDialog,
  type InventorySummaryMetric,
} from "@/components/tokomu/inventory-summary-detail-dialog";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { ProductForm } from "@/components/warung/product-form";
import { FIELD_HELP } from "@/lib/field-help";
import { formatCurrency } from "@/lib/format";
import {
  areAllIdsSelected,
  toggleAllIds,
  toggleSelectedId,
} from "@/lib/inventory-selection";
import { generateSku } from "@/lib/sku";
import { Product, ProductDraft } from "@/lib/types";
import { cn } from "@/lib/utils";

const emptyDraft: ProductDraft = {
  sku: "",
  name: "",
  category: "Makanan",
  buyPrice: 0,
  sellPrice: 0,
  stock: 0,
  minimumStock: 0,
  description: "",
};

export function InventarisView() {
  const currentRole = useCurrentRole();
  const {
    products,
    addProduct,
    updateProduct,
    deleteProduct,
    deleteProducts,
    restockProduct,
    lowStockProducts,
    refreshWorkspace,
    dataState,
    retryWorkspace,
  } = useAppState();
  const [query, setQuery] = useState("");
  const [createOpen, setCreateOpen] = useState(false);
  const [draft, setDraft] = useState<ProductDraft>(emptyDraft);
  const [editingProduct, setEditingProduct] = useState<Product | null>(null);
  const [editDraft, setEditDraft] = useState<ProductDraft>(emptyDraft);
  const [restockTarget, setRestockTarget] = useState<Product | null>(null);
  const [restockAmount, setRestockAmount] = useState(12);
  const [newlyAddedIds, setNewlyAddedIds] = useState<string[]>([]);
  const [activeSummaryMetric, setActiveSummaryMetric] =
    useState<InventorySummaryMetric | null>(null);
  const [pendingDeletedIds, setPendingDeletedIds] = useState<Set<string>>(() => new Set());
  const [selectedProductIds, setSelectedProductIds] = useState<Set<string>>(() => new Set());
  const [bulkDeleteOpen, setBulkDeleteOpen] = useState(false);
  const [bulkRestockOpen, setBulkRestockOpen] = useState(false);
  const [bulkRestockAmount, setBulkRestockAmount] = useState(1);
  const [isBulkActionPending, setIsBulkActionPending] = useState(false);
  const deleteTimersRef = useRef(new Map<string, ReturnType<typeof setTimeout>>());
  const selectAllRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const timers = deleteTimersRef.current;
    return () => {
      timers.forEach((timer) => clearTimeout(timer));
      timers.clear();
    };
  }, []);

  const visibleProducts = products.filter((product) => !pendingDeletedIds.has(product.id));

  const filteredProducts = visibleProducts.filter((product) => {
    const keyword = query.toLowerCase();
    return (
      product.name.toLowerCase().includes(keyword) ||
      (product.sku ?? "").toLowerCase().includes(keyword) ||
      product.category.toLowerCase().includes(keyword) ||
      product.description.toLowerCase().includes(keyword)
    );
  });

  const totalInventoryValue = visibleProducts.reduce(
    (sum, product) => sum + product.buyPrice * product.stock,
    0
  );
  const existingSkus = visibleProducts.map((product) => product.sku);
  const visibleLowStockProducts = lowStockProducts.filter(
    (product) => !pendingDeletedIds.has(product.id)
  );
  const filteredProductIds = filteredProducts.map((product) => product.id);
  const selectedProducts = visibleProducts.filter((product) => selectedProductIds.has(product.id));
  const allFilteredProductsSelected = areAllIdsSelected(selectedProductIds, filteredProductIds);
  const hasPartiallySelectedFilteredProducts =
    filteredProductIds.some((id) => selectedProductIds.has(id)) && !allFilteredProductsSelected;
  const canMutateInventory = true;

  useEffect(() => {
    if (selectAllRef.current) {
      selectAllRef.current.indeterminate = hasPartiallySelectedFilteredProducts;
    }
  }, [hasPartiallySelectedFilteredProducts]);

  function validateProduct(nextDraft: ProductDraft) {
    return (
      nextDraft.name.trim().length > 0 &&
      nextDraft.sellPrice > 0 &&
      nextDraft.buyPrice >= 0 &&
      nextDraft.stock >= 0 &&
      nextDraft.minimumStock >= 0
    );
  }

  async function handleCreateProduct() {
    try {
      if (!validateProduct(draft)) {
        toast.error("Lengkapi data produk lebih dulu.");
        return;
      }

      const newProduct = await addProduct(draft);
      setNewlyAddedIds((prev) => [newProduct.id, ...prev]);
      setDraft(emptyDraft);
      setCreateOpen(false);
      toast.success("Produk baru berhasil ditambahkan.");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Gagal menambah produk.");
    }
  }

  async function handleUpdateProduct() {
    try {
      if (!editingProduct || !validateProduct(editDraft)) {
        toast.error("Periksa kembali data yang ingin diperbarui.");
        return;
      }

      await updateProduct(editingProduct.id, editDraft);
      setEditingProduct(null);
      toast.success(`${editDraft.name} berhasil diperbarui.`);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Gagal memperbarui produk.");
    }
  }

  async function handleRestock() {
    try {
      if (!restockTarget || restockAmount <= 0) {
        toast.error("Masukkan jumlah restok yang valid.");
        return;
      }

      await restockProduct(restockTarget.id, restockAmount);
      toast.success(`${restockTarget.name} ditambah ${restockAmount} stok.`);
      setRestockTarget(null);
      setRestockAmount(12);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Gagal menambah stok.");
    }
  }

  function handleDeleteProduct(product: Product) {
    if (deleteTimersRef.current.has(product.id)) {
      return;
    }

    setPendingDeletedIds((current) => {
      const next = new Set(current);
      next.add(product.id);
      return next;
    });

    function undoDelete() {
      const timer = deleteTimersRef.current.get(product.id);
      if (timer) {
        clearTimeout(timer);
      }

      deleteTimersRef.current.delete(product.id);
      setPendingDeletedIds((current) => {
        const next = new Set(current);
        next.delete(product.id);
        return next;
      });
      toast.dismiss(toastId);
    }

    const timer = setTimeout(() => {
      deleteTimersRef.current.delete(product.id);
      void deleteProduct(product.id)
        .then(() => {
          setPendingDeletedIds((current) => {
            const next = new Set(current);
            next.delete(product.id);
            return next;
          });
        })
        .catch((error) => {
          setPendingDeletedIds((current) => {
            const next = new Set(current);
            next.delete(product.id);
            return next;
          });
          toast.error(
            error instanceof Error ? error.message : "Gagal menghapus produk.",
            { position: "bottom-center" }
          );
        });
    }, 3000);

    deleteTimersRef.current.set(product.id, timer);

    const toastId = toast(`${product.name} akan dihapus.`, {
      description: "Klik Urungkan dalam 3 detik jika tidak jadi menghapus.",
      duration: 3000,
      position: "bottom-center",
      action: {
        label: "Urungkan",
        onClick: undoDelete,
      },
    });
  }

  async function handleBulkDeleteProducts() {
    const productIds = selectedProducts.map((product) => product.id);
    if (productIds.length === 0) {
      return;
    }

    setIsBulkActionPending(true);
    try {
      await deleteProducts(productIds);
      setSelectedProductIds(new Set());
      setBulkDeleteOpen(false);
      toast.success(`${productIds.length} produk berhasil dihapus.`);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Gagal menghapus produk terpilih.");
    } finally {
      setIsBulkActionPending(false);
    }
  }

  async function handleBulkRestockProducts() {
    const productIds = selectedProducts.map((product) => product.id);
    if (productIds.length === 0 || bulkRestockAmount <= 0) {
      toast.error("Masukkan jumlah restok yang valid.");
      return;
    }

    setIsBulkActionPending(true);
    const results = await Promise.allSettled(
      productIds.map((id) => restockProduct(id, bulkRestockAmount))
    );
    const failedIds = new Set(
      results.flatMap((result, index) => (result.status === "rejected" ? [productIds[index]] : []))
    );

    setSelectedProductIds(failedIds);
    setIsBulkActionPending(false);
    setBulkRestockOpen(false);

    if (failedIds.size > 0) {
      toast.error(
        `${productIds.length - failedIds.size} produk direstok, ${failedIds.size} produk gagal diperbarui.`
      );
      return;
    }

    setBulkRestockAmount(1);
    toast.success(`${productIds.length} produk berhasil direstok ${bulkRestockAmount} pcs.`);
  }

  return (
    <div className="space-y-4">
      <section className="grid gap-4 md:grid-cols-3">
        <StatCard
          title="Total SKU"
          value={`${visibleProducts.length} produk`}
          description="Produk siap jual yang sedang aktif di warung."
          onClick={() => setActiveSummaryMetric("total_sku")}
          dataState={dataState}
          onRetry={retryWorkspace}
        />
        <StatCard
          title="Stok menipis"
          value={`${visibleLowStockProducts.length} item`}
          description="Pantau dan restok sebelum pelanggan kehabisan pilihan."
          tone="warn"
          onClick={() => setActiveSummaryMetric("stok_menipis")}
          dataState={dataState}
          onRetry={retryWorkspace}
        />
        {canMutateInventory ? (
          <StatCard
            title="Nilai stok"
            value={formatCurrency(totalInventoryValue)}
            description="Perkiraan modal yang sedang tersimpan di inventaris."
            tone="accent"
            onClick={() => setActiveSummaryMetric("nilai_stok")}
            dataState={dataState}
            onRetry={retryWorkspace}
          />
        ) : (
          <StatCard
            title="Produk aktif"
            value={`${visibleProducts.filter((product) => product.stock > 0).length} siap jual`}
            description="Produk yang masih bisa dipilih dari layar kasir."
            tone="accent"
            onClick={() => setActiveSummaryMetric("produk_aktif")}
            dataState={dataState}
            onRetry={retryWorkspace}
          />
        )}
      </section>

      <Card className="border-border/60 bg-card/74 shadow-[0_28px_70px_-45px_rgba(66,38,20,0.55)]">
        <CardHeader className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
          <div>
            <CardTitle className="font-heading text-2xl">Inventaris barang jadi</CardTitle>
            <CardDescription>
              Semua perubahan di layar ini langsung mengubah state mock yang dipakai POS dan laporan.
            </CardDescription>
          </div>

          <div className="flex flex-col gap-3 lg:flex-row lg:items-center">
            <div className="relative w-full min-w-[240px] flex-1 lg:w-auto">
              <Search className="absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                placeholder="Cari nama, kategori, atau catatan"
                className="h-11 w-full rounded-2xl bg-card/85 pl-9"
              />
            </div>
            {canMutateInventory ? (
              <div className="flex flex-wrap items-center gap-2.5 sm:gap-3">
                <Button
                  render={<Link href="/inventaris/restok-ai" />}
                  nativeButton={false}
                  variant="outline"
                  size="lg"
                  className="h-11 shrink-0 rounded-2xl"
                >
                  <Camera className="size-4" />
                  Restok via Scan Struk
                </Button>
                <ImportProductDialog onImportComplete={async (importedProducts) => {
                  await refreshWorkspace();
                  if (importedProducts && importedProducts.length > 0) {
                    const ids = importedProducts.map((p) => p.id);
                    setNewlyAddedIds((prev) => [...ids, ...prev]);
                    
                    if (importedProducts.length <= 5) {
                      toast.success(
                        `${importedProducts.length} produk berhasil ditambahkan: ${importedProducts.map(p => p.name).join(", ")}`, 
                        { duration: 5000 }
                      );
                    } else {
                      toast.success(
                        `${importedProducts.length} produk berhasil ditambahkan secara massal.`, 
                        { duration: 5000 }
                      );
                    }
                  }
                }} />
                <Dialog open={createOpen} onOpenChange={setCreateOpen}>
                  <DialogTrigger
                    render={<Button size="lg" className="h-11 shrink-0 rounded-2xl" />}
                  >
                    <PackagePlus className="size-4" />
                    Tambah barang
                  </DialogTrigger>
                  <DialogContent className="max-h-[92vh] w-full max-w-2xl sm:max-w-2xl md:max-w-3xl overflow-y-auto overflow-x-hidden rounded-[28px] p-0">
                    <DialogHeader className="p-6 pb-2">
                      <DialogTitle className="font-heading text-2xl">Tambah produk baru</DialogTitle>
                      <DialogDescription>
                        Isi data minimum supaya kasir bisa langsung menjual barang ini.
                      </DialogDescription>
                    </DialogHeader>
                    <div className="p-6 pt-2">
                      <ProductForm draft={draft} onChange={setDraft} existingSkus={existingSkus} />
                    </div>
                    <DialogFooter
                      className="m-0 flex flex-col-reverse gap-2 rounded-b-[28px] border-t bg-muted/50 px-6 py-4 sm:flex-row sm:justify-end"
                      showCloseButton
                    >
                      <Button type="button" onClick={() => void handleCreateProduct()}>
                        Simpan produk
                      </Button>
                    </DialogFooter>
                  </DialogContent>
                </Dialog>
              </div>
            ) : null}
          </div>
        </CardHeader>
        <CardContent>
          {canMutateInventory && selectedProducts.length > 0 ? (
            <div className="mb-4 flex flex-col gap-3 rounded-2xl border border-primary/20 bg-primary/5 p-3 sm:flex-row sm:items-center sm:justify-between">
              <p className="text-sm font-medium">
                {selectedProducts.length} produk terpilih
              </p>
              <div className="flex flex-wrap gap-2">
                <Button type="button" variant="outline" onClick={() => setSelectedProductIds(new Set())}>
                  Batalkan pilihan
                </Button>
                <Button type="button" variant="secondary" onClick={() => setBulkRestockOpen(true)}>
                  <Warehouse className="size-4" />
                  Restok terpilih
                </Button>
                <Button type="button" variant="destructive" onClick={() => setBulkDeleteOpen(true)}>
                  <Trash2 className="size-4" />
                  Hapus terpilih
                </Button>
              </div>
            </div>
          ) : null}
          <Table className="min-w-[760px]">
            <TableHeader>
              <TableRow>
                {canMutateInventory ? (
                  <TableHead className="w-12 px-3">
                    <input
                      ref={selectAllRef}
                      type="checkbox"
                      checked={allFilteredProductsSelected}
                      onChange={() => setSelectedProductIds((current) => toggleAllIds(current, filteredProductIds))}
                      aria-label="Pilih semua produk yang terlihat"
                      className="size-4 cursor-pointer accent-primary"
                    />
                  </TableHead>
                ) : null}
                <TableHead>
                  <span className="inline-flex items-center gap-2">
                    SKU
                    <InfoHint text={FIELD_HELP.sku} label="Penjelasan SKU" side="top" />
                  </span>
                </TableHead>
                <TableHead>Produk</TableHead>
                <TableHead>Kategori</TableHead>
                {canMutateInventory ? (
                  <TableHead>
                    <span className="inline-flex items-center gap-2">
                      Harga beli
                      <InfoHint text={FIELD_HELP.costPrice} label="Penjelasan harga beli" side="top" />
                    </span>
                  </TableHead>
                ) : null}
                <TableHead>Harga jual</TableHead>
                {canMutateInventory ? (
                  <TableHead>
                    <span className="inline-flex items-center gap-2">
                      Margin
                      <InfoHint text={FIELD_HELP.margin} label="Penjelasan margin" side="top" />
                    </span>
                  </TableHead>
                ) : null}
                <TableHead>Stok</TableHead>
                <TableHead>
                  <span className="inline-flex items-center gap-2">
                    Stok min
                    <InfoHint text={FIELD_HELP.reorderPoint} label="Penjelasan stok minimum" side="top" />
                  </span>
                </TableHead>
                {canMutateInventory ? <TableHead className="text-right">Aksi</TableHead> : null}
              </TableRow>
            </TableHeader>
            <TableBody>
              {dataState === "error" ? (
                <TableRow>
                  <TableCell colSpan={10}>
                    <div role="alert" className="flex min-h-44 flex-col items-center justify-center gap-3 text-center">
                      <p className="font-medium">Gagal memuat data, coba lagi</p>
                      <Button type="button" variant="outline" onClick={retryWorkspace}>Muat ulang</Button>
                    </div>
                  </TableCell>
                </TableRow>
              ) : dataState === "loading" ? (
                <TableRow>
                  <TableCell colSpan={10} className="h-44 text-center text-muted-foreground">Memuat inventaris...</TableCell>
                </TableRow>
              ) : filteredProducts.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={10} className="h-44 text-center text-muted-foreground">Belum ada produk di inventaris.</TableCell>
                </TableRow>
              ) : filteredProducts.map((product) => {
                const lowStock = product.stock <= product.minimumStock;
                const sku = product.sku || generateSku(product.name, product.category);
                const margin = Math.max(0, product.sellPrice - product.buyPrice);
                const marginPct = product.sellPrice > 0 ? Math.round((margin / product.sellPrice) * 100) : 0;

                return (
                  <TableRow 
                    key={product.id} 
                    className={cn(
                      lowStock && "bg-primary/6",
                      newlyAddedIds.includes(product.id) && "bg-emerald-500/15 transition-colors duration-1000 dark:bg-emerald-500/20"
                    )}
                  >
                    {canMutateInventory ? (
                      <TableCell className="px-3">
                        <input
                          type="checkbox"
                          checked={selectedProductIds.has(product.id)}
                          onChange={() =>
                            setSelectedProductIds((current) => toggleSelectedId(current, product.id))
                          }
                          aria-label={`Pilih ${product.name}`}
                          className="size-4 cursor-pointer accent-primary"
                        />
                      </TableCell>
                    ) : null}
                    <TableCell className="font-mono text-xs font-medium text-muted-foreground">
                      {sku}
                    </TableCell>
                    <TableCell className="min-w-[220px]">
                      <div>
                        <p className="font-medium">{product.name}</p>
                        <p className="text-sm text-muted-foreground">{product.description}</p>
                      </div>
                    </TableCell>
                    <TableCell>{product.category}</TableCell>
                    {canMutateInventory ? <TableCell>{formatCurrency(product.buyPrice)}</TableCell> : null}
                    <TableCell>{formatCurrency(product.sellPrice)}</TableCell>
                    {canMutateInventory ? (
                      <TableCell>
                        <span className="font-medium">{formatCurrency(margin)}</span>
                        <span className="ml-1 text-xs text-muted-foreground">({marginPct}%)</span>
                      </TableCell>
                    ) : null}
                    <TableCell>
                      <div className="flex items-center gap-2">
                        <Badge
                          className={cn(
                            "rounded-full border-0",
                            lowStock ? "bg-primary text-primary-foreground" : "bg-accent text-accent-foreground"
                          )}
                        >
                          {product.stock} pcs
                        </Badge>
                        {lowStock ? <AlertTriangle className="size-4 text-primary" /> : null}
                      </div>
                    </TableCell>
                    <TableCell>{product.minimumStock} pcs</TableCell>
                    {canMutateInventory ? (
                      <TableCell className="text-right">
                        <div className="flex justify-end gap-2">
                          <Button
                            type="button"
                            variant="outline"
                            className="rounded-full"
                            onClick={() => {
                              setEditingProduct(product);
                              setEditDraft({
                                sku: product.sku ?? "",
                                name: product.name,
                                category: product.category,
                                buyPrice: product.buyPrice,
                                sellPrice: product.sellPrice,
                                stock: product.stock,
                                minimumStock: product.minimumStock,
                                description: product.description,
                              });
                            }}
                          >
                            <PencilLine className="size-4" />
                            Edit
                          </Button>
                          <Button
                            type="button"
                            variant="secondary"
                            className="rounded-full"
                            onClick={() => setRestockTarget(product)}
                          >
                            <Warehouse className="size-4" />
                            Restok
                          </Button>
                          <Button
                            type="button"
                            variant="destructive"
                            className="rounded-full"
                            onClick={() => handleDeleteProduct(product)}
                          >
                            <Trash2 className="size-4" />
                            Hapus
                          </Button>
                        </div>
                      </TableCell>
                    ) : null}
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <Dialog open={Boolean(editingProduct)} onOpenChange={(open) => !open && setEditingProduct(null)}>
        <DialogContent className="max-h-[92vh] w-full max-w-2xl sm:max-w-2xl md:max-w-3xl overflow-y-auto overflow-x-hidden rounded-[28px] p-0">
          <DialogHeader className="p-6 pb-2">
            <DialogTitle className="font-heading text-2xl">Edit produk</DialogTitle>
            <DialogDescription>Perbarui stok, harga, atau posisi minimum sebelum notifikasi muncul.</DialogDescription>
          </DialogHeader>
          <div className="p-6 pt-2">
            <ProductForm
              draft={editDraft}
              onChange={setEditDraft}
              existingSkus={existingSkus.filter((sku) => sku !== editingProduct?.sku)}
            />
          </div>
          <DialogFooter
            className="m-0 flex flex-col-reverse gap-2 rounded-b-[28px] border-t bg-muted/50 px-6 py-4 sm:flex-row sm:justify-end"
            showCloseButton
          >
            <Button type="button" onClick={() => void handleUpdateProduct()}>
              Simpan perubahan
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={Boolean(restockTarget)} onOpenChange={(open) => !open && setRestockTarget(null)}>
        <DialogContent className="max-h-[90vh] w-full max-w-md sm:max-w-md md:max-w-lg overflow-y-auto overflow-x-hidden rounded-[28px] p-0">
          <DialogHeader className="p-6 pb-2">
            <DialogTitle className="font-heading text-2xl">Restok barang</DialogTitle>
            <DialogDescription>
              Tambahkan stok untuk {restockTarget?.name ?? "produk terpilih"}.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 p-6 pt-2">
            <div className="rounded-[22px] border border-border/70 bg-card/75 p-4">
              <p className="text-sm text-muted-foreground">Stok sekarang</p>
              <p className="mt-2 font-heading text-3xl font-semibold">
                {restockTarget?.stock ?? 0} pcs
              </p>
            </div>
            <div className="grid gap-2">
              <Label htmlFor="restock-amount">Jumlah tambahan stok</Label>
              <Input
                id="restock-amount"
                type="number"
                min={1}
                value={restockAmount}
                onChange={(event) => setRestockAmount(Number(event.target.value))}
                className="h-11 rounded-2xl"
              />
            </div>
          </div>
          <DialogFooter
            className="m-0 flex flex-col-reverse gap-2 rounded-b-[28px] border-t bg-muted/50 px-6 py-4 sm:flex-row sm:justify-end"
            showCloseButton
          >
            <Button type="button" onClick={() => void handleRestock()}>
              Simpan restok
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={bulkRestockOpen} onOpenChange={setBulkRestockOpen}>
        <DialogContent className="w-full max-w-md rounded-[28px]">
          <DialogHeader>
            <DialogTitle className="font-heading text-2xl">Restok produk terpilih</DialogTitle>
            <DialogDescription>
              Tambahkan jumlah stok yang sama ke {selectedProducts.length} produk yang dipilih.
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-2">
            <Label htmlFor="bulk-restock-amount">Jumlah tambahan stok per produk</Label>
            <Input
              id="bulk-restock-amount"
              type="number"
              min={1}
              value={bulkRestockAmount}
              onChange={(event) => setBulkRestockAmount(Number(event.target.value))}
              className="h-11 rounded-2xl"
            />
          </div>
          <DialogFooter>
            <Button
              type="button"
              disabled={isBulkActionPending}
              onClick={() => void handleBulkRestockProducts()}
            >
              {isBulkActionPending ? "Menyimpan..." : "Simpan restok"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={bulkDeleteOpen} onOpenChange={setBulkDeleteOpen}>
        <DialogContent className="w-full max-w-md rounded-[28px]">
          <DialogHeader>
            <DialogTitle className="font-heading text-2xl">Hapus produk terpilih?</DialogTitle>
            <DialogDescription>
              {selectedProducts.length} produk akan dihapus permanen dari inventaris. Aksi ini tidak dapat dibatalkan.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button type="button" variant="outline" disabled={isBulkActionPending} onClick={() => setBulkDeleteOpen(false)}>
              Batal
            </Button>
            <Button
              type="button"
              variant="destructive"
              disabled={isBulkActionPending}
              onClick={() => void handleBulkDeleteProducts()}
            >
              <Trash2 className="size-4" />
              {isBulkActionPending ? "Menghapus..." : "Hapus produk"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <InventorySummaryDetailDialog
        canViewInventoryValue={canMutateInventory}
        lowStockProducts={visibleLowStockProducts}
        metric={activeSummaryMetric}
        onClose={() => setActiveSummaryMetric(null)}
        products={visibleProducts}
      />
    </div>
  );
}
