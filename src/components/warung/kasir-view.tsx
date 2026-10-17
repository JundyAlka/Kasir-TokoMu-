"use client";

import { type ReactNode, memo, useCallback, useDeferredValue, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import dynamic from "next/dynamic";
import { useVirtualizer } from "@tanstack/react-virtual";
import {
  AlertTriangle,
  ArrowUpDown,
  BanknoteArrowDown,
  Building2,
  CheckCircle2,
  Coffee,
  Copy,
  CreditCard,
  Flame,
  Loader2,
  Minus,
  PackageCheck,
  PackageSearch,
  Plus,
  QrCode,
  ReceiptText,
  RefreshCw,
  Search,
  ShoppingBasket,
  Smartphone,
  Sparkles,
  BellRing,
  CircleDollarSign,
  Clock,
  UserRoundCheck,
  WalletCards,
  Wheat,
  X,
} from "lucide-react";
import { toast } from "sonner";
import { useAppState } from "@/components/providers/app-state-provider";
const ReceiptPrintDialog = dynamic(
  () => import("@/components/tokomu/receipt-print").then((mod) => mod.ReceiptPrintDialog),
  { ssr: false }
);
import { ShiftChangeBanner } from "@/components/tokomu/shift-change-banner";
import { ShiftClosingDialog } from "@/components/tokomu/shift-closing-dialog";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { ScrollArea } from "@/components/ui/scroll-area";
import { formatCurrency } from "@/lib/format";
import { generateDynamicQris } from "@/lib/qris";
import { PaymentMethod, Product, ProductCategory, Settings, Transaction } from "@/lib/types";
import { cn } from "@/lib/utils";

export type SortOption =
  | "popular"
  | "revenue-desc"
  | "qty-desc"
  | "name-asc"
  | "name-desc"
  | "stock-desc"
  | "stock-asc"
  | "price-asc"
  | "price-desc";

export type ProductSalesStat = {
  productId?: string;
  productName: string;
  totalQty: number;
  txCount: number;
  totalRevenue: number;
  avgPerDay: number;
  popularityScore: number;
  lastSoldAt?: string;
};

const paymentLabels: Record<PaymentMethod, string> = {
  Tunai: "Tunai",
  QRIS: "QRIS",
  Transfer: "Transfer",
};

const categoryLabels: Array<{ value: "Semua" | "Terlaris" | ProductCategory; label: string }> = [
  { value: "Semua", label: "Semua" },
  { value: "Terlaris", label: "🔥 Terlaris" },
  { value: "Makanan", label: "Makanan" },
  { value: "Minuman", label: "Minuman" },
  { value: "Sembako", label: "Sembako" },
  { value: "Kebutuhan Harian", label: "Harian" },
];

const dummyPaymentAccounts = {
  qrisMerchantId: "NMID-DUMMY-TOKOMU-0001",
  dana: {
    label: "DANA",
    accountName: "TokoMu Dummy",
    accountNumber: "0812 3456 7890",
  },
  bri: {
    label: "BRI",
    accountName: "TokoMu Warung",
    accountNumber: "1234 0101 9988 550",
  },
} as const;

type RecordedByInfo = {
  userId: string;
  name: string;
  shiftSessionId: string | null;
};

async function requestJson<T>(input: RequestInfo): Promise<T> {
  const response = await fetch(input);
  const data = (await response.json().catch(() => null)) as T & { error?: string } | null;
  if (!response.ok) {
    throw new Error(typeof data?.error === "string" ? data.error : "Permintaan gagal.");
  }
  return data as T;
}

function ProductCategoryIcon({ category }: { category: ProductCategory }) {
  if (category === "Minuman") {
    return <Coffee className="size-5" />;
  }

  if (category === "Sembako") {
    return <Wheat className="size-5" />;
  }

  if (category === "Kebutuhan Harian") {
    return <Sparkles className="size-5" />;
  }

  return <ShoppingBasket className="size-5" />;
}

function ProductDetailDialog({
  product,
  salesStat,
  open,
  onOpenChange,
  onAdd,
}: {
  product: Product | null;
  salesStat?: ProductSalesStat | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onAdd: () => void;
}) {
  if (!product) return null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md rounded-[28px] border-border bg-card p-6 shadow-2xl">
        <DialogHeader className="space-y-2">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2 rounded-full border border-border/60 bg-muted/40 px-3 py-1 text-xs font-medium text-muted-foreground">
              <ProductCategoryIcon category={product.category} />
              <span>{product.category}</span>
            </div>
            <Badge
              className={cn(
                "rounded-full px-3 py-1 text-xs font-semibold border-0",
                product.stock <= product.minimumStock
                  ? "bg-primary text-primary-foreground"
                  : "bg-muted text-foreground"
              )}
            >
              {product.stock} pcs tersedia
            </Badge>
          </div>
          <DialogTitle className="font-heading text-2xl pt-2 text-left">{product.name}</DialogTitle>
          {product.sku && <p className="font-mono text-xs text-muted-foreground text-left">SKU: {product.sku}</p>}
        </DialogHeader>

        <div className="space-y-4 py-3">
          <div className="rounded-[20px] border border-border/60 bg-muted/30 p-4">
            <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground">Harga Jual</p>
            <p className="mt-1 font-heading text-3xl font-bold text-primary">{formatCurrency(product.sellPrice)}</p>
          </div>

          {salesStat && salesStat.totalQty > 0 && (
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-2.5">
              <div className="rounded-[20px] border border-amber-500/30 bg-amber-500/10 p-3.5 text-left">
                <div className="flex items-center gap-1.5 text-xs font-semibold text-amber-800 dark:text-amber-300">
                  <Flame className="size-3.5 fill-amber-500/30 text-amber-600" />
                  <span>Rata-rata/hari</span>
                </div>
                <p className="mt-1 font-heading text-xl font-bold text-amber-900 dark:text-amber-200">
                  ~{salesStat.avgPerDay} <span className="text-xs font-normal">pcs</span>
                </p>
              </div>
              <div className="rounded-[20px] border border-border/60 bg-muted/30 p-3.5 text-left">
                <p className="text-xs font-semibold text-muted-foreground">Frekuensi Belanja</p>
                <p className="mt-1 font-heading text-xl font-bold text-foreground">
                  {salesStat.txCount} <span className="text-xs font-normal">transaksi</span>
                </p>
              </div>
              <div className="col-span-2 sm:col-span-1 rounded-[20px] border border-emerald-500/30 bg-emerald-500/10 p-3.5 text-left">
                <p className="text-xs font-semibold text-emerald-800 dark:text-emerald-300">Omzet 30 Hari</p>
                <p className="mt-1 font-heading text-xl font-bold text-emerald-900 dark:text-emerald-200 truncate">
                  {formatCurrency(salesStat.totalRevenue || 0)}
                </p>
              </div>
            </div>
          )}

          <div className="space-y-1.5 text-left">
            <p className="text-xs font-medium text-muted-foreground">Catatan & Deskripsi</p>
            <p className="text-sm leading-relaxed text-foreground rounded-2xl border border-border/40 bg-card/60 p-3.5">
              {product.description || "Tidak ada catatan khusus untuk produk ini."}
            </p>
          </div>
        </div>

        <DialogFooter className="flex flex-col-reverse sm:flex-row gap-2 pt-2">
          <Button type="button" variant="outline" className="h-12 rounded-2xl flex-1 font-medium" onClick={() => onOpenChange(false)}>
            Tutup
          </Button>
          <Button
            type="button"
            className="h-12 rounded-2xl flex-1 font-semibold"
            disabled={product.stock <= 0}
            onClick={() => {
              onAdd();
              onOpenChange(false);
            }}
          >
            <Plus className="mr-2 size-4" />
            Tambah ke keranjang
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

const ProductCard = memo(function ProductCard({
  product,
  salesStat,
  onAdd,
  onDetail,
}: {
  product: Product;
  salesStat?: ProductSalesStat;
  onAdd: (product: Product) => void;
  onDetail?: (product: Product) => void;
}) {
  const lowStock = product.stock <= product.minimumStock;
  const isBestSeller = (salesStat?.popularityScore ?? 0) >= 200 || (salesStat?.txCount ?? 0) >= 15;

  return (
    <div
      onClick={() => onAdd(product)}
      role="button"
      tabIndex={0}
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          onAdd(product);
        }
      }}
      className={cn(
        "group relative flex h-[138px] xl:h-[148px] min-w-0 flex-col justify-between rounded-2xl border border-border bg-card p-2 xl:p-2.5 text-left shadow-2xs transition-all duration-100 hover:-translate-y-0.5 hover:border-primary/45 hover:shadow-md cursor-pointer select-none active:scale-[0.98] active:duration-75",
        product.stock <= 0 && "cursor-not-allowed opacity-55 hover:translate-y-0 hover:border-border hover:shadow-2xs active:scale-100",
        lowStock && product.stock > 0 && "border-amber-500/40 bg-amber-500/5"
      )}
      style={{ contain: "content" }}
    >
      {/* Top row: Category icon, Stock Badge & Popular/Best Seller Badge */}
      <div className="flex items-center justify-between gap-1 w-full shrink-0">
        <div className="flex items-center gap-1 min-w-0">
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              onDetail?.(product);
            }}
            title={`Detail ${product.name}`}
            className="flex size-6.5 xl:size-7 shrink-0 items-center justify-center rounded-lg border border-border/60 bg-muted/60 text-muted-foreground transition hover:bg-muted hover:text-foreground cursor-pointer"
          >
            <ProductCategoryIcon category={product.category} />
          </button>

          <Badge
            className={cn(
              "shrink-0 rounded-full border px-1.5 py-0 text-[9px] font-semibold shadow-2xs inline-flex items-center gap-0.5 select-none",
              product.stock <= 0
                ? "border-destructive/30 bg-destructive/10 text-destructive font-medium"
                : lowStock
                  ? "border-amber-500/40 bg-amber-500/15 text-amber-700 dark:text-amber-300 font-semibold"
                  : "border-border/70 bg-background/90 text-foreground/90 font-medium"
            )}
          >
            <span
              className={cn(
                "size-1.5 rounded-full shrink-0",
                product.stock <= 0
                  ? "bg-destructive animate-pulse"
                  : lowStock
                    ? "bg-amber-500"
                    : "bg-emerald-500"
              )}
            />
            <span className="whitespace-nowrap tabular-nums">{product.stock}</span>
          </Badge>
        </div>

        {salesStat && salesStat.totalQty > 0 ? (
          <span
            title={`${salesStat.txCount}x transaksi | ${salesStat.totalQty} terjual (~${salesStat.avgPerDay}/hari)`}
            className={cn(
              "inline-flex items-center gap-0.5 rounded-full px-1.5 py-0.5 text-[9px] font-bold select-none shrink-0",
              isBestSeller
                ? "bg-gradient-to-r from-amber-500 to-orange-500 text-white shadow-2xs"
                : "bg-amber-500/10 text-amber-800 dark:text-amber-300 border border-amber-500/25"
            )}
          >
            <Flame
              className={cn(
                "size-2.5 shrink-0",
                isBestSeller ? "fill-white text-white" : "text-amber-600 fill-amber-500/40"
              )}
            />
            <span className="tabular-nums">
              {salesStat.avgPerDay >= 1 ? `~${salesStat.avgPerDay}` : salesStat.totalQty}
            </span>
          </span>
        ) : null}
      </div>

      {/* Middle: Name & description */}
      <div className="min-w-0 space-y-0.5 my-auto w-full">
        <p className="line-clamp-2 break-words font-heading text-xs xl:text-[13px] font-bold leading-tight text-foreground group-hover:text-primary transition-colors">
          {product.name}
        </p>
        {product.description && (
          <p className="line-clamp-1 break-words text-[9.5px] xl:text-[10px] leading-tight text-muted-foreground">
            {product.description}
          </p>
        )}
      </div>

      {/* Bottom row: Category, Price, and Plus Action Button */}
      <div className="flex items-end justify-between gap-1 w-full pt-1 border-t border-border/40 shrink-0">
        <div className="min-w-0 flex-1">
          <p className="truncate text-[8px] xl:text-[9px] font-semibold uppercase tracking-wider text-muted-foreground/80">
            {product.category}
          </p>
          <p className="truncate font-bold text-foreground text-[11px] xl:text-xs tracking-tight tabular-nums" title={formatCurrency(product.sellPrice)}>
            {formatCurrency(product.sellPrice)}
          </p>
        </div>
        <div className="flex size-5.5 xl:size-6 shrink-0 items-center justify-center rounded-full bg-primary text-primary-foreground shadow-2xs transition-all duration-150 group-hover:scale-105 group-hover:bg-primary/90">
          <Plus className="size-2.5 xl:size-3" />
        </div>
      </div>
    </div>
  );
});

type CartItemLine = {
  product: Product;
  quantity: number;
  lineTotal: number;
};

const CartItemRow = memo(function CartItemRow({
  line,
  onRemove,
  onUpdateQuantity,
}: {
  line: CartItemLine;
  onRemove: (productId: string) => void;
  onUpdateQuantity: (productId: string, quantity: number) => void;
}) {
  const handleRemove = useCallback(() => {
    onRemove(line.product.id);
  }, [line.product.id, onRemove]);

  const handleDecrease = useCallback(() => {
    onUpdateQuantity(line.product.id, line.quantity - 1);
  }, [line.product.id, line.quantity, onUpdateQuantity]);

  const handleIncrease = useCallback(() => {
    if (line.quantity >= line.product.stock) {
      toast.error(`Stok ${line.product.name} tidak cukup.`, {
        description: `Stok tersedia hanya ${line.product.stock} pcs.`,
      });
      return;
    }
    onUpdateQuantity(line.product.id, line.quantity + 1);
  }, [line.product.id, line.product.name, line.product.stock, line.quantity, onUpdateQuantity]);

  return (
    <div className="group/item relative rounded-[18px] border border-border border-l-4 border-l-primary bg-card py-2.5 pr-2.5 pl-3.5 shadow-sm transition-all duration-200 hover:-translate-y-0.5 hover:border-primary/40 hover:border-l-primary hover:shadow-md dark:bg-muted/90 dark:hover:bg-muted shrink-0">
      <div className="flex items-start justify-between gap-2">
        <p className="font-semibold text-foreground text-sm tracking-tight transition-colors group-hover/item:text-primary leading-snug">
          {line.product.name}
        </p>
        <button
          type="button"
          onClick={handleRemove}
          className="rounded-full p-1 text-muted-foreground transition hover:bg-destructive/10 hover:text-destructive shrink-0 -mt-0.5 -mr-0.5"
          aria-label={`Hapus ${line.product.name}`}
        >
          <X className="size-3.5" />
        </button>
      </div>

      <div className="mt-2 flex items-center justify-between gap-2">
        <p className="text-xs text-muted-foreground">
          {formatCurrency(line.product.sellPrice)} <span className="opacity-75">x {line.quantity}</span>
        </p>
        <div className="flex items-center gap-2 shrink-0">
          <div className="inline-flex items-center gap-0.5 rounded-full bg-muted/80 p-0.5 border border-border/40 dark:bg-muted/40">
            <Button
              type="button"
              size="icon-sm"
              variant="ghost"
              className="rounded-full size-6 hover:bg-background/80"
              onClick={handleDecrease}
            >
              <Minus className="size-3" />
            </Button>
            <span className="min-w-5 text-center text-xs font-semibold text-foreground">{line.quantity}</span>
            <Button
              type="button"
              size="icon-sm"
              variant="ghost"
              className="rounded-full size-6 hover:bg-background/80"
              onClick={handleIncrease}
            >
              <Plus className="size-3" />
            </Button>
          </div>
          <p className="font-bold text-primary text-sm tracking-tight tabular-nums min-w-[72px] text-right">
            {formatCurrency(line.lineTotal)}
          </p>
        </div>
      </div>
    </div>
  );
});

type QrisPreviewLine = {
  lineTotal: number;
  product: Pick<Product, "id" | "name" | "sellPrice">;
  quantity: number;
};

function createQrisReference(total: number, items: QrisPreviewLine[]) {
  const lineKey = items
    .map((item) => `${item.product.id.slice(-6)}${item.quantity}`)
    .join("-");

  return `TOKOMU-${total}-${lineKey || "EMPTY"}`.toUpperCase();
}

function createQrisPayload(total: number, items: QrisPreviewLine[]) {
  return JSON.stringify({
    type: "TOKOMU_QRIS_PAYMENT",
    merchantId: dummyPaymentAccounts.qrisMerchantId,
    reference: createQrisReference(total, items),
    amount: total,
    currency: "IDR",
    items: items.map((item) => ({
      productId: item.product.id,
      name: item.product.name,
      quantity: item.quantity,
      unitPrice: item.product.sellPrice,
      lineTotal: item.lineTotal,
    })),
  });
}

function QrisPaymentPreview({
  items,
  total,
  settings,
}: Readonly<{
  items: QrisPreviewLine[];
  total: number;
  settings: Settings;
}>) {
  const [qrResult, setQrResult] = useState<{ dataUrl: string; payload: string } | null>(null);
  const reference = createQrisReference(total, items);

  const isDynamic = Boolean(settings.qrisPayload && settings.qrisPayload.length > 20);
  const isStaticImage = Boolean(settings.qrisImageUrl && !isDynamic);

  const payload = isDynamic ? generateDynamicQris(settings.qrisPayload, total) : "";
  const qrDataUrl = qrResult?.payload === payload ? qrResult.dataUrl : null;

  useEffect(() => {
    if (total <= 0 || items.length === 0 || !isDynamic || !payload) {
      return;
    }

    let active = true;
    import("qrcode")
      .then((mod) => {
        const qr = mod.default || mod;
        return qr.toDataURL(payload, {
          color: { dark: "#1f1713", light: "#ffffff" },
          errorCorrectionLevel: "M",
          margin: 1,
          width: 220,
        });
      })
      .then((dataUrl: string) => {
        if (active) setQrResult({ dataUrl, payload });
      })
      .catch(() => {
        if (active) setQrResult(null);
      });

    return () => {
      active = false;
    };
  }, [items, payload, total, isDynamic]);

  if (!isDynamic && !isStaticImage) {
    return (
      <div className="mt-4 rounded-[22px] border border-border/70 bg-card/60 p-4 text-center text-sm text-muted-foreground">
        QRIS belum diatur. Silakan atur Payload Dinamis atau Gambar QRIS Statis di menu Pengaturan.
      </div>
    );
  }

  return (
    <div className="mt-4 rounded-[22px] border border-primary/25 bg-primary/8 p-4">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="flex items-center gap-2 text-sm font-medium">
            <QrCode className="size-4 text-primary" />
            {isDynamic ? "QRIS Dinamis (Otomatis)" : "QRIS Statis"}
          </div>
          <p className="mt-1 text-xs text-muted-foreground">
            Ref: <span className="font-mono">{reference}</span>
          </p>
        </div>
        <div className="rounded-full bg-card px-3 py-1 text-sm font-semibold">
          {formatCurrency(total)}
        </div>
      </div>

      <div className="mt-4 flex flex-col items-center gap-3">
        <div className="flex size-48 items-center justify-center rounded-[26px] border border-border/70 bg-white p-3 shadow-inner">
          {isDynamic && qrDataUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={qrDataUrl} alt={`QRIS pembayaran ${formatCurrency(total)}`} className="size-full" />
          ) : isStaticImage ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={settings.qrisImageUrl} alt={`QRIS pembayaran`} className="size-full object-contain" />
          ) : (
            <QrCode className="size-10 text-muted-foreground" />
          )}
        </div>
        <div className="flex items-center gap-2 text-xs font-medium text-primary">
          <CheckCircle2 className="size-4" />
          Menunggu pembayaran pelanggan
        </div>
      </div>
    </div>
  );
}

function CopyButton({ text }: Readonly<{ text: string }>) {
  return (
    <Button
      type="button"
      variant="outline"
      size="sm"
      className="h-9 rounded-xl"
      onClick={() => {
        void navigator.clipboard
          ?.writeText(text)
          .then(() => toast.success("Nomor pembayaran disalin."))
          .catch(() => toast.error("Gagal menyalin nomor pembayaran."));
      }}
    >
      <Copy className="size-3.5" />
      Salin
    </Button>
  );
}

function TransferAccountCard({
  account,
  icon,
}: Readonly<{
  account: { label: string; accountName: string; accountNumber: string };
  icon: ReactNode;
}>) {
  return (
    <div className="rounded-[22px] border border-border/70 bg-card/70 p-4">
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-center gap-3">
          <div className="flex size-10 shrink-0 items-center justify-center rounded-2xl bg-primary/12 text-primary">
            {icon}
          </div>
          <div>
            <p className="font-medium">{account.label}</p>
            <p className="text-xs text-muted-foreground">a.n. {account.accountName}</p>
          </div>
        </div>
        <CopyButton text={account.accountNumber.replace(/\s/g, "")} />
      </div>
      <p className="mt-4 rounded-2xl bg-muted/40 px-3 py-2 font-mono text-lg font-semibold tracking-wide">
        {account.accountNumber}
      </p>
    </div>
  );
}

function PaymentInstructionDialog({
  method,
  onOpenChange,
  open,
  total,
  settings,
}: Readonly<{
  method: PaymentMethod;
  onOpenChange: (open: boolean) => void;
  open: boolean;
  total: number;
  settings: Settings;
}>) {
  const isTransfer = method === "Transfer";

  if (!isTransfer) {
    return null;
  }

  const transferInfos = settings.bankTransferInfo
    ? settings.bankTransferInfo.split("\n").filter((line) => line.trim())
    : [];

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md rounded-[28px] p-0">
        <DialogHeader className="border-b border-border/70 p-6 pb-4">
          <div className="mb-2 flex size-12 items-center justify-center rounded-2xl bg-primary/14 text-primary">
            <CreditCard className="size-5" />
          </div>
          <DialogTitle className="font-heading text-2xl">Pembayaran Transfer</DialogTitle>
          <DialogDescription>
            Arahkan pelanggan untuk mentransfer ke rekening di bawah ini.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 p-6">
          <div className="rounded-[22px] border border-primary/20 bg-primary/8 p-4">
            <div className="flex items-center justify-between gap-3">
              <span className="text-sm text-muted-foreground">Total tagihan</span>
              <span className="font-heading text-2xl font-semibold">{formatCurrency(total)}</span>
            </div>
          </div>

          <div className="space-y-3">
            {transferInfos.length > 0 ? (
              transferInfos.map((info, idx) => {
                const parts = info.split(/:(.+)/);
                const bankName = parts[0]?.trim() ?? "Bank";
                const accDetails = parts[1]?.trim() ?? info;

                return (
                  <div key={idx} className="rounded-[22px] border border-border/70 bg-card/70 p-4">
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex items-center gap-3">
                        <div className="flex size-10 shrink-0 items-center justify-center rounded-2xl bg-primary/12 text-primary">
                          <Building2 className="size-4" />
                        </div>
                        <p className="font-medium text-sm">{bankName}</p>
                      </div>
                      <CopyButton text={accDetails.split(" ")[0] ?? accDetails} />
                    </div>
                    <p className="mt-4 rounded-2xl bg-muted/40 px-3 py-2 font-mono text-base font-semibold tracking-wide">
                      {accDetails}
                    </p>
                  </div>
                );
              })
            ) : (
              <div className="rounded-[22px] border border-border/70 bg-card/70 p-4 text-center text-sm text-muted-foreground">
                Informasi rekening belum diatur. Silakan atur di menu Pengaturan.
              </div>
            )}
          </div>
        </div>

        <div className="flex flex-col sm:flex-row items-center justify-between gap-4 rounded-b-[28px] border-t border-border/70 bg-card/70 px-5 py-4 sm:px-6">
          <div className="flex items-center gap-2 w-full sm:w-auto">
            <input 
              type="checkbox" 
              id="hideTransferPopup" 
              className="size-4 cursor-pointer rounded border-border"
              defaultChecked={typeof window !== "undefined" ? window.localStorage.getItem("hideTransferPopup") === "true" : false}
              onChange={(e) => {
                if (e.target.checked) {
                  window.localStorage.setItem("hideTransferPopup", "true");
                } else {
                  window.localStorage.removeItem("hideTransferPopup");
                }
              }}
            />
            <label htmlFor="hideTransferPopup" className="text-sm text-muted-foreground cursor-pointer select-none">
              Jangan otomatis tampilkan ini lagi
            </label>
          </div>
          <div className="flex items-center justify-end gap-3 w-full sm:w-auto">
            <DialogClose
              render={
                <Button type="button" variant="outline" className="h-10 min-w-24 rounded-full" />
              }
            >
              Tutup
            </DialogClose>
            <Button type="button" className="h-10 min-w-32 rounded-full" onClick={() => onOpenChange(false)}>
              Sudah paham
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

// ── Virtualized Product Grid ──────────────────────────────────────────
// Renders only visible rows using @tanstack/react-virtual to keep DOM
// node count minimal — ultra fast 60/120fps scrolling on tablets.
const ROW_HEIGHT = 146; // 138px card height + 8px gap
const ROW_GAP = 8;

const VirtualizedProductGrid = memo(function VirtualizedProductGrid({
  dataState,
  products,
  filteredProducts,
  salesStatsMap,
  colCount,
  productGridClass,
  retryWorkspace,
  onAdd,
  onDetail,
  activeFilterKey,
}: {
  dataState: string;
  products: Product[];
  filteredProducts: Product[];
  salesStatsMap: Map<string, ProductSalesStat>;
  colCount: number;
  productGridClass: string;
  retryWorkspace: () => void;
  onAdd: (product: Product) => void;
  onDetail: (product: Product) => void;
  activeFilterKey?: string;
}) {
  const scrollRef = useRef<HTMLDivElement>(null);

  // Split products into rows based on column count
  const rows = useMemo(() => {
    const result: Product[][] = [];
    for (let i = 0; i < filteredProducts.length; i += colCount) {
      result.push(filteredProducts.slice(i, i + colCount));
    }
    return result;
  }, [filteredProducts, colCount]);

  const virtualizer = useVirtualizer({
    count: rows.length,
    getScrollElement: () => scrollRef.current,
    estimateSize: () => ROW_HEIGHT,
    overscan: 4,
    gap: ROW_GAP,
  });

  // Reset scroll to top when category, search query, or sort changes
  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = 0;
    }
  }, [activeFilterKey]);

  // Loading state
  if (dataState === "loading" && products.length === 0) {
    return (
      <CardContent className="flex-1 overflow-y-auto custom-scrollbar p-3">
        <div className={cn("grid gap-2", productGridClass)}>
          {Array.from({ length: 12 }).map((_, i) => (
            <div
              key={`skeleton-card-${i}`}
              className="flex h-[138px] flex-col justify-between rounded-2xl border border-border/50 bg-card/60 p-2.5 animate-pulse"
            >
              <div className="flex justify-between items-center">
                <div className="size-6.5 rounded-lg bg-muted/60" />
                <div className="h-3.5 w-10 rounded-full bg-muted/50" />
              </div>
              <div className="space-y-1 my-auto">
                <div className="h-3 w-3/4 rounded bg-muted/60" />
                <div className="h-2 w-1/2 rounded bg-muted/40" />
              </div>
              <div className="pt-1.5 border-t border-border/40 flex justify-between items-center">
                <div className="h-2.5 w-12 rounded bg-muted/40" />
                <div className="size-5.5 rounded-full bg-muted/60" />
              </div>
            </div>
          ))}
        </div>
      </CardContent>
    );
  }

  // Error state
  if (dataState === "error" && products.length === 0) {
    return (
      <CardContent className="flex-1 overflow-y-auto custom-scrollbar">
        <div role="alert" className="flex min-h-[200px] flex-col items-center justify-center gap-3 rounded-[22px] border border-dashed border-destructive/40 bg-card/55 text-center p-5">
          <p className="font-heading text-lg font-semibold text-foreground">Gagal memuat produk</p>
          <p className="max-w-md text-sm text-muted-foreground">
            Terjadi kendala saat mengambil data katalog produk dari server.
          </p>
          <Button type="button" variant="outline" className="mt-1 rounded-xl" onClick={retryWorkspace}>
            <RefreshCw className="mr-2 size-4" />
            Muat ulang
          </Button>
        </div>
      </CardContent>
    );
  }

  // Empty state
  if (filteredProducts.length === 0) {
    return (
      <CardContent className="flex-1 overflow-y-auto custom-scrollbar">
        <div className="flex min-h-[200px] flex-col items-center justify-center rounded-[22px] border border-dashed border-border bg-card/55 text-center p-4">
          <PackageSearch className="size-8 text-muted-foreground" />
          <p className="mt-2.5 font-heading text-base font-semibold">Produk tidak ditemukan</p>
          <p className="mt-1 max-w-xs text-xs text-muted-foreground">
            Coba kata kunci lain atau pilih kategori yang lebih luas.
          </p>
        </div>
      </CardContent>
    );
  }

  // Virtualized grid
  return (
    <div
      ref={scrollRef}
      className="flex-1 overflow-y-auto custom-scrollbar select-none"
      style={{
        WebkitOverflowScrolling: "touch",
      }}
    >
      <div
        className="relative w-full pb-3"
        style={{
          height: `${virtualizer.getTotalSize() + 16}px`,
        }}
      >
        {virtualizer.getVirtualItems().map((virtualRow) => {
          const rowProducts = rows[virtualRow.index];
          if (!rowProducts) return null;

          return (
            <div
              key={virtualRow.index}
              className={cn("grid absolute left-0 right-0 px-2 xl:px-3", productGridClass)}
              style={{
                top: `${virtualRow.start + 8}px`,
                height: `${virtualRow.size}px`,
                gap: `${ROW_GAP}px`,
                willChange: "transform",
              }}
            >
              {rowProducts.map((product) => {
                const stat = (product as { salesStat?: ProductSalesStat }).salesStat || salesStatsMap.get(product.id) || salesStatsMap.get(product.name.trim().toLowerCase());
                return (
                  <ProductCard
                    key={product.id}
                    product={product}
                    salesStat={stat}
                    onDetail={onDetail}
                    onAdd={onAdd}
                  />
                );
              })}
            </div>
          );
        })}
      </div>
    </div>
  );
});

export function KasirView() {
  const {
    products,
    transactions,
    cartLines,
    cartTotal,
    paymentMethod,
    settings,
    addToCart,
    updateCartQuantity,
    removeFromCart,
    setPaymentMethod,
    checkout,
    dataState,
    retryWorkspace,
  } = useAppState();
  const [query, setQuery] = useState("");
  const deferredQuery = useDeferredValue(query);
  const [category, setCategory] = useState<"Semua" | "Terlaris" | ProductCategory>("Semua");
  const [sortBy, setSortBy] = useState<SortOption>("popular");
  const [inStockOnly, setInStockOnly] = useState(false);
  const [remoteSalesStats, setRemoteSalesStats] = useState<ProductSalesStat[] | null>(null);

  useEffect(() => {
    let active = true;
    requestJson<{ stats: ProductSalesStat[] }>("/api/products/sales-stats")
      .then((data) => {
        if (active && Array.isArray(data.stats)) {
          setRemoteSalesStats(data.stats);
        }
      })
      .catch(() => {
        // Fallback silently to client-side calculation from transactions
      });

    return () => {
      active = false;
    };
  }, []);

  const salesStatsMap = useMemo(() => {
    const map = new Map<string, ProductSalesStat>();

    // 1. If remote 30-day stats are loaded from database, seed the map
    if (remoteSalesStats && remoteSalesStats.length > 0) {
      for (const item of remoteSalesStats) {
        if (item.productId) map.set(item.productId, item);
        if (item.productName) map.set(item.productName.trim().toLowerCase(), item);
      }
      return map;
    }

    // 2. Otherwise calculate immediately from loaded transactions in memory
    if (!transactions || transactions.length === 0) {
      return map;
    }

    const activeDaysSet = new Set<string>();
    const tempTotals = new Map<
      string,
      { totalQty: number; txCount: number; totalRevenue: number; productId?: string; productName: string }
    >();

    for (const tx of transactions) {
      const dayKey = (tx.occurredAt || tx.createdAt || "").split("T")[0];
      if (dayKey) activeDaysSet.add(dayKey);

      for (const item of tx.items || []) {
        const idKey = item.productId || "";
        const nameKey = (item.productName || "").trim().toLowerCase();
        const primaryKey = idKey || nameKey;
        if (!primaryKey) continue;

        const cur = tempTotals.get(primaryKey) || {
          totalQty: 0,
          txCount: 0,
          totalRevenue: 0,
          productId: idKey || undefined,
          productName: item.productName || "",
        };
        const qty = item.quantity || 0;
        const price = item.unitPrice || 0;
        cur.totalQty += qty;
        cur.txCount += 1;
        cur.totalRevenue += qty * price;
        tempTotals.set(primaryKey, cur);
      }
    }

    const activeDays = Math.max(1, activeDaysSet.size);

    for (const [key, data] of tempTotals.entries()) {
      const avgPerDay = Math.round((data.totalQty / activeDays) * 10) / 10;
      const popularityScore = Math.round(
        (data.txCount * 10.0 + Math.sqrt(data.totalRevenue / 100.0) + data.totalQty * 0.5) * 10
      ) / 10;
      const stat: ProductSalesStat = {
        productId: data.productId,
        productName: data.productName,
        totalQty: data.totalQty,
        txCount: data.txCount,
        totalRevenue: data.totalRevenue,
        avgPerDay,
        popularityScore,
      };
      map.set(key, stat);
      if (data.productId) map.set(data.productId, stat);
      if (data.productName) map.set(data.productName.trim().toLowerCase(), stat);
    }

    return map;
  }, [remoteSalesStats, transactions]);
  const [receiptOpen, setReceiptOpen] = useState(false);
  const [lastTransaction, setLastTransaction] = useState<Transaction | null>(null);
  const [recordedBy, setRecordedBy] = useState<RecordedByInfo | null>(null);
  const [lastRecordedByKey, setLastRecordedByKey] = useState<string | null>(null);
  const [shiftBannerName, setShiftBannerName] = useState<string | null>(null);
  const [paidAmountInput, setPaidAmountInput] = useState("");
  const [paymentInfoOpen, setPaymentInfoOpen] = useState(false);
  const [detailProduct, setDetailProduct] = useState<Product | null>(null);
  const [hasOpenShift, setHasOpenShift] = useState<boolean | null>(null);
  const [shiftClosingOpen, setShiftClosingOpen] = useState(false);
  const [shiftWarningDismissed, setShiftWarningDismissed] = useState(false);
  const [currentShiftInfo, setCurrentShiftInfo] = useState<{
    session?: {
      id: string;
      shiftId: string;
      shiftName: string;
      cashierUserId: string;
      cashierName: string;
      startedAt: string;
      shiftStartTime?: string;
      shiftEndTime?: string;
      openingTotal?: number;
    } | null;
    activeShift?: {
      id: string;
      name: string;
      startTime: string;
      endTime: string;
    } | null;
  } | null>(null);
  const [nowTick, setNowTick] = useState(Date.now());
  const workspaceRef = useRef<HTMLDivElement>(null);
  const productColumnRef = useRef<HTMLDivElement>(null);
  const [workspaceWidth, setWorkspaceWidth] = useState(1024);
  const [productColumnWidth, setProductColumnWidth] = useState(800);
  const searchInputRef = useRef<HTMLInputElement>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const isSubmittingRef = useRef(false);

  const cartLinesRef = useRef(cartLines);
  cartLinesRef.current = cartLines;

  const focusAndSelectSearch = useCallback(() => {
    requestAnimationFrame(() => {
      if (searchInputRef.current) {
        searchInputRef.current.focus();
        searchInputRef.current.select();
      }
    });
  }, []);

  const handleAddToCart = useCallback((product: Product) => {
    const existingLine = cartLinesRef.current.find((line) => line.product.id === product.id);
    if (existingLine && existingLine.quantity >= product.stock) {
      toast.error(`Stok ${product.name} tidak cukup.`, {
        id: "cart-stock-error",
        description: `Keranjang sudah mencapai stok tersedia (${product.stock} pcs).`,
      });
      return;
    }

    addToCart(product.id);
    toast.success(`${product.name} (+1)`, {
      id: "pos-cart-action",
      duration: 1200,
    });
  }, [addToCart]);

  const handleDetailProduct = useCallback((product: Product) => {
    setDetailProduct(product);
  }, []);

  const handleRemoveFromCart = useCallback((productId: string) => {
    removeFromCart(productId);
  }, [removeFromCart]);

  const handleUpdateCartQuantity = useCallback((productId: string, quantity: number) => {
    updateCartQuantity(productId, quantity);
  }, [updateCartQuantity]);

  useEffect(() => {
    const element = workspaceRef.current;
    if (!element) {
      return;
    }

    const updateWidth = () => setWorkspaceWidth(element.getBoundingClientRect().width);
    updateWidth();

    const observer = new ResizeObserver((entries) => {
      const entry = entries[0];
      if (entry) {
        setWorkspaceWidth(entry.contentRect.width);
      }
    });
    observer.observe(element);

    return () => observer.disconnect();
  }, []);

  async function refreshShiftGate() {
    try {
      const response = await fetch("/api/shifts/current", { cache: "no-store" });
      const data = (await response.json().catch(() => null)) as {
        session?: {
          id: string;
          shiftId: string;
          shiftName: string;
          cashierUserId: string;
          cashierName: string;
          startedAt: string;
          shiftStartTime?: string;
          shiftEndTime?: string;
          openingTotal?: number;
        } | null;
        activeShift?: {
          id: string;
          name: string;
          startTime: string;
          endTime: string;
        } | null;
      } | null;
      const isOpen = Boolean(response.ok && data?.session);
      setHasOpenShift(isOpen);
      setCurrentShiftInfo(data ?? null);
      return isOpen;
    } catch {
      setHasOpenShift(false);
      setCurrentShiftInfo(null);
      return false;
    }
  }

  useEffect(() => {
    const timer = window.setInterval(() => {
      setNowTick(Date.now());
    }, 20000);
    return () => window.clearInterval(timer);
  }, []);

  const shiftRemainingCalc = useMemo(() => {
    void nowTick;
    // Peringatan tutup buku HANYA berlaku jika sesi shift sedang aktif/terbuka!
    if (!hasOpenShift || !currentShiftInfo?.session) {
      return null;
    }

    const targetEndTime =
      currentShiftInfo.session.shiftEndTime ||
      currentShiftInfo.activeShift?.endTime;
    const targetStartTime =
      currentShiftInfo.session.shiftStartTime ||
      currentShiftInfo.activeShift?.startTime;
    const shiftName =
      currentShiftInfo.session.shiftName ||
      currentShiftInfo.activeShift?.name ||
      "Shift Kasir";

    if (!targetEndTime) return null;

    try {
      const now = new Date();
      const jakartaFormatter = new Intl.DateTimeFormat("en-GB", {
        timeZone: "Asia/Jakarta",
        hour: "2-digit",
        minute: "2-digit",
        hour12: false,
      });
      const [nowH, nowM] = jakartaFormatter.format(now).split(":").map(Number);
      const nowMinutes = nowH * 60 + nowM;

      const [endH, endM] = targetEndTime.split(":").map(Number);
      const endMinutes = endH * 60 + endM;

      const [startH, startM] = (targetStartTime || "00:00").split(":").map(Number);
      const startMinutes = startH * 60 + startM;

      let remaining = 0;
      if (startMinutes <= endMinutes) {
        remaining = endMinutes - nowMinutes;
      } else {
        if (nowMinutes >= startMinutes) {
          remaining = endMinutes + 24 * 60 - nowMinutes;
        } else {
          remaining = endMinutes - nowMinutes;
        }
      }

      const warningThreshold = settings.shiftCloseWarningMinutes || 30;
      const isDue = remaining <= warningThreshold;
      const isOverdue = remaining <= 0;

      return {
        shiftName,
        endTime: targetEndTime,
        remainingMinutes: remaining,
        isDue,
        isOverdue,
      };
    } catch {
      return null;
    }
  }, [hasOpenShift, currentShiftInfo, nowTick, settings.shiftCloseWarningMinutes]);

  useEffect(() => {
    void refreshShiftGate();
    const refresh = () => { void refreshShiftGate(); };
    window.addEventListener("cashier-shift-updated", refresh);
    return () => window.removeEventListener("cashier-shift-updated", refresh);
  }, []);

  useEffect(() => {
    const element = productColumnRef.current;
    if (!element) {
      return;
    }

    const updateWidth = () => setProductColumnWidth(element.getBoundingClientRect().width);
    updateWidth();

    const observer = new ResizeObserver((entries) => {
      const entry = entries[0];
      if (entry) {
        setProductColumnWidth(entry.contentRect.width);
      }
    });
    observer.observe(element);

    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    let active = true;
    void requestJson<{ recordedBy: RecordedByInfo }>("/api/shift-sessions")
      .then((response) => {
        if (!active) {
          return;
        }
        setRecordedBy(response.recordedBy);
        setLastRecordedByKey(`${response.recordedBy.userId}:${response.recordedBy.shiftSessionId ?? "auto"}`);
      })
      .catch(() => {
        if (active) {
          setRecordedBy(null);
        }
      });

    return () => {
      active = false;
    };
  }, []);

  // 1. Pre-index product search blob & sales stat to eliminate string allocations in search/sort loops
  const indexedProducts = useMemo(() => {
    return products.map((product) => {
      const cleanName = product.name.trim().toLowerCase();
      const stat = salesStatsMap.get(product.id) || salesStatsMap.get(cleanName);
      const searchBlob = `${cleanName} ${(product.description || "").toLowerCase()} ${(product.sku || "").toLowerCase()}`;
      return {
        product,
        searchBlob,
        cleanName,
        stat,
        stock: product.stock,
        category: product.category,
        sellPrice: product.sellPrice,
        popularityScore: stat?.popularityScore ?? 0,
        txCount: stat?.txCount ?? 0,
        totalQty: stat?.totalQty ?? 0,
        avgPerDay: stat?.avgPerDay ?? 0,
        totalRevenue: stat?.totalRevenue ?? 0,
      };
    });
  }, [products, salesStatsMap]);

  // 2. High-performance filtering & sorting (runs in <1ms)
  const filteredProducts = useMemo(() => {
    const cleanQuery = deferredQuery.trim().toLowerCase();
    const terms = cleanQuery ? cleanQuery.split(/\s+/).filter(Boolean) : [];

    // Filter step
    const list = indexedProducts.filter((item) => {
      if (inStockOnly && item.stock <= 0) {
        return false;
      }

      if (category === "Terlaris") {
        if (!item.stat || item.totalQty <= 0) {
          return false;
        }
      } else if (category !== "Semua" && item.category !== category) {
        return false;
      }

      if (terms.length === 0) {
        return true;
      }
      return terms.every((term) => item.searchBlob.includes(term));
    });

    // Sort step using native primitive comparisons
    list.sort((a, b) => {
      switch (sortBy) {
        case "popular": {
          if (b.popularityScore !== a.popularityScore) return b.popularityScore - a.popularityScore;
          if (b.txCount !== a.txCount) return b.txCount - a.txCount;
          if (b.totalQty !== a.totalQty) return b.totalQty - a.totalQty;
          if (b.stock > 0 && a.stock <= 0) return 1;
          if (a.stock > 0 && b.stock <= 0) return -1;
          return a.cleanName < b.cleanName ? -1 : a.cleanName > b.cleanName ? 1 : 0;
        }
        case "revenue-desc": {
          if (b.totalRevenue !== a.totalRevenue) return b.totalRevenue - a.totalRevenue;
          if (b.totalQty !== a.totalQty) return b.totalQty - a.totalQty;
          if (b.stock > 0 && a.stock <= 0) return 1;
          if (a.stock > 0 && b.stock <= 0) return -1;
          return a.cleanName < b.cleanName ? -1 : a.cleanName > b.cleanName ? 1 : 0;
        }
        case "qty-desc": {
          if (b.totalQty !== a.totalQty) return b.totalQty - a.totalQty;
          if (b.avgPerDay !== a.avgPerDay) return b.avgPerDay - a.avgPerDay;
          if (b.stock > 0 && a.stock <= 0) return 1;
          if (a.stock > 0 && b.stock <= 0) return -1;
          return a.cleanName < b.cleanName ? -1 : a.cleanName > b.cleanName ? 1 : 0;
        }
        case "name-asc":
          return a.cleanName < b.cleanName ? -1 : a.cleanName > b.cleanName ? 1 : 0;
        case "name-desc":
          return b.cleanName < a.cleanName ? -1 : b.cleanName > a.cleanName ? 1 : 0;
        case "stock-desc":
          return b.stock - a.stock;
        case "stock-asc":
          return a.stock - b.stock;
        case "price-asc":
          return a.sellPrice - b.sellPrice;
        case "price-desc":
          return b.sellPrice - a.sellPrice;
        default:
          return 0;
      }
    });

    return list.map((item) => {
      // Attach pre-computed stat so ProductCard doesn't need to re-lookup in salesStatsMap
      (item.product as { salesStat?: ProductSalesStat }).salesStat = item.stat;
      return item.product;
    });
  }, [indexedProducts, deferredQuery, category, inStockOnly, sortBy]);

  const totalItems = cartLines.reduce((sum, line) => sum + line.quantity, 0);
  const paidAmount = Math.max(0, Math.round(Number(paidAmountInput.replace(/\D/g, "")) || 0));
  const isCashPayment = paymentMethod === "Tunai";
  const showQrisPreview = paymentMethod === "QRIS" && cartLines.length > 0;
  const needsPaymentInfo = paymentMethod === "Transfer";
  const cashShortfall = Math.max(0, cartTotal - paidAmount);
  const changeAmount = isCashPayment ? Math.max(0, paidAmount - cartTotal) : 0;
  const hasMeasuredWorkspace = workspaceWidth > 0;
  const shouldStackCheckout = hasMeasuredWorkspace && workspaceWidth < 560;

  // Responsive column count tuned for tablets:
  // Tablets (415px - 780px product area) display exactly 4 columns!
  const colCount = useMemo(() => {
    if (productColumnWidth === 0) return 4;
    if (productColumnWidth < 220) return 1;
    if (productColumnWidth < 320) return 2;
    if (productColumnWidth < 415) return 3;
    if (productColumnWidth < 780) return 4; // Tablet portrait & landscape with cart
    if (productColumnWidth < 1050) return 5;
    return 6;
  }, [productColumnWidth]);

  const productGridClass =
    colCount === 1 ? "grid-cols-1"
    : colCount === 2 ? "grid-cols-2"
    : colCount === 3 ? "grid-cols-3"
    : colCount === 4 ? "grid-cols-4"
    : colCount === 5 ? "grid-cols-5"
    : "grid-cols-6";
  const canCheckout =
    cartLines.length > 0 && hasOpenShift === true && (!isCashPayment || (paidAmountInput.trim() !== "" && cashShortfall === 0));

  async function handleCheckout() {
    if (isSubmittingRef.current) {
      return;
    }
    isSubmittingRef.current = true;
    setIsSubmitting(true);

    try {
      if (hasOpenShift === false) {
        toast.error("Buka shift dulu sebelum mulai jualan.");
        return;
      }
      const invalidStockLine = cartLines.find((line) => line.quantity > line.product.stock);
      if (invalidStockLine) {
        toast.error(`Stok ${invalidStockLine.product.name} tidak cukup.`, {
          description: `Diminta ${invalidStockLine.quantity} pcs, tersedia ${invalidStockLine.product.stock} pcs.`,
        });
        return;
      }

      if (isCashPayment && (paidAmountInput.trim() === "" || paidAmount < cartTotal)) {
        toast.error("Uang dibayarkan belum cukup.", {
          description: `Kurang ${formatCurrency(cashShortfall)} dari total tagihan.`,
        });
        return;
      }

      const transaction = await checkout(isCashPayment ? paidAmount : undefined);
      if (!transaction) {
        toast.error("Keranjang masih kosong.");
        return;
      }

      const lowProducts = transaction.items.reduce<Product[]>((items, item) => {
        const product = products.find((candidate) => candidate.id === item.productId);
        if (!product) {
          return items;
        }

        if (product.stock - item.quantity <= product.minimumStock) {
          items.push(product);
        }

        return items;
      }, []);

      toast.success("Transaksi berhasil disimpan.", {
        description: `${transaction.items.length} produk masuk ke penjualan ${paymentLabels[transaction.paymentMethod]}.`,
      });
      window.dispatchEvent(new CustomEvent("pcm-reports-updated", { detail: { action: "transaction_added" } }));
      window.dispatchEvent(new CustomEvent("cashier-shift-updated"));
      const transactionRecordedBy = {
        userId: transaction.recordedByUserId ?? "",
        name: transaction.recordedByName || "Kasir",
        shiftSessionId: transaction.shiftSessionId ?? null,
      };
      const nextRecordedByKey = `${transactionRecordedBy.userId}:${transactionRecordedBy.shiftSessionId ?? "auto"}`;
      if (nextRecordedByKey && lastRecordedByKey && nextRecordedByKey !== lastRecordedByKey) {
        setShiftBannerName(transactionRecordedBy.name);
      }
      if (!lastRecordedByKey && nextRecordedByKey) {
        setShiftBannerName(transactionRecordedBy.name);
      }
      setRecordedBy(transactionRecordedBy);
      setLastRecordedByKey(nextRecordedByKey);
      setLastTransaction(transaction);
      setReceiptOpen(true);
      setPaidAmountInput("");
      setQuery("");

      if (lowProducts.length > 0) {
        toast.warning("Ada produk yang mendekati stok minimum.", {
          description: `Siapkan restok untuk ${lowProducts.slice(0, 2).map((item) => item.name).join(", ")}.`,
        });
      }
    } catch (error) {
      const msg = error instanceof Error ? error.message : "Gagal menyimpan transaksi.";
      if (msg.includes("SHIFT_NOT_OPEN")) {
        setHasOpenShift(false);
        toast.error("Shift belum dibuka atau sudah ditutup.");
      } else {
        toast.error(msg);
      }
    } finally {
      isSubmittingRef.current = false;
      setIsSubmitting(false);
    }
  }

  return (
    <div
      ref={workspaceRef}
      className={cn(
        "grid gap-4 h-full max-h-full overflow-hidden",
        shouldStackCheckout
          ? "grid-cols-1 auto-rows-min overflow-auto"
          : "grid-cols-[minmax(200px,1fr)_minmax(280px,320px)] md:grid-cols-[minmax(0,1fr)_minmax(280px,320px)] xl:grid-cols-[minmax(0,1fr)_minmax(330px,380px)] 2xl:grid-cols-[minmax(0,1fr)_minmax(380px,0.76fr)]"
      )}
    >
      {shiftBannerName ? (
        <ShiftChangeBanner cashierName={shiftBannerName} onDone={() => setShiftBannerName(null)} />
      ) : null}
      {receiptOpen && lastTransaction ? (
        <ReceiptPrintDialog
          open={receiptOpen}
          onOpenChange={setReceiptOpen}
          settings={settings}
          transaction={lastTransaction}
        />
      ) : null}
      <PaymentInstructionDialog
        open={paymentInfoOpen}
        onOpenChange={setPaymentInfoOpen}
        method={paymentMethod}
        total={cartTotal}
        settings={settings}
      />
      <ProductDetailDialog
        product={detailProduct}
        salesStat={detailProduct ? (salesStatsMap.get(detailProduct.id) || salesStatsMap.get(detailProduct.name.trim().toLowerCase())) : null}
        open={Boolean(detailProduct)}
        onOpenChange={(open) => !open && setDetailProduct(null)}
        onAdd={() => {
          if (!detailProduct) return;
          const existingLine = cartLines.find((line) => line.product.id === detailProduct.id);
          if (existingLine && existingLine.quantity >= detailProduct.stock) {
            toast.error(`Stok ${detailProduct.name} tidak cukup.`, {
              description: `Keranjang sudah mencapai stok tersedia (${detailProduct.stock} pcs).`,
            });
            return;
          }

          addToCart(detailProduct.id);
          toast.success(`${detailProduct.name} ditambahkan ke keranjang.`, {
            description: `Stok tersedia ${detailProduct.stock} pcs.`,
          });
          focusAndSelectSearch();
        }}
      />
      <div ref={productColumnRef} className="min-w-0 min-h-0 flex flex-col overflow-hidden">
        <Card className="border-border/60 bg-card/74 shadow-[0_28px_70px_-45px_rgba(66,38,20,0.55)] flex flex-col flex-1 overflow-hidden">
          {/* Condensed & padat CardHeader to maximize product card visibility on tablets */}
          <CardHeader className="flex flex-col gap-1.5 p-2 xl:p-2.5 pb-2 border-b border-border/40 shrink-0">
            {/* Row 1: Title & Count, Search Bar, Sort, In-Stock Toggle, Cashier Indicator */}
            <div className="flex items-center gap-1.5 w-full">
              <div className="flex items-center gap-1 shrink-0">
                <CardTitle className="font-heading text-sm xl:text-base font-bold tracking-tight">Produk</CardTitle>
                <span className="rounded-full bg-primary/10 px-1.5 py-0.5 text-[10px] font-bold text-primary tabular-nums shrink-0">
                  {filteredProducts.length}
                </span>
              </div>

              <div className="relative flex-1 min-w-[120px]">
                <Search className="pointer-events-none absolute top-1/2 left-2.5 size-3.5 -translate-y-1/2 text-muted-foreground" />
                <Input
                  ref={searchInputRef}
                  value={query}
                  onChange={(event) => setQuery(event.target.value)}
                  onFocus={(event) => {
                    event.currentTarget.select();
                  }}
                  onMouseUp={(event) => {
                    if (event.currentTarget.value) {
                      event.currentTarget.select();
                    }
                  }}
                  onKeyDown={(event) => {
                    if (event.key === "Enter" && filteredProducts.length > 0) {
                      event.preventDefault();
                      handleAddToCart(filteredProducts[0]);
                      focusAndSelectSearch();
                    }
                  }}
                  placeholder="Cari produk / barcode..."
                  className="h-8 rounded-xl border-border/70 bg-card/80 pl-7 pr-7 text-xs shadow-2xs"
                />
                {query ? (
                  <button
                    type="button"
                    onClick={() => {
                      setQuery("");
                      searchInputRef.current?.focus();
                    }}
                    className="absolute top-1/2 right-2 -translate-y-1/2 p-0.5 text-muted-foreground transition-colors hover:text-foreground rounded-full"
                    title="Hapus pencarian"
                  >
                    <X className="size-3" />
                  </button>
                ) : null}
              </div>

              <div className="flex items-center gap-1 shrink-0">
                <Select value={sortBy} onValueChange={(val) => setSortBy(val as SortOption)}>
                  <SelectTrigger className="h-8 rounded-xl border-border/70 bg-card/80 px-2 min-w-[105px] sm:min-w-[125px] text-[11px] font-semibold gap-1 shadow-2xs">
                    <ArrowUpDown className="size-3 text-primary shrink-0" />
                    <SelectValue placeholder="Urutkan" />
                  </SelectTrigger>
                  <SelectContent
                    align="end"
                    side="bottom"
                    sideOffset={6}
                    alignItemWithTrigger={false}
                    className="w-auto min-w-[245px] sm:min-w-[265px] max-w-[calc(100vw-2rem)] rounded-2xl border border-border/90 bg-popover text-popover-foreground shadow-2xl p-1.5 text-xs z-[100] backdrop-blur-none ring-1 ring-border/50"
                  >
                    <SelectItem value="popular" className="rounded-xl py-2 px-2.5 font-medium cursor-pointer">
                      <span className="flex items-center gap-2">
                        <Flame className="size-3.5 text-amber-500 fill-amber-500/20 shrink-0" />
                        <span className="whitespace-nowrap font-medium">Terlaris (Rutin & Omzet)</span>
                      </span>
                    </SelectItem>
                    <SelectItem value="revenue-desc" className="rounded-xl py-2 px-2.5 font-medium cursor-pointer">
                      <span className="flex items-center gap-2">
                        <CircleDollarSign className="size-3.5 text-emerald-500 shrink-0" />
                        <span className="whitespace-nowrap font-medium">Omzet Penjualan Terbesar</span>
                      </span>
                    </SelectItem>
                    <SelectItem value="qty-desc" className="rounded-xl py-2 px-2.5 font-medium cursor-pointer">
                      <span className="flex items-center gap-2">
                        <ShoppingBasket className="size-3.5 text-sky-500 shrink-0" />
                        <span className="whitespace-nowrap font-medium">Kuantitas Terbanyak (Pcs)</span>
                      </span>
                    </SelectItem>
                    <SelectItem value="stock-desc" className="rounded-xl py-2 px-2.5 font-medium cursor-pointer">
                      <span className="flex items-center gap-2">
                        <PackageCheck className="size-3.5 text-emerald-500 shrink-0" />
                        <span className="whitespace-nowrap font-medium">Stok Terbanyak</span>
                      </span>
                    </SelectItem>
                    <SelectItem value="stock-asc" className="rounded-xl py-2 px-2.5 font-medium cursor-pointer">
                      <span className="flex items-center gap-2">
                        <AlertTriangle className="size-3.5 text-amber-500 shrink-0" />
                        <span className="whitespace-nowrap font-medium">Stok Tersedikit</span>
                      </span>
                    </SelectItem>
                    <SelectItem value="name-asc" className="rounded-xl py-2 px-2.5 font-medium cursor-pointer">
                      <span className="flex items-center gap-2">
                        <span className="text-xs shrink-0">🔤</span>
                        <span className="whitespace-nowrap font-medium">Nama (A → Z)</span>
                      </span>
                    </SelectItem>
                    <SelectItem value="name-desc" className="rounded-xl py-2 px-2.5 font-medium cursor-pointer">
                      <span className="flex items-center gap-2">
                        <span className="text-xs shrink-0">🔤</span>
                        <span className="whitespace-nowrap font-medium">Nama (Z → A)</span>
                      </span>
                    </SelectItem>
                    <SelectItem value="price-asc" className="rounded-xl py-2 px-2.5 font-medium cursor-pointer">
                      <span className="flex items-center gap-2">
                        <span className="text-xs font-bold text-primary shrink-0">Rp↑</span>
                        <span className="whitespace-nowrap font-medium">Harga Termurah</span>
                      </span>
                    </SelectItem>
                    <SelectItem value="price-desc" className="rounded-xl py-2 px-2.5 font-medium cursor-pointer">
                      <span className="flex items-center gap-2">
                        <span className="text-xs font-bold text-primary shrink-0">Rp↓</span>
                        <span className="whitespace-nowrap font-medium">Harga Tertinggi</span>
                      </span>
                    </SelectItem>
                  </SelectContent>
                </Select>

                <Button
                  type="button"
                  size="sm"
                  variant={inStockOnly ? "default" : "outline"}
                  onClick={() => setInStockOnly((v) => !v)}
                  className={cn(
                    "h-8 rounded-xl px-2 text-[11px] font-semibold gap-1 transition-all shadow-2xs shrink-0",
                    inStockOnly
                      ? "bg-emerald-600 hover:bg-emerald-700 text-white border-transparent"
                      : "border-border/70 bg-card/80 text-muted-foreground hover:text-foreground"
                  )}
                  title={inStockOnly ? "Hanya menampilkan stok > 0. Klik untuk melihat semua." : "Klik untuk menyaring produk dengan stok > 0"}
                >
                  <PackageCheck className={cn("size-3", inStockOnly ? "text-white" : "text-muted-foreground")} />
                  <span className="hidden sm:inline">{inStockOnly ? "Stok Ada" : "Semua"}</span>
                </Button>

                <div className="hidden lg:inline-flex items-center gap-1 rounded-xl border border-border/70 bg-card/70 px-2 py-1 text-[10px] text-muted-foreground shadow-2xs shrink-0">
                  <UserRoundCheck className="size-3 text-primary" />
                  <span className="truncate max-w-[90px]">{recordedBy?.name ?? "Shift"}</span>
                </div>
              </div>
            </div>

            {/* Row 2: Compact Category Filter Chips */}
            <div className="flex items-center gap-1 overflow-x-auto no-scrollbar py-0.5">
              {categoryLabels.map((item) => {
                const isSelected = category === item.value;
                const isTerlaris = item.value === "Terlaris";

                return (
                  <Button
                    key={item.value}
                    type="button"
                    variant={isSelected ? "default" : "outline"}
                    size="sm"
                    className={cn(
                      "rounded-full h-6.5 px-2.5 text-[10.5px] font-semibold transition-all shrink-0",
                      isTerlaris && !isSelected && "border-amber-500/40 text-amber-700 dark:text-amber-400 hover:bg-amber-500/10",
                      isTerlaris && isSelected && "bg-gradient-to-r from-amber-600 to-orange-600 text-white border-transparent shadow-2xs",
                      !isTerlaris && isSelected && "shadow-2xs",
                      !isTerlaris && !isSelected && "border-border/60 text-muted-foreground hover:text-foreground bg-card/60"
                    )}
                    onClick={() => setCategory(item.value)}
                  >
                    {isTerlaris && <Flame className={cn("mr-0.5 size-2.5", isSelected ? "fill-white/40" : "fill-amber-500/30 text-amber-600")} />}
                    {item.label}
                  </Button>
                );
              })}

              {sortBy === "popular" && (
                <span className="hidden sm:inline-flex items-center gap-1 text-[9.5px] text-amber-800 dark:text-amber-300 bg-amber-500/10 border border-amber-500/20 rounded-full px-2 py-0.5 ml-auto font-medium shrink-0">
                  <Flame className="size-2.5 fill-amber-500/30 text-amber-600" />
                  Terlaris
                </span>
              )}
            </div>
          </CardHeader>
          <VirtualizedProductGrid
            dataState={dataState}
            products={products}
            filteredProducts={filteredProducts}
            salesStatsMap={salesStatsMap}
            colCount={colCount}
            productGridClass={productGridClass}
            retryWorkspace={retryWorkspace}
            onAdd={handleAddToCart}
            onDetail={handleDetailProduct}
            activeFilterKey={`${category}-${sortBy}-${deferredQuery}-${inStockOnly}`}
          />
        </Card>
      </div>

      <div className="min-w-0 min-h-0 flex flex-col overflow-hidden">
        <Card
          className={cn(
            "glass-panel border-border/60 shadow-[0_28px_70px_-48px_rgba(66,38,20,0.6)] flex flex-col flex-1 overflow-hidden",
            !shouldStackCheckout && "sticky top-0"
          )}
        >
          <CardHeader className="shrink-0 pb-3">
            <div className="flex items-center justify-between gap-2">
              <div>
                <CardTitle className="font-heading text-2xl">Keranjang aktif</CardTitle>
                <CardDescription>Semua item yang sudah ditap akan muncul di sini.</CardDescription>
              </div>
              <div className="flex items-center gap-2 shrink-0">
                {shiftRemainingCalc?.isDue && (
                  <button
                    type="button"
                    onClick={() => {
                      setShiftWarningDismissed(false);
                      setShiftClosingOpen(true);
                    }}
                    title="Klik untuk membuka dialog tutup buku shift"
                    className={cn(
                      "inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-bold transition-all shadow-sm cursor-pointer",
                      shiftRemainingCalc.isOverdue
                        ? "bg-red-500/15 text-red-700 dark:text-red-400 border border-red-500/30 animate-pulse hover:bg-red-500/25"
                        : "bg-amber-500/15 text-amber-800 dark:text-amber-300 border border-amber-500/30 hover:bg-amber-500/25"
                    )}
                  >
                    <CircleDollarSign className="size-3.5" />
                    <span>
                      {shiftRemainingCalc.isOverdue
                        ? `Tutup Buku (${Math.abs(shiftRemainingCalc.remainingMinutes)}m lalu)`
                        : `Tutup Buku (${shiftRemainingCalc.remainingMinutes}m)`}
                    </span>
                  </button>
                )}
                <Badge className="rounded-full bg-foreground text-background">{cartLines.length} item</Badge>
              </div>
            </div>
          </CardHeader>

          {shiftRemainingCalc?.isDue && !shiftWarningDismissed && (
            <div className="mx-4 sm:mx-5 mb-2 rounded-2xl border border-amber-500/35 bg-gradient-to-br from-amber-500/15 via-orange-500/10 to-amber-500/15 p-3.5 text-amber-950 dark:text-amber-100 shadow-sm animate-in fade-in slide-in-from-top-2 duration-300">
              <div className="flex items-start justify-between gap-2.5">
                <div className="flex items-start gap-2.5 min-w-0">
                  <div
                    className={cn(
                      "p-2 rounded-xl text-white shrink-0 mt-0.5 shadow-sm",
                      shiftRemainingCalc.isOverdue ? "bg-red-600 animate-pulse" : "bg-amber-600"
                    )}
                  >
                    <BellRing className="size-4" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <p className="font-heading font-bold text-sm text-foreground">
                        {shiftRemainingCalc.isOverdue
                          ? "Shift Telah Berakhir — Tutup Buku"
                          : "Pemberitahuan Tutup Buku Shift"}
                      </p>
                      <span
                        className={cn(
                          "text-[10px] font-bold px-2 py-0.5 rounded-full uppercase tracking-wider",
                          shiftRemainingCalc.isOverdue
                            ? "bg-red-500/20 text-red-700 dark:text-red-300"
                            : "bg-amber-500/20 text-amber-800 dark:text-amber-200"
                        )}
                      >
                        {shiftRemainingCalc.isOverdue
                          ? `Lewat ${Math.abs(shiftRemainingCalc.remainingMinutes)} Menit`
                          : `Sisa ${shiftRemainingCalc.remainingMinutes} Menit`}
                      </span>
                    </div>
                    <p className="mt-1 text-xs text-muted-foreground leading-relaxed">
                      {shiftRemainingCalc.isOverdue
                        ? `Shift ${shiftRemainingCalc.shiftName} selesai pkl ${shiftRemainingCalc.endTime}. Harap segera lakukan tutup buku dan rekonsiliasi uang kas fisik.`
                        : `Shift ${shiftRemainingCalc.shiftName} akan berakhir pkl ${shiftRemainingCalc.endTime}. Mohon persiapkan rekonsiliasi kas dan tutup buku.`}
                    </p>
                    <div className="mt-2.5 flex flex-wrap items-center gap-2">
                      <Button
                        type="button"
                        size="sm"
                        onClick={() => setShiftClosingOpen(true)}
                        className="h-8 rounded-xl bg-amber-600 hover:bg-amber-700 text-white font-semibold text-xs px-3.5 shadow-sm cursor-pointer"
                      >
                        <CircleDollarSign className="size-3.5 mr-1" />
                        Tutup Buku Sekarang
                      </Button>
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        onClick={() => setShiftWarningDismissed(true)}
                        className="h-8 rounded-xl text-xs text-muted-foreground hover:text-foreground cursor-pointer"
                      >
                        Tutup Sementara
                      </Button>
                    </div>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => setShiftWarningDismissed(true)}
                  className="text-muted-foreground hover:text-foreground p-1 rounded-lg transition-colors cursor-pointer shrink-0"
                  title="Sembunyikan peringatan"
                >
                  <X className="size-4" />
                </button>
              </div>
            </div>
          )}
          <CardContent className="flex-1 flex flex-col p-0 min-h-0 overflow-hidden">
            {/* Scrollable middle: cart items + payment options */}
            <div className="flex-1 overflow-y-auto custom-scrollbar space-y-3 sm:space-y-4 p-4 sm:p-5 min-h-0">
            <div
              className={cn(
                "rounded-[24px] border border-border bg-background/25 p-3 sm:p-3.5 shadow-inner dark:bg-black/15 transition-all min-h-[80px] flex flex-col overflow-y-auto custom-scrollbar",
                cartLines.length === 0 ? "justify-center items-center text-center flex-1" : "justify-start"
              )}
            >
              {cartLines.length > 0 ? (
                <div className="space-y-2.5">
                  {cartLines.map((line) => (
                    <CartItemRow
                      key={line.product.id}
                      line={line}
                      onRemove={handleRemoveFromCart}
                      onUpdateQuantity={handleUpdateCartQuantity}
                    />
                  ))}
                </div>
              ) : (
                <div className="flex flex-col items-center justify-center text-center py-4">
                  <ReceiptText className="size-9 text-muted-foreground" />
                  <p className="mt-3 font-heading text-lg font-semibold">Belum ada item</p>
                  <p className="mt-1 max-w-xs text-xs text-muted-foreground">
                    Tap produk dari sisi kiri untuk mulai membuat transaksi baru.
                  </p>
                </div>
              )}
            </div>

            <div className="space-y-2 sm:space-y-2.5 lg:space-y-3 shrink-0">
              <p className="text-xs sm:text-sm font-medium text-muted-foreground">Metode pembayaran</p>
              <div className="grid gap-1.5 sm:gap-2 sm:grid-cols-3">
                {settings.enabledPayments.map((method) => (
                  <Button
                    key={method}
                    type="button"
                    variant={paymentMethod === method ? "default" : "outline"}
                    className={cn(
                      "h-10 sm:h-11 lg:h-12 rounded-xl lg:rounded-2xl text-xs sm:text-sm font-semibold",
                      paymentMethod === method && "shadow-[0_20px_40px_-22px_rgba(186,92,35,0.75)]"
                    )}
                    onClick={() => {
                      setPaymentMethod(method);
                      if (method === "Transfer" && typeof window !== "undefined" && window.localStorage.getItem("hideTransferPopup") !== "true") {
                        setPaymentInfoOpen(true);
                      }
                    }}
                  >
                    {method === "Tunai" ? <BanknoteArrowDown className="size-3.5 sm:size-4" /> : <CreditCard className="size-3.5 sm:size-4" />}
                    {paymentLabels[method]}
                  </Button>
                ))}
              </div>
            </div>

            {needsPaymentInfo ? (
              <div className="rounded-[22px] border border-border/70 bg-card/55 p-3.5 lg:p-4 shrink-0">
                <div className="flex flex-col gap-2.5 lg:gap-3">
                  <div className="flex items-center gap-2 text-xs sm:text-sm font-medium">
                    <CreditCard className="size-4 text-primary" />
                    Transfer Bank / e-Wallet
                  </div>
                  <div className="space-y-2">
                    {settings.bankTransferInfo ? (
                      settings.bankTransferInfo.split("\n").filter(Boolean).map((info, idx) => (
                        <div key={idx} className="flex flex-wrap items-center justify-between gap-2 rounded-xl bg-card/70 px-3 py-2 border border-border/50 text-xs">
                          <span className="font-medium">{info.split(":")[0]?.trim() || "Bank"}</span>
                          <span className="font-mono text-muted-foreground">{info.split(":")[1]?.trim() || info}</span>
                        </div>
                      ))
                    ) : (
                      <p className="text-xs text-muted-foreground">Belum ada info rekening.</p>
                    )}
                  </div>
                </div>
              </div>
            ) : null}

            {isCashPayment ? (
              <div className="space-y-2 sm:space-y-2.5 lg:space-y-3 rounded-2xl lg:rounded-[22px] border border-border/70 bg-card/55 p-3 sm:p-3.5 lg:p-4 shrink-0">
                <div className="flex items-center justify-between gap-3">
                  <label htmlFor="paid-amount" className="text-xs sm:text-sm font-medium text-muted-foreground">
                    Uang dibayarkan
                  </label>
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    className="h-7 sm:h-8 rounded-xl px-2.5 sm:px-3 text-xs sm:text-sm font-semibold"
                    disabled={cartTotal <= 0}
                    onClick={() =>
                      setPaidAmountInput(
                        cartTotal > 0 ? new Intl.NumberFormat("id-ID").format(cartTotal) : ""
                      )
                    }
                  >
                    Uang pas
                  </Button>
                </div>
                <Input
                  id="paid-amount"
                  type="text"
                  inputMode="numeric"
                  value={paidAmountInput}
                  onChange={(event) => {
                    const digits = event.target.value.replace(/\D/g, "");
                    if (!digits) {
                      setPaidAmountInput("");
                      return;
                    }
                    const num = parseInt(digits, 10);
                    setPaidAmountInput(new Intl.NumberFormat("id-ID").format(num));
                  }}
                  placeholder="Masukkan nominal diterima"
                  className="h-10 sm:h-11 lg:h-12 rounded-xl lg:rounded-2xl border-border/80 bg-card text-base lg:text-lg font-semibold tabular-nums"
                />
                <div className="grid gap-1.5 sm:gap-2 sm:grid-cols-2">
                  <div className="rounded-xl lg:rounded-2xl bg-muted/40 px-3 py-1.5 sm:py-2">
                    <p className="text-xs text-muted-foreground">Diterima</p>
                    <p className="mt-0.5 lg:mt-1 font-semibold tabular-nums text-xs sm:text-sm">
                      {paidAmountInput ? formatCurrency(paidAmount) : "-"}
                    </p>
                  </div>
                  <div
                    className={cn(
                      "rounded-xl lg:rounded-2xl px-3 py-1.5 sm:py-2",
                      cashShortfall > 0
                        ? "bg-destructive/10 text-destructive"
                        : "bg-accent/15 text-accent-foreground"
                    )}
                  >
                    <p className="text-xs opacity-75">
                      {cashShortfall > 0 ? "Kurang" : "Kembalian"}
                    </p>
                    <p className="mt-0.5 lg:mt-1 font-semibold tabular-nums text-xs sm:text-sm">
                      {formatCurrency(cashShortfall > 0 ? cashShortfall : changeAmount)}
                    </p>
                  </div>
                </div>
              </div>
            ) : null}
            </div>

            {/* Fixed bottom: total + checkout - always visible */}
            <div className="shrink-0 border-t border-border/40 p-3 sm:p-4 lg:px-5 lg:py-4">
              <div className="rounded-[20px] lg:rounded-[24px] border border-border bg-card p-3 sm:p-3.5 lg:px-5 lg:py-4 text-card-foreground shadow-[inset_0_2px_4px_rgba(0,0,0,0.02)] dark:bg-muted/30">
              <div className="flex items-center justify-between text-xs sm:text-sm text-muted-foreground">
                <span className="font-medium">Total tagihan</span>
                <Badge variant="outline" className="rounded-full bg-background px-2.5 py-0.5 font-semibold text-xs border-border/60">
                  {totalItems} pcs
                </Badge>
              </div>
              <p className="mt-1 font-heading text-xl sm:text-2xl font-bold tracking-tight text-primary tabular-nums">
                {formatCurrency(cartTotal)}
              </p>
              {hasOpenShift === false ? (
                <div className="mt-2.5 rounded-xl border border-amber-500/30 bg-amber-500/10 p-3 text-xs text-amber-900 dark:text-amber-200">
                  <p className="font-semibold">Shift belum dibuka</p>
                  <p className="mt-0.5 text-xs text-muted-foreground dark:text-amber-300">
                    Buka shift di menu Harian & Shift sebelum mulai transaksi kasir.
                  </p>
                  <Link
                    href="/harian-shift"
                    className="mt-2 inline-flex items-center gap-1.5 rounded-lg bg-primary px-3 py-1.5 text-xs font-semibold text-primary-foreground hover:bg-primary/90 transition-colors"
                  >
                    <WalletCards className="size-3.5" />
                    Buka Shift Kasir
                  </Link>
                </div>
              ) : null}
              {hasOpenShift === null ? <p className="mt-2 text-xs text-muted-foreground">Memeriksa status shift...</p> : null}
              {showQrisPreview ? <QrisPaymentPreview items={cartLines} total={cartTotal} settings={settings} /> : null}
              <Button
                type="button"
                size="lg"
                className="mt-2 sm:mt-3 h-10 sm:h-11 lg:h-12 w-full rounded-xl lg:rounded-2xl bg-primary text-primary-foreground hover:bg-primary/90 font-semibold text-sm sm:text-base shadow-md disabled:opacity-60 disabled:cursor-not-allowed"
                disabled={!canCheckout || isSubmitting}
                onClick={() => void handleCheckout()}
              >
                {isSubmitting ? (
                  <span className="inline-flex items-center justify-center gap-2">
                    <Loader2 className="size-4 sm:size-5 animate-spin" />
                    Memproses transaksi...
                  </span>
                ) : (
                  "Selesaikan transaksi"
                )}
              </Button>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      <ShiftClosingDialog
        open={shiftClosingOpen}
        onOpenChange={setShiftClosingOpen}
        onClosed={() => void refreshShiftGate()}
      />
    </div>
  );
}
