"use client";

import { useEffect, useMemo, useState } from "react";
import { BadgeCheck, Info, MessageSquareShare, WalletCards } from "lucide-react";
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
  const data = (await response.json().catch(() => null)) as T & { error?: string } | null;

  if (!response.ok) {
    throw new Error(typeof data?.error === "string" ? data.error : "Permintaan gagal.");
  }

  return data as T;
}

function statusClassName(status: Debt["status"]) {
  if (status === "lunas") {
    return "rounded-full bg-accent text-accent-foreground";
  }

  if (status === "lewat_tempo") {
    return "rounded-full bg-destructive text-destructive-foreground";
  }

  return "rounded-full bg-primary text-primary-foreground";
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
      <DialogContent className="max-h-[92vh] max-w-4xl overflow-y-auto rounded-[28px] p-0">
        <DialogHeader className="border-b border-border/70 p-6 pb-4">
          <DialogTitle className="flex items-center gap-2 font-heading text-2xl">
            <Info className="size-5" />
            Detail kasbon
          </DialogTitle>
          <DialogDescription>Rincian peminjam, barang, pembayaran cicilan, dan status kasbon.</DialogDescription>
        </DialogHeader>

        {loading ? (
          <div className="p-6 text-sm text-muted-foreground">Memuat detail kasbon...</div>
        ) : detail ? (
          <div className="grid gap-5 p-6">
            <section className="grid gap-4 md:grid-cols-[1fr_auto]">
              <div>
                <div className="flex flex-wrap items-center gap-2">
                  <h3 className="font-heading text-2xl font-semibold">{detail.borrowerName}</h3>
                  <Badge className={statusClassName(detail.status)}>{statusLabel(detail.status)}</Badge>
                </div>
                <p className="mt-1 text-sm text-muted-foreground">{detail.whatsapp}</p>
                <p className="mt-1 text-sm text-muted-foreground">Jatuh tempo {formatDate(detail.dueDate)}</p>
              </div>
              <div className="grid min-w-[220px] gap-2 rounded-[20px] border border-border/70 bg-muted/40 p-4">
                <div className="flex items-center justify-between text-sm">
                  <span className="text-muted-foreground">Progress</span>
                  <span className="font-medium">{paidPct}%</span>
                </div>
                <div className="h-2 overflow-hidden rounded-full bg-border">
                  <div className="h-full rounded-full bg-primary" style={{ width: `${paidPct}%` }} />
                </div>
              </div>
            </section>

            <section className="grid gap-3 sm:grid-cols-3">
              <div className="rounded-[20px] bg-muted/45 p-4">
                <p className="text-sm text-muted-foreground">Total hutang</p>
                <p className="mt-2 text-xl font-semibold">{formatCurrency(detail.amount)}</p>
              </div>
              <div className="rounded-[20px] bg-muted/45 p-4">
                <p className="text-sm text-muted-foreground">Terbayar</p>
                <p className="mt-2 text-xl font-semibold">{formatCurrency(detail.paidAmount)}</p>
              </div>
              <div className="rounded-[20px] bg-muted/45 p-4">
                <p className="text-sm text-muted-foreground">Sisa</p>
                <p className="mt-2 text-xl font-semibold">{formatCurrency(detail.remainingAmount)}</p>
              </div>
            </section>

            <section className="grid gap-3">
              <h4 className="font-heading text-lg font-semibold">Daftar barang</h4>
              {detail.items.length > 0 ? (
                <Table>
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
                <div className="grid gap-3 md:grid-cols-[180px_1fr_auto] md:items-end">
                  <div className="grid gap-2">
                    <Label htmlFor="debt-payment-amount">Nominal</Label>
                    <Input
                      id="debt-payment-amount"
                      inputMode="numeric"
                      value={formatNumberInput(paymentAmount)}
                      onChange={(event) => setPaymentAmount(parseNumberInput(event.target.value))}
                      className="h-11 rounded-2xl"
                    />
                  </div>
                  <div className="grid gap-2">
                    <Label htmlFor="debt-payment-note">Catatan</Label>
                    <Textarea
                      id="debt-payment-note"
                      value={paymentNote}
                      onChange={(event) => setPaymentNote(event.target.value)}
                      placeholder="Opsional"
                      className="min-h-11 rounded-2xl"
                    />
                  </div>
                  <Button type="button" onClick={() => void handlePayment()} disabled={submitting} className="rounded-full">
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

        <DialogFooter className="rounded-b-[28px]" showCloseButton>
          {detail ? (
            <>
              <Button
                type="button"
                variant="outline"
                onClick={() =>
                  toast.success("Simulasi pengingat WhatsApp terkirim.", {
                    description: `Pesan pengingat untuk ${detail.borrowerName} siap dikirim.`,
                  })
                }
              >
                <MessageSquareShare className="size-4" />
                Kirim pengingat
              </Button>
              {detail.status !== "lunas" ? (
                <Button type="button" onClick={() => void handleMarkPaid()} disabled={submitting}>
                  <BadgeCheck className="size-4" />
                  Tandai lunas
                </Button>
              ) : null}
            </>
          ) : null}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
