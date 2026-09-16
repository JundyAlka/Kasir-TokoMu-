"use client";

import Link from "next/link";
import { useDeferredValue, useEffect, useMemo, useRef, useState } from "react";
import {
  AlertTriangle,
  Camera,
  ChevronLeft,
  ChevronRight,
  ChevronsLeft,
  ChevronsRight,
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
  const deferredQuery = useDeferredValue(query);
  const [selectedCategory, setSelectedCategory] = useState<string>("all");
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState<number>(25);
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

  const visibleProducts = useMemo(
    () => products.filter((product) => !pendingDeletedIds.has(product.id)),
    [products, pendingDeletedIds]
  );

  const categories = useMemo(() => {
    const cats = new Set<string>();
    visibleProducts.forEach((p) => {
      if (p.category) cats.add(p.category.trim());
    });
    return Array.from(cats).sort();
  }, [visibleProducts]);

  const filteredProducts = useMemo(() => {
    const keyword = deferredQuery.toLowerCase().trim();
    return visibleProducts.filter((product) => {
      if (selectedCategory === "low_stock") {
        if (product.stock > product.minimumStock) return false;
      } else if (selectedCategory !== "all") {
        if (product.category.toLowerCase() !== selectedCategory.toLowerCase()) return false;
      }

      if (!keyword) return true;

      return (
        product.name.toLowerCase().includes(keyword) ||
        (product.sku ?? "").toLowerCase().includes(keyword) ||
        product.category.toLowerCase().includes(keyword) ||
        product.description.toLowerCase().includes(keyword)
      );
    });
  }, [visibleProducts, deferredQuery, selectedCategory]);

  const totalPages = pageSize === -1 ? 1 : Math.max(1, Math.ceil(filteredProducts.length / pageSize));
  const currentPage = Math.min(page, totalPages);

  const paginatedProducts = useMemo(() => {
    if (pageSize === -1) return filteredProducts;
    const start = (currentPage - 1) * pageSize;
    return filteredProducts.slice(start, start + pageSize);
  }, [filteredProducts, currentPage, pageSize]);

  const totalInventoryValue = useMemo(
    () => visibleProducts.reduce((sum, product) => sum + product.buyPrice * product.stock, 0),
    [visibleProducts]
  );

  const existingSkus = useMemo(
    () => visibleProducts.map((product) => product.sku),
    [visibleProducts]
  );

  const visibleLowStockProducts = useMemo(
    () => lowStockProducts.filter((product) => !pendingDeletedIds.has(product.id)),
    [lowStockProducts, pendingDeletedIds]
  );

  const paginatedProductIds = useMemo(
    () => paginatedProducts.map((product) => product.id),
    [paginatedProducts]
  );

  const selectedProducts = useMemo(
    () => visibleProducts.filter((product) => selectedProductIds.has(product.id)),
    [visibleProducts, selectedProductIds]
  );

  const allPaginatedProductsSelected = areAllIdsSelected(selectedProductIds, paginatedProductIds);
  const hasPartiallySelectedPaginatedProducts =
    paginatedProductIds.some((id) => selectedProductIds.has(id)) && !allPaginatedProductsSelected;
  const canMutateInventory = true;

  useEffect(() => {
    if (selectAllRef.current) {
      selectAllRef.current.indeterminate = hasPartiallySelectedPaginatedProducts;
    }
  }, [hasPartiallySelectedPaginatedProducts]);

  useEffect(() => {
    setPage(1);
  }, [query, selectedCategory]);

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
        <CardHeader className="flex flex-col gap-3.5">
          <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
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
                  placeholder="Cari nama, SKU, atau kategori..."
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
          </div>

          {/* Quick Category Filter Pills */}
          <div className="flex items-center gap-1.5 overflow-x-auto pb-0.5 text-xs no-scrollbar pt-1">
            <button
              type="button"
              onClick={() => setSelectedCategory("all")}
              className={cn(
                "inline-flex items-center gap-1.5 rounded-full px-3 py-1 font-medium transition-all shrink-0 cursor-pointer border",
                selectedCategory === "all"
                  ? "border-primary bg-primary text-primary-foreground shadow-xs"
                  : "border-border/60 bg-muted/40 text-muted-foreground hover:bg-muted hover:text-foreground"
              )}
            >
              Semua
              <span className={cn(
                "rounded-full px-1.5 py-0.2 text-[10px]",
                selectedCategory === "all" ? "bg-primary-foreground/20 text-primary-foreground" : "bg-background/80 text-muted-foreground"
              )}>
                {visibleProducts.length}
              </span>
            </button>

            {visibleLowStockProducts.length > 0 && (
              <button
                type="button"
                onClick={() => setSelectedCategory("low_stock")}
                className={cn(
                  "inline-flex items-center gap-1.5 rounded-full px-3 py-1 font-medium transition-all shrink-0 cursor-pointer border",
                  selectedCategory === "low_stock"
                    ? "border-amber-500 bg-amber-500 text-white shadow-xs"
                    : "border-amber-500/30 bg-amber-500/10 text-amber-700 hover:bg-amber-500/20 dark:text-amber-400"
                )}
              >
                <AlertTriangle className="size-3" />
                Stok Menipis
                <span className="rounded-full bg-amber-500/20 px-1.5 py-0.2 text-[10px] font-bold">
                  {visibleLowStockProducts.length}
                </span>
              </button>
            )}

            {categories.map((cat) => {
              const count = visibleProducts.filter((p) => p.category === cat).length;
              return (
                <button
                  key={cat}
                  type="button"
                  onClick={() => setSelectedCategory(cat)}
                  className={cn(
                    "inline-flex items-center gap-1.5 rounded-full px-3 py-1 font-medium transition-all shrink-0 cursor-pointer border",
                    selectedCategory === cat
                      ? "border-primary bg-primary text-primary-foreground shadow-xs"
                      : "border-border/60 bg-muted/40 text-muted-foreground hover:bg-muted hover:text-foreground"
                  )}
                >
                  {cat}
                  <span className={cn(
                    "rounded-full px-1.5 py-0.2 text-[10px]",
                    selectedCategory === cat ? "bg-primary-foreground/20 text-primary-foreground" : "bg-background/80 text-muted-foreground"
                  )}>
                    {count}
                  </span>
                </button>
              );
            })}
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
          <Table className="w-full">
            <TableHeader>
              <TableRow>
                {canMutateInventory ? (
                  <TableHead className="w-10 px-2">
                    <input
                      ref={selectAllRef}
                      type="checkbox"
                      checked={paginatedProductIds.length > 0 && allPaginatedProductsSelected}
                      onChange={() => setSelectedProductIds((current) => toggleAllIds(current, paginatedProductIds))}
                      aria-label="Pilih semua produk di halaman ini"
                      className="size-4 cursor-pointer accent-primary"
                    />
                  </TableHead>
                ) : null}
                <TableHead className="w-28 px-2">
                  <span className="inline-flex items-center gap-1.5 text-xs">
                    SKU
                    <InfoHint text={FIELD_HELP.sku} label="Penjelasan SKU" side="top" />
                  </span>
                </TableHead>
                <TableHead className="min-w-[130px] max-w-[200px] px-2 text-xs">Produk</TableHead>
                <TableHead className="w-24 px-2 text-xs">Kategori</TableHead>
                {canMutateInventory ? (
                  <TableHead className="w-24 px-2 text-right">
                    <span className="inline-flex items-center justify-end gap-1 text-xs">
                      Harga beli
                      <InfoHint text={FIELD_HELP.costPrice} label="Penjelasan harga beli" side="top" />
                    </span>
                  </TableHead>
                ) : null}
                <TableHead className="w-24 px-2 text-right text-xs">Harga jual</TableHead>
                {canMutateInventory ? (
                  <TableHead className="w-20 px-2 text-right">
                    <span className="inline-flex items-center justify-end gap-1 text-xs">
                      Margin
                      <InfoHint text={FIELD_HELP.margin} label="Penjelasan margin" side="top" />
                    </span>
                  </TableHead>
                ) : null}
                <TableHead className="w-16 px-1.5 text-center text-xs">Stok</TableHead>
                <TableHead className="w-16 px-1.5 text-center">
                  <span className="inline-flex items-center justify-center gap-1 text-xs">
                    Min
                    <InfoHint text={FIELD_HELP.reorderPoint} label="Penjelasan stok minimum" side="top" />
                  </span>
                </TableHead>
                {canMutateInventory ? <TableHead className="w-48 px-2 text-right text-xs">Aksi</TableHead> : null}
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
              ) : (dataState === "loading" && visibleProducts.length === 0) ? (
                Array.from({ length: 6 }).map((_, i) => (
                  <TableRow key={`skeleton-${i}`} className="animate-pulse">
                    {canMutateInventory && (
                      <TableCell className="w-10 px-2">
                        <div className="size-4 rounded bg-muted/60" />
                      </TableCell>
                    )}
                    <TableCell className="w-28 px-2">
                      <div className="h-4 w-20 rounded bg-muted/50" />
                    </TableCell>
                    <TableCell className="min-w-[130px] max-w-[200px] px-2">
                      <div className="space-y-1.5">
                        <div className="h-4 w-32 rounded bg-muted/60" />
                        <div className="h-3 w-20 rounded bg-muted/40" />
                      </div>
                    </TableCell>
                    <TableCell className="w-24 px-2">
                      <div className="h-4 w-16 rounded bg-muted/50" />
                    </TableCell>
                    {canMutateInventory && (
                      <TableCell className="w-24 px-2 text-right">
                        <div className="h-4 w-16 ml-auto rounded bg-muted/50" />
                      </TableCell>
                    )}
                    <TableCell className="w-24 px-2 text-right">
                      <div className="h-4 w-16 ml-auto rounded bg-muted/50" />
                    </TableCell>
                    {canMutateInventory && (
                      <TableCell className="w-20 px-2 text-right">
                        <div className="h-4 w-12 ml-auto rounded bg-muted/50" />
                      </TableCell>
                    )}
                    <TableCell className="w-16 px-1.5 text-center">
                      <div className="h-5 w-8 mx-auto rounded-full bg-muted/60" />
                    </TableCell>
                    <TableCell className="w-16 px-1.5 text-center">
                      <div className="h-4 w-6 mx-auto rounded bg-muted/40" />
                    </TableCell>
                    {canMutateInventory && (
                      <TableCell className="w-48 px-2 text-right">
                        <div className="flex justify-end gap-1.5">
                          <div className="h-7 w-14 rounded-full bg-muted/50" />
                          <div className="h-7 w-16 rounded-full bg-muted/50" />
                          <div className="h-7 w-7 rounded-full bg-muted/40" />
                        </div>
                      </TableCell>
                    )}
                  </TableRow>
                ))
              ) : filteredProducts.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={10} className="h-44 text-center text-muted-foreground">
                    {query || selectedCategory !== "all"
                      ? "Tidak ada produk yang sesuai dengan filter pencarian."
                      : "Belum ada produk di inventaris."}
                  </TableCell>
                </TableRow>
              ) : (
                paginatedProducts.map((product) => {
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
                      <TableCell className="w-10 px-2">
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
                    <TableCell className="w-28 px-2 font-mono text-xs font-medium text-muted-foreground truncate">
                      {sku}
                    </TableCell>
                    <TableCell className="min-w-[130px] max-w-[200px] px-2 whitespace-normal">
                      <div className="min-w-0">
                        <p className="font-medium text-foreground truncate text-xs sm:text-sm">{product.name}</p>
                        {product.description ? (
                          <p className="text-[11px] text-muted-foreground line-clamp-1 mt-0.5">{product.description}</p>
                        ) : null}
                      </div>
                    </TableCell>
                    <TableCell className="w-24 px-2 text-xs">{product.category}</TableCell>
                    {canMutateInventory ? (
                      <TableCell className="w-24 px-2 text-right text-xs tabular-nums">{formatCurrency(product.buyPrice)}</TableCell>
                    ) : null}
                    <TableCell className="w-24 px-2 text-right text-xs font-medium tabular-nums">{formatCurrency(product.sellPrice)}</TableCell>
                    {canMutateInventory ? (
                      <TableCell className="w-20 px-2 text-right text-xs">
                        <span className="font-medium tabular-nums">{formatCurrency(margin)}</span>
                        <span className="ml-1 text-[10px] text-muted-foreground">({marginPct}%)</span>
                      </TableCell>
                    ) : null}
                    <TableCell className="w-16 px-1.5 text-center">
                      <div className="inline-flex items-center gap-1 justify-center">
                        <Badge
                          className={cn(
                            "rounded-full border-0 text-[11px] px-2 py-0.2",
                            lowStock ? "bg-primary text-primary-foreground" : "bg-accent text-accent-foreground"
                          )}
                        >
                          {product.stock}
                        </Badge>
                        {lowStock ? <AlertTriangle className="size-3 text-primary shrink-0" /> : null}
                      </div>
                    </TableCell>
                    <TableCell className="w-16 px-1.5 text-center text-xs text-muted-foreground tabular-nums">{product.minimumStock}</TableCell>
                    {canMutateInventory ? (
                      <TableCell className="w-48 px-2 text-right">
                        <div className="flex justify-end gap-1.5">
                          <Button
                            type="button"
                            variant="outline"
                            size="sm"
                            className="h-7 rounded-full px-2.5 text-xs gap-1"
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
                            <PencilLine className="size-3" />
                            Edit
                          </Button>
                          <Button
                            type="button"
                            variant="secondary"
                            size="sm"
                            className="h-7 rounded-full px-2.5 text-xs gap-1"
                            onClick={() => setRestockTarget(product)}
                          >
                            <Warehouse className="size-3" />
                            Restok
                          </Button>
                          <Button
                            type="button"
                            variant="ghost"
                            size="sm"
                            className="h-7 rounded-full px-2 text-xs text-destructive hover:bg-destructive/10"
                            onClick={() => handleDeleteProduct(product)}
                            aria-label={`Hapus ${product.name}`}
                          >
                            <Trash2 className="size-3.5" />
                          </Button>
                        </div>
                      </TableCell>
                    ) : null}
                  </TableRow>
                );
              })
            )}
            </TableBody>
          </Table>

          {/* Pagination Controls Footer */}
          <div className="mt-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between border-t border-border/40 pt-4 text-xs text-muted-foreground">
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
                        ? "bg-primary text-primary-foreground shadow-xs"
                        : "text-muted-foreground hover:text-foreground"
                    )}
                  >
                    {size === -1 ? "Semua" : size}
                  </button>
                ))}
              </div>
              <span className="hidden sm:inline text-muted-foreground/80 pl-2">
                Menampilkan {filteredProducts.length === 0 ? 0 : (currentPage - 1) * (pageSize === -1 ? filteredProducts.length : pageSize) + 1} -{" "}
                {pageSize === -1 ? filteredProducts.length : Math.min(currentPage * pageSize, filteredProducts.length)} dari{" "}
                {filteredProducts.length} produk
              </span>
            </div>

            {pageSize !== -1 && totalPages > 1 && (
              <div className="flex items-center gap-1.5 self-end sm:self-auto">
                <span className="mr-1 sm:hidden">
                  {currentPage}/{totalPages}
                </span>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  disabled={currentPage <= 1}
                  onClick={() => setPage(1)}
                  className="h-8 w-8 p-0 rounded-lg"
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
                  className="h-8 w-8 p-0 rounded-lg"
                  title="Halaman sebelumnya"
                >
                  <ChevronLeft className="size-3.5" />
                </Button>
                <span className="hidden sm:inline px-2 font-medium text-foreground">
                  Halaman {currentPage} dari {totalPages}
                </span>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  disabled={currentPage >= totalPages}
                  onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                  className="h-8 w-8 p-0 rounded-lg"
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
                  className="h-8 w-8 p-0 rounded-lg"
                  title="Halaman terakhir"
                >
                  <ChevronsRight className="size-3.5" />
                </Button>
              </div>
            )}
          </div>
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
