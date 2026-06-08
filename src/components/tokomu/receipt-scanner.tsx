"use client";

import { useRef, useState } from "react";
import { Camera, FileImage, Loader2, UploadCloud, X } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import type { Product } from "@/lib/types";

export type ReceiptScanConfidence = "high" | "medium" | "low" | "none";

export type ReceiptScanItem = {
  rawName: string;
  quantity: number;
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

  async function handleFile(file?: File | null) {
    if (!file) return;
    if (!file.type.startsWith("image/")) {
      toast.error("File harus berupa gambar struk.");
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
      onScanned({ imageDataUrl, items: data.items });
      toast.success(`${data.items.length} item struk berhasil dibaca.`);
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
          accept="image/*"
          className="hidden"
          onChange={(event) => void handleFile(event.target.files?.[0])}
        />
        <input
          ref={cameraRef}
          type="file"
          accept="image/*"
          capture="environment"
          className="hidden"
          onChange={(event) => void handleFile(event.target.files?.[0])}
        />

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
                Gambar akan dikompresi otomatis sebelum dikirim ke AI.
              </p>
            </>
          )}
        </button>

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
            {isAnalyzing ? <Loader2 className="size-4 animate-spin" /> : <Camera className="size-4" />}
            Analisis Struk
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
