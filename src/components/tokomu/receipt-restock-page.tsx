"use client";

import { CheckCircle2 } from "lucide-react";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { useAppState } from "@/components/providers/app-state-provider";
import {
  ReceiptScanner,
  type ReceiptScanResult,
} from "@/components/tokomu/receipt-scanner";
import { RestockConfirmForm } from "@/components/tokomu/restock-confirm-form";

type CommitResult = {
  restockedCount: number;
  totalQuantity: number;
  logs: Array<{ id: string; productId: string; quantity: number }>;
};

type Step = "upload" | "confirming" | "success";

export function ReceiptRestockPage() {
  const { products } = useAppState();
  const [step, setStep] = useState<Step>("upload");
  const [scanResult, setScanResult] = useState<ReceiptScanResult | null>(null);
  const [commitResult, setCommitResult] = useState<CommitResult | null>(null);

  if (step === "success" && commitResult) {
    return (
      <Card className="border-border/60 bg-card/80">
        <CardHeader>
          <div className="mb-2 flex size-12 items-center justify-center rounded-2xl bg-accent text-accent-foreground">
            <CheckCircle2 className="size-6" />
          </div>
          <CardTitle className="font-heading text-2xl">Restok berhasil disimpan</CardTitle>
          <CardDescription>
            Stok produk sudah bertambah dan log restok AI OCR sudah tercatat.
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
                {commitResult.totalQuantity} pcs
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
    );
  }

  if (step === "confirming" && scanResult) {
    return (
      <RestockConfirmForm
        imageDataUrl={scanResult.imageDataUrl}
        items={scanResult.items}
        products={products}
        onCancel={() => setStep("upload")}
        onSuccess={(result) => {
          setCommitResult(result);
          setStep("success");
        }}
      />
    );
  }

  return (
    <ReceiptScanner
      onScanned={(result) => {
        setScanResult(result);
        setStep("confirming");
      }}
    />
  );
}
