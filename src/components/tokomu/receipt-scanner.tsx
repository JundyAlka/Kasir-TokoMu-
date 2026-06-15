"use client";

import { useRef, useState, useEffect } from "react";
import {
  Camera,
  CheckCircle2,
  FileImage,
  Loader2,
  ScanSearch,
  Sparkles,
  UploadCloud,
  X,
  Zap,
} from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import type { Product } from "@/lib/types";

const IMAGE_ACCEPT = "image/png,image/jpeg,image/webp,image/*";
const SUPPORTED_IMAGE_EXTENSIONS = /\.(png|jpe?g|webp)$/i;

export type ReceiptScanConfidence = "high" | "medium" | "low" | "none";

export type ReceiptScanItem = {
  rawName: string;
  quantity: number;
  unit?: string | null;
  unitPrice?: number | null;
  lineTotal?: number | null;
  rawText?: string | null;
  suggestedProduct: Product | null;
  alternatives: Product[];
  confidence: ReceiptScanConfidence;
};

export type ReceiptScanResult = {
  imageDataUrl: string;
  items: ReceiptScanItem[];
};

function readFileAsDataUrl(file: File) {
  return new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result ?? ""));
    reader.onerror = () => reject(reader.error ?? new Error("Gagal membaca file."));
    reader.readAsDataURL(file);
  });
}

async function downsizeImage(file: File) {
  const dataUrl = await readFileAsDataUrl(file);
  const image = await new Promise<HTMLImageElement>((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error("File gambar tidak valid."));
    img.src = dataUrl;
  });

  const maxSide = 1600;
  const scale = Math.min(1, maxSide / Math.max(image.width, image.height));
  const canvas = document.createElement("canvas");
  canvas.width = Math.max(1, Math.round(image.width * scale));
  canvas.height = Math.max(1, Math.round(image.height * scale));
  const context = canvas.getContext("2d");
  if (!context) {
    return dataUrl;
  }

  context.drawImage(image, 0, 0, canvas.width, canvas.height);
  return canvas.toDataURL("image/jpeg", 0.78);
}

function isSupportedImageFile(file: File) {
  return file.type.startsWith("image/") || SUPPORTED_IMAGE_EXTENSIONS.test(file.name);
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

const SCAN_PHASES = [
  { label: "Mengunggah gambar struk…", detail: "Mengkompresi dan mempersiapkan gambar untuk AI", icon: UploadCloud },
  { label: "Membaca teks struk…", detail: "AI sedang mengenali tulisan dan angka pada struk", icon: ScanSearch },
  { label: "Menganalisis item belanja…", detail: "Mencocokkan setiap baris item dengan format yang benar", icon: Sparkles },
  { label: "Mencocokkan dengan produk toko…", detail: "Mencari kecocokan produk di inventaris Anda", icon: Zap },
] as const;

function ScanProgressOverlay({ phase }: Readonly<{ phase: number }>) {
  return (
    <div className="flex flex-col items-center gap-6 py-6">
      <div className="relative">
        <div className="absolute inset-0 animate-ping rounded-full bg-primary/20" />
        <div className="relative flex size-16 items-center justify-center rounded-full bg-primary/15 text-primary">
          <Loader2 className="size-8 animate-spin" />
        </div>
      </div>

      <div className="w-full max-w-sm space-y-4">
        {SCAN_PHASES.map((step, index) => {
          const Icon = step.icon;
          const isDone = index < phase;
          const isActive = index === phase;
          const isPending = index > phase;

          return (
            <div
              key={step.label}
              className={cn(
                "flex items-start gap-3 rounded-2xl border px-4 py-3 transition-all duration-500",
                isDone && "border-accent bg-accent/20",
                isActive && "border-primary/40 bg-primary/8 shadow-sm shadow-primary/10",
                isPending && "border-border/40 bg-card/30 opacity-40"
              )}
            >
              <div
                className={cn(
                  "mt-0.5 flex size-7 shrink-0 items-center justify-center rounded-xl transition-colors",
                  isDone && "bg-accent text-accent-foreground",
                  isActive && "bg-primary/15 text-primary",
                  isPending && "bg-muted/50 text-muted-foreground"
                )}
              >
                {isDone ? (
                  <CheckCircle2 className="size-4" />
                ) : isActive ? (
                  <Icon className="size-4 animate-pulse" />
                ) : (
                  <Icon className="size-4" />
                )}
              </div>
              <div className="min-w-0 flex-1">
                <p
                  className={cn(
                    "text-sm font-medium",
                    isDone && "text-accent-foreground",
                    isActive && "text-foreground",
                    isPending && "text-muted-foreground"
                  )}
                >
                  {step.label}
                </p>
                {(isActive || isDone) && (
                  <p className="mt-0.5 text-xs text-muted-foreground">{step.detail}</p>
                )}
              </div>
              {isActive && (
                <Loader2 className="mt-1 size-4 shrink-0 animate-spin text-primary" />
              )}
            </div>
          );
        })}
      </div>

      <p className="text-center text-sm text-muted-foreground">
        Proses analisis biasanya memerlukan 5–15 detik
      </p>
    </div>
  );
}

export function ReceiptScanner({
  onScanned,
}: Readonly<{
  onScanned: (result: ReceiptScanResult) => void;
}>) {
  const uploadRef = useRef<HTMLInputElement>(null);
  const cameraRef = useRef<HTMLInputElement>(null);
  const [imageDataUrl, setImageDataUrl] = useState("");
  const [isDragging, setIsDragging] = useState(false);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [scanPhase, setScanPhase] = useState(0);

  useEffect(() => {
    if (!isAnalyzing) {
      setScanPhase(0);
      return;
    }

    // Simulate phase progression while waiting for API
    const timers = [
      setTimeout(() => setScanPhase(1), 1200),
      setTimeout(() => setScanPhase(2), 3500),
      setTimeout(() => setScanPhase(3), 6000),
    ];

    return () => timers.forEach(clearTimeout);
  }, [isAnalyzing]);

  async function handleFile(file?: File | null) {
    if (!file) return;
    if (!isSupportedImageFile(file)) {
      toast.error("File harus berupa gambar struk PNG, JPG, atau WebP.");
      return;
    }

    try {
      const nextImage = await downsizeImage(file);
      setImageDataUrl(nextImage);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Gagal membaca gambar.");
    }
  }

  async function handleAnalyze() {
    if (!imageDataUrl) {
      toast.error("Upload atau ambil foto struk lebih dulu.");
      return;
    }

    setIsAnalyzing(true);
    try {
      const data = await requestJson<{ items: ReceiptScanItem[] }>("/api/ai/scan-receipt", {
        method: "POST",
        body: JSON.stringify({ imageDataUrl }),
      });
      const items = Array.isArray(data.items) ? data.items : [];
      if (items.length === 0) {
        throw new Error("AI belum menemukan item dari struk. Coba foto ulang dengan pencahayaan lebih jelas.");
      }

      onScanned({ imageDataUrl, items });
      toast.success(`${items.length} item struk berhasil dibaca.`);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Gagal menganalisis struk.");
    } finally {
      setIsAnalyzing(false);
    }
  }

  return (
    <Card className="border-border/60 bg-card/80">
      <CardHeader>
        <CardTitle className="font-heading text-2xl">Scan struk restok</CardTitle>
        <CardDescription>
          Upload foto struk atau ambil gambar dari kamera belakang, lalu analisis dengan AI.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <input
          ref={uploadRef}
          type="file"
          accept={IMAGE_ACCEPT}
          className="hidden"
          onChange={(event) => {
            const file = event.target.files?.[0];
            event.currentTarget.value = "";
            void handleFile(file);
          }}
        />
        <input
          ref={cameraRef}
          type="file"
          accept={IMAGE_ACCEPT}
          capture="environment"
          className="hidden"
          onChange={(event) => {
            const file = event.target.files?.[0];
            event.currentTarget.value = "";
            void handleFile(file);
          }}
        />

        {isAnalyzing ? (
          <div className="rounded-[28px] border border-primary/20 bg-card/55 p-6">
            <ScanProgressOverlay phase={scanPhase} />
          </div>
        ) : (
          <button
            type="button"
            className={cn(
              "flex min-h-72 w-full flex-col items-center justify-center rounded-[28px] border border-dashed border-border bg-card/55 p-6 text-center transition",
              isDragging && "border-primary bg-primary/8"
            )}
            onClick={() => uploadRef.current?.click()}
            onDragOver={(event) => {
              event.preventDefault();
              setIsDragging(true);
            }}
            onDragLeave={() => setIsDragging(false)}
            onDrop={(event) => {
              event.preventDefault();
              setIsDragging(false);
              void handleFile(event.dataTransfer.files[0]);
            }}
          >
            {imageDataUrl ? (
              <div className="relative">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={imageDataUrl}
                  alt="Preview struk"
                  className="max-h-80 rounded-2xl border border-border object-contain"
                />
                <span className="mt-3 block text-sm text-muted-foreground">
                  Klik area ini untuk mengganti gambar.
                </span>
              </div>
            ) : (
              <>
                <UploadCloud className="size-12 text-muted-foreground" />
                <p className="mt-4 font-heading text-xl font-semibold">Tarik foto struk ke sini</p>
                <p className="mt-2 max-w-md text-sm text-muted-foreground">
                  Format PNG, JPG, atau WebP akan dikompresi otomatis sebelum dikirim ke AI.
                </p>
              </>
            )}
          </button>
        )}

        {!isAnalyzing && (
          <div className="flex flex-col gap-2 sm:flex-row">
            <Button
              type="button"
              variant="outline"
              className="h-11 rounded-2xl"
              onClick={() => uploadRef.current?.click()}
            >
              <FileImage className="size-4" />
              Upload Foto
            </Button>
            <Button
              type="button"
              variant="outline"
              className="h-11 rounded-2xl"
              onClick={() => cameraRef.current?.click()}
            >
              <Camera className="size-4" />
              Ambil Foto Kamera
            </Button>
            {imageDataUrl ? (
              <Button
                type="button"
                variant="ghost"
                className="h-11 rounded-2xl"
                onClick={() => setImageDataUrl("")}
              >
                <X className="size-4" />
                Hapus
              </Button>
            ) : null}
            <Button
              type="button"
              className="h-11 rounded-2xl sm:ml-auto"
              disabled={!imageDataUrl || isAnalyzing}
              onClick={() => void handleAnalyze()}
            >
              <ScanSearch className="size-4" />
              Analisis Struk
            </Button>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
