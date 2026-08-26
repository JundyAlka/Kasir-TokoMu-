"use client";

import { useEffect, useState } from "react";
import { AlertTriangle, BanknoteArrowDown, Check, CircleDollarSign, Loader2, WalletCards } from "lucide-react";
import { toast } from "sonner";
import { ExpenseRecordDialog } from "@/components/warung/pengeluaran-restok-view";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { formatCurrency } from "@/lib/format";
import { cn } from "@/lib/utils";

type CashBalances = { cash: number; coins: number; savings: number };
type ShiftSession = {
  id: string; shiftName: string; startedAt: string; openingTotal: number;
  expectedClosing: number | null; cashierUserId: string; cashierName: string;
};
type CashMovement = {
  cashSales: number; creditSales: number; debtRepayments: number;
  cashExpenses: number; cashIn: number;
};
type CurrentShiftResponse = {
  session: ShiftSession | null;
  openSessionInfo?: {
    id: string;
    shiftName: string;
    cashierUserId: string;
    cashierName: string;
    startedAt: string;
  } | null;
  activeShift: { id: string; name: string } | null;
  openingSuggestion: CashBalances;
  cashMovement: CashMovement | null;
  hasOtherOpenShift: boolean;
};

function dispatchShiftUpdate() {
  window.dispatchEvent(new CustomEvent("cashier-shift-updated"));
}

export function ShiftSayaPanel() {
  const [state, setState] = useState<"loading" | "ready" | "error">("loading");
  const [data, setData] = useState<CurrentShiftResponse | null>(null);
  const [openDialog, setOpenDialog] = useState(false);
  const [closeDialog, setCloseDialog] = useState(false);
  const [expenseDialog, setExpenseDialog] = useState(false);
  const [movementDialog, setMovementDialog] = useState(false);
  const [saving, setSaving] = useState(false);
  const [openingEdited, setOpeningEdited] = useState(false);
  const [openingReason, setOpeningReason] = useState("");
  const [opening, setOpening] = useState<CashBalances>({ cash: 0, coins: 0, savings: 0 });
  const [closing, setClosing] = useState<CashBalances>({ cash: 0, coins: 0, savings: 0 });
  const [varianceNote, setVarianceNote] = useState("");
  const [movement, setMovement] = useState<{ fromBucket: "cash" | "coins" | "savings"; toBucket: "cash" | "coins" | "savings"; amount: number; note: string }>({ fromBucket: "cash", toBucket: "savings", amount: 0, note: "" });

  async function load() {
    setState("loading");
    try {
      const response = await fetch("/api/shifts/current", { cache: "no-store" });
      const next = await response.json().catch(() => null) as CurrentShiftResponse | null;
      if (!response.ok || !next) throw new Error("REQUEST_FAILED");
      setData(next);
      setState("ready");
    } catch (error) {
      console.error("[shift-saya] load failed", error);
      setState("error");
    }
  }

  useEffect(() => {
    void load();
    const refresh = () => void load();
    window.addEventListener("cashier-shift-updated", refresh);
    return () => window.removeEventListener("cashier-shift-updated", refresh);
  }, []);

  const session = data?.session ?? null;
  const cashMovement = data?.cashMovement ?? null;
  const expectedClosing = (session?.openingTotal ?? 0) + (cashMovement?.cashIn ?? 0) - (cashMovement?.cashExpenses ?? 0);
  const actualClosing = closing.cash + closing.coins + closing.savings;
  const variance = actualClosing - expectedClosing;

  function startOpening() {
    setOpening(data?.openingSuggestion ?? { cash: 0, coins: 0, savings: 0 });
    setOpeningEdited(false); setOpeningReason(""); setOpenDialog(true);
  }

  function startClosing() {
    setClosing({ cash: session?.expectedClosing ?? expectedClosing, coins: 0, savings: 0 });
    setVarianceNote(""); setCloseDialog(true);
  }

  async function openShift() {
    setSaving(true);
    try {
      const response = await fetch("/api/shifts/open", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ shiftId: data?.activeShift?.id, openingCash: opening.cash, openingCoins: opening.coins, openingSavings: opening.savings, openingOverrideReason: openingReason.trim() || undefined }) });
      const result = await response.json().catch(() => null);
      if (!response.ok) throw new Error(result?.error ?? "Gagal membuka shift.");
      toast.success("Shift berhasil dibuka."); setOpenDialog(false); dispatchShiftUpdate(); await load();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Gagal membuka shift.");
    } finally { setSaving(false); }
  }

  async function closeShift() {
    if (!session) return;
    if (variance !== 0 && !varianceNote.trim()) {
      toast.error("Alasan selisih kas wajib diisi.");
      return;
    }
    setSaving(true);
    try {
      const response = await fetch("/api/shifts/close", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ sessionId: session.id, closingCash: closing.cash, closingCoins: closing.coins, closingSavings: closing.savings, varianceNote: variance === 0 ? undefined : varianceNote }) });
      const result = await response.json().catch(() => null);
      if (!response.ok) throw new Error(result?.error ?? "Gagal menutup shift.");
      toast.success("Shift berhasil ditutup."); setCloseDialog(false); dispatchShiftUpdate(); await load();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Gagal menutup shift.");
    } finally { setSaving(false); }
  }

  async function saveMovement() {
    if (movement.amount <= 0 || movement.fromBucket === movement.toBucket) {
      toast.error("Pilih dua pos berbeda dan isi nominal mutasi."); return;
    }
    setSaving(true);
    try {
      const response = await fetch("/api/kas-movements", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(movement) });
      const result = await response.json().catch(() => null);
      if (!response.ok) throw new Error(result?.error ?? "Gagal mencatat mutasi kas.");
      toast.success("Mutasi kas berhasil dicatat."); setMovementDialog(false); setMovement((current) => ({ ...current, amount: 0, note: "" })); dispatchShiftUpdate(); await load();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Gagal mencatat mutasi kas.");
    } finally { setSaving(false); }
  }

  if (state === "loading") return <Card><CardContent className="flex min-h-28 items-center gap-2 p-5 text-sm text-muted-foreground"><Loader2 className="size-4 animate-spin" />Memuat shift saya...</CardContent></Card>;
  if (state === "error") return <Card><CardContent className="flex min-h-28 flex-wrap items-center justify-between gap-3 p-5"><p role="alert" className="font-medium">Gagal memuat data shift, coba lagi.</p><Button variant="outline" onClick={() => void load()}>Muat ulang</Button></CardContent></Card>;

  return <section className="space-y-3">
    <ExpenseRecordDialog open={expenseDialog} onOpenChange={setExpenseDialog} onRecorded={() => { dispatchShiftUpdate(); void load(); }} />
    <Card className="border-primary/30 bg-primary/5"><CardContent className="flex flex-col gap-4 p-5 lg:flex-row lg:items-center lg:justify-between">
      <div className="flex gap-3"><span className="mt-0.5 rounded-2xl bg-primary/20 p-2.5 text-primary shadow-sm border border-primary/30"><WalletCards className="size-5" /></span><div><p className="font-heading text-xl font-semibold flex items-center gap-2">Shift Saya{session && <span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-600 dark:bg-emerald-500 text-white dark:text-emerald-950 px-2.5 py-0.5 text-xs font-bold shadow-sm shadow-emerald-600/25"><span className="size-2 rounded-full bg-white dark:bg-emerald-950 animate-pulse" />Sedang Aktif di {session.shiftName}</span>}</p><p className="mt-1 text-sm text-muted-foreground">{session ? `Sesi ${session.shiftName} dibuka ${new Intl.DateTimeFormat("id-ID", { hour: "2-digit", minute: "2-digit" }).format(new Date(session.startedAt))} oleh ${session.cashierName}. Kas masuk, pengeluaran, dan penjualan otomatis tercatat ke shift ini.` : data?.activeShift ? `Belum ada shift terbuka. Jadwal saat ini: ${data.activeShift.name}. Klik tombol Buka Shift untuk mulai bertugas.` : "Tidak ada jadwal shift aktif saat ini."}</p></div></div>
      {session ? <div className="flex flex-wrap gap-2"><Button variant="outline" onClick={() => setExpenseDialog(true)}><BanknoteArrowDown className="size-4" />Catat Pengeluaran</Button><Button variant="outline" onClick={() => setMovementDialog(true)}>Mutasi Kas</Button><Button onClick={startClosing}><CircleDollarSign className="size-4" />Tutup Shift</Button></div> : <Button size="lg" disabled={saving} onClick={startOpening}><WalletCards className="size-4" />Buka Shift</Button>}
    </CardContent></Card>
    {session ? <div className="grid gap-3 grid-cols-2 md:grid-cols-3 xl:grid-cols-5"><Summary label="Kas awal" value={session.openingTotal} /><Summary label="Penjualan tunai" value={cashMovement?.cashSales ?? 0} tone="positive" /><Summary label="Penjualan kasbon" value={cashMovement?.creditSales ?? 0} /><Summary label="Pengeluaran" value={cashMovement?.cashExpenses ?? 0} tone="negative" /><Summary label="Kas seharusnya sekarang" value={expectedClosing} /></div> : null}

    <Dialog open={openDialog} onOpenChange={setOpenDialog}>
      <DialogContent className="sm:max-w-xl">
        <DialogHeader>
          <DialogTitle>Buka Shift {data?.activeShift?.name}</DialogTitle>
          <DialogDescription>Masukkan nominal kas fisik awal di laci kasir saat membuka shift.</DialogDescription>
        </DialogHeader>
        <div className="grid gap-4 py-3">
          <div className="grid grid-cols-3 gap-3">
            {(["cash", "coins", "savings"] as const).map((key) => (
              <div key={key} className="grid gap-2">
                <Label className="text-xs sm:text-sm">{key === "cash" ? "Kas awal (Laci)" : key === "coins" ? "Receh" : "Tabungan"}</Label>
                <Input
                  type="text"
                  inputMode="numeric"
                  value={opening[key] ? new Intl.NumberFormat("id-ID").format(opening[key]) : ""}
                  placeholder="0"
                  onChange={(event) => {
                    const raw = event.target.value.replace(/\D/g, "");
                    const num = raw ? parseInt(raw, 10) : 0;
                    setOpening((current) => ({ ...current, [key]: num }));
                  }}
                />
              </div>
            ))}
          </div>
          <div className="flex items-center justify-between rounded-xl bg-muted/60 p-3 text-sm">
            <span className="text-muted-foreground font-medium">Total Kas Awal:</span>
            <span className="font-bold text-foreground tabular-nums">
              {formatCurrency((opening.cash || 0) + (opening.coins || 0) + (opening.savings || 0))}
            </span>
          </div>
          <div className="grid gap-2">
            <Label className="text-xs text-muted-foreground">Catatan / Keterangan (Opsional)</Label>
            <Textarea
              value={openingReason}
              onChange={(event) => setOpeningReason(event.target.value)}
              placeholder="Contoh: modal awal kasir"
              className="min-h-[60px]"
            />
          </div>
          <Button size="lg" disabled={saving} onClick={() => void openShift()}>{saving ? "Menyimpan..." : "Buka Shift Sekarang"}</Button>
        </div>
      </DialogContent>
    </Dialog>
    <Dialog open={closeDialog} onOpenChange={setCloseDialog}><DialogContent className="max-w-2xl"><DialogHeader><DialogTitle>Tutup Shift {session?.shiftName}</DialogTitle><DialogDescription>Periksa kas fisik sebelum menyimpan penutupan shift.</DialogDescription></DialogHeader><div className="grid grid-cols-2 gap-3 rounded-xl bg-muted/50 p-4 sm:grid-cols-4"><Summary label="Kas awal" value={session?.openingTotal ?? 0} compact /><Summary label="Pemasukan" value={cashMovement?.cashIn ?? 0} compact /><Summary label="Pengeluaran" value={cashMovement?.cashExpenses ?? 0} compact /><Summary label="Kas akhir seharusnya" value={expectedClosing} compact /></div><div className="grid grid-cols-3 gap-3">{(["cash", "coins", "savings"] as const).map((key) => <div key={key} className="grid gap-2"><Label>{key === "cash" ? "Kas Tutup" : key === "coins" ? "Receh" : "Tabungan"}</Label><Input type="number" min={0} value={closing[key]} onChange={(event) => setClosing((current) => ({ ...current, [key]: Number(event.target.value) || 0 }))} /></div>)}</div><div className={cn("rounded-xl border p-3 text-sm font-medium", variance === 0 ? "border-emerald-500/30 bg-emerald-500/10 text-emerald-700" : "border-destructive/30 bg-destructive/10 text-destructive")}>{variance === 0 ? <Check className="mr-2 inline size-4" /> : <AlertTriangle className="mr-2 inline size-4" />}Selisih: {formatCurrency(variance)}</div>{variance !== 0 ? <div className="grid gap-2"><Label>Alasan selisih</Label><Textarea value={varianceNote} onChange={(event) => setVarianceNote(event.target.value)} /></div> : null}<Button disabled={saving} onClick={() => void closeShift()}>{saving ? "Menyimpan..." : "Simpan Penutupan Shift"}</Button></DialogContent></Dialog>
    <Dialog open={movementDialog} onOpenChange={setMovementDialog}><DialogContent><DialogHeader><DialogTitle>Mutasi Kas</DialogTitle><DialogDescription>Pindahkan uang antar laci, receh, dan tabungan. Total kas dan laba tidak berubah.</DialogDescription></DialogHeader><div className="grid gap-4 py-3"><div className="grid grid-cols-2 gap-3"><BucketSelect label="Pos asal" value={movement.fromBucket} onChange={(fromBucket) => setMovement((current) => ({ ...current, fromBucket }))} /><BucketSelect label="Pos tujuan" value={movement.toBucket} onChange={(toBucket) => setMovement((current) => ({ ...current, toBucket }))} /></div><div className="grid gap-2"><Label>Nominal</Label><Input type="number" min={1} value={movement.amount || ""} onChange={(event) => setMovement((current) => ({ ...current, amount: Number(event.target.value) || 0 }))} /></div><div className="grid gap-2"><Label>Catatan</Label><Textarea value={movement.note} onChange={(event) => setMovement((current) => ({ ...current, note: event.target.value }))} /></div><Button disabled={saving} onClick={() => void saveMovement()}>{saving ? "Menyimpan..." : "Catat Mutasi"}</Button></div></DialogContent></Dialog>
  </section>;
}

function Summary({ label, value, tone, compact = false }: { label: string; value: number; tone?: "positive" | "negative"; compact?: boolean }) {
  return <Card className={compact ? "border-0 bg-transparent shadow-none" : "border-border/60"}><CardContent className={compact ? "p-0" : "p-4"}><p className="text-xs text-muted-foreground">{label}</p><p className={cn("mt-1 font-semibold tabular-nums", tone === "positive" && "text-emerald-600", tone === "negative" && "text-destructive")}>{formatCurrency(value)}</p></CardContent></Card>;
}

function BucketSelect({ label, value, onChange }: { label: string; value: "cash" | "coins" | "savings"; onChange: (value: "cash" | "coins" | "savings") => void }) {
  return <div className="grid gap-2"><Label>{label}</Label><Select value={value} onValueChange={(next) => onChange(next as "cash" | "coins" | "savings")}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent><SelectItem value="cash">Laci kas</SelectItem><SelectItem value="coins">Receh</SelectItem><SelectItem value="savings">Tabungan</SelectItem></SelectContent></Select></div>;
}
