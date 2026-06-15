"use client";

import { CheckCircle2, Clock, Eye, Package, Receipt } from "lucide-react";
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
import { useAppState } from "@/components/providers/app-state-provider";
import {
  ReceiptScanner,
  type ReceiptScanResult,
} from "@/components/tokomu/receipt-scanner";
import { RestockConfirmForm } from "@/components/tokomu/restock-confirm-form";
import { formatCurrency, formatDateTime } from "@/lib/format";

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

// --- History list panel ---
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

// --- Single history batch card ---
function HistoryBatchCard({ batch }: Readonly<{ batch: HistoryBatch }>) {
  const [isOpen, setIsOpen] = useState(false);
  const totalQty = batch.items.reduce((sum, item) => sum + item.quantity, 0);
  const totalValue = batch.items.reduce(
    (sum, item) => sum + item.quantity * (item.unitCost ?? 0),
    0
  );

  return (
    <Dialog open={isOpen} onOpenChange={setIsOpen}>
      <DialogTrigger
        render={
          <button
            type="button"
            className="flex w-full items-center gap-3 rounded-2xl border border-border/50 bg-card/60 px-4 py-3 text-left transition-all hover:border-primary/30 hover:bg-primary/5 hover:shadow-sm"
          />
        }
      >
        <div className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary">
          <Receipt className="size-5" />
        </div>
        <div className="min-w-0 flex-1">
          <p className="text-sm font-medium">
            {batch.items.length} item direstok
          </p>
          <p className="mt-0.5 text-xs text-muted-foreground">
            {formatDateTime(batch.createdAt)} · {totalQty} unit
            {totalValue > 0 ? ` · ${formatCurrency(totalValue)}` : ""}
          </p>
        </div>
        <Eye className="size-4 shrink-0 text-muted-foreground" />
      </DialogTrigger>

      <DialogContent className="sm:max-w-lg max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Receipt className="size-5 text-primary" />
            Detail scan struk
          </DialogTitle>
          <DialogDescription>
            {formatDateTime(batch.createdAt)} · {batch.items.length} item
          </DialogDescription>
        </DialogHeader>

        {/* Receipt image preview */}
        {batch.receiptImageUrl && (
          <div className="rounded-xl border border-border/40 bg-card/50 p-3">
            <p className="mb-2 text-xs font-medium text-muted-foreground">Foto struk</p>
            <div className="max-h-[60vh] overflow-auto rounded-lg bg-muted/20">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={batch.receiptImageUrl}
                alt="Struk restok"
                className="mx-auto h-auto max-w-none rounded-lg object-contain"
              />
            </div>
          </div>
        )}

        {/* Items list */}
        <div className="space-y-2">
          <p className="text-xs font-medium text-muted-foreground">Item yang direstok</p>
          <div className="max-h-52 space-y-1.5 overflow-y-auto">
            {batch.items.map((item) => (
              <div
                key={item.id}
                className="flex items-center gap-3 rounded-xl border border-border/40 bg-card/40 px-3 py-2"
              >
                <div className="flex size-8 shrink-0 items-center justify-center rounded-lg bg-accent/20 text-accent-foreground">
                  <Package className="size-4" />
                </div>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium">
                    {item.productName ?? item.productId}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    +{item.quantity} unit
                    {item.unitCost ? ` · ${formatCurrency(item.unitCost)}/unit` : ""}
                  </p>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* OCR changes summary */}
        {batch.ocrRaw?.originalItems && batch.ocrRaw?.editedItems && (
          <div className="space-y-2">
            <p className="text-xs font-medium text-muted-foreground">Perubahan dari struk asli</p>
            <div className="max-h-40 space-y-1.5 overflow-y-auto">
              {batch.ocrRaw.editedItems.map((edited, idx) => {
                const original = batch.ocrRaw?.originalItems?.[idx];
                const changed =
                  original &&
                  (original.rawName !== edited.rawName ||
                    original.quantity !== edited.quantity ||
                    (original.unitPrice ?? 0) !== (edited.unitPrice ?? 0));

                if (!changed && !original) return null;

                return (
                  <div
                    key={`diff-${idx}`}
                    className="rounded-lg border border-border/30 bg-muted/30 px-3 py-2 text-xs"
                  >
                    {changed ? (
                      <>
                        <p className="text-muted-foreground line-through">
                          {original?.rawName} — {original?.quantity} {original?.unit ?? "unit"}
                          {original?.unitPrice ? ` × ${formatCurrency(original.unitPrice)}` : ""}
                        </p>
                        <p className="font-medium text-foreground">
                          → {edited.rawName} — {edited.quantity} {edited.unit ?? "unit"}
                          {edited.unitPrice ? ` × ${formatCurrency(edited.unitPrice)}` : ""}
                        </p>
                      </>
                    ) : (
                      <p className="text-muted-foreground">
                        {edited.rawName} — {edited.quantity} {edited.unit ?? "unit"}
                        {edited.unitPrice ? ` × ${formatCurrency(edited.unitPrice)}` : ""}
                        <span className="ml-1 text-accent-foreground">(tidak diubah)</span>
                      </p>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        )}
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
      // silently fail — history is not critical
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
