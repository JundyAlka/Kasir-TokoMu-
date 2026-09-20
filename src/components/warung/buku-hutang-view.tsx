"use client";

import { useCallback, useMemo, useState } from "react";
import { CheckCircle2, Coins, Info, Loader2, Search, WalletCards } from "lucide-react";
import { toast } from "sonner";
import { useAppState } from "@/components/providers/app-state-provider";
import { StatCard } from "@/components/stat-card";
import { DebtDetailDialog } from "@/components/tokomu/debt-detail-dialog";
import { DebtFormDialog } from "@/components/tokomu/debt-form-dialog";
import { DebtImportDialog } from "@/components/tokomu/debt-import-dialog";
import {
  DebtSummaryDetailDialog,
  DebtSummaryMetric,
} from "@/components/tokomu/debt-summary-detail-dialog";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { formatCurrency, formatDate, formatDateTime } from "@/lib/format";
import type { Debt } from "@/lib/types";

type DebtFilter = "semua" | "aktif" | "lewat_tempo" | "lunas";

function statusClassName(status: Debt["status"]) {
  if (status === "lunas") {
    return "rounded-full bg-emerald-600 text-white font-semibold";
  }

  if (status === "lewat_tempo") {
    return "rounded-full bg-red-600 text-white font-semibold";
  }

  return "rounded-full bg-primary text-primary-foreground font-semibold";
}

function statusLabel(status: Debt["status"]) {
  if (status === "lunas") {
    return "Lunas";
  }

  if (status === "lewat_tempo") {
    return "Lewat tempo";
  }

  return "Aktif";
}

function parseNumberInput(value: string) {
  return Number(value.replace(/[^\d]/g, ""));
}

function formatNumberInput(value: number) {
  if (!value) return "";
  return new Intl.NumberFormat("id-ID").format(value);
}

export function BukuHutangView() {
  const { debts, products, addDebt } = useAppState();
  const [query, setQuery] = useState("");
  const [status, setStatus] = useState<DebtFilter>("semua");
  const [selectedDebtId, setSelectedDebtId] = useState<string | null>(null);
  const [detailOpen, setDetailOpen] = useState(false);
  const [debtOverrides, setDebtOverrides] = useState<Record<string, Debt>>({});
  const [activeSummaryMetric, setActiveSummaryMetric] = useState<DebtSummaryMetric | null>(null);

  // Quick Pay States
  const [quickPayDebt, setQuickPayDebt] = useState<Debt | null>(null);
  const [quickPayMode, setQuickPayMode] = useState<"cicil" | "lunas">("cicil");
  const [quickPayAmount, setQuickPayAmount] = useState<number>(0);
  const [quickPayNote, setQuickPayNote] = useState<string>("");
  const [quickPaySubmitting, setQuickPaySubmitting] = useState<boolean>(false);

  const visibleDebts = useMemo(
    () => debts.map((debt) => debtOverrides[debt.id] ?? debt),
    [debtOverrides, debts]
  );

  const filteredDebts = visibleDebts.filter((debt) => {
    const keyword = query.toLowerCase();
    const matchesKeyword =
      debt.borrowerName.toLowerCase().includes(keyword) ||
      debt.whatsapp.includes(keyword);
    const matchesStatus = status === "semua" || debt.status === status;
    return matchesKeyword && matchesStatus;
  });

  const outstandingTotal = visibleDebts
    .filter((debt) => debt.status !== "lunas")
    .reduce((sum, debt) => sum + debt.remainingAmount, 0);
  const paidCount = visibleDebts.filter((debt) => debt.status === "lunas").length;
  const overdueCount = visibleDebts.filter((debt) => debt.status === "lewat_tempo").length;

  const handleDebtUpdated = useCallback((debt: Debt) => {
    setDebtOverrides((current) => ({
      ...current,
      [debt.id]: debt,
    }));
  }, []);

  function openDetail(debtId: string) {
    setSelectedDebtId(debtId);
    setDetailOpen(true);
  }

  function openQuickCicil(debt: Debt) {
    setQuickPayDebt(debt);
    setQuickPayMode("cicil");
    setQuickPayAmount(Math.min(20000, debt.remainingAmount));
    setQuickPayNote("Cicilan kasbon");
  }

  function openQuickLunas(debt: Debt) {
    setQuickPayDebt(debt);
    setQuickPayMode("lunas");
    setQuickPayAmount(debt.remainingAmount);
    setQuickPayNote("Pelunasan kasbon");
  }

  async function handleQuickPaySubmit() {
    if (!quickPayDebt) return;
    if (quickPayAmount <= 0) {
      toast.error("Nominal pembayaran harus lebih dari Rp 0.");
      return;
    }
    if (quickPayAmount > quickPayDebt.remainingAmount) {
      toast.error(`Nominal melebihi sisa tagihan (${formatCurrency(quickPayDebt.remainingAmount)}).`);
      return;
    }

    try {
      setQuickPaySubmitting(true);
      const res = await fetch(`/api/debts/${quickPayDebt.id}/payments`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          amount: quickPayAmount,
          note: quickPayNote || (quickPayMode === "lunas" ? "Pelunasan kasbon" : "Cicilan kasbon"),
        }),
      });

      if (!res.ok) {
        const err = await res.json().catch(() => null);
        throw new Error(err?.error || "Gagal mencatat pembayaran.");
      }

      const data = (await res.json()) as { debt: Debt };
      handleDebtUpdated(data.debt);
      toast.success(
        data.debt.isPaid
          ? `Kasbon atas nama ${data.debt.borrowerName} telah LUNAS! 🎉`
          : `Cicilan ${formatCurrency(quickPayAmount)} untuk ${data.debt.borrowerName} berhasil dicatat!`
      );
      setQuickPayDebt(null);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Terjadi kesalahan saat memproses pembayaran.");
    } finally {
      setQuickPaySubmitting(false);
    }
  }

  return (
    <div className="space-y-4">
      <section className="grid gap-4 md:grid-cols-3">
        <StatCard
          title="Kasbon aktif"
          value={formatCurrency(outstandingTotal)}
          description="Total sisa piutang yang masih perlu ditagih."
          onClick={() => setActiveSummaryMetric("aktif")}
        />
        <StatCard
          title="Sudah lunas"
          value={`${paidCount} pelanggan`}
          description="Pelanggan yang sudah menyelesaikan pembayaran."
          tone="accent"
          onClick={() => setActiveSummaryMetric("lunas")}
        />
        <StatCard
          title="Lewat tempo"
          value={`${overdueCount} kasbon`}
          description="Kasbon belum lunas yang melewati jatuh tempo hari ini."
          tone="warn"
          onClick={() => setActiveSummaryMetric("lewat_tempo")}
        />
      </section>

      <Card className="border-border/60 bg-card/74 shadow-[0_28px_70px_-45px_rgba(66,38,20,0.55)]">
        <CardHeader className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
          <div>
            <CardTitle className="font-heading text-2xl">Buku hutang pelanggan</CardTitle>
            <CardDescription>
              Kelola kasbon, cicilan, dan rincian barang pelanggan dari satu halaman.
            </CardDescription>
          </div>

          <div className="flex flex-col sm:flex-row flex-wrap gap-2.5 md:items-center">
            <div className="relative min-w-[220px]">
              <Search className="absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                placeholder="Cari nama atau no. WhatsApp"
                className="h-11 rounded-2xl bg-card/85 pl-9"
              />
            </div>

            <DebtImportDialog />

            <DebtFormDialog
              products={products}
              onSubmit={async (draft) => {
                await addDebt(draft);
                toast.success("Kasbon berhasil disimpan.");
              }}
            />
          </div>
        </CardHeader>
        <CardContent className="space-y-5">
          <Tabs value={status} onValueChange={(value) => setStatus(value as DebtFilter)}>
            <TabsList className="rounded-full p-1">
              <TabsTrigger value="semua" className="rounded-full px-4">
                Semua
              </TabsTrigger>
              <TabsTrigger value="aktif" className="rounded-full px-4">
                Aktif
              </TabsTrigger>
              <TabsTrigger value="lewat_tempo" className="rounded-full px-4">
                Lewat tempo
              </TabsTrigger>
              <TabsTrigger value="lunas" className="rounded-full px-4">
                Lunas
              </TabsTrigger>
            </TabsList>
          </Tabs>

          {filteredDebts.length > 0 ? (
            <div className="grid gap-4 md:grid-cols-2">
              {filteredDebts.map((debt) => (
                <Card
                  key={debt.id}
                  className="h-full rounded-[26px] border border-border/70 bg-card/78 transition hover:border-primary/60 hover:bg-card flex flex-col justify-between"
                >
                  <CardContent className="space-y-4 p-5 flex-1 flex flex-col justify-between">
                    <div className="space-y-4">
                      <div
                        className="flex items-start justify-between gap-4 cursor-pointer"
                        onClick={() => openDetail(debt.id)}
                      >
                        <div>
                          <p className="font-heading text-xl font-semibold hover:text-primary transition-colors">
                            {debt.borrowerName}
                          </p>
                          <p className="mt-1 text-sm text-muted-foreground">
                            {debt.whatsapp || "Nomor WhatsApp belum diisi"}
                          </p>
                        </div>
                        <Badge className={statusClassName(debt.status)}>
                          {statusLabel(debt.status)}
                        </Badge>
                      </div>

                      {/* Progress bar */}
                      {(() => {
                        const paidPct =
                          debt.amount > 0
                            ? Math.min(
                                100,
                                Math.round(
                                  ((debt.amount - debt.remainingAmount) / debt.amount) * 100
                                )
                              )
                            : 0;
                        return (
                          <div className="rounded-[16px] border border-border/50 bg-muted/30 px-4 py-3">
                            <div className="flex items-center justify-between text-sm">
                              <span className="text-muted-foreground">Progress pembayaran</span>
                              <span className="font-semibold tabular-nums">{paidPct}%</span>
                            </div>
                            <div className="mt-2 h-2.5 overflow-hidden rounded-full bg-border/60">
                              <div
                                className={`h-full rounded-full transition-all ${
                                  paidPct >= 100
                                    ? "bg-emerald-500"
                                    : paidPct > 0
                                      ? "bg-primary"
                                      : "bg-border"
                                }`}
                                style={{ width: `${paidPct}%` }}
                              />
                            </div>
                          </div>
                        );
                      })()}

                      <div className="grid gap-3 sm:grid-cols-3">
                        <div className="rounded-[20px] bg-muted/55 p-3.5 sm:p-4">
                          <p className="text-xs sm:text-sm text-muted-foreground">Total</p>
                          <p className="mt-1.5 text-base sm:text-lg font-semibold">{formatCurrency(debt.amount)}</p>
                        </div>
                        <div className="rounded-[20px] bg-muted/55 p-3.5 sm:p-4">
                          <p className="text-xs sm:text-sm text-muted-foreground">Sisa</p>
                          <p className="mt-1.5 text-base sm:text-lg font-semibold text-destructive">{formatCurrency(debt.remainingAmount)}</p>
                        </div>
                        <div className="rounded-[20px] bg-muted/55 p-3.5 sm:p-4">
                          <p className="text-xs sm:text-sm text-muted-foreground">Tempo</p>
                          <p className="mt-1.5 text-base sm:text-lg font-semibold">{debt.dueDate ? formatDate(debt.dueDate) : "Tanpa batas"}</p>
                        </div>
                      </div>
                    </div>

                    {/* Quick Action Footer Bar */}
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 rounded-[20px] border border-border/70 bg-card/75 p-3.5 sm:p-4 text-sm mt-3">
                      <div className="text-xs text-muted-foreground">
                        <p>Dicatat: {formatDateTime(debt.createdAt)}</p>
                        <p className="mt-0.5">
                          Pengingat: {debt.lastReminderAt ? formatDateTime(debt.lastReminderAt) : "Belum dikirim"}
                        </p>
                      </div>

                      <div className="flex items-center gap-2 flex-wrap sm:flex-nowrap">
                        {debt.status !== "lunas" && debt.remainingAmount > 0 ? (
                          <>
                            <Button
                              type="button"
                              size="sm"
                              variant="outline"
                              onClick={() => openQuickCicil(debt)}
                              className="h-8 rounded-full border-primary/40 text-primary hover:bg-primary/10 px-3 text-xs font-semibold shadow-xs"
                            >
                              <Coins className="size-3.5 mr-1" />
                              Cicil
                            </Button>
                            <Button
                              type="button"
                              size="sm"
                              onClick={() => openQuickLunas(debt)}
                              className="h-8 rounded-full bg-emerald-600 hover:bg-emerald-700 text-white px-3 text-xs font-semibold shadow-xs"
                            >
                              <CheckCircle2 className="size-3.5 mr-1" />
                              Lunas
                            </Button>
                          </>
                        ) : (
                          <Badge
                            variant="outline"
                            className="h-8 rounded-full border-emerald-500/40 bg-emerald-50 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-400 px-3 font-medium text-xs flex items-center"
                          >
                            <CheckCircle2 className="size-3.5 mr-1" />
                            Lunas
                          </Badge>
                        )}
                        <Button
                          type="button"
                          size="sm"
                          variant="ghost"
                          onClick={() => openDetail(debt.id)}
                          className="h-8 rounded-full border border-border bg-card px-3 text-xs font-medium text-foreground hover:bg-muted shadow-xs"
                        >
                          <Info className="size-3.5 mr-1" />
                          Detail
                        </Button>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          ) : (
            <div className="flex min-h-48 flex-col items-center justify-center rounded-[26px] border border-dashed border-border/80 bg-muted/35 p-6 text-center">
              <WalletCards className="size-8 text-muted-foreground" />
              <p className="mt-3 font-medium">Belum ada kasbon yang cocok.</p>
              <p className="mt-1 max-w-md text-sm text-muted-foreground">
                Ubah filter atau catat kasbon baru untuk mulai melacak piutang pelanggan.
              </p>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Quick Pay Modal (Cicil / Lunas) */}
      <Dialog open={Boolean(quickPayDebt)} onOpenChange={(open) => !open && setQuickPayDebt(null)}>
        {quickPayDebt ? (
          <DialogContent className="sm:max-w-md rounded-[28px] p-6 gap-5">
            <DialogHeader>
              <DialogTitle className="font-heading text-xl flex items-center gap-2">
                {quickPayMode === "lunas" ? (
                  <>
                    <CheckCircle2 className="size-5 text-emerald-600" />
                    <span>Konfirmasi Pelunasan Kasbon</span>
                  </>
                ) : (
                  <>
                    <Coins className="size-5 text-primary" />
                    <span>Bayar Cicilan Kasbon</span>
                  </>
                )}
              </DialogTitle>
              <DialogDescription>
                Pelanggan: <span className="font-semibold text-foreground">{quickPayDebt.borrowerName}</span>
                {quickPayDebt.whatsapp ? ` (${quickPayDebt.whatsapp})` : ""}
              </DialogDescription>
            </DialogHeader>

            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-3">
                <div className="rounded-2xl border border-border/60 bg-muted/40 p-3">
                  <p className="text-xs text-muted-foreground">Total Kasbon</p>
                  <p className="text-base font-semibold mt-0.5">{formatCurrency(quickPayDebt.amount)}</p>
                </div>
                <div className="rounded-2xl border border-border/60 bg-destructive/10 p-3">
                  <p className="text-xs text-destructive font-medium">Sisa Tagihan</p>
                  <p className="text-base font-semibold text-destructive mt-0.5">
                    {formatCurrency(quickPayDebt.remainingAmount)}
                  </p>
                </div>
              </div>

              {quickPayMode === "cicil" ? (
                <div className="space-y-3">
                  <div>
                    <Label htmlFor="quick-amount" className="text-xs font-semibold">
                      Nominal Cicilan (Rp)
                    </Label>
                    <div className="relative mt-1.5">
                      <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-sm font-semibold text-muted-foreground">
                        Rp
                      </span>
                      <Input
                        id="quick-amount"
                        type="text"
                        value={formatNumberInput(quickPayAmount)}
                        onChange={(e) => setQuickPayAmount(parseNumberInput(e.target.value))}
                        className="pl-11 text-lg font-semibold rounded-xl h-12"
                        placeholder="0"
                        autoFocus
                      />
                    </div>
                  </div>

                  {/* Quick Preset Buttons */}
                  <div>
                    <p className="text-[11px] text-muted-foreground mb-1.5 font-medium">Pilihan Cepat:</p>
                    <div className="flex flex-wrap gap-1.5">
                      {[10000, 20000, 50000, 100000].map((nominal) => (
                        <Button
                          key={nominal}
                          type="button"
                          size="sm"
                          variant="outline"
                          disabled={nominal > quickPayDebt.remainingAmount}
                          onClick={() => setQuickPayAmount(nominal)}
                          className="h-7 text-xs rounded-lg px-2.5"
                        >
                          {formatCurrency(nominal)}
                        </Button>
                      ))}
                      <Button
                        type="button"
                        size="sm"
                        variant="secondary"
                        onClick={() => setQuickPayAmount(quickPayDebt.remainingAmount)}
                        className="h-7 text-xs rounded-lg px-2.5 font-semibold text-emerald-600 dark:text-emerald-400"
                      >
                        Semua ({formatCurrency(quickPayDebt.remainingAmount)})
                      </Button>
                    </div>
                  </div>

                  <div>
                    <Label htmlFor="quick-note" className="text-xs font-medium">
                      Catatan (Opsional)
                    </Label>
                    <Input
                      id="quick-note"
                      value={quickPayNote}
                      onChange={(e) => setQuickPayNote(e.target.value)}
                      placeholder="Contoh: Titip uang lewat tetangga"
                      className="mt-1 rounded-xl text-sm"
                    />
                  </div>
                </div>
              ) : (
                <div className="rounded-2xl border border-emerald-500/30 bg-emerald-500/10 p-4 text-center space-y-1.5">
                  <p className="text-xs text-muted-foreground">Pelanggan akan melunasi sisa tagihan sebesar:</p>
                  <p className="text-2xl font-bold text-emerald-600 dark:text-emerald-400">
                    {formatCurrency(quickPayDebt.remainingAmount)}
                  </p>
                  <p className="text-[11px] text-muted-foreground">
                    Status kasbon akan otomatis berubah menjadi <span className="font-semibold text-emerald-600">Lunas</span>.
                  </p>
                </div>
              )}
            </div>

            <DialogFooter className="gap-2 sm:gap-0 mt-2">
              <Button
                type="button"
                variant="outline"
                onClick={() => setQuickPayDebt(null)}
                disabled={quickPaySubmitting}
                className="rounded-full"
              >
                Batal
              </Button>
              <Button
                type="button"
                onClick={() => void handleQuickPaySubmit()}
                disabled={quickPaySubmitting || quickPayAmount <= 0}
                className={
                  quickPayMode === "lunas"
                    ? "rounded-full bg-emerald-600 hover:bg-emerald-700 text-white font-semibold"
                    : "rounded-full font-semibold"
                }
              >
                {quickPaySubmitting ? (
                  <>
                    <Loader2 className="size-4 animate-spin mr-2" />
                    Menyimpan...
                  </>
                ) : quickPayMode === "lunas" ? (
                  `Ya, Lunasi ${formatCurrency(quickPayDebt.remainingAmount)}`
                ) : (
                  `Simpan Cicilan ${formatCurrency(quickPayAmount)}`
                )}
              </Button>
            </DialogFooter>
          </DialogContent>
        ) : null}
      </Dialog>

      <DebtDetailDialog
        debtId={selectedDebtId}
        open={detailOpen}
        onOpenChange={setDetailOpen}
        onDebtUpdated={handleDebtUpdated}
        products={products}
      />
      <DebtSummaryDetailDialog
        debts={visibleDebts}
        metric={activeSummaryMetric}
        onClose={() => setActiveSummaryMetric(null)}
      />
    </div>
  );
}
