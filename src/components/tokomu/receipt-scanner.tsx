"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import {
  Camera,
  CheckCircle2,
  FileImage,
  Loader2,
  RefreshCw,
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
type VideoFacingMode = "environment" | "user";

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
  {
    label: "Mengunggah gambar struk...",
    detail: "Mengkompresi dan mempersiapkan gambar untuk AI",
    icon: UploadCloud,
  },
  {
    label: "Membaca teks struk...",
    detail: "AI sedang mengenali tulisan dan angka pada struk",
    icon: ScanSearch,
  },
  {
    label: "Menganalisis item belanja...",
    detail: "Mencocokkan setiap baris item dengan format yang benar",
    icon: Sparkles,
  },
  {
    label: "Mencocokkan dengan produk toko...",
    detail: "Mencari kecocokan produk di inventaris Anda",
    icon: Zap,
  },
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
        Proses analisis biasanya memerlukan 5-15 detik
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
  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const [imageDataUrl, setImageDataUrl] = useState("");
  const [isDragging, setIsDragging] = useState(false);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [scanPhase, setScanPhase] = useState(0);
  const [cameraMode, setCameraMode] = useState<VideoFacingMode>("environment");
  const [isCameraOpen, setIsCameraOpen] = useState(false);
  const [isCameraStarting, setIsCameraStarting] = useState(false);
  const [cameraError, setCameraError] = useState<string | null>(null);

  const stopCameraStream = useCallback(() => {
    streamRef.current?.getTracks().forEach((track) => track.stop());
    streamRef.current = null;
    if (videoRef.current) {
      videoRef.current.srcObject = null;
    }
  }, []);

  const closeCamera = useCallback(() => {
    stopCameraStream();
    setIsCameraOpen(false);
    setIsCameraStarting(false);
    setCameraError(null);
  }, [stopCameraStream]);

  const openNativeCameraFallback = useCallback((message?: string) => {
    if (message) {
      toast.error(message);
    }
    cameraRef.current?.click();
  }, []);

  const startCamera = useCallback(
    async (facing: VideoFacingMode) => {
      if (typeof navigator === "undefined" || !navigator.mediaDevices?.getUserMedia) {
        openNativeCameraFallback(
          "Browser belum mendukung preview kamera langsung. Membuka kamera bawaan perangkat."
        );
        return;
      }

      setCameraMode(facing);
      setCameraError(null);
      setIsCameraOpen(true);
      setIsCameraStarting(true);
      stopCameraStream();

      try {
        const stream = await navigator.mediaDevices.getUserMedia({
          audio: false,
          video: {
            facingMode: { ideal: facing },
            height: { ideal: 1280 },
            width: { ideal: 960 },
          },
        });

        streamRef.current = stream;
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
          await videoRef.current.play().catch(() => undefined);
        }
      } catch (error) {
        const message =
          error instanceof DOMException && error.name === "NotAllowedError"
            ? "Izin kamera ditolak. Izinkan akses kamera di browser, atau pilih foto dari galeri."
            : "Kamera tidak bisa dibuka. Membuka kamera bawaan perangkat sebagai fallback.";
        setCameraError(message);
        setIsCameraOpen(false);
        openNativeCameraFallback(message);
      } finally {
        setIsCameraStarting(false);
      }
    },
    [openNativeCameraFallback, stopCameraStream]
  );

  const switchCamera = useCallback(() => {
    const nextMode = cameraMode === "environment" ? "user" : "environment";
    void startCamera(nextMode);
  }, [cameraMode, startCamera]);

  const captureCameraPhoto = useCallback(() => {
    const video = videoRef.current;
    if (!video || video.readyState < 2) {
      toast.error("Kamera belum siap. Tunggu preview muncul dulu.");
      return;
    }

    const width = video.videoWidth || 960;
    const height = video.videoHeight || 1280;
    const canvas = document.createElement("canvas");
    canvas.width = width;
    canvas.height = height;
    const context = canvas.getContext("2d");

    if (!context) {
      toast.error("Gagal mengambil gambar dari kamera.");
      return;
    }

    context.drawImage(video, 0, 0, width, height);
    setImageDataUrl(canvas.toDataURL("image/jpeg", 0.86));
    closeCamera();
    toast.success("Foto struk berhasil diambil dari kamera.");
  }, [closeCamera]);

  useEffect(() => {
    return () => {
      stopCameraStream();
    };
  }, [stopCameraStream]);

  useEffect(() => {
    if (!isAnalyzing) {
      setScanPhase(0);
      return;
    }

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
      closeCamera();
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
          Upload foto struk atau buka kamera depan/belakang, lalu analisis dengan AI.
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
          capture={cameraMode}
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
        ) : isCameraOpen ? (
          <div className="space-y-4 rounded-[28px] border border-primary/20 bg-card/60 p-4">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <p className="font-medium">
                  Kamera {cameraMode === "environment" ? "belakang" : "depan"}
                </p>
                <p className="text-sm text-muted-foreground">
                  Posisikan struk di tengah frame, pastikan tulisan cukup terang.
                </p>
              </div>
              <Button
                type="button"
                variant="outline"
                className="h-10 rounded-2xl"
                onClick={switchCamera}
                disabled={isCameraStarting}
              >
                <RefreshCw className="size-4" />
                {cameraMode === "environment" ? "Pakai Kamera Depan" : "Pakai Kamera Belakang"}
              </Button>
            </div>

            <div className="relative overflow-hidden rounded-[24px] border border-border bg-black">
              <video
                ref={videoRef}
                autoPlay
                muted
                playsInline
                className="h-[360px] w-full bg-black object-contain"
              />
              {isCameraStarting ? (
                <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 bg-black/70 text-white">
                  <Loader2 className="size-7 animate-spin" />
                  <p className="text-sm">Membuka kamera...</p>
                </div>
              ) : null}
            </div>

            {cameraError ? (
              <div className="rounded-2xl border border-primary/20 bg-primary/8 px-4 py-3 text-sm text-muted-foreground">
                {cameraError}
              </div>
            ) : null}
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
            {!isCameraOpen ? (
              <>
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
                  onClick={() => void startCamera(cameraMode)}
                >
                  <Camera className="size-4" />
                  Ambil Foto Kamera
                </Button>
              </>
            ) : (
              <>
                <Button
                  type="button"
                  className="h-11 rounded-2xl"
                  onClick={captureCameraPhoto}
                  disabled={isCameraStarting}
                >
                  <Camera className="size-4" />
                  Ambil Foto
                </Button>
                <Button
                  type="button"
                  variant="ghost"
                  className="h-11 rounded-2xl"
                  onClick={closeCamera}
                >
                  <X className="size-4" />
                  Tutup Kamera
                </Button>
              </>
            )}

            {imageDataUrl && !isCameraOpen ? (
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
              disabled={!imageDataUrl || isAnalyzing || isCameraOpen}
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
