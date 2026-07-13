"use client";

import { type ReactNode, useEffect, useRef, useState } from "react";
import QRCode from "qrcode";
import {
  BanknoteArrowDown,
  Building2,
  CheckCircle2,
  Coffee,
  Copy,
  CreditCard,
  Minus,
  PackageSearch,
  Plus,
  QrCode,
  ReceiptText,
  Search,
  ShoppingBasket,
  Smartphone,
  Sparkles,
  UserRoundCheck,
  Wheat,
  X,
} from "lucide-react";
import { toast } from "sonner";
import { useAppState } from "@/components/providers/app-state-provider";
import { ReceiptPrintDialog } from "@/components/tokomu/receipt-print";
import { ShiftChangeBanner } from "@/components/tokomu/shift-change-banner";
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
import { ScrollArea } from "@/components/ui/scroll-area";
import { formatCurrency } from "@/lib/format";
import { generateDynamicQris } from "@/lib/qris";
import { PaymentMethod, Product, ProductCategory, Settings, Transaction } from "@/lib/types";
import { cn } from "@/lib/utils";

const paymentLabels: Record<PaymentMethod, string> = {
  Tunai: "Tunai",
  QRIS: "QRIS",
  Transfer: "Transfer",
};

const categoryLabels: Array<{ value: "Semua" | ProductCategory; label: string }> = [
  { value: "Semua", label: "Semua" },
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

function ProductCard({
  product,
  onAdd,
}: {
  product: Product;
  onAdd: () => void;
}) {
  const lowStock = product.stock <= product.minimumStock;

  return (
    <button
      type="button"
      onClick={onAdd}
      disabled={product.stock <= 0}
      className={cn(
        "group relative flex min-h-[164px] min-w-0 flex-col justify-between rounded-[26px] border border-border/65 bg-card/80 p-4 text-left shadow-[0_24px_50px_-36px_rgba(66,38,20,0.48)] transition hover:-translate-y-0.5 hover:border-primary/40 hover:shadow-[0_26px_60px_-34px_rgba(186,92,35,0.4)] disabled:cursor-not-allowed disabled:opacity-55 md:min-h-[214px] md:gap-4 md:pb-16 lg:min-h-[196px] 2xl:min-h-[164px] 2xl:pb-4",
        lowStock && "border-primary/45 bg-primary/8"
      )}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="flex size-12 shrink-0 items-center justify-center rounded-2xl bg-foreground text-background md:size-10 2xl:size-12">
          <ProductCategoryIcon category={product.category} />
        </div>
        <Badge
          className={cn(
            "max-w-[82px] truncate rounded-full border-0 px-3 py-1 text-xs md:max-w-[72px] md:px-2 md:text-[11px] 2xl:max-w-none 2xl:px-3 2xl:text-xs",
            lowStock ? "bg-primary text-primary-foreground" : "bg-accent text-accent-foreground"
          )}
        >
          {product.stock} stok
        </Badge>
      </div>

      <div className="min-w-0 space-y-2">
        <p className="line-clamp-2 break-words font-heading text-lg font-semibold tracking-tight md:text-base lg:text-[15px] 2xl:text-lg">
          {product.name}
        </p>
        <p className="line-clamp-2 break-words text-sm text-muted-foreground md:text-xs 2xl:text-sm">
          {product.description}
        </p>
      </div>

      <div className="flex items-end justify-between gap-3 md:block 2xl:flex 2xl:items-end">
        <div className="min-w-0">
          <p className="truncate text-xs uppercase tracking-[0.18em] text-muted-foreground md:text-[11px] 2xl:text-xs">
            {product.category}
          </p>
          <p className="mt-1 truncate text-lg font-semibold md:text-base 2xl:text-lg">
            {formatCurrency(product.sellPrice)}
          </p>
        </div>
        <div className="grid shrink-0 place-items-center rounded-full bg-foreground px-4 py-2 text-sm font-medium text-background transition group-hover:bg-primary md:absolute md:right-4 md:bottom-4 md:size-10 md:px-0 md:py-0 2xl:static 2xl:size-auto 2xl:px-4 2xl:py-2">
          <Plus className="hidden size-4 md:block 2xl:hidden" />
          <span className="md:sr-only 2xl:not-sr-only">Tap</span>
        </div>
      </div>
    </button>
  );
}

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
    void QRCode.toDataURL(payload, {
      color: { dark: "#1f1713", light: "#ffffff" },
      errorCorrectionLevel: "M",
      margin: 1,
      width: 220,
    })
      .then((dataUrl) => {
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

export function KasirView() {
  const {
    products,
    cartLines,
    cartTotal,
    paymentMethod,
    settings,
    addToCart,
    updateCartQuantity,
    removeFromCart,
    setPaymentMethod,
    checkout,
  } = useAppState();
  const [query, setQuery] = useState("");
  const [category, setCategory] = useState<"Semua" | ProductCategory>("Semua");
  const [receiptOpen, setReceiptOpen] = useState(false);
  const [lastTransaction, setLastTransaction] = useState<Transaction | null>(null);
  const [recordedBy, setRecordedBy] = useState<RecordedByInfo | null>(null);
  const [lastRecordedByKey, setLastRecordedByKey] = useState<string | null>(null);
  const [shiftBannerName, setShiftBannerName] = useState<string | null>(null);
  const [paidAmountInput, setPaidAmountInput] = useState("");
  const [paymentInfoOpen, setPaymentInfoOpen] = useState(false);
  const workspaceRef = useRef<HTMLDivElement>(null);
  const productColumnRef = useRef<HTMLDivElement>(null);
  const [workspaceWidth, setWorkspaceWidth] = useState(0);
  const [productColumnWidth, setProductColumnWidth] = useState(0);

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

  const filteredProducts = products.filter((product) => {
    const queryMatch =
      query.length === 0 ||
      product.name.toLowerCase().includes(query.toLowerCase()) ||
      product.description.toLowerCase().includes(query.toLowerCase());
    const categoryMatch = category === "Semua" || product.category === category;
    return queryMatch && categoryMatch;
  });
  const totalItems = cartLines.reduce((sum, line) => sum + line.quantity, 0);
  const paidAmount = Math.max(0, Math.round(Number(paidAmountInput) || 0));
  const isCashPayment = paymentMethod === "Tunai";
  const showQrisPreview = paymentMethod === "QRIS" && cartLines.length > 0;
  const needsPaymentInfo = paymentMethod === "Transfer";
  const cashShortfall = Math.max(0, cartTotal - paidAmount);
  const changeAmount = isCashPayment ? Math.max(0, paidAmount - cartTotal) : 0;
  const hasMeasuredWorkspace = workspaceWidth > 0;
  const shouldStackCheckout = hasMeasuredWorkspace && workspaceWidth < 560;
  const isProductHeaderCompact = productColumnWidth > 0 && productColumnWidth < 740;
  const productGridClass =
    productColumnWidth === 0
      ? "sm:grid-cols-2 md:grid-cols-3 xl:grid-cols-2 2xl:grid-cols-3"
      : productColumnWidth < 480
        ? "grid-cols-1"
        : productColumnWidth < 720
          ? "grid-cols-2"
          : "grid-cols-3";
  const canCheckout =
    cartLines.length > 0 && (!isCashPayment || (paidAmountInput.trim() !== "" && cashShortfall === 0));

  async function handleCheckout() {
    try {
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

      if (lowProducts.length > 0) {
        toast.warning("Ada produk yang mendekati stok minimum.", {
          description: `Siapkan restok untuk ${lowProducts.slice(0, 2).map((item) => item.name).join(", ")}.`,
        });
      }
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Gagal menyimpan transaksi.");
    }
  }

  return (
    <div
      ref={workspaceRef}
      className={cn(
        "grid gap-4",
        shouldStackCheckout
          ? "grid-cols-1"
          : "grid-cols-[minmax(220px,1fr)_minmax(300px,340px)] xl:grid-cols-[minmax(0,1fr)_minmax(340px,380px)] 2xl:grid-cols-[minmax(0,1fr)_minmax(380px,0.72fr)]"
      )}
    >
      {shiftBannerName ? (
        <ShiftChangeBanner cashierName={shiftBannerName} onDone={() => setShiftBannerName(null)} />
      ) : null}
      <ReceiptPrintDialog
        open={receiptOpen}
        onOpenChange={setReceiptOpen}
        settings={settings}
        transaction={lastTransaction}
      />
      <PaymentInstructionDialog
        open={paymentInfoOpen}
        onOpenChange={setPaymentInfoOpen}
        method={paymentMethod}
        total={cartTotal}
        settings={settings}
      />
      <div ref={productColumnRef} className="min-w-0">
        <Card className="border-border/60 bg-card/74 shadow-[0_28px_70px_-45px_rgba(66,38,20,0.55)]">
          <CardHeader
            className={cn(
              "flex flex-col gap-4",
              !isProductHeaderCompact && "md:flex-row md:items-center md:justify-between"
            )}
          >
            <div>
              <CardTitle className="font-heading text-2xl">Produk siap jual</CardTitle>
              <CardDescription>
                Semua fokus kasir ada di sini: cari produk, tap item, lalu lanjut ke keranjang.
              </CardDescription>
              <div className="mt-3 inline-flex items-center gap-2 rounded-full border border-border/70 bg-card/85 px-3 py-1.5 text-sm text-muted-foreground">
                <UserRoundCheck className="size-4 text-primary" />
                Dicatat oleh: <span className="font-medium text-foreground">{recordedBy?.name ?? "Mengikuti shift aktif"}</span>
              </div>
            </div>

            <div
              className={cn(
                "flex flex-col gap-3",
                isProductHeaderCompact ? "w-full" : "md:flex-row md:items-center"
              )}
            >
              <div className={cn("relative", isProductHeaderCompact ? "w-full" : "min-w-[220px]")}>
                <Search className="absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground" />
                <Input
                  value={query}
                  onChange={(event) => setQuery(event.target.value)}
                  placeholder="Cari produk atau kategori"
                  className="h-11 rounded-2xl border-border/80 bg-card/80 pl-9"
                />
              </div>
              <div className="flex flex-wrap gap-2">
                {categoryLabels.map((item) => (
                  <Button
                    key={item.value}
                    type="button"
                    variant={category === item.value ? "default" : "outline"}
                    className="rounded-full"
                    onClick={() => setCategory(item.value)}
                  >
                    {item.label}
                  </Button>
                ))}
              </div>
            </div>
          </CardHeader>
          <CardContent>
            {filteredProducts.length > 0 ? (
              <div
                className={cn(
                  "grid gap-4",
                  productGridClass
                )}
              >
                {filteredProducts.map((product) => (
                  <ProductCard
                    key={product.id}
                    product={product}
                    onAdd={() => {
                      const existingLine = cartLines.find((line) => line.product.id === product.id);
                      if (existingLine && existingLine.quantity >= product.stock) {
                        toast.error(`Stok ${product.name} tidak cukup.`, {
                          description: `Keranjang sudah mencapai stok tersedia (${product.stock} pcs).`,
                        });
                        return;
                      }

                      addToCart(product.id);
                      toast.success(`${product.name} ditambahkan ke keranjang.`, {
                        description: `Stok tersedia ${product.stock} pcs.`,
                      });
                    }}
                  />
                ))}
              </div>
            ) : (
              <div className="flex min-h-[240px] flex-col items-center justify-center rounded-[26px] border border-dashed border-border bg-card/55 text-center">
                <PackageSearch className="size-10 text-muted-foreground" />
                <p className="mt-4 font-heading text-xl font-semibold">Produk tidak ditemukan</p>
                <p className="mt-2 max-w-md text-sm text-muted-foreground">
                  Coba kata kunci lain atau pilih kategori yang lebih luas untuk melihat produk aktif.
                </p>
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      <div className="min-w-0">
        <Card
          className={cn(
            "glass-panel border-border/60 shadow-[0_28px_70px_-48px_rgba(66,38,20,0.6)]",
            !shouldStackCheckout && "sticky top-4 max-h-[calc(100vh-2rem)] overflow-y-auto custom-scrollbar"
          )}
        >
          <CardHeader>
            <div className="flex items-center justify-between">
              <div>
                <CardTitle className="font-heading text-2xl">Keranjang aktif</CardTitle>
                <CardDescription>Semua item yang sudah ditap akan muncul di sini.</CardDescription>
              </div>
              <Badge className="rounded-full bg-foreground text-background">{cartLines.length} item</Badge>
            </div>
          </CardHeader>
          <CardContent className="space-y-5">
            <ScrollArea className="h-[300px] rounded-[22px] border border-border/70 bg-card/60 p-3">
              {cartLines.length > 0 ? (
                <div className="space-y-3">
                  {cartLines.map((line) => (
                    <div
                      key={line.product.id}
                      className="rounded-[20px] border border-border/70 bg-card/85 p-3"
                    >
                      <div className="flex items-start justify-between gap-3">
                        <div>
                          <p className="font-medium">{line.product.name}</p>
                          <p className="text-sm text-muted-foreground">
                            {formatCurrency(line.product.sellPrice)} per item
                          </p>
                        </div>
                        <button
                          type="button"
                          onClick={() => removeFromCart(line.product.id)}
                          className="rounded-full p-1 text-muted-foreground transition hover:bg-muted hover:text-foreground"
                          aria-label={`Hapus ${line.product.name}`}
                        >
                          <X className="size-4" />
                        </button>
                      </div>

                      <div className="mt-4 flex items-center justify-between gap-3">
                        <div className="inline-flex items-center gap-2 rounded-full bg-muted px-2 py-1">
                          <Button
                            type="button"
                            size="icon-sm"
                            variant="ghost"
                            className="rounded-full"
                            onClick={() => updateCartQuantity(line.product.id, line.quantity - 1)}
                          >
                            <Minus className="size-4" />
                          </Button>
                          <span className="min-w-6 text-center text-sm font-semibold">{line.quantity}</span>
                          <Button
                            type="button"
                            size="icon-sm"
                            variant="ghost"
                            className="rounded-full"
                            onClick={() => {
                              if (line.quantity >= line.product.stock) {
                                toast.error(`Stok ${line.product.name} tidak cukup.`, {
                                  description: `Stok tersedia hanya ${line.product.stock} pcs.`,
                                });
                                return;
                              }

                              updateCartQuantity(line.product.id, line.quantity + 1);
                            }}
                          >
                            <Plus className="size-4" />
                          </Button>
                        </div>
                        <p className="font-semibold">{formatCurrency(line.lineTotal)}</p>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="flex h-full min-h-[240px] flex-col items-center justify-center text-center">
                  <ReceiptText className="size-10 text-muted-foreground" />
                  <p className="mt-4 font-heading text-xl font-semibold">Belum ada item</p>
                  <p className="mt-2 max-w-xs text-sm text-muted-foreground">
                    Tap produk dari sisi kiri untuk mulai membuat transaksi baru.
                  </p>
                </div>
              )}
            </ScrollArea>

            <div className="space-y-3">
              <p className="text-sm font-medium text-muted-foreground">Metode pembayaran</p>
              <div className="grid gap-2 sm:grid-cols-3">
                {settings.enabledPayments.map((method) => (
                  <Button
                    key={method}
                    type="button"
                    variant={paymentMethod === method ? "default" : "outline"}
                    className={cn(
                      "h-12 rounded-2xl",
                      paymentMethod === method && "shadow-[0_20px_40px_-22px_rgba(186,92,35,0.75)]"
                    )}
                    onClick={() => {
                      setPaymentMethod(method);
                      if (method === "Transfer" && typeof window !== "undefined" && window.localStorage.getItem("hideTransferPopup") !== "true") {
                        setPaymentInfoOpen(true);
                      }
                    }}
                  >
                    {method === "Tunai" ? <BanknoteArrowDown className="size-4" /> : <CreditCard className="size-4" />}
                    {paymentLabels[method]}
                  </Button>
                ))}
              </div>
            </div>

            {needsPaymentInfo ? (
              <div className="rounded-[22px] border border-border/70 bg-card/55 p-4">
                <div className="flex flex-col gap-3">
                  <div className="flex items-center gap-2 text-sm font-medium">
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
              <div className="space-y-3 rounded-[22px] border border-border/70 bg-card/55 p-4">
                <div className="flex items-center justify-between gap-3">
                  <label htmlFor="paid-amount" className="text-sm font-medium text-muted-foreground">
                    Uang dibayarkan
                  </label>
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    className="h-8 rounded-xl px-3"
                    disabled={cartTotal <= 0}
                    onClick={() => setPaidAmountInput(String(cartTotal))}
                  >
                    Uang pas
                  </Button>
                </div>
                <Input
                  id="paid-amount"
                  type="number"
                  min={0}
                  inputMode="numeric"
                  value={paidAmountInput}
                  onChange={(event) => setPaidAmountInput(event.target.value)}
                  placeholder="Masukkan nominal diterima"
                  className="h-12 rounded-2xl border-border/80 bg-card text-lg font-semibold tabular-nums"
                />
                <div className="grid gap-2 sm:grid-cols-2">
                  <div className="rounded-2xl bg-muted/40 px-3 py-2">
                    <p className="text-xs text-muted-foreground">Diterima</p>
                    <p className="mt-1 font-semibold tabular-nums">
                      {paidAmountInput ? formatCurrency(paidAmount) : "-"}
                    </p>
                  </div>
                  <div
                    className={cn(
                      "rounded-2xl px-3 py-2",
                      cashShortfall > 0
                        ? "bg-destructive/10 text-destructive"
                        : "bg-accent/15 text-accent-foreground"
                    )}
                  >
                    <p className="text-xs opacity-75">
                      {cashShortfall > 0 ? "Kurang" : "Kembalian"}
                    </p>
                    <p className="mt-1 font-semibold tabular-nums">
                      {formatCurrency(cashShortfall > 0 ? cashShortfall : changeAmount)}
                    </p>
                  </div>
                </div>
              </div>
            ) : null}

            <div className="rounded-[24px] border border-border/70 bg-card/70 px-4 py-4 text-card-foreground shadow-inner dark:bg-muted/45">
              <div className="flex items-center justify-between text-sm text-muted-foreground">
                <span>Total tagihan</span>
                <span>{totalItems} pcs</span>
              </div>
              <p className="mt-3 font-heading text-4xl font-semibold tracking-tight">
                {formatCurrency(cartTotal)}
              </p>
              {showQrisPreview ? <QrisPaymentPreview items={cartLines} total={cartTotal} settings={settings} /> : null}
              <Button
                type="button"
                size="lg"
                className="mt-4 h-13 w-full rounded-2xl bg-primary text-primary-foreground hover:bg-primary/90"
                disabled={!canCheckout}
                onClick={() => void handleCheckout()}
              >
                Selesaikan transaksi
              </Button>
              <p className="mt-3 text-sm text-muted-foreground">
                Checkout akan mengurangi stok dan menyimpan transaksi ke laporan.
              </p>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
