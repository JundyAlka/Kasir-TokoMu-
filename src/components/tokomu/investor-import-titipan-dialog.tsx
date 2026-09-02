"use client";

import { useState, useRef, useMemo } from "react";
import { useRouter } from "next/navigation";
import {
  AlertTriangle,
  ArrowRight,
  Boxes,
  CheckCircle2,
  ChevronDown,
  ChevronUp,
  FileSpreadsheet,
  FolderOpen,
  GitMerge,
  Loader2,
  Package,
  Plus,
  RefreshCw,
  Sparkles,
  Trash2,
  UploadCloud,
  Users,
  X,
} from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
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
import type {
  TitipanImportPreview,
  InvestorTitipanGroup,
} from "@/lib/server/investor-titipan-import";

export type ClientInvestorGroup = InvestorTitipanGroup & {
  id: string;
};

export function InvestorImportTitipanDialog() {
  const router = useRouter();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [open, setOpen] = useState(false);
  const [file, setFile] = useState<File | null>(null);
  const [isLoadingPreview, setIsLoadingPreview] = useState(false);
  const [isCommitting, setIsCommitting] = useState(false);
  const [preview, setPreview] = useState<TitipanImportPreview | null>(null);
  const [groups, setGroups] = useState<ClientInvestorGroup[]>([]);
  const [expandedGroups, setExpandedGroups] = useState<Record<string, boolean>>({});

  function resetState() {
    setFile(null);
    setPreview(null);
    setGroups([]);
    setExpandedGroups({});
    if (fileInputRef.current) fileInputRef.current.value = "";
  }

  function handleOpenChange(nextOpen: boolean) {
    setOpen(nextOpen);
    if (!nextOpen && !isCommitting) {
      resetState();
    }
  }

  async function handleFileSelect(selectedFile: File) {
    setFile(selectedFile);
    await uploadAndPreview(selectedFile);
  }

  async function uploadAndPreview(fileToUpload?: File) {
    setIsLoadingPreview(true);
    try {
      let response: Response;
      if (fileToUpload) {
        const formData = new FormData();
        formData.append("file", fileToUpload);
        response = await fetch("/api/investors/import-titipan/preview", {
          method: "POST",
          body: formData,
        });
      } else {
        // Use default file path on server
        response = await fetch("/api/investors/import-titipan/preview", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ useDefaultFile: true }),
        });
      }

      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.error ?? "Gagal memproses pratinjau file.");
      }

      const prevData = data.preview as TitipanImportPreview;
      setPreview(prevData);

      const clientGroups: ClientInvestorGroup[] = prevData.groups.map((g, idx) => ({
        ...g,
        id: `grp-${idx}-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
      }));
      setGroups(clientGroups);

      // Expand top 3 groups by default using stable id
      const initialExpanded: Record<string, boolean> = {};
      clientGroups.slice(0, 3).forEach((g) => {
        initialExpanded[g.id] = true;
      });
      setExpandedGroups(initialExpanded);

      toast.success(
        `Pratinjau siap: ${prevData.totalProducts} produk titipan terdeteksi dalam ${prevData.totalInvestors} kelompok mitra.`
      );
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Gagal memuat pratinjau.");
    } finally {
      setIsLoadingPreview(false);
    }
  }

  function toggleExpand(groupId: string) {
    setExpandedGroups((prev) => ({
      ...prev,
      [groupId]: !prev[groupId],
    }));
  }

  function handleInvestorNameChange(groupId: string, newName: string) {
    setGroups((prev) =>
      prev.map((g) => (g.id === groupId ? { ...g, investorName: newName } : g))
    );
  }

  // Gabungkan seluruh kelompok sourceGroupId ke kelompok targetGroupId
  function mergeGroupInto(sourceGroupId: string, targetGroupId: string) {
    setGroups((prev) => {
      const sourceGroup = prev.find((g) => g.id === sourceGroupId);
      const targetGroup = prev.find((g) => g.id === targetGroupId);
      if (!sourceGroup || !targetGroup || sourceGroup.id === targetGroup.id) return prev;

      const mergedItems = [...targetGroup.items, ...sourceGroup.items];
      const updatedTarget: ClientInvestorGroup = {
        ...targetGroup,
        items: mergedItems,
        itemCount: mergedItems.length,
        totalStock: mergedItems.reduce((acc, i) => acc + i.stock, 0),
        totalBuyValue: mergedItems.reduce((acc, i) => acc + i.buyPrice * i.stock, 0),
        totalSellValue: mergedItems.reduce((acc, i) => acc + i.sellPrice * i.stock, 0),
      };

      const copy = prev
        .filter((g) => g.id !== sourceGroupId)
        .map((g) => (g.id === targetGroupId ? updatedTarget : g));

      setExpandedGroups((exp) => ({ ...exp, [targetGroupId]: true }));
      toast.success(
        `Berhasil menggabungkan ${sourceGroup.items.length} barang dari "${sourceGroup.investorName}" ke dalam "${targetGroup.investorName}".`
      );
      return copy;
    });
  }

  // Pindahkan 1 item individual dari kelompok sourceGroupId ke targetGroupId
  function moveItemToGroup(sourceGroupId: string, itemIdx: number, targetGroupId: string) {
    setGroups((prev) => {
      const sourceGroup = prev.find((g) => g.id === sourceGroupId);
      const targetGroup = prev.find((g) => g.id === targetGroupId);
      if (!sourceGroup || !targetGroup || sourceGroup.id === targetGroup.id) return prev;
      const itemToMove = sourceGroup.items[itemIdx];
      if (!itemToMove) return prev;

      const remainingItems = sourceGroup.items.filter((_, idx) => idx !== itemIdx);

      let nextList: ClientInvestorGroup[];
      if (remainingItems.length === 0) {
        nextList = prev.filter((g) => g.id !== sourceGroupId);
      } else {
        nextList = prev.map((g) =>
          g.id === sourceGroupId
            ? {
                ...sourceGroup,
                items: remainingItems,
                itemCount: remainingItems.length,
                totalStock: remainingItems.reduce((acc, i) => acc + i.stock, 0),
                totalBuyValue: remainingItems.reduce((acc, i) => acc + i.buyPrice * i.stock, 0),
                totalSellValue: remainingItems.reduce((acc, i) => acc + i.sellPrice * i.stock, 0),
              }
            : g
        );
      }

      const updatedTarget: ClientInvestorGroup = {
        ...targetGroup,
        items: [...targetGroup.items, itemToMove],
        itemCount: targetGroup.items.length + 1,
        totalStock: targetGroup.totalStock + itemToMove.stock,
        totalBuyValue: targetGroup.totalBuyValue + itemToMove.buyPrice * itemToMove.stock,
        totalSellValue: targetGroup.totalSellValue + itemToMove.sellPrice * itemToMove.stock,
      };

      setExpandedGroups((exp) => ({ ...exp, [targetGroupId]: true }));
      toast.success(`"${itemToMove.productName}" dipindahkan ke mitra "${targetGroup.investorName}".`);
      return nextList.map((g) => (g.id === targetGroupId ? updatedTarget : g));
    });
  }

  // Pisahkan 1 item menjadi kelompok mitra baru mandiri
  function separateItemToNewGroup(sourceGroupId: string, itemIdx: number) {
    setGroups((prev) => {
      const sourceGroup = prev.find((g) => g.id === sourceGroupId);
      if (!sourceGroup) return prev;
      const itemToMove = sourceGroup.items[itemIdx];
      if (!itemToMove) return prev;

      const remainingItems = sourceGroup.items.filter((_, idx) => idx !== itemIdx);
      const newGroupId = `grp-new-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
      const defaultName = itemToMove.productName.trim();

      const newGroup: ClientInvestorGroup = {
        id: newGroupId,
        investorName: defaultName,
        partnerType: "titipan_bagihasil",
        itemCount: 1,
        totalStock: itemToMove.stock,
        totalBuyValue: itemToMove.buyPrice * itemToMove.stock,
        totalSellValue: itemToMove.sellPrice * itemToMove.stock,
        items: [itemToMove],
      };

      let nextList: ClientInvestorGroup[];
      if (remainingItems.length === 0) {
        nextList = prev.filter((g) => g.id !== sourceGroupId);
      } else {
        const updatedSource: ClientInvestorGroup = {
          ...sourceGroup,
          items: remainingItems,
          itemCount: remainingItems.length,
          totalStock: remainingItems.reduce((acc, i) => acc + i.stock, 0),
          totalBuyValue: remainingItems.reduce((acc, i) => acc + i.buyPrice * i.stock, 0),
          totalSellValue: remainingItems.reduce((acc, i) => acc + i.sellPrice * i.stock, 0),
        };
        nextList = prev.map((g) => (g.id === sourceGroupId ? updatedSource : g));
      }

      const sourceIndex = prev.findIndex((g) => g.id === sourceGroupId);
      if (sourceIndex !== -1 && sourceIndex < nextList.length) {
        nextList.splice(sourceIndex + 1, 0, newGroup);
      } else {
        nextList.push(newGroup);
      }

      setExpandedGroups((exp) => ({ ...exp, [newGroupId]: true }));
      toast.success(
        `"${itemToMove.productName}" dipisahkan ke kelompok mitra baru. Anda dapat langsung mengubah nama mitranya.`
      );
      return nextList;
    });
  }

  // Tambah kelompok mitra kosong baru
  function addNewEmptyGroup() {
    const newGroupId = `grp-custom-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
    const newGroup: ClientInvestorGroup = {
      id: newGroupId,
      investorName: "Mitra Baru",
      partnerType: "titipan_bagihasil",
      itemCount: 0,
      totalStock: 0,
      totalBuyValue: 0,
      totalSellValue: 0,
      items: [],
    };

    setGroups((prev) => [newGroup, ...prev]);
    setExpandedGroups((exp) => ({ ...exp, [newGroupId]: true }));
    toast.info("Kelompok mitra baru ditambahkan di paling atas. Silakan ubah nama mitranya.");
  }

  // Hapus kelompok
  function deleteGroup(groupId: string) {
    setGroups((prev) => prev.filter((g) => g.id !== groupId));
    toast.info("Kelompok mitra berhasil dihapus.");
  }

  // Satukan semua grup yang namanya identik
  function autoMergeIdenticalNames() {
    setGroups((prev) => {
      const map = new Map<string, ClientInvestorGroup>();
      let mergedCount = 0;

      for (const g of prev) {
        const key = g.investorName.trim().toLowerCase();
        if (!key) continue;
        const existing = map.get(key);
        if (existing) {
          mergedCount += 1;
          const mergedItems = [...existing.items, ...g.items];
          existing.items = mergedItems;
          existing.itemCount = mergedItems.length;
          existing.totalStock += g.totalStock;
          existing.totalBuyValue += g.totalBuyValue;
          existing.totalSellValue += g.totalSellValue;
        } else {
          map.set(key, { ...g, items: [...g.items] });
        }
      }

      if (mergedCount > 0) {
        toast.success(`Berhasil menyatukan ${mergedCount} kelompok yang bernama sama.`);
      } else {
        toast.info("Tidak ada kelompok dengan nama yang sama persis.");
      }
      return [...map.values()];
    });
  }

  // Cek apakah ada kelompok dengan nama identik
  const hasDuplicateNames = useMemo(() => {
    const seen = new Set<string>();
    for (const g of groups) {
      const key = g.investorName.trim().toLowerCase();
      if (seen.has(key)) return true;
      seen.add(key);
    }
    return false;
  }, [groups]);

  async function handleCommit() {
    if (!groups.length) return;
    setIsCommitting(true);
    try {
      // Satukan grup dengan nama yang sama sebelum kirim ke backend
      const consolidatedMap = new Map<string, InvestorTitipanGroup>();
      for (const g of groups) {
        const key = g.investorName.trim().toLowerCase();
        if (!key) continue;
        const existing = consolidatedMap.get(key);
        if (existing) {
          existing.items.push(...g.items);
          existing.itemCount = existing.items.length;
          existing.totalStock += g.totalStock;
          existing.totalBuyValue += g.totalBuyValue;
          existing.totalSellValue += g.totalSellValue;
        } else {
          consolidatedMap.set(key, { ...g, items: [...g.items] });
        }
      }
      const finalGroups = [...consolidatedMap.values()];

      const response = await fetch("/api/investors/import-titipan/commit", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ groups: finalGroups }),
      });

      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.error ?? "Gagal menyimpan data investor titipan.");
      }

      toast.success(
        `Berhasil menyimpan: ${data.createdInvestorsCount} mitra baru, ${data.createdInvestmentsCount} barang titip jual, dan ${data.createdProductsCount} produk baru di inventaris!`
      );
      setOpen(false);
      resetState();
      router.refresh();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Gagal menyimpan data.");
    } finally {
      setIsCommitting(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogTrigger render={<Button variant="outline" size="lg" className="rounded-2xl gap-2 font-medium" />}>
        <FileSpreadsheet className="size-4 text-emerald-600 dark:text-emerald-400" />
        Impor Produk Titipan
      </DialogTrigger>

      <DialogContent className="w-[96vw] max-w-[1360px] sm:max-w-[96vw] md:max-w-[96vw] lg:max-w-[1360px] h-[92vh] max-h-[92vh] flex flex-col p-4 sm:p-6 rounded-[28px] shadow-2xl overflow-hidden">
        <DialogHeader className="pb-3 border-b border-border/60">
          <DialogTitle className="font-heading text-2xl flex items-center gap-2.5">
            <span className="p-2 rounded-xl bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20">
              <Boxes className="size-5" />
            </span>
            Impor Investor &amp; Barang Titipan
          </DialogTitle>
          <DialogDescription className="text-sm text-muted-foreground">
            Unggah file catatan produk titipan (.xlsx) untuk secara otomatis mencatat mitra konsinyasi
            beserta barang titip jual ke dalam sistem TokoMu.
          </DialogDescription>
        </DialogHeader>

        <div className="flex-1 overflow-y-auto py-4 space-y-5 pr-1">
          {/* Upload Area */}
          {!preview && !isLoadingPreview && (
            <div className="space-y-4">
              <div
                onClick={() => fileInputRef.current?.click()}
                onDragOver={(e) => e.preventDefault()}
                onDrop={(e) => {
                  e.preventDefault();
                  if (e.dataTransfer.files?.[0]) {
                    void handleFileSelect(e.dataTransfer.files[0]);
                  }
                }}
                className="border-2 border-dashed border-border/80 hover:border-emerald-500/60 bg-muted/20 hover:bg-emerald-500/5 rounded-3xl p-8 text-center transition-all cursor-pointer flex flex-col items-center justify-center gap-3"
              >
                <input
                  ref={fileInputRef}
                  type="file"
                  accept=".xlsx,.xls"
                  className="hidden"
                  onChange={(e) => {
                    if (e.target.files?.[0]) {
                      void handleFileSelect(e.target.files[0]);
                    }
                  }}
                />
                <div className="size-14 rounded-2xl bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 flex items-center justify-center shadow-xs">
                  <UploadCloud className="size-7" />
                </div>
                <div>
                  <p className="font-semibold text-base text-foreground">
                    Tarik file Excel ke sini atau klik untuk memilih file
                  </p>
                  <p className="text-xs text-muted-foreground mt-1">
                    Mendukung format spreadsheet (.xlsx, .xls) dengan kolom Nama Produk, Kategori, Harga Beli, Harga Jual, dan Stok
                  </p>
                </div>
              </div>

              {/* Quick default loader button */}
              <div className="flex items-center justify-center pt-1">
                <Button
                  type="button"
                  variant="secondary"
                  size="sm"
                  className="rounded-xl gap-2 font-semibold text-xs h-9 bg-muted/60 hover:bg-muted"
                  onClick={() => void uploadAndPreview()}
                >
                  <Sparkles className="size-3.5 text-amber-500" />
                  Gunakan File Titipan TokoMu (Agustus 2026)
                </Button>
              </div>
            </div>
          )}

          {/* Loading Indicator */}
          {isLoadingPreview && (
            <div className="py-14 text-center space-y-3">
              <Loader2 className="size-8 animate-spin text-emerald-600 mx-auto" />
              <p className="font-semibold text-foreground">Membedah file &amp; mengelompokkan mitra investor...</p>
              <p className="text-xs text-muted-foreground">
                Sistem sedang mencocokkan produk dengan inventaris toko dan mendeteksi nama mitra.
              </p>
            </div>
          )}

          {/* Preview Content */}
          {preview && !isLoadingPreview && (
            <div className="space-y-5">
              {/* Summary Cards */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                <div className="p-3.5 rounded-2xl bg-muted/40 border border-border/60">
                  <span className="text-xs text-muted-foreground flex items-center gap-1.5 font-medium">
                    <Package className="size-3.5 text-emerald-500" />
                    Total Produk
                  </span>
                  <p className="font-heading text-xl font-bold text-foreground mt-1">
                    {preview.totalProducts} <span className="text-xs font-normal text-muted-foreground">barang</span>
                  </p>
                </div>

                <div className="p-3.5 rounded-2xl bg-muted/40 border border-border/60">
                  <span className="text-xs text-muted-foreground flex items-center gap-1.5 font-medium">
                    <Users className="size-3.5 text-primary" />
                    Mitra Terdaftar
                  </span>
                  <p className="font-heading text-xl font-bold text-foreground mt-1">
                    {groups.length} <span className="text-xs font-normal text-muted-foreground">kelompok</span>
                  </p>
                </div>

                <div className="p-3.5 rounded-2xl bg-muted/40 border border-border/60">
                  <span className="text-xs text-muted-foreground flex items-center gap-1.5 font-medium">
                    <Boxes className="size-3.5 text-amber-500" />
                    Total Stok Titipan
                  </span>
                  <p className="font-heading text-xl font-bold text-foreground mt-1">
                    {preview.totalStock} <span className="text-xs font-normal text-muted-foreground">unit</span>
                  </p>
                </div>

                <div className="p-3.5 rounded-2xl bg-muted/40 border border-border/60">
                  <span className="text-xs text-muted-foreground flex items-center gap-1.5 font-medium">
                    <CheckCircle2 className="size-3.5 text-emerald-500" />
                    Modal Titipan
                  </span>
                  <p className="font-heading text-xl font-bold text-emerald-600 dark:text-emerald-400 mt-1">
                    {formatCurrency(preview.totalInvestmentValue)}
                  </p>
                </div>
              </div>

              {/* Status Info Alert */}
              <div className="flex flex-wrap items-center justify-between gap-3 p-3.5 rounded-2xl bg-emerald-500/10 border border-emerald-500/20 text-xs text-emerald-950 dark:text-emerald-200">
                <div className="flex items-center gap-2">
                  <Sparkles className="size-4 shrink-0 text-emerald-600 dark:text-emerald-400" />
                  <span>
                    <strong>{preview.totalCatalogMatched}</strong> produk cocok dengan inventaris toko, dan{" "}
                    <strong>{preview.totalNewProducts}</strong> produk baru akan otomatis didaftarkan ke katalog barang.
                  </span>
                </div>
                <div className="flex items-center gap-2">
                  {hasDuplicateNames && (
                    <Button
                      type="button"
                      size="sm"
                      className="h-7 text-xs rounded-lg bg-emerald-700 hover:bg-emerald-800 text-white gap-1 font-semibold"
                      onClick={autoMergeIdenticalNames}
                    >
                      <GitMerge className="size-3" />
                      Satukan Nama Sama
                    </Button>
                  )}
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    className="h-7 text-xs rounded-lg text-emerald-800 dark:text-emerald-200 hover:bg-emerald-500/20"
                    onClick={resetState}
                  >
                    <RefreshCw className="size-3 mr-1" />
                    Pilih file lain
                  </Button>
                </div>
              </div>

              {/* Grouped Accordion per Investor */}
              <div className="space-y-3">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div>
                    <h4 className="font-heading font-semibold text-base">
                      Rincian Mitra &amp; Barang Titip Jual ({groups.length} Mitra)
                    </h4>
                    <p className="text-xs text-muted-foreground mt-0.5">
                      💡 Gunakan dropdown <strong>↳ Gabungkan kelompok ini ke...</strong> untuk menyatukan mitra, atau klik <strong>Pindah &gt; ✨ + Buat Mitra Baru</strong> untuk memisahkan barang ke mitra sendiri!
                    </p>
                  </div>
                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    className="h-8 text-xs rounded-xl font-semibold gap-1.5 border-primary/50 text-primary hover:bg-primary/10 shadow-2xs"
                    onClick={addNewEmptyGroup}
                  >
                    <Plus className="size-3.5" />
                    + Tambah Kelompok Mitra Baru
                  </Button>
                </div>

                <div className="space-y-3">
                  {groups.map((group, gIdx) => {
                    const isExpanded = expandedGroups[group.id] ?? false;

                    return (
                      <div
                        key={group.id}
                        className="rounded-2xl border border-border/70 bg-card overflow-hidden transition-all shadow-2xs"
                      >
                        {/* Group Header */}
                        <div className="flex flex-wrap items-center justify-between gap-3 p-3.5 bg-muted/30 border-b border-border/40">
                          <div className="flex items-start gap-3 flex-1 min-w-[280px]">
                            <span className="size-7 rounded-xl bg-primary/10 text-primary flex items-center justify-center font-bold text-xs shrink-0 mt-1">
                              #{gIdx + 1}
                            </span>
                            <div className="flex-1 space-y-1.5">
                              <div className="flex flex-wrap items-center justify-between gap-2">
                                <Label className="text-[10px] text-muted-foreground font-medium">
                                  Nama Mitra / Investor
                                </Label>

                                {/* Fitur Gabungkan ke Kelompok Lain */}
                                <div className="flex items-center gap-1.5">
                                  <GitMerge className="size-3.5 text-emerald-600 dark:text-emerald-400" />
                                  <select
                                    aria-label={`Gabungkan kelompok ${group.investorName} ke mitra lain`}
                                    className="text-xs h-7 rounded-lg bg-background border border-emerald-500/50 text-emerald-800 dark:text-emerald-300 font-semibold px-2 py-0.5 cursor-pointer hover:border-emerald-600 focus:ring-1 focus:ring-emerald-500 shadow-2xs"
                                    value=""
                                    onChange={(e) => {
                                      if (e.target.value) {
                                        mergeGroupInto(group.id, e.target.value);
                                      }
                                    }}
                                  >
                                    <option value="">↳ Gabungkan kelompok ini ke...</option>
                                    {groups
                                      .filter((other) => other.id !== group.id)
                                      .map((other) => (
                                        <option key={other.id} value={other.id}>
                                          Ke: {other.investorName} ({other.itemCount} barang)
                                        </option>
                                      ))}
                                  </select>
                                </div>
                              </div>

                              <Input
                                value={group.investorName}
                                onChange={(e) => handleInvestorNameChange(group.id, e.target.value)}
                                className="h-8.5 text-xs font-semibold rounded-lg bg-background w-full max-w-md shadow-2xs"
                                placeholder="Nama Mitra / Vendor"
                              />
                            </div>
                          </div>

                          <div className="flex items-center gap-2 shrink-0">
                            {group.itemCount === 0 && (
                              <Button
                                type="button"
                                variant="ghost"
                                size="sm"
                                className="h-8 text-xs text-destructive hover:bg-destructive/10 rounded-lg gap-1 px-2.5 font-medium"
                                onClick={() => deleteGroup(group.id)}
                                title="Hapus kelompok kosong ini"
                              >
                                <Trash2 className="size-3.5" />
                                Hapus Kelompok
                              </Button>
                            )}
                            <Badge variant="secondary" className="text-xs px-2.5 py-1 font-medium">
                              {group.itemCount} barang
                            </Badge>
                            <Badge variant="outline" className="text-xs px-2.5 py-1 font-medium">
                              Stok: {group.totalStock}
                            </Badge>
                            <span className="font-bold text-xs text-emerald-600 dark:text-emerald-400 tabular-nums">
                              {formatCurrency(group.totalBuyValue)}
                            </span>
                            <Button
                              type="button"
                              variant="ghost"
                              size="sm"
                              className="h-8 w-8 p-0 rounded-lg text-muted-foreground hover:text-foreground"
                              onClick={() => toggleExpand(group.id)}
                            >
                              {isExpanded ? (
                                <ChevronUp className="size-4" />
                              ) : (
                                <ChevronDown className="size-4" />
                              )}
                            </Button>
                          </div>
                        </div>

                        {/* Items Table (Visible if expanded) */}
                        {isExpanded && (
                          <div className="p-3 overflow-x-auto">
                            <Table>
                              <TableHeader>
                                <TableRow className="hover:bg-transparent">
                                  <TableHead className="w-10">No</TableHead>
                                  <TableHead>Nama Barang Titipan</TableHead>
                                  <TableHead>Kategori</TableHead>
                                  <TableHead className="text-right">Harga Beli</TableHead>
                                  <TableHead className="text-right">Harga Jual</TableHead>
                                  <TableHead className="text-center">Stok</TableHead>
                                  <TableHead className="text-right">Margin Toko</TableHead>
                                  <TableHead className="text-center">Katalog</TableHead>
                                  <TableHead className="text-center min-w-[170px] w-48">Pindah Mitra</TableHead>
                                </TableRow>
                              </TableHeader>
                              <TableBody>
                                {group.items.length === 0 ? (
                                  <TableRow>
                                    <TableCell colSpan={9} className="text-center py-6 text-muted-foreground text-xs">
                                      Kelompok ini belum memiliki barang. Pindahkan barang dari kelompok lain ke sini menggunakan dropdown &quot;Pindah...&quot; pada tabel barang.
                                    </TableCell>
                                  </TableRow>
                                ) : (
                                  group.items.map((item, iIdx) => (
                                    <TableRow key={`${group.id}-item-${iIdx}`} className="text-xs">
                                      <TableCell className="text-muted-foreground font-mono">
                                        {iIdx + 1}
                                      </TableCell>
                                      <TableCell className="font-semibold text-foreground">
                                        {item.productName}
                                        {item.description && (
                                          <p className="text-[11px] text-muted-foreground font-normal line-clamp-1">
                                            {item.description}
                                          </p>
                                        )}
                                      </TableCell>
                                      <TableCell className="text-muted-foreground">
                                        {item.category}
                                      </TableCell>
                                      <TableCell className="text-right tabular-nums">
                                        {formatCurrency(item.buyPrice)}
                                      </TableCell>
                                      <TableCell className="text-right tabular-nums font-medium">
                                        {formatCurrency(item.sellPrice)}
                                      </TableCell>
                                      <TableCell className="text-center tabular-nums font-semibold">
                                        {item.stock}
                                      </TableCell>
                                      <TableCell className="text-right tabular-nums font-semibold text-emerald-600 dark:text-emerald-400">
                                        +{formatCurrency(item.unitMargin)}
                                      </TableCell>
                                      <TableCell className="text-center">
                                        {item.existsInCatalog ? (
                                          <Badge
                                            variant="outline"
                                            className="text-[10px] bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/30"
                                          >
                                            Di Inventaris
                                          </Badge>
                                        ) : (
                                          <Badge
                                            variant="outline"
                                            className="text-[10px] bg-sky-500/10 text-sky-600 dark:text-sky-400 border-sky-500/30"
                                          >
                                            + Buat Baru
                                          </Badge>
                                        )}
                                      </TableCell>
                                      <TableCell className="text-center">
                                        <select
                                          aria-label={`Pindahkan ${item.productName}`}
                                          className="text-xs h-7.5 rounded-lg bg-background border border-border/80 hover:border-primary px-2 text-foreground font-medium cursor-pointer w-full min-w-[160px] shadow-2xs"
                                          value=""
                                          onChange={(e) => {
                                            if (e.target.value === "__SEPARATE_NEW_GROUP__") {
                                              separateItemToNewGroup(group.id, iIdx);
                                            } else if (e.target.value) {
                                              moveItemToGroup(group.id, iIdx, e.target.value);
                                            }
                                          }}
                                          title="Pindahkan barang ini ke mitra lain atau buat kelompok mitra baru"
                                        >
                                          <option value="">Pindah...</option>
                                          <option
                                            value="__SEPARATE_NEW_GROUP__"
                                            className="font-bold text-emerald-600 dark:text-emerald-400"
                                          >
                                            ✨ + Buat Mitra Baru untuk Barang Ini
                                          </option>
                                          {groups
                                            .filter((other) => other.id !== group.id)
                                            .map((other) => (
                                              <option key={other.id} value={other.id}>
                                                Ke: {other.investorName} ({other.itemCount} barang)
                                              </option>
                                            ))}
                                        </select>
                                      </TableCell>
                                    </TableRow>
                                  ))
                                )}
                              </TableBody>
                            </Table>
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>
          )}
        </div>

        <DialogFooter className="pt-3 border-t border-border/60 flex flex-wrap items-center justify-between gap-2">
          <Button
            type="button"
            variant="outline"
            className="rounded-xl h-10 text-xs font-semibold"
            disabled={isCommitting}
            onClick={() => setOpen(false)}
          >
            Batal
          </Button>

          {preview && (
            <Button
              type="button"
              className="rounded-xl h-10 text-xs font-semibold bg-emerald-600 hover:bg-emerald-700 text-white gap-2 shadow-xs"
              disabled={isCommitting || !groups.length}
              onClick={() => void handleCommit()}
            >
              {isCommitting ? (
                <Loader2 className="size-4 animate-spin" />
              ) : (
                <CheckCircle2 className="size-4" />
              )}
              Konfirmasi &amp; Simpan Semua ({groups.length} Mitra)
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
