"use client";

import {
  CheckCircle2,
  Clock,
  Coins,
  Eye,
  FileText,
  Package,
  Receipt,
  Scale,
} from "lucide-react";
import { useCallback, useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { ScrollArea } from "@/components/ui/scroll-area";
import { useAppState } from "@/components/providers/app-state-provider";
import {
  ReceiptScanner,
  type ReceiptScanResult,
} from "@/components/tokomu/receipt-scanner";
import { RestockConfirmForm } from "@/components/tokomu/restock-confirm-form";
import { formatCurrency, formatDateTime } from "@/lib/format";
import { cn } from "@/lib/utils";

type CommitResult = {
  restockedCount: number;
  totalQuantity: number;
  logs: Array<{ id: string; productId: string; quantity: number }>;
};

type HistoryBatch = {
  batchId: string;
  createdAt: string;
  receiptImageUrl: string | null;
  ocrRaw: {
    originalItems?: Array<{
      rawName: string;
      quantity: number;
      unit?: string | null;
      unitPrice?: number | null;
    }>;
    editedItems?: Array<{
      rawName: string;
      quantity: number;
      unit?: string | null;
      unitPrice?: number | null;
      productId?: string;
    }>;
  } | null;
  items: Array<{
    id: string;
    productId: string;
    productName: string | null;
    quantity: number;
    unitCost: number | null;
    source: string;
  }>;
};

type Step = "upload" | "confirming" | "success";

function ScanHistoryPanel({
  history,
  isLoading,
}: Readonly<{
  history: HistoryBatch[];
  isLoading: boolean;
}>) {
  if (isLoading) {
    return (
      <Card className="border-border/60 bg-card/80">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 font-heading text-lg">
            <Clock className="size-5 text-muted-foreground" />
            Riwayat scan struk
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex items-center justify-center py-8">
            <div className="flex flex-col items-center gap-3 text-muted-foreground">
              <div className="size-6 animate-spin rounded-full border-2 border-muted-foreground border-t-transparent" />
              <p className="text-sm">Memuat riwayat...</p>
            </div>
          </div>
        </CardContent>
      </Card>
    );
  }

  if (history.length === 0) {
    return (
      <Card className="border-border/60 bg-card/80">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 font-heading text-lg">
            <Clock className="size-5 text-muted-foreground" />
            Riwayat scan struk
          </CardTitle>
          <CardDescription>Belum ada riwayat scan struk restok.</CardDescription>
        </CardHeader>
      </Card>
    );
  }

  return (
    <Card className="border-border/60 bg-card/80">
      <CardHeader>
        <CardTitle className="flex items-center gap-2 font-heading text-lg">
          <Clock className="size-5 text-muted-foreground" />
          Riwayat scan struk
        </CardTitle>
        <CardDescription>{history.length} scan terakhir</CardDescription>
      </CardHeader>
      <CardContent>
        <div className="max-h-[400px] space-y-2 overflow-y-auto pr-1">
          {history.map((batch) => (
            <HistoryBatchCard key={batch.batchId} batch={batch} />
          ))}
        </div>
      </CardContent>
    </Card>
  );
}

function HistoryBatchCard({ batch }: Readonly<{ batch: HistoryBatch }>) {
  const [isOpen, setIsOpen] = useState(false);
  const restockedByProductId = new Map(batch.items.map((item) => [item.productId, item]));
  const totalQty = batch.items.reduce((sum, item) => sum + item.quantity, 0);
  const totalValue = batch.items.reduce(
    (sum, item) => sum + item.quantity * (item.unitCost ?? 0),
    0
  );
  const averageUnitCost = totalQty > 0 ? totalValue / totalQty : 0;
  const originalItems = batch.ocrRaw?.originalItems ?? [];
  const editedItems = batch.ocrRaw?.editedItems ?? [];
  const changedItems = editedItems.filter((edited, idx) => {
    const original = originalItems[idx];
    return (
      original &&
      (original.rawName !== edited.rawName ||
        original.quantity !== edited.quantity ||
        (original.unitPrice ?? 0) !== (edited.unitPrice ?? 0))
    );
  }).length;

  return (
    <Dialog open={isOpen} onOpenChange={setIsOpen}>
      <DialogTrigger
        render={
          <button
            type="button"
            className="flex w-full items-center gap-3 rounded-2xl border border-border/50 bg-card/60 px-4 py-3 text-left transition-all hover:border-primary/30 hover:bg-primary/5 hover:shadow-sm focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:outline-none"
          />
        }
      >
        <div className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary">
          <Receipt className="size-5" />
        </div>
        <div className="min-w-0 flex-1">
          <p className="text-sm font-medium">{batch.items.length} item direstok</p>
          <p className="mt-0.5 text-xs text-muted-foreground">
            {formatDateTime(batch.createdAt)} - {totalQty} unit
            {totalValue > 0 ? ` - ${formatCurrency(totalValue)}` : ""}
          </p>
        </div>
        <Eye className="size-4 shrink-0 text-muted-foreground" />
      </DialogTrigger>

      <DialogContent className="max-h-[94vh] w-[min(1480px,calc(100vw-2rem))] !max-w-none overflow-hidden rounded-[28px] p-0 sm:!max-w-none">
        <DialogHeader className="border-b border-border/60 px-6 pt-6 pb-5">
          <div className="flex min-w-0 items-start gap-3">
            <div className="flex size-11 shrink-0 items-center justify-center rounded-2xl bg-primary/12 text-primary">
              <Receipt className="size-5" />
            </div>
            <div className="min-w-0">
              <DialogTitle className="font-heading text-2xl">Detail scan struk</DialogTitle>
              <DialogDescription className="mt-1">
                {formatDateTime(batch.createdAt)} - batch {batch.batchId}
              </DialogDescription>
            </div>
          </div>
        </DialogHeader>

        <ScrollArea className="max-h-[calc(94vh-108px)]">
          <div className="space-y-5 px-5 pb-6 sm:px-6">
            <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
              <div className="min-w-0 rounded-2xl border border-border/60 bg-card/70 p-4">
                <div className="flex items-center gap-2 text-xs text-muted-foreground">
                  <Package className="size-3.5 text-primary" />
                  Produk
                </div>
                <p className="mt-2 font-heading text-2xl font-semibold">
                  {batch.items.length}
                </p>
                <p className="text-xs text-muted-foreground">item direstok</p>
              </div>
              <div className="min-w-0 rounded-2xl border border-border/60 bg-card/70 p-4">
                <div className="flex items-center gap-2 text-xs text-muted-foreground">
                  <Scale className="size-3.5 text-primary" />
                  Stok masuk
                </div>
                <p className="mt-2 font-heading text-2xl font-semibold">{totalQty}</p>
                <p className="text-xs text-muted-foreground">unit total</p>
              </div>
              <div className="min-w-0 rounded-2xl border border-border/60 bg-card/70 p-4">
                <div className="flex items-center gap-2 text-xs text-muted-foreground">
                  <Coins className="size-3.5 text-primary" />
                  Estimasi nilai
                </div>
                <p className="mt-2 break-words font-heading text-[1.55rem] leading-tight font-semibold tabular-nums">
                  {totalValue > 0 ? formatCurrency(totalValue) : "-"}
                </p>
                <p className="text-xs text-muted-foreground">
                  {averageUnitCost > 0
                    ? `${formatCurrency(averageUnitCost)}/unit`
                    : "tanpa harga"}
                </p>
              </div>
              <div className="min-w-0 rounded-2xl border border-border/60 bg-card/70 p-4">
                <div className="flex items-center gap-2 text-xs text-muted-foreground">
                  <FileText className="size-3.5 text-primary" />
                  Koreksi OCR
                </div>
                <p className="mt-2 font-heading text-2xl font-semibold">{changedItems}</p>
                <p className="text-xs text-muted-foreground">baris berubah</p>
              </div>
            </div>

            <div className="grid gap-5 xl:grid-cols-[minmax(360px,0.8fr)_minmax(0,0.95fr)_minmax(0,1.05fr)]">
              {batch.receiptImageUrl ? (
                <div className="rounded-2xl border border-border/60 bg-card/60 p-4">
                  <div className="mb-3">
                    <p className="text-sm font-medium">Foto struk</p>
                    <p className="text-xs text-muted-foreground">
                      Ditampilkan penuh dengan mode fit agar mudah dicek ulang.
                    </p>
                  </div>
                  <div className="overflow-hidden rounded-2xl border border-border/60 bg-white">
                    <div className="flex max-h-[64vh] min-h-[320px] items-center justify-center overflow-auto bg-white p-3">
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img
                        src={batch.receiptImageUrl}
                        alt="Struk restok"
                        className="block h-auto max-h-[60vh] w-auto max-w-full object-contain"
                      />
                    </div>
                  </div>
                </div>
              ) : (
                <div className="rounded-2xl border border-dashed border-border/70 bg-muted/35 px-4 py-8 text-center">
                  <Receipt className="mx-auto size-8 text-muted-foreground" />
                  <p className="mt-3 text-sm font-medium">Foto struk tidak tersimpan</p>
                  <p className="mt-1 text-xs text-muted-foreground">
                    Riwayat item tetap bisa dilihat dari data restok yang tercatat.
                  </p>
                </div>
              )}

              <div className="min-w-0 space-y-2">
                <div>
                  <p className="text-sm font-medium">Item yang masuk ke stok</p>
                  <p className="text-xs text-muted-foreground">
                    Data final yang benar-benar ditambahkan ke inventaris.
                  </p>
                </div>
                <div className="max-h-[61vh] min-h-[320px] space-y-2 overflow-y-auto pr-1">
                  {batch.items.map((item) => (
                    <div
                      key={item.id}
                      className="rounded-2xl border border-border/60 bg-card/55 p-3"
                    >
                      <div className="flex items-center gap-3">
                        <div className="flex size-9 shrink-0 items-center justify-center rounded-xl bg-accent/20 text-accent-foreground">
                          <Package className="size-4" />
                        </div>
                        <div className="min-w-0 flex-1">
                          <p className="truncate text-sm font-medium">
                            {item.productName ?? item.productId}
                          </p>
                          <p className="text-xs text-muted-foreground">
                            Sumber: {item.source}
                          </p>
                        </div>
                        <div className="rounded-xl bg-primary/10 px-3 py-2 text-right text-primary">
                          <p className="text-sm font-semibold tabular-nums">+{item.quantity}</p>
                          <p className="text-[11px]">unit</p>
                        </div>
                      </div>
                      <div className="mt-3 flex items-center justify-between gap-3 rounded-xl bg-muted/35 px-3 py-2 text-xs">
                        <span className="text-muted-foreground">Harga/unit</span>
                        <span className="font-medium tabular-nums">
                          {item.unitCost ? formatCurrency(item.unitCost) : "-"}
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              <div className="min-w-0 space-y-2">
                <div>
                  <p className="text-sm font-medium">Scan asli dan hasil koreksi</p>
                  <p className="text-xs text-muted-foreground">
                    Membandingkan hasil OCR awal dengan data final sebelum disimpan.
                  </p>
                </div>
                {originalItems.length > 0 && editedItems.length > 0 ? (
                  <div className="max-h-[61vh] min-h-[320px] space-y-2 overflow-y-auto pr-1">
                    {editedItems.map((edited, idx) => {
                      const original = originalItems[idx];
                      const changed =
                        original &&
                        (original.rawName !== edited.rawName ||
                          original.quantity !== edited.quantity ||
                          (original.unitPrice ?? 0) !== (edited.unitPrice ?? 0));
                      const restockedItem = edited.productId
                        ? restockedByProductId.get(edited.productId)
                        : undefined;

                      if (!changed && !original) return null;

                      return (
                        <div
                          key={`diff-${idx}`}
                          className="rounded-2xl border border-border/60 bg-card/55 p-3 text-xs"
                        >
                          <div className="mb-2 flex items-center justify-between gap-3">
                            <span className="rounded-full bg-muted/45 px-2.5 py-1 text-[11px] text-muted-foreground">
                              Baris {idx + 1}
                            </span>
                            <span
                              className={cn(
                                "rounded-full px-2.5 py-1 text-[11px] font-medium",
                                changed
                                  ? "bg-primary/12 text-primary"
                                  : "bg-accent/16 text-accent-foreground"
                              )}
                            >
                              {changed ? "Diedit" : "Sesuai OCR"}
                            </span>
                          </div>
                          <div className="grid gap-2 md:grid-cols-2 xl:grid-cols-1 2xl:grid-cols-2">
                            <div className="rounded-xl border border-border/50 bg-muted/25 p-3">
                              <p className="mb-1 text-[11px] font-medium text-muted-foreground">
                                Scan asli
                              </p>
                              <p className={cn("font-medium", changed && "text-muted-foreground line-through")}>
                                {original?.rawName ?? "-"}
                              </p>
                              <p className="mt-1 text-muted-foreground">
                                {original?.quantity ?? edited.quantity} {original?.unit ?? edited.unit ?? "unit"}
                                {original?.unitPrice
                                  ? ` x ${formatCurrency(original.unitPrice)}`
                                  : ""}
                              </p>
                            </div>
                            <div className="rounded-xl border border-primary/20 bg-primary/7 p-3">
                              <p className="mb-1 text-[11px] font-medium text-primary">
                                Setelah koreksi
                              </p>
                              <p className="font-medium text-foreground">{edited.rawName}</p>
                              <p className="mt-1 text-muted-foreground">
                                {edited.quantity} {edited.unit ?? "unit"}
                                {edited.unitPrice
                                  ? ` x ${formatCurrency(edited.unitPrice)}`
                                  : ""}
                              </p>
                            </div>
                          </div>
                          {restockedItem ? (
                            <div className="mt-2 rounded-xl bg-accent/12 px-3 py-2 text-accent-foreground">
                              Ditambahkan ke stok: {restockedItem.productName ?? restockedItem.productId} +
                              {restockedItem.quantity} unit
                            </div>
                          ) : null}
                        </div>
                      );
                    })}
                  </div>
                ) : (
                  <div className="rounded-2xl border border-dashed border-border/70 bg-muted/35 px-4 py-8 text-center text-sm text-muted-foreground">
                    Tidak ada data koreksi OCR pada batch ini.
                  </div>
                )}
              </div>
            </div>
          </div>
        </ScrollArea>
      </DialogContent>
    </Dialog>
  );
}

export function ReceiptRestockPage() {
  const { products } = useAppState();
  const [step, setStep] = useState<Step>("upload");
  const [scanResult, setScanResult] = useState<ReceiptScanResult | null>(null);
  const [commitResult, setCommitResult] = useState<CommitResult | null>(null);
  const [history, setHistory] = useState<HistoryBatch[]>([]);
  const [isLoadingHistory, setIsLoadingHistory] = useState(true);

  const fetchHistory = useCallback(async () => {
    setIsLoadingHistory(true);
    try {
      const res = await fetch("/api/restock/history");
      if (!res.ok) throw new Error();
      const data = (await res.json()) as { batches: HistoryBatch[] };
      setHistory(data.batches ?? []);
    } catch {
      // History is supporting context; the scanner can still be used if this fails.
      setHistory([]);
    } finally {
      setIsLoadingHistory(false);
    }
  }, []);

  useEffect(() => {
    void fetchHistory();
  }, [fetchHistory]);

  const knownUnits = history.flatMap((batch) => [
    ...(batch.ocrRaw?.originalItems ?? []).map((item) => item.unit ?? ""),
    ...(batch.ocrRaw?.editedItems ?? []).map((item) => item.unit ?? ""),
  ]);

  if (step === "success" && commitResult) {
    return (
      <div className="space-y-6">
        <Card className="border-border/60 bg-card/80">
          <CardHeader>
            <div className="mb-2 flex size-12 items-center justify-center rounded-2xl bg-accent text-accent-foreground">
              <CheckCircle2 className="size-6" />
            </div>
            <CardTitle className="font-heading text-2xl">Restok berhasil disimpan</CardTitle>
            <CardDescription>
              Stok produk sudah bertambah dan log restok dari struk sudah tercatat.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid gap-3 sm:grid-cols-2">
              <div className="rounded-[22px] border border-border/70 bg-card/75 p-4">
                <p className="text-sm text-muted-foreground">Item direstok</p>
                <p className="mt-2 font-heading text-3xl font-semibold">
                  {commitResult.restockedCount}
                </p>
              </div>
              <div className="rounded-[22px] border border-border/70 bg-card/75 p-4">
                <p className="text-sm text-muted-foreground">Total stok masuk</p>
                <p className="mt-2 font-heading text-3xl font-semibold">
                  {commitResult.totalQuantity} unit
                </p>
              </div>
            </div>
            <div className="flex flex-col gap-2 sm:flex-row">
              <Button
                type="button"
                variant="outline"
                className="rounded-2xl"
                onClick={() => {
                  setScanResult(null);
                  setCommitResult(null);
                  setStep("upload");
                  void fetchHistory();
                }}
              >
                Scan Struk Lagi
              </Button>
              <Button
                type="button"
                className="rounded-2xl"
                onClick={() => {
                  window.location.href = "/inventaris";
                }}
              >
                Kembali ke Inventaris
              </Button>
            </div>
          </CardContent>
        </Card>
        <ScanHistoryPanel history={history} isLoading={isLoadingHistory} />
      </div>
    );
  }

  if (step === "confirming" && scanResult) {
    return (
      <RestockConfirmForm
        imageDataUrl={scanResult.imageDataUrl}
        items={scanResult.items}
        products={products}
        knownUnits={knownUnits}
        onCancel={() => setStep("upload")}
        onSuccess={(result) => {
          setCommitResult(result);
          setStep("success");
        }}
      />
    );
  }

  return (
    <div className="space-y-6">
      <ReceiptScanner
        onScanned={(result) => {
          setScanResult(result);
          setStep("confirming");
        }}
      />
      <ScanHistoryPanel history={history} isLoading={isLoadingHistory} />
    </div>
  );
}
