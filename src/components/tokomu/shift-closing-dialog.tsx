"use client";

import { useEffect, useState } from "react";
import {
  AlertTriangle,
  Banknote,
  CheckCircle2,
  CircleDollarSign,
  Coins,
  DollarSign,
  Info,
  Loader2,
  Lock,
  PiggyBank,
  Wallet,
} from "lucide-react";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { formatCurrency } from "@/lib/format";
import { cn } from "@/lib/utils";

type CashBalances = {
  cash: number;
  coins: number;
  savings: number;
};

type ShiftSession = {
  id: string;
  shiftId: string;
  shiftName: string;
  startedAt: string;
  openingTotal: number;
  expectedClosing: number | null;
  cashierUserId: string;
  cashierName: string;
};

type CashMovement = {
  cashSales: number;
  creditSales: number;
  debtRepayments: number;
  cashExpenses: number;
  cashIn: number;
};

type ShiftClosingDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onClosed?: () => void;
};

export function ShiftClosingDialog({
  open,
  onOpenChange,
  onClosed,
}: ShiftClosingDialogProps) {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [session, setSession] = useState<ShiftSession | null>(null);
  const [cashMovement, setCashMovement] = useState<CashMovement | null>(null);
  const [closing, setClosing] = useState<CashBalances>({
    cash: 0,
    coins: 0,
    savings: 0,
  });
  const [varianceNote, setVarianceNote] = useState("");

  async function loadCurrentShift() {
    setLoading(true);
    try {
      const res = await fetch("/api/shifts/current", { cache: "no-store" });
      const data = (await res.json().catch(() => null)) as {
        session?: ShiftSession | null;
        cashMovement?: CashMovement | null;
      } | null;

      if (res.ok && data?.session) {
        setSession(data.session);
        setCashMovement(data.cashMovement ?? null);

        const expClosing =
          (data.session.openingTotal ?? 0) +
          (data.cashMovement?.cashIn ?? 0) -
          (data.cashMovement?.cashExpenses ?? 0);

        setClosing({
          cash: expClosing > 0 ? expClosing : 0,
          coins: 0,
          savings: 0,
        });
        setVarianceNote("");
      } else {
        setSession(null);
      }
    } catch {
      setSession(null);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    if (open) {
      void loadCurrentShift();
    }
  }, [open]);

  const expectedClosing =
    (session?.openingTotal ?? 0) +
    (cashMovement?.cashIn ?? 0) -
    (cashMovement?.cashExpenses ?? 0);

  const actualClosing = closing.cash + closing.coins + closing.savings;
  const variance = actualClosing - expectedClosing;

  async function handleCloseShift() {
    if (!session) return;
    if (variance !== 0 && !varianceNote.trim()) {
      toast.error("Alasan selisih kas fisik wajib diisi.");
      return;
    }

    setSaving(true);
    try {
      const response = await fetch("/api/shifts/close", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          sessionId: session.id,
          closingCash: closing.cash,
          closingCoins: closing.coins,
          closingSavings: closing.savings,
          varianceNote: variance === 0 ? undefined : varianceNote.trim(),
        }),
      });

      const result = (await response.json().catch(() => null)) as { error?: string } | null;
      if (!response.ok) {
        throw new Error(result?.error ?? "Gagal menutup shift.");
      }

      toast.success(`Tutup buku shift ${session.shiftName} berhasil diselesaikan.`);
      onOpenChange(false);
      window.dispatchEvent(new CustomEvent("cashier-shift-updated"));
      onClosed?.();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Gagal menutup shift.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto custom-scrollbar">
        <DialogHeader>
          <div className="flex items-center gap-2">
            <div className="flex size-9 items-center justify-center rounded-xl bg-amber-500/15 text-amber-600 dark:text-amber-400">
              <CircleDollarSign className="size-5" />
            </div>
            <div>
              <DialogTitle className="font-heading text-xl">
                Tutup Buku Shift {session?.shiftName ? `(${session.shiftName})` : ""}
              </DialogTitle>
              <DialogDescription className="text-xs">
                Hitung uang fisik di laci kasir untuk mencocokkan saldo dengan sistem pembukuan.
              </DialogDescription>
            </div>
          </div>
        </DialogHeader>

        {loading ? (
          <div className="flex items-center justify-center py-12 text-sm text-muted-foreground">
            <Loader2 className="size-5 animate-spin mr-2" />
            Memuat data sesi shift kasir...
          </div>
        ) : !session ? (
          <div className="flex flex-col items-center justify-center py-10 text-center text-muted-foreground">
            <Lock className="size-10 stroke-1 text-muted-foreground/60 mb-2" />
            <p className="font-semibold text-foreground">Tidak Ada Shift Terbuka</p>
            <p className="text-xs max-w-sm mt-1">
              Saat ini belum ada sesi shift aktif yang tercatat atas nama Anda.
            </p>
          </div>
        ) : (
          <div className="space-y-4 pt-1">
            {/* Ringkasan Perhitungan Kas Masuk & Keluar */}
            <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-4">
              <div className="rounded-2xl border border-border/70 bg-card/80 p-3">
                <span className="text-[11px] text-muted-foreground font-medium">Kas Awal</span>
                <p className="mt-1 font-heading text-sm font-bold text-foreground tabular-nums">
                  {formatCurrency(session.openingTotal)}
                </p>
              </div>
              <div className="rounded-2xl border border-border/70 bg-card/80 p-3">
                <span className="text-[11px] text-muted-foreground font-medium">Penjualan Tunai</span>
                <p className="mt-1 font-heading text-sm font-bold text-emerald-600 dark:text-emerald-400 tabular-nums">
                  +{formatCurrency(cashMovement?.cashIn ?? 0)}
                </p>
              </div>
              <div className="rounded-2xl border border-border/70 bg-card/80 p-3">
                <span className="text-[11px] text-muted-foreground font-medium">Pengeluaran Kas</span>
                <p className="mt-1 font-heading text-sm font-bold text-destructive tabular-nums">
                  -{formatCurrency(cashMovement?.cashExpenses ?? 0)}
                </p>
              </div>
              <div className="rounded-2xl border border-primary/30 bg-primary/10 p-3">
                <span className="text-[11px] text-primary font-medium">Seharusnya di Laci</span>
                <p className="mt-1 font-heading text-sm font-bold text-primary tabular-nums">
                  {formatCurrency(expectedClosing)}
                </p>
              </div>
            </div>

            {/* Input Hitung Uang Fisik */}
            <div className="space-y-3 rounded-2xl border border-border/70 bg-card/70 p-4">
              <p className="text-xs font-semibold text-foreground flex items-center gap-1.5">
                <Wallet className="size-3.5 text-primary" />
                Penghitungan Kas Fisik Nyata di Kasir
              </p>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div className="space-y-1.5">
                  <Label htmlFor="closing-cash" className="text-xs font-medium flex items-center gap-1">
                    <Banknote className="size-3 text-muted-foreground" /> Uang Kertas (Laci)
                  </Label>
                  <Input
                    id="closing-cash"
                    type="number"
                    min={0}
                    value={closing.cash || ""}
                    onChange={(e) =>
                      setClosing((cur) => ({ ...cur, cash: Number(e.target.value) || 0 }))
                    }
                    placeholder="0"
                    className="h-10 rounded-xl bg-background font-semibold"
                  />
                </div>

                <div className="space-y-1.5">
                  <Label htmlFor="closing-coins" className="text-xs font-medium flex items-center gap-1">
                    <Coins className="size-3 text-muted-foreground" /> Uang Receh / Koin
                  </Label>
                  <Input
                    id="closing-coins"
                    type="number"
                    min={0}
                    value={closing.coins || ""}
                    onChange={(e) =>
                      setClosing((cur) => ({ ...cur, coins: Number(e.target.value) || 0 }))
                    }
                    placeholder="0"
                    className="h-10 rounded-xl bg-background font-semibold"
                  />
                </div>

                <div className="space-y-1.5">
                  <Label htmlFor="closing-savings" className="text-xs font-medium flex items-center gap-1">
                    <PiggyBank className="size-3 text-muted-foreground" /> Tabungan / Brankas
                  </Label>
                  <Input
                    id="closing-savings"
                    type="number"
                    min={0}
                    value={closing.savings || ""}
                    onChange={(e) =>
                      setClosing((cur) => ({ ...cur, savings: Number(e.target.value) || 0 }))
                    }
                    placeholder="0"
                    className="h-10 rounded-xl bg-background font-semibold"
                  />
                </div>
              </div>

              <div className="flex items-center justify-between pt-2 border-t border-border/40 text-xs">
                <span className="text-muted-foreground">Total Kas Fisik Dihitung:</span>
                <strong className="font-heading text-sm text-foreground tabular-nums">
                  {formatCurrency(actualClosing)}
                </strong>
              </div>
            </div>

            {/* Status Selisih Kas */}
            <div
              className={cn(
                "flex items-center justify-between rounded-xl border p-3 text-xs sm:text-sm font-semibold transition-all",
                variance === 0
                  ? "border-emerald-500/30 bg-emerald-500/10 text-emerald-700 dark:text-emerald-300"
                  : "border-destructive/30 bg-destructive/10 text-destructive"
              )}
            >
              <div className="flex items-center gap-2">
                {variance === 0 ? (
                  <CheckCircle2 className="size-4 text-emerald-600 dark:text-emerald-400" />
                ) : (
                  <AlertTriangle className="size-4 text-destructive" />
                )}
                <span>
                  {variance === 0
                    ? "Kas fisik sesuai (Pas)"
                    : variance > 0
                    ? "Kelebihan Kas Fisik"
                    : "Kekurangan Kas Fisik"}
                </span>
              </div>
              <span className="tabular-nums font-bold">
                {variance === 0 ? "Rp 0 (Sempurna)" : formatCurrency(variance)}
              </span>
            </div>

            {/* Alasan Selisih jika variance != 0 */}
            {variance !== 0 && (
              <div className="space-y-1.5 animate-in fade-in duration-200">
                <Label htmlFor="variance-note" className="text-xs font-semibold text-destructive">
                  Alasan Selisih Kas <span className="text-destructive">*</span>
                </Label>
                <Textarea
                  id="variance-note"
                  value={varianceNote}
                  onChange={(e) => setVarianceNote(e.target.value)}
                  placeholder="Jelaskan penyebab selisih kas fisik (misal: uang receh kembalian belum tercatat, salah hitung saldo awal, dll)..."
                  className="min-h-[72px] rounded-xl text-xs bg-background"
                />
              </div>
            )}

            {/* Action Buttons */}
            <div className="flex items-center justify-end gap-2.5 pt-2 border-t border-border/50">
              <Button
                type="button"
                variant="outline"
                onClick={() => onOpenChange(false)}
                className="h-10 rounded-xl px-4 text-xs font-medium cursor-pointer"
              >
                Batal
              </Button>
              <Button
                type="button"
                disabled={saving || (variance !== 0 && !varianceNote.trim())}
                onClick={() => void handleCloseShift()}
                className="h-10 rounded-xl px-5 text-xs font-bold shadow-sm shadow-primary/25 cursor-pointer"
              >
                <CircleDollarSign className="size-3.5 mr-1.5" />
                {saving ? "Menyimpan Tutup Buku..." : "Simpan & Tutup Buku"}
              </Button>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
