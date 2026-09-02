"use client";

import { useEffect, useMemo, useState } from "react";
import { BadgeCheck, Info, MessageSquareShare, WalletCards, Pencil, Check, X, ChevronDown, Copy, Plus, Trash2, Save, Loader2 } from "lucide-react";
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
import { cn } from "@/lib/utils";
import type { Debt, DebtDetail, Product } from "@/lib/types";

type DebtDetailDialogProps = {
  debtId: string | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onDebtUpdated: (debt: Debt) => void;
  products?: Product[];
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

export function DebtDetailDialog({
  debtId,
  open,
  onOpenChange,
  onDebtUpdated,
  products = [],
}: DebtDetailDialogProps) {
  const [detail, setDetail] = useState<DebtDetail | null>(null);
  const [loading, setLoading] = useState(false);
  const [paymentAmount, setPaymentAmount] = useState(0);
  const [paymentNote, setPaymentNote] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [editingDueDate, setEditingDueDate] = useState(false);
  const [newDueDate, setNewDueDate] = useState("");
  const [newNoDueDate, setNewNoDueDate] = useState(false);
  const [showTemplate, setShowTemplate] = useState(false);

  // Item editor states
  const [editingItems, setEditingItems] = useState(false);
  const [draftItems, setDraftItems] = useState<
    Array<{
      id: string;
      productId: string | null;
      name: string;
      quantity: number;
      unitPrice: number;
    }>
  >([]);
  const [syncTotalAmount, setSyncTotalAmount] = useState(true);
  const [savingItems, setSavingItems] = useState(false);

  useEffect(() => {
    if (!open || !debtId) {
      setEditingItems(false);
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
      await refreshDetail(response.debt);
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

  function handleStartEditItems() {
    if (!detail) return;
    const initial = (detail.items ?? []).map((i) => ({
      id: i.id || crypto.randomUUID(),
      productId: i.productId ?? null,
      name: i.name,
      quantity: i.quantity,
      unitPrice: i.unitPrice,
    }));
    if (initial.length === 0) {
      initial.push({
        id: crypto.randomUUID(),
        productId: null,
        name: "",
        quantity: 1,
        unitPrice: 0,
      });
    }
    setDraftItems(initial);
    setSyncTotalAmount(true);
    setEditingItems(true);
  }

  function handleAddItemRow() {
    setDraftItems((prev) => [
      ...prev,
      {
        id: crypto.randomUUID(),
        productId: null,
        name: "",
        quantity: 1,
        unitPrice: 0,
      },
    ]);
  }

  function handleUpdateItemRow(
    id: string,
    patch: Partial<{ productId: string | null; name: string; quantity: number; unitPrice: number }>
  ) {
    setDraftItems((prev) =>
      prev.map((i) => (i.id === id ? { ...i, ...patch } : i))
    );
  }

  function handleDeleteItemRow(id: string) {
    setDraftItems((prev) => prev.filter((i) => i.id !== id));
  }

  function handleSelectProduct(id: string, prodId: string) {
    const p = products.find((prod) => prod.id === prodId);
    if (!p) return;
    setDraftItems((prev) =>
      prev.map((i) =>
        i.id === id
          ? {
              ...i,
              productId: p.id,
              name: p.name,
              unitPrice: p.sellPrice,
            }
          : i
      )
    );
  }

  const draftItemsTotal = useMemo(
    () => draftItems.reduce((sum, i) => sum + Math.max(0, i.quantity) * Math.max(0, i.unitPrice), 0),
    [draftItems]
  );

  async function handleSaveItems() {
    if (!detail) return;
    const cleanItems = draftItems
      .filter((i) => i.name.trim().length > 0)
      .map((i) => ({
        productId: i.productId ?? null,
        name: i.name.trim(),
        quantity: Math.max(1, Math.round(i.quantity)),
        unitPrice: Math.max(0, Math.round(i.unitPrice)),
        lineTotal: Math.max(1, Math.round(i.quantity)) * Math.max(0, Math.round(i.unitPrice)),
      }));

    const itemsTotal = cleanItems.reduce((sum, i) => sum + i.lineTotal, 0);
    const newAmount = syncTotalAmount && itemsTotal > 0 ? itemsTotal : detail.amount;

    setSavingItems(true);
    try {
      const response = await requestJson<{ debt: DebtDetail }>(`/api/debts/${detail.id}`, {
        method: "PATCH",
        body: JSON.stringify({
          items: cleanItems,
          amount: newAmount,
        }),
      });

      setDetail(response.debt);
      onDebtUpdated(response.debt);
      setEditingItems(false);
      toast.success("Rincian barang kasbon berhasil disimpan.");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Gagal menyimpan rincian barang.");
    } finally {
      setSavingItems(false);
    }
  }

  const reminderText = detail ? `Assalamu'alaikum wr. wb.\n\nHalo ${detail.borrowerName}, mohon maaf mengganggu waktunya 🙏\n\nIni pesan dari TokoMu, sekadar mengingatkan mengenai catatan kasbon yang belum terselesaikan sebesar *${formatCurrency(detail.remainingAmount)}*.\n\nTerima kasih banyak ya, semoga sehat selalu dan dilancarkan rezekinya! 😊` : "";

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

              <div className="flex flex-wrap items-center gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  className="rounded-full gap-2 text-xs"
                  onClick={() => setShowTemplate(!showTemplate)}
                >
                  <MessageSquareShare className="size-3.5" />
                  Pesan penagihan
                  <ChevronDown className={cn("size-3.5 transition-transform", showTemplate && "rotate-180")} />
                </Button>
                {detail.status !== "lunas" && (
                  <Button
                    variant="outline"
                    size="sm"
                    className="rounded-full gap-2 text-xs border-emerald-600 text-emerald-600 hover:bg-emerald-50 dark:hover:bg-emerald-950/20"
                    onClick={() => void handleMarkPaid()}
                    disabled={submitting}
                  >
                    <BadgeCheck className="size-3.5" />
                    Tandai lunas
                  </Button>
                )}
              </div>
            </section>

            {/* Template Pesan Penagihan WhatsApp */}
            {showTemplate && (
              <section className="rounded-[22px] border border-primary/30 bg-primary/5 p-4 space-y-3">
                <div className="flex items-center justify-between">
                  <h4 className="font-heading text-sm font-semibold flex items-center gap-2">
                    <MessageSquareShare className="size-4 text-primary" />
                    Template pesan penagihan
                  </h4>
                  <Button
                    size="sm"
                    variant="ghost"
                    className="h-8 gap-1 text-xs rounded-full"
                    onClick={() => {
                      navigator.clipboard.writeText(reminderText);
                      toast.success("Teks penagihan disalin ke clipboard!");
                    }}
                  >
                    <Copy className="size-3" />
                    Salin teks
                  </Button>
                </div>
                <Textarea
                  readOnly
                  value={reminderText}
                  className="text-xs bg-background/80 resize-none min-h-[90px] rounded-xl font-mono"
                />
                {detail.whatsapp && (
                  <Button
                    size="sm"
                    className="rounded-full gap-2 text-xs w-full sm:w-auto bg-emerald-600 hover:bg-emerald-700 text-white"
                    onClick={() => {
                      const cleanPhone = detail.whatsapp.replace(/\D/g, "");
                      const formattedPhone = cleanPhone.startsWith("0") ? "62" + cleanPhone.slice(1) : cleanPhone;
                      window.open(`https://wa.me/${formattedPhone}?text=${encodeURIComponent(reminderText)}`, "_blank");
                    }}
                  >
                    <MessageSquareShare className="size-3.5" />
                    Kirim via WhatsApp
                  </Button>
                )}
              </section>
            )}

            <section className="grid grid-cols-2 sm:grid-cols-3 gap-3">
              <div className="rounded-[20px] bg-muted/45 p-3 sm:p-4 flex flex-col justify-center">
                <p className="text-sm text-muted-foreground">Total Kasbon</p>
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

            {/* DAFTAR BARANG YANG DIHUTANG */}
            <section className="grid gap-3">
              <div className="flex items-center justify-between">
                <h4 className="font-heading text-lg font-semibold">Daftar barang</h4>
                {detail.status !== "lunas" && !editingItems && (
                  <Button
                    variant="outline"
                    size="sm"
                    className="h-8 rounded-xl text-xs gap-1.5 font-medium border-border/80 hover:bg-primary/10 hover:text-primary"
                    onClick={handleStartEditItems}
                  >
                    <Pencil className="size-3.5" />
                    {(detail.items?.length ?? 0) > 0 ? "Ubah Barang" : "+ Atur Barang Dihutang"}
                  </Button>
                )}
              </div>

              {editingItems ? (
                /* Mode Edit Rincian Barang */
                <div className="rounded-2xl border border-primary/40 bg-card p-4 space-y-3.5 shadow-xs">
                  <div className="flex items-center justify-between">
                    <p className="text-xs font-semibold text-foreground">
                      Pilih produk dari inventaris toko atau ketik nama barang:
                    </p>
                    <Button
                      type="button"
                      size="sm"
                      variant="outline"
                      className="h-7 text-xs rounded-lg gap-1"
                      onClick={handleAddItemRow}
                    >
                      <Plus className="size-3" />
                      Tambah Baris
                    </Button>
                  </div>

                  <div className="space-y-2 max-h-[260px] overflow-y-auto pr-1">
                    {draftItems.map((item, idx) => (
                      <div
                        key={item.id}
                        className="flex flex-wrap sm:flex-nowrap items-center gap-2 p-2 rounded-xl bg-muted/30 border border-border/60"
                      >
                        <span className="text-xs font-mono text-muted-foreground w-6 text-center">
                          #{idx + 1}
                        </span>

                        {/* Pilih dari Produk Master jika ada */}
                        {products.length > 0 && (
                          <select
                            className="h-8 text-xs rounded-lg bg-background border border-border px-2 max-w-[150px] sm:max-w-[180px] cursor-pointer"
                            value={item.productId ?? ""}
                            onChange={(e) => {
                              if (e.target.value) {
                                handleSelectProduct(item.id, e.target.value);
                              }
                            }}
                          >
                            <option value="">-- Pilih dari Katalog --</option>
                            {products.map((p) => (
                              <option key={p.id} value={p.id}>
                                {p.name} ({formatCurrency(p.sellPrice)})
                              </option>
                            ))}
                          </select>
                        )}

                        {/* Input Nama Barang Bebas */}
                        <Input
                          value={item.name}
                          onChange={(e) => handleUpdateItemRow(item.id, { name: e.target.value })}
                          placeholder="Nama barang..."
                          className="h-8 text-xs flex-1 rounded-lg bg-background min-w-[120px]"
                        />

                        {/* Qty */}
                        <div className="flex items-center gap-1 shrink-0">
                          <Label className="text-[10px] text-muted-foreground">Qty:</Label>
                          <Input
                            type="number"
                            min="1"
                            value={item.quantity}
                            onChange={(e) =>
                              handleUpdateItemRow(item.id, {
                                quantity: Math.max(1, Number(e.target.value) || 1),
                              })
                            }
                            className="h-8 text-xs w-16 text-center rounded-lg bg-background"
                          />
                        </div>

                        {/* Harga Satuan */}
                        <div className="flex items-center gap-1 shrink-0">
                          <Label className="text-[10px] text-muted-foreground">Harga:</Label>
                          <Input
                            type="number"
                            value={item.unitPrice}
                            onChange={(e) =>
                              handleUpdateItemRow(item.id, {
                                unitPrice: Math.max(0, Number(e.target.value) || 0),
                              })
                            }
                            className="h-8 text-xs w-24 text-right rounded-lg bg-background"
                          />
                        </div>

                        {/* Subtotal */}
                        <span className="text-xs font-semibold tabular-nums text-foreground shrink-0 w-24 text-right">
                          {formatCurrency(item.quantity * item.unitPrice)}
                        </span>

                        {/* Hapus */}
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon"
                          className="h-7 w-7 text-muted-foreground hover:text-destructive shrink-0 rounded-lg"
                          onClick={() => handleDeleteItemRow(item.id)}
                          disabled={draftItems.length <= 1}
                        >
                          <Trash2 className="size-3.5" />
                        </Button>
                      </div>
                    ))}
                  </div>

                  <div className="flex flex-wrap items-center justify-between gap-3 pt-2 border-t border-border/60">
                    <label className="flex items-center gap-2 text-xs text-muted-foreground cursor-pointer">
                      <input
                        type="checkbox"
                        checked={syncTotalAmount}
                        onChange={(e) => setSyncTotalAmount(e.target.checked)}
                        className="size-4 rounded accent-primary cursor-pointer"
                      />
                      <span>
                        Sesuaikan total hutang dengan subtotal barang (<strong>{formatCurrency(draftItemsTotal)}</strong>)
                      </span>
                    </label>

                    <div className="flex items-center gap-2">
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        className="h-8 text-xs rounded-xl"
                        onClick={() => setEditingItems(false)}
                        disabled={savingItems}
                      >
                        Batal
                      </Button>
                      <Button
                        type="button"
                        size="sm"
                        className="h-8 text-xs rounded-xl bg-primary text-primary-foreground font-semibold gap-1.5"
                        onClick={() => void handleSaveItems()}
                        disabled={savingItems}
                      >
                        {savingItems ? <Loader2 className="size-3.5 animate-spin" /> : <Save className="size-3.5" />}
                        Simpan Barang
                      </Button>
                    </div>
                  </div>
                </div>
              ) : (detail.items?.length ?? 0) > 0 ? (
                /* Tabel Display Barang Normal */
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
                    {(detail.items ?? []).map((item) => (
                      <TableRow key={item.id}>
                        <TableCell className="font-semibold">{item.name}</TableCell>
                        <TableCell className="text-right tabular-nums">{item.quantity}</TableCell>
                        <TableCell className="text-right tabular-nums">{formatCurrency(item.unitPrice)}</TableCell>
                        <TableCell className="text-right font-medium tabular-nums">{formatCurrency(item.lineTotal)}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                  </Table>
                </div>
              ) : (
                <div className="flex items-center justify-between rounded-[18px] bg-muted/45 p-4 text-sm text-muted-foreground">
                  <span>Kasbon ini dicatat dengan nominal langsung (tanpa rincian barang).</span>
                  {detail.status !== "lunas" && (
                    <Button
                      variant="link"
                      size="sm"
                      className="text-xs text-primary p-0 h-auto font-semibold"
                      onClick={handleStartEditItems}
                    >
                      + Tambah rincian barang
                    </Button>
                  )}
                </div>
              )}
            </section>

            <section className="grid gap-3">
              <h4 className="font-heading text-lg font-semibold">Riwayat pembayaran</h4>
              {(detail.payments?.length ?? 0) > 0 ? (
                <div className="grid gap-2">
                  {(detail.payments ?? []).map((payment) => (
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
