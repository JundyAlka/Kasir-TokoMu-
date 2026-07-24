"use client";

import { useCallback, useRef, useState } from "react";
import {
  CheckCircle2,
  Download,
  FileSpreadsheet,
  Loader2,
  Upload,
  XCircle,
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
import { cn } from "@/lib/utils";

interface ImportResult {
  success: boolean;
  imported: number;
  failed: number;
  skipped: number;
  products: Array<{ id: string; name: string; sku: string }>;
  errors: string[];
  mappedColumns: Record<string, string>;
}

function generateTemplateCSV(): string {
  const headers = [
    "Nama Produk",
    "Kategori",
    "Harga Beli",
    "Harga Jual",
    "Stok",
    "Stok Minimum",
    "Deskripsi",
  ];
  const exampleRows = [
    [
      "Indomie Goreng",
      "Makanan",
      "2800",
      "3500",
      "48",
      "12",
      "Mi instan goreng favorit",
    ],
    [
      "Aqua 600ml",
      "Minuman",
      "2500",
      "3500",
      "36",
      "10",
      "Air mineral ukuran sedang",
    ],
    [
      "Beras IR64 5kg",
      "Sembako",
      "62000",
      "70000",
      "8",
      "3",
      "Beras ekonomis keluarga",
    ],
    [
      "Sabun Mandi Batang",
      "Kebutuhan Harian",
      "4200",
      "6500",
      "24",
      "6",
      "Sabun harian permintaan stabil",
    ],
  ];

  const rows = [headers, ...exampleRows];
  return rows.map((row) => row.join(",")).join("\n");
}

export function ImportProductDialog({
  onImportComplete,
}: {
  onImportComplete: (products?: Array<{ id: string; name: string; sku: string }>) => void;
}) {
  const [open, setOpen] = useState(false);
  const [file, setFile] = useState<File | null>(null);
  const [dragActive, setDragActive] = useState(false);
  const [importing, setImporting] = useState(false);
  const [result, setResult] = useState<ImportResult | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const reset = useCallback(() => {
    setFile(null);
    setResult(null);
    setImporting(false);
  }, []);

  function handleOpenChange(next: boolean) {
    if (!next) reset();
    setOpen(next);
  }

  function handleFileSelect(selectedFile: File | null) {
    if (!selectedFile) return;

    const validExtensions = [".csv", ".xlsx", ".xls"];
    const ext = selectedFile.name.substring(
      selectedFile.name.lastIndexOf(".")
    ).toLowerCase();

    if (!validExtensions.includes(ext)) {
      toast.error("Format file tidak didukung. Gunakan .csv, .xlsx, atau .xls");
      return;
    }

    setFile(selectedFile);
    setResult(null);
  }

  function handleDrag(e: React.DragEvent) {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === "dragenter" || e.type === "dragover") {
      setDragActive(true);
    } else if (e.type === "dragleave") {
      setDragActive(false);
    }
  }

  function handleDrop(e: React.DragEvent) {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);
    const droppedFile = e.dataTransfer.files?.[0];
    if (droppedFile) handleFileSelect(droppedFile);
  }

  async function handleImport() {
    if (!file) return;

    setImporting(true);
    setResult(null);

    try {
      const formData = new FormData();
      formData.append("file", file);

      const response = await fetch("/api/products/import", {
        method: "POST",
        body: formData,
      });

      const data = await response.json();

      if (!response.ok) {
        toast.error(data.error ?? "Gagal mengimport produk.");
        if (data.details) {
          setResult({
            success: false,
            imported: 0,
            failed: 0,
            skipped: 0,
            products: [],
            errors: data.details,
            mappedColumns: {},
          });
        }
        return;
      }

      setResult(data as ImportResult);

      if (data.imported > 0) {
        toast.success(`${data.imported} produk berhasil diimport!`);
        onImportComplete(data.products);
      }
    } catch {
      toast.error("Terjadi kesalahan saat mengimport file.");
    } finally {
      setImporting(false);
    }
  }

  function downloadTemplate() {
    const csv = generateTemplateCSV();
    const blob = new Blob(["\uFEFF" + csv], {
      type: "text/csv;charset=utf-8;",
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "template_import_produk.csv";
    a.click();
    URL.revokeObjectURL(url);
  }

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogTrigger
        render={
          <Button variant="outline" size="lg" className="h-11 rounded-2xl" />
        }
      >
        <FileSpreadsheet className="size-4" />
        Import Excel/CSV
      </DialogTrigger>
      <DialogContent className="max-h-[92vh] w-full max-w-3xl sm:max-w-3xl overflow-y-auto overflow-x-hidden rounded-[28px] p-0">
        <DialogHeader className="p-6 pb-2">
          <DialogTitle className="font-heading text-2xl">
            Import Produk dari Excel / CSV
          </DialogTitle>
          <DialogDescription>
            Upload file Excel (.xlsx) atau CSV (.csv) dengan data produk. Sistem
            akan mencocokkan kolom secara otomatis.
          </DialogDescription>
        </DialogHeader>

        <div className="p-6 pt-2">
          {!result ? (
            <div className="grid grid-cols-1 gap-6 md:grid-cols-12">
              {/* Left side: Column guide & template download */}
              <div className="flex flex-col justify-between gap-4 md:col-span-6">
                <div className="rounded-2xl border border-border/60 bg-card/60 p-4">
                  <div className="mb-3 flex items-center justify-between">
                    <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                      Kolom yang didukung
                    </p>
                    <span className="rounded-md bg-primary/10 px-2 py-0.5 text-[10px] font-medium text-primary">
                      Fleksibel
                    </span>
                  </div>
                  <div className="grid grid-cols-2 gap-x-3 gap-y-2 text-xs">
                    <div className="rounded-lg bg-background/50 p-2">
                      <span className="block font-medium text-primary">
                        Nama Produk
                      </span>
                      <span className="text-[10px] text-muted-foreground">
                        Wajib
                      </span>
                    </div>
                    <div className="rounded-lg bg-background/50 p-2">
                      <span className="block font-medium">Harga Jual</span>
                      <span className="text-[10px] text-muted-foreground">
                        Disarankan
                      </span>
                    </div>
                    <div className="rounded-lg bg-background/50 p-2">
                      <span className="block font-medium">Kategori</span>
                      <span className="text-[10px] text-muted-foreground">
                        Opsional
                      </span>
                    </div>
                    <div className="rounded-lg bg-background/50 p-2">
                      <span className="block font-medium">Harga Beli</span>
                      <span className="text-[10px] text-muted-foreground">
                        Opsional
                      </span>
                    </div>
                    <div className="rounded-lg bg-background/50 p-2">
                      <span className="block font-medium">Stok & Min.</span>
                      <span className="text-[10px] text-muted-foreground">
                        Opsional
                      </span>
                    </div>
                    <div className="rounded-lg bg-background/50 p-2">
                      <span className="block font-medium">Deskripsi & SKU</span>
                      <span className="text-[10px] text-muted-foreground">
                        Opsional
                      </span>
                    </div>
                  </div>
                  <p className="mt-3 text-[11px] leading-relaxed text-muted-foreground">
                    Header seperti &quot;Nama&quot;, &quot;Product Name&quot;,
                    &quot;Harga&quot;, &quot;Qty&quot;, dsb. otomatis terdeteksi.
                  </p>
                </div>

                <Button
                  variant="outline"
                  size="sm"
                  className="w-full justify-center rounded-xl border-dashed py-5 text-xs"
                  onClick={downloadTemplate}
                >
                  <Download className="size-4" />
                  Download template CSV contoh
                </Button>
              </div>

              {/* Right side: Dropzone */}
              <div className="flex flex-col md:col-span-6">
                <div
                  className={cn(
                    "flex flex-1 flex-col items-center justify-center rounded-2xl border-2 border-dashed p-6 text-center transition-all",
                    dragActive
                      ? "border-primary bg-primary/10 shadow-sm"
                      : file
                        ? "border-primary/50 bg-primary/5 shadow-inner"
                        : "border-border/60 hover:border-primary/40 hover:bg-primary/5"
                  )}
                  onDragEnter={handleDrag}
                  onDragLeave={handleDrag}
                  onDragOver={handleDrag}
                  onDrop={handleDrop}
                  onClick={() => inputRef.current?.click()}
                >
                  <input
                    ref={inputRef}
                    type="file"
                    accept=".csv,.xlsx,.xls"
                    className="hidden"
                    onChange={(e) =>
                      handleFileSelect(e.target.files?.[0] ?? null)
                    }
                  />
                  {file ? (
                    <div className="space-y-3">
                      <div className="mx-auto flex size-14 items-center justify-center rounded-2xl bg-primary/10 text-primary shadow-sm">
                        <FileSpreadsheet className="size-7" />
                      </div>
                      <div>
                        <p className="max-w-[220px] truncate text-sm font-semibold text-foreground">
                          {file.name}
                        </p>
                        <p className="mt-0.5 text-xs text-muted-foreground">
                          {(file.size / 1024).toFixed(1)} KB
                        </p>
                      </div>
                      <span className="inline-block rounded-full bg-background px-3 py-1 text-[11px] font-medium text-muted-foreground shadow-sm">
                        Klik untuk ganti file
                      </span>
                    </div>
                  ) : (
                    <div className="space-y-3">
                      <div className="mx-auto flex size-14 items-center justify-center rounded-2xl bg-muted text-muted-foreground transition-colors group-hover:bg-primary/10 group-hover:text-primary">
                        <Upload className="size-7" />
                      </div>
                      <div>
                        <p className="text-sm font-semibold text-foreground">
                          Seret file ke sini atau klik
                        </p>
                        <p className="mt-1 text-xs text-muted-foreground">
                          Format: .csv, .xlsx, .xls
                        </p>
                      </div>
                      <span className="inline-block rounded-full bg-background/80 px-3 py-1 text-[11px] text-muted-foreground">
                        Maksimal ukuran 5MB
                      </span>
                    </div>
                  )}
                </div>
              </div>
            </div>
          ) : (
            /* Result display */
            <div className="space-y-4">
              <div
                className={cn(
                  "flex items-center gap-3.5 rounded-2xl p-4.5",
                  result.imported > 0
                    ? "bg-emerald-500/10 text-emerald-700 dark:text-emerald-400"
                    : "bg-destructive/10 text-destructive"
                )}
              >
                {result.imported > 0 ? (
                  <CheckCircle2 className="size-6 shrink-0" />
                ) : (
                  <XCircle className="size-6 shrink-0" />
                )}
                <div>
                  <p className="font-semibold">
                    {result.imported > 0
                      ? `${result.imported} produk berhasil diimport!`
                      : "Tidak ada produk yang berhasil diimport."}
                  </p>
                  {(result.failed > 0 || result.skipped > 0) && (
                    <p className="mt-0.5 text-xs opacity-85">
                      {result.failed > 0 && `${result.failed} gagal. `}
                      {result.skipped > 0 && `${result.skipped} dilewati.`}
                    </p>
                  )}
                </div>
              </div>

              {result.errors.length > 0 && (
                <div className="max-h-36 overflow-y-auto rounded-2xl bg-card/60 p-4 ring-1 ring-border">
                  <p className="mb-2 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
                    Detail Catatan / Error
                  </p>
                  <div className="space-y-1.5">
                    {result.errors.map((err, i) => (
                      <p key={i} className="text-xs text-muted-foreground">
                        • {err}
                      </p>
                    ))}
                  </div>
                </div>
              )}

              {Object.keys(result.mappedColumns).length > 0 && (
                <div className="rounded-2xl bg-card/60 p-4 ring-1 ring-border">
                  <p className="mb-2 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
                    Kolom yang berhasil dicocokkan
                  </p>
                  <div className="flex flex-wrap gap-1.5">
                    {Object.entries(result.mappedColumns).map(
                      ([raw, mapped]) => (
                        <span
                          key={raw}
                          className="inline-flex items-center gap-1 rounded-lg bg-primary/10 px-2.5 py-1 text-xs font-medium text-primary"
                        >
                          {raw} → {mapped}
                        </span>
                      )
                    )}
                  </div>
                </div>
              )}
            </div>
          )}
        </div>

        <DialogFooter
          className="m-0 flex flex-col-reverse gap-2 rounded-b-[28px] border-t bg-muted/50 px-6 py-4 sm:flex-row sm:justify-end"
          showCloseButton
        >
          {result ? (
            <Button type="button" onClick={reset}>
              Import lagi
            </Button>
          ) : (
            <Button
              type="button"
              onClick={() => void handleImport()}
              disabled={!file || importing}
              className="px-6"
            >
              {importing ? (
                <>
                  <Loader2 className="size-4 animate-spin" />
                  Mengimport…
                </>
              ) : (
                <>
                  <Upload className="size-4" />
                  Import produk
                </>
              )}
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
