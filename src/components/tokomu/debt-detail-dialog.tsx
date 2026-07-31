"use client";

import { useEffect, useMemo, useState } from "react";
import { BadgeCheck, Info, MessageSquareShare, WalletCards, Pencil, Check, X, ChevronDown, Copy } from "lucide-react";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
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
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Textarea } from "@/components/ui/textarea";
import { formatCurrency, formatDate, formatDateTime } from "@/lib/format";
import type { Debt, DebtDetail } from "@/lib/types";

type DebtDetailDialogProps = {
  debtId: string | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onDebtUpdated: (debt: Debt) => void;
};

async function requestJson<T>(input: RequestInfo, init?: RequestInit): Promise<T> {
  const response = await fetch(input, {
    ...init,
    headers: {
      "Content-Type": "application/json",
      ...(init?.headers ?? {}),
    },
  });
  const data = (await response.json().catch(() => null)) as T & { error?: string | { issues?: { message: string }[] } } | null;

  if (!response.ok) {
    if (data?.error && typeof data.error === "object" && Array.isArray(data.error.issues)) {
      const issueMessage = data.error.issues.map((i) => i.message).join(", ");
      throw new Error(issueMessage || "Permintaan gagal karena data tidak valid.");
    }
    throw new Error(typeof data?.error === "string" ? data.error : "Permintaan gagal.");
  }

  return data as T;
}

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
  if (!value) {
    return "";
  }

  return new Intl.NumberFormat("id-ID").format(value);
}

export function DebtDetailDialog({ debtId, open, onOpenChange, onDebtUpdated }: DebtDetailDialogProps) {
  const [detail, setDetail] = useState<DebtDetail | null>(null);
  const [loading, setLoading] = useState(false);
  const [paymentAmount, setPaymentAmount] = useState(0);
  const [paymentNote, setPaymentNote] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [editingDueDate, setEditingDueDate] = useState(false);
  const [newDueDate, setNewDueDate] = useState("");
  const [newNoDueDate, setNewNoDueDate] = useState(false);
  const [showTemplate, setShowTemplate] = useState(false);

  useEffect(() => {
    if (!open || !debtId) {
      return;
    }

    let isActive = true;
    setLoading(true);
    void requestJson<{ debt: DebtDetail }>(`/api/debts/${debtId}`)
      .then((response) => {
        if (!isActive) {
          return;
        }
        setDetail(response.debt);
        setPaymentAmount(response.debt.remainingAmount);
        onDebtUpdated(response.debt);
      })
      .catch((error) => {
        if (isActive) {
          toast.error(error instanceof Error ? error.message : "Gagal mengambil detail kasbon.");
        }
      })
      .finally(() => {
        if (isActive) {
          setLoading(false);
        }
      });

    return () => {
      isActive = false;
    };
  }, [debtId, onDebtUpdated, open]);

  const paidPct = useMemo(() => {
    if (!detail || detail.amount <= 0) {
      return 0;
    }

    return Math.min(100, Math.round((detail.paidAmount / detail.amount) * 100));
  }, [detail]);

  async function refreshDetail(updatedDebt: Debt) {
    onDebtUpdated(updatedDebt);
    if (!debtId) {
      return;
    }

    const response = await requestJson<{ debt: DebtDetail }>(`/api/debts/${debtId}`);
    setDetail(response.debt);
    setPaymentAmount(response.debt.remainingAmount);
    setPaymentNote("");
    onDebtUpdated(response.debt);
  }

  async function handleSaveDueDate() {
    if (!detail) return;
    try {
      setSubmitting(true);
      const payload = {
        dueDate: newNoDueDate ? null : newDueDate,
      };
      const response = await requestJson<{ debt: DebtDetail }>(`/api/debts/${detail.id}`, {
        method: "PATCH",
        body: JSON.stringify(payload),
      });
      setDetail(response.debt);
      onDebtUpdated(response.debt);
      setEditingDueDate(false);
      toast.success("Jatuh tempo berhasil diubah.");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Gagal mengubah jatuh tempo.");
    } finally {
      setSubmitting(false);
    }
  }

  async function handlePayment() {
    if (!detail || paymentAmount <= 0) {
      toast.error("Nominal pembayaran harus lebih dari 0.");
      return;
    }

    try {
      setSubmitting(true);
      const response = await requestJson<{ debt: Debt; payment: unknown }>(`/api/debts/${detail.id}/payments`, {
        method: "POST",
        body: JSON.stringify({
          amount: paymentAmount,
          note: paymentNote,
        }),
      });
      await refreshDetail(response.debt);
      toast.success(response.debt.isPaid ? "Kasbon sudah lunas." : "Pembayaran cicilan dicatat.");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Gagal mencatat pembayaran.");
    } finally {
      setSubmitting(false);
    }
  }

  async function handleMarkPaid() {
    if (!detail) {
      return;
    }

    try {
      setSubmitting(true);
      const response = await requestJson<{ debt: Debt }>(`/api/debts/${detail.id}`, {
        method: "PATCH",
        body: JSON.stringify({ status: "lunas" }),
      });
      await refreshDetail(response.debt);
      toast.success("Kasbon ditandai lunas.");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Gagal menandai lunas.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="flex max-h-[92vh] w-[96vw] max-w-[96vw] sm:max-w-2xl md:max-w-3xl flex-col gap-0 overflow-hidden rounded-[28px] p-0">
        <DialogHeader className="border-b border-border/70 p-5 pb-4 sm:p-6 sm:pb-4">
          <DialogTitle className="flex items-center gap-2 font-heading text-2xl">
            <Info className="size-5" />
            Detail kasbon
          </DialogTitle>
          <DialogDescription>Rincian peminjam, barang, pembayaran cicilan, dan status kasbon.</DialogDescription>
        </DialogHeader>

        <div className="flex-1 overflow-y-auto overflow-x-hidden">
          {loading ? (
            <div className="p-6 text-sm text-muted-foreground">Memuat detail kasbon...</div>
          ) : detail ? (
            <div className="grid gap-5 p-5 sm:p-6">
            <section className="grid gap-4 md:grid-cols-[1fr_auto]">
              <div className="min-w-0">
                <div className="flex flex-wrap items-center gap-2">
                  <h3 className="font-heading text-2xl font-semibold break-words truncate max-w-full">{detail.borrowerName}</h3>
                  <Badge className={statusClassName(detail.status)}>{statusLabel(detail.status)}</Badge>
                </div>
                <p className="mt-1 text-sm text-muted-foreground break-words">
                  {detail.whatsapp || "Nomor WhatsApp belum diisi"}
                </p>
                <div className="mt-1 flex flex-wrap items-center gap-2">
                  {editingDueDate ? (
                    <div className="flex flex-wrap items-center gap-2 bg-muted/40 p-1 pr-2 rounded-2xl border border-border/70">
                      <Input
                        type="date"
                        value={newDueDate}
                        onChange={(e) => setNewDueDate(e.target.value)}
                        disabled={newNoDueDate}
                        className="h-8 min-w-[130px] w-auto border-0 focus-visible:ring-0 bg-transparent shadow-none"
                      />
                      <label className="flex items-center gap-1.5 text-xs text-muted-foreground whitespace-nowrap cursor-pointer">
                        <input
                          type="checkbox"
                          className="accent-primary"
                          checked={newNoDueDate}
                          onChange={(e) => setNewNoDueDate(e.target.checked)}
                        />
                        Tanpa batas
                      </label>
                      <div className="flex items-center gap-1 pl-1 ml-1 border-l border-border/70">
                        <Button size="icon" variant="ghost" className="h-7 w-7 rounded-full text-emerald-600 hover:text-emerald-700 hover:bg-emerald-100 dark:hover:bg-emerald-900/30" onClick={() => void handleSaveDueDate()} disabled={submitting}><Check className="size-3.5" /></Button>
                        <Button size="icon" variant="ghost" className="h-7 w-7 rounded-full text-muted-foreground hover:text-destructive hover:bg-destructive/10" onClick={() => setEditingDueDate(false)} disabled={submitting}><X className="size-3.5" /></Button>
                      </div>
                    </div>
                  ) : (
                    <>
                      <p className="text-sm text-muted-foreground">{detail.dueDate ? `Jatuh tempo ${formatDate(detail.dueDate)}` : "Tanpa jatuh tempo"}</p>
                      {detail.status !== "lunas" && (
                        <Button variant="ghost" size="icon" className="h-6 w-6 text-muted-foreground hover:text-foreground rounded-full" onClick={() => {
                          setNewDueDate(detail.dueDate ? detail.dueDate.slice(0, 10) : "");
                          setNewNoDueDate(!detail.dueDate);
                          setEditingDueDate(true);
                        }}>
                          <Pencil className="size-3" />
                        </Button>
                      )}
                    </>
                  )}
                </div>
              </div>
              <div className="grid min-w-0 sm:min-w-[220px] w-full gap-2 rounded-[20px] border border-border/70 bg-muted/40 p-4">
                <div className="flex items-center justify-between text-sm">
                  <span className="text-muted-foreground">Progress</span>
                  <span className="font-medium">{paidPct}%</span>
                </div>
                <div className="h-2 overflow-hidden rounded-full bg-border">
                  <div className="h-full rounded-full bg-primary" style={{ width: `${paidPct}%` }} />
                </div>
              </div>
            </section>

            <section className="grid gap-2 sm:gap-3 grid-cols-2 sm:grid-cols-3">
              <div className="rounded-[20px] bg-muted/45 p-3 sm:p-4 flex flex-col justify-center">
                <p className="text-sm text-muted-foreground">Total hutang</p>
                <p className="mt-1 sm:mt-2 text-lg sm:text-xl font-semibold whitespace-nowrap tracking-tight">{formatCurrency(detail.amount)}</p>
              </div>
              <div className="rounded-[20px] bg-muted/45 p-3 sm:p-4 flex flex-col justify-center">
                <p className="text-sm text-muted-foreground">Terbayar</p>
                <p className="mt-1 sm:mt-2 text-lg sm:text-xl font-semibold whitespace-nowrap tracking-tight">{formatCurrency(detail.paidAmount)}</p>
              </div>
              <div className="rounded-[20px] bg-muted/45 p-3 sm:p-4 flex flex-col justify-center col-span-2 sm:col-span-1">
                <p className="text-sm text-muted-foreground">Sisa</p>
                <p className="mt-1 sm:mt-2 text-lg sm:text-xl font-semibold whitespace-nowrap tracking-tight">{formatCurrency(detail.remainingAmount)}</p>
              </div>
            </section>

            <section className="grid gap-3">
              <h4 className="font-heading text-lg font-semibold">Daftar barang</h4>
              {detail.items.length > 0 ? (
                <div className="overflow-x-auto rounded-[18px] border border-border/60">
                  <Table className="min-w-[520px]">
                  <TableHeader>
                    <TableRow>
                      <TableHead>Nama</TableHead>
                      <TableHead className="text-right">Qty</TableHead>
                      <TableHead className="text-right">Harga</TableHead>
                      <TableHead className="text-right">Subtotal</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {detail.items.map((item) => (
                      <TableRow key={item.id}>
                        <TableCell>{item.name}</TableCell>
                        <TableCell className="text-right">{item.quantity}</TableCell>
                        <TableCell className="text-right">{formatCurrency(item.unitPrice)}</TableCell>
                        <TableCell className="text-right font-medium">{formatCurrency(item.lineTotal)}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                  </Table>
                </div>
              ) : (
                <p className="rounded-[18px] bg-muted/45 p-4 text-sm text-muted-foreground">Kasbon ini dicatat tanpa rincian barang.</p>
              )}
            </section>

            <section className="grid gap-3">
              <h4 className="font-heading text-lg font-semibold">Riwayat pembayaran</h4>
              {detail.payments.length > 0 ? (
                <div className="grid gap-2">
                  {detail.payments.map((payment) => (
                    <div key={payment.id} className="flex flex-wrap items-center justify-between gap-3 rounded-[18px] border border-border/70 p-3">
                      <div>
                        <p className="font-medium">{formatCurrency(payment.amount)}</p>
                        <p className="text-sm text-muted-foreground">{formatDateTime(payment.paidAt)}</p>
                      </div>
                      <p className="text-sm text-muted-foreground">{payment.note || "Tanpa catatan"}</p>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="rounded-[18px] bg-muted/45 p-4 text-sm text-muted-foreground">Belum ada pembayaran cicilan.</p>
              )}
            </section>

            {detail.status !== "lunas" ? (
              <section className="grid gap-3 rounded-[22px] border border-border/70 bg-card/70 p-4">
                <h4 className="font-heading text-lg font-semibold">Catat pembayaran</h4>
                <div className="flex flex-col sm:flex-row flex-wrap gap-3 sm:items-end">
                  <div className="grid flex-1 gap-2 min-w-[120px]">
                    <Label htmlFor="debt-payment-amount">Nominal</Label>
                    <Input
                      id="debt-payment-amount"
                      inputMode="numeric"
                      value={formatNumberInput(paymentAmount)}
                      onChange={(event) => setPaymentAmount(parseNumberInput(event.target.value))}
                      className="h-11 rounded-2xl"
                    />
                  </div>
                  <div className="grid flex-[2] gap-2 min-w-[150px]">
                    <Label htmlFor="debt-payment-note">Catatan</Label>
                    <Textarea
                      id="debt-payment-note"
                      value={paymentNote}
                      onChange={(event) => setPaymentNote(event.target.value)}
                      placeholder="Opsional"
                      className="min-h-11 rounded-2xl"
                    />
                  </div>
                  <Button type="button" onClick={() => void handlePayment()} disabled={submitting} className="rounded-full w-full sm:w-auto h-11">
                    <WalletCards className="size-4" />
                    Catat pembayaran
                  </Button>
                </div>
              </section>
            ) : null}
          </div>
        ) : (
          <div className="p-6 text-sm text-muted-foreground">Pilih kasbon untuk melihat detail.</div>
        )}
        </div>

        <DialogFooter className="m-0 rounded-b-[28px] border-t border-border/70 bg-card">
          {detail ? (
            <div className="w-full">
              {showTemplate && (
                <div className="border-b border-border/70 p-4 sm:p-5">
                  <p className="mb-1.5 text-xs font-medium text-muted-foreground">Template pesan WA:</p>
                  <div className="rounded-2xl bg-muted/50 p-3 text-sm leading-relaxed text-foreground whitespace-pre-wrap font-mono text-xs">{`Assalamu'alaikum wr. wb.

Halo ${detail.borrowerName}, mohon maaf mengganggu waktunya 🙏

Ini pesan dari TokoMu, sekadar mengingatkan mengenai catatan kasbon yang belum terselesaikan sebesar *${formatCurrency(detail.remainingAmount)}*.

Terima kasih banyak ya, semoga sehat selalu dan dilancarkan rezekinya! 😊`}</div>
                  <button
                    type="button"
                    className="mt-2 flex items-center gap-1.5 text-xs text-primary hover:underline transition-opacity"
                    onClick={() => {
                      void navigator.clipboard.writeText(`Assalamu'alaikum wr. wb.\n\nHalo ${detail.borrowerName}, mohon maaf mengganggu waktunya 🙏\n\nIni pesan dari TokoMu, sekadar mengingatkan mengenai catatan kasbon yang belum terselesaikan sebesar *${formatCurrency(detail.remainingAmount)}*.\n\nTerima kasih banyak ya, semoga sehat selalu dan dilancarkan rezekinya! 😊`);
                      toast.success("Template disalin ke clipboard!");
                    }}
                  >
                    <Copy className="size-3" />
                    Salin teks
                  </button>
                </div>
              )}
              <div className="flex flex-wrap items-center justify-between gap-2 p-4 sm:p-5">
                <div className="flex flex-wrap items-center gap-2">
                  <button
                    type="button"
                    className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground transition-colors"
                    onClick={() => setShowTemplate((v) => !v)}
                  >
                    <ChevronDown className={`size-3.5 transition-transform ${showTemplate ? "rotate-180" : ""}`} />
                    {showTemplate ? "Sembunyikan" : "Lihat"} template
                  </button>
                </div>
                <div className="flex flex-wrap items-center gap-2">
                  {detail.whatsapp ? (
                  <Button
                    render={
                      <a
                        href={`https://wa.me/${detail.whatsapp.replace(/\D/g, '')}?text=${encodeURIComponent(`Assalamu'alaikum wr. wb.\n\nHalo ${detail.borrowerName}, mohon maaf mengganggu waktunya 🙏\n\nIni pesan dari TokoMu, sekadar mengingatkan mengenai catatan kasbon yang belum terselesaikan sebesar *${formatCurrency(detail.remainingAmount)}*.\n\nTerima kasih banyak ya, semoga sehat selalu dan dilancarkan rezekinya! 😊`)}`}
                        target="_blank"
                        rel="noreferrer"
                      />
                    }
                    nativeButton={false}
                    variant="outline"
                  >
                    <MessageSquareShare className="size-4" />
                    Kirim pengingat
                  </Button>
                  ) : null}
                  {detail.status !== "lunas" ? (
                    <Button type="button" onClick={() => void handleMarkPaid()} disabled={submitting}>
                      <BadgeCheck className="size-4" />
                      Tandai lunas
                    </Button>
                  ) : null}
                  <Button variant="outline" type="button" onClick={() => onOpenChange(false)}>Tutup</Button>
                </div>
              </div>
            </div>
          ) : (
            <div className="p-4 sm:p-5">
              <Button variant="outline" type="button" onClick={() => onOpenChange(false)}>Tutup</Button>
            </div>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
