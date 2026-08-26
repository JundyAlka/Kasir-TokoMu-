"use client";

import { useEffect, useMemo, useState } from "react";
import { BanknoteArrowDown, CalendarDays, Check, Loader2, Plus, ShoppingBag, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { useCurrentRole } from "@/components/role-gate";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { StatCard } from "@/components/stat-card";
import { formatCompactCurrency, formatCurrency } from "@/lib/format";
import { cn } from "@/lib/utils";

type RestockPlan = {
  id: string;
  productName: string;
  note: string;
  estimatedPrice: number;
  isDone: number;
  createdAt: string;
};

export function ExpenseRecordDialog({
  open,
  onOpenChange,
  onRecorded,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onRecorded?: () => void;
}) {
  const role = useCurrentRole();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [title, setTitle] = useState("");
  const [amount, setAmount] = useState("");
  const [category, setCategory] = useState<string>("operasional");
  const [partners, setPartners] = useState<Array<{ id: string; name: string; partnerType: string }>>([]);
  const [products, setProducts] = useState<Array<{ id: string; name: string; buyPrice: number }>>([]);
  const [investorId, setInvestorId] = useState("");
  const [intakes, setIntakes] = useState<Array<{ id: string; productName: string | null; qtySold: number; unitCost: number; settledAmount: number }>>([]);
  const [settleIntakeIds, setSettleIntakeIds] = useState<string[]>([]);
  const [restockEnabled, setRestockEnabled] = useState(false);
  const [restockProductId, setRestockProductId] = useState("");
  const [restockQuantity, setRestockQuantity] = useState("");
  const isCashier = role === "kasir";

  useEffect(() => {
    if (!open) return;
    void fetch("/api/bootstrap").then(async (response) => {
      if (response.ok) setProducts((await response.json()).products ?? []);
    });
    if (!isCashier) {
      void fetch("/api/investors?status=active").then(async (response) => {
        if (response.ok) setPartners((await response.json()).investors ?? []);
      });
    }
  }, [isCashier, open]);

  useEffect(() => {
    if (category !== "sales_titipan" || !investorId) { setIntakes([]); setSettleIntakeIds([]); return; }
    void fetch(`/api/titipan-intakes?investorId=${encodeURIComponent(investorId)}`).then(async (response) => {
      if (response.ok) setIntakes((await response.json()).intakes ?? []);
    });
  }, [category, investorId]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!title || !amount) {
      toast.error("Mohon isi semua data yang wajib.");
      return;
    }

    setIsSubmitting(true);
    try {
      const payload = {
        title,
        amount: parseInt(amount, 10),
        expenseType: category,
        investorId: investorId || undefined,
        settleIntakeIds,
        restock: category === "sales_toko" && restockEnabled ? { productId: restockProductId, quantity: Number(restockQuantity), unitCost: products.find((product) => product.id === restockProductId)?.buyPrice ?? 0 } : undefined,
      };
      const response = await fetch("/api/expenses", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => null);
        throw new Error(errorData?.error?.issues?.[0]?.message || errorData?.error || "Gagal mencatat pengeluaran");
      }

      toast.success("Pengeluaran berhasil dicatat");
      onOpenChange(false);
      setTitle("");
      setAmount("");
      setCategory("operasional"); setInvestorId(""); setSettleIntakeIds([]); setRestockEnabled(false); setRestockProductId(""); setRestockQuantity("");
      onRecorded?.();
    } catch (err: any) {
      toast.error(err.message);
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg md:max-w-xl w-full rounded-[28px] border-border bg-card p-6 sm:p-7 shadow-2xl">
        <DialogHeader>
          <div className="mb-2 flex size-12 items-center justify-center rounded-2xl bg-primary/14 text-primary">
            <BanknoteArrowDown className="size-5" />
          </div>
          <DialogTitle className="font-heading text-2xl">Catat Pengeluaran</DialogTitle>
          <DialogDescription>Pengeluaran tercatat pada shift yang sedang terbuka.</DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4 py-3">
          <div className="space-y-2">
            <label className="text-sm font-medium">Keterangan / Nama</label>
            <Input 
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="Contoh: Token Listrik PLN" 
              className="h-12 rounded-xl"
            />
          </div>
          <div className="space-y-2">
            <label className="text-sm font-medium">Kategori</label>
            <Select value={category} onValueChange={(val) => setCategory(val || "operasional")}>
              <SelectTrigger className="w-full h-12 rounded-xl">
                <SelectValue placeholder="Pilih Kategori" />
              </SelectTrigger>
              <SelectContent className="rounded-xl">
                <SelectItem value="sales_toko">Sales toko</SelectItem><SelectItem value="operasional">Operasional</SelectItem><SelectItem value="gaji_sosial">Gaji sosial</SelectItem><SelectItem value="setoran_tabungan">Setoran tabungan</SelectItem>{!isCashier && <><SelectItem value="sales_titipan">Sales titipan</SelectItem><SelectItem value="bagi_hasil_investor">Bagi hasil investor</SelectItem></>}
              </SelectContent>
            </Select>
          </div>
          {category === "setoran_tabungan" && <p className="rounded-xl bg-amber-500/10 p-3 text-sm text-amber-700">Tidak dihitung sebagai beban; hanya mengurangi kas shift.</p>}
          {(category === "bagi_hasil_investor" || category === "sales_titipan") && <div className="space-y-2"><label className="text-sm font-medium">{category === "sales_titipan" ? "Mitra Titipan" : "Investor"}</label><Select value={investorId} onValueChange={(value) => setInvestorId(value ?? "")}><SelectTrigger className="h-12 rounded-xl"><SelectValue placeholder="Pilih mitra" /></SelectTrigger><SelectContent>{partners.filter((partner) => category !== "sales_titipan" || partner.partnerType === "titipan_bagihasil" || partner.partnerType === "sales_harian").map((partner) => <SelectItem key={partner.id} value={partner.id}>{partner.name}</SelectItem>)}</SelectContent></Select>{category === "bagi_hasil_investor" && <p className="text-sm text-muted-foreground">Distribusi laba, bukan beban operasional.</p>}</div>}
          {category === "sales_titipan" && investorId && <div className="space-y-2 rounded-xl border p-3"><p className="text-sm font-medium">Barang titipan belum disetor</p>{intakes.length === 0 ? <p className="text-sm text-muted-foreground">Tidak ada barang yang perlu dilunasi.</p> : intakes.map((intake) => <label key={intake.id} className="flex gap-2 text-sm"><input type="checkbox" checked={settleIntakeIds.includes(intake.id)} onChange={(event) => setSettleIntakeIds((current) => event.target.checked ? [...current, intake.id] : current.filter((id) => id !== intake.id))} />{intake.productName ?? "Barang titipan"} — {intake.qtySold} terjual</label>)}</div>}
          {category === "sales_toko" && <div className="space-y-2 rounded-xl border p-3"><label className="flex gap-2 text-sm"><input type="checkbox" checked={restockEnabled} onChange={(event) => setRestockEnabled(event.target.checked)} />Sekalian catat sebagai restok</label>{restockEnabled && <div className="grid grid-cols-2 gap-2"><Select value={restockProductId} onValueChange={(value) => setRestockProductId(value ?? "")}><SelectTrigger><SelectValue placeholder="Produk" /></SelectTrigger><SelectContent>{products.map((product) => <SelectItem key={product.id} value={product.id}>{product.name}</SelectItem>)}</SelectContent></Select><Input type="number" value={restockQuantity} onChange={(event) => setRestockQuantity(event.target.value)} placeholder="Jumlah" /></div>}</div>}
          <div className="space-y-2">
            <label className="text-sm font-medium">Jumlah (Rp)</label>
            <Input 
              type="text"
              inputMode="numeric"
              value={amount ? new Intl.NumberFormat("id-ID").format(Number(amount)) : ""}
              onChange={(e) => {
                const digits = e.target.value.replace(/\D/g, "");
                setAmount(digits);
              }}
              placeholder="Contoh: 50.000" 
              className="h-12 rounded-xl text-base font-semibold tabular-nums"
            />
          </div>
          <DialogFooter className="pt-4 flex flex-col sm:flex-row gap-3">
            <Button type="button" variant="outline" className="h-12 rounded-2xl flex-1 font-medium" onClick={() => onOpenChange(false)}>
              Batal
            </Button>
            <Button type="submit" className="h-12 rounded-2xl flex-1 font-semibold" disabled={isSubmitting}>
              {isSubmitting ? "Menyimpan..." : "Simpan Pengeluaran"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

export function PengeluaranRestokView() {
  const [plans, setPlans] = useState<RestockPlan[]>([]);
  const [expenses, setExpenses] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isLoadingExpenses, setIsLoadingExpenses] = useState(true);
  const [expenseDialogOpen, setExpenseDialogOpen] = useState(false);
  const [isAdding, setIsAdding] = useState(false);
  
  // Add Plan form state
  const [productName, setProductName] = useState("");
  const [note, setNote] = useState("");
  const [estimatedPrice, setEstimatedPrice] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    fetchPlans();
    fetchExpenses();
  }, []);

  async function fetchExpenses() {
    setIsLoadingExpenses(true);
    try {
      const res = await fetch("/api/expenses", { cache: "no-store" });
      const data = await res.json();
      if (res.ok && data.expenses) {
        setExpenses(data.expenses);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setIsLoadingExpenses(false);
    }
  }

  async function fetchPlans() {
    setIsLoading(true);
    try {
      const res = await fetch("/api/restock-plans", { cache: "no-store" });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      setPlans(data.plans || []);
    } catch (err: any) {
      toast.error(err.message || "Gagal memuat rencana restok.");
    } finally {
      setIsLoading(false);
    }
  }

  async function handleAddPlan(e: React.FormEvent) {
    e.preventDefault();
    if (!productName) return;
    
    setIsSubmitting(true);
    try {
      const res = await fetch("/api/restock-plans", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ 
          productName, 
          note, 
          estimatedPrice: parseInt(estimatedPrice, 10) || 0 
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      
      toast.success("Berhasil ditambahkan ke daftar restok");
      setPlans([data.plan, ...plans]);
      setIsAdding(false);
      setProductName("");
      setNote("");
      setEstimatedPrice("");
    } catch (err: any) {
      toast.error(err.message || "Gagal menambahkan data.");
    } finally {
      setIsSubmitting(false);
    }
  }

  async function handleToggleDone(id: string, currentStatus: number) {
    const newStatus = currentStatus === 1 ? 0 : 1;
    setPlans(plans.map((p) => (p.id === id ? { ...p, isDone: newStatus } : p)));
    try {
      const res = await fetch("/api/restock-plans", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id, isDone: newStatus }),
      });
      if (!res.ok) throw new Error("Gagal mengupdate");
    } catch (err) {
      toast.error("Gagal mengubah status restok.");
      setPlans(plans.map((p) => (p.id === id ? { ...p, isDone: currentStatus } : p)));
    }
  }

  const totalExpensesAmount = expenses.reduce((acc, e) => acc + (e.amount || 0), 0);
  const pendingPlansCount = plans.filter((p) => p.isDone === 0).length;
  const estimatedRestokCost = plans
    .filter((p) => p.isDone === 0)
    .reduce((acc, p) => acc + (p.estimatedPrice || 0), 0);
  const completedPlansCount = plans.filter((p) => p.isDone === 1).length;

  const expensesByMonth = useMemo(() => {
    const groups: { monthKey: string; monthLabel: string; items: typeof expenses; totalAmount: number }[] = [];
    const map = new Map<string, { monthKey: string; monthLabel: string; items: typeof expenses; totalAmount: number }>();

    for (const exp of expenses) {
      const date = new Date(exp.createdAt);
      const year = date.getFullYear();
      const month = date.getMonth();
      const key = `${year}-${String(month + 1).padStart(2, "0")}`;
      const label = new Intl.DateTimeFormat("id-ID", {
        month: "long",
        year: "numeric",
      }).format(date);

      let group = map.get(key);
      if (!group) {
        group = { monthKey: key, monthLabel: label, items: [], totalAmount: 0 };
        map.set(key, group);
        groups.push(group);
      }
      group.items.push(exp);
      group.totalAmount += exp.amount || 0;
    }

    return groups;
  }, [expenses]);

  return (
    <div className="w-full space-y-4 animate-in fade-in slide-in-from-bottom-2 duration-500">
      <ExpenseRecordDialog
        open={expenseDialogOpen}
        onOpenChange={setExpenseDialogOpen}
      />

      <section className="grid gap-4 grid-cols-2 md:grid-cols-4">
        <StatCard
          title="Beban Pengeluaran"
          value={formatCurrency(totalExpensesAmount)}
          description="Total biaya operasional."
          tone="warn"
        />
        <StatCard
          title="Rencana Restok"
          value={`${pendingPlansCount} Item`}
          description="Stok menipis perlu dibeli."
        />
        <StatCard
          title="Est. Modal Restok"
          value={formatCurrency(estimatedRestokCost)}
          description="Perkiraan belanja restok."
          tone="accent"
        />
        <StatCard
          title="Restok Selesai"
          value={`${completedPlansCount} Terbeli`}
          description="Barang yang sudah dibeli."
        />
      </section>

      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 py-1">
        <div>
          <h2 className="font-heading text-2xl font-bold tracking-tight">Manajemen Restok & Pengeluaran</h2>
          <p className="text-sm text-muted-foreground mt-0.5">
            Daftar belanja kulakan barang warung dan pencatatan biaya operasional.
          </p>
        </div>
        
        <Button 
          onClick={() => setExpenseDialogOpen(true)}
          className="rounded-2xl gap-2 font-semibold shadow-md shadow-primary/20 shrink-0"
        >
          <BanknoteArrowDown className="size-4" />
          Catat Pengeluaran
        </Button>
      </div>

      <div className="grid gap-6 lg:grid-cols-2 items-start">
        {/* Kolom Kiri: Daftar Rencana Restok */}
        <div className="w-full rounded-xl border border-border/60 bg-card/74 text-card-foreground shadow-[0_28px_70px_-45px_rgba(66,38,20,0.55)] overflow-hidden p-6 relative">
          <div className="flex items-center justify-between gap-2 mb-6">
            <div className="flex items-center gap-3">
              <div className="flex size-10 items-center justify-center rounded-xl bg-orange-500/10 text-orange-600 dark:text-primary">
                <ShoppingBag className="size-5" />
              </div>
              <div>
                <h3 className="font-heading text-lg font-semibold">Rencana Belanja Restok</h3>
                <p className="text-xs text-muted-foreground">Catat barang yang harus segera dibeli ke supplier / pasar.</p>
              </div>
            </div>
          </div>

          <form onSubmit={handleAddPlan} className="space-y-3 mb-6 bg-muted/40 p-4 rounded-2xl border border-border/50">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <Input
                placeholder="Nama barang (cth: Beras 5kg)"
                value={productName}
                onChange={(e) => setProductName(e.target.value)}
                className="h-10 rounded-xl"
              />
              <Input
                placeholder="Est. Harga (opsional)"
                type="number"
                value={estimatedPrice}
                onChange={(e) => setEstimatedPrice(e.target.value)}
                className="h-10 rounded-xl"
              />
            </div>
            <div className="flex gap-2">
              <Input
                placeholder="Catatan (cth: beli 2 karung di Toko Sejahtera)"
                value={note}
                onChange={(e) => setNote(e.target.value)}
                className="h-10 rounded-xl"
              />
              <Button type="submit" disabled={isSubmitting} className="rounded-xl shrink-0 gap-1 font-medium">
                <Plus className="size-4" /> Tambah
              </Button>
            </div>
          </form>

          {isLoading ? (
            <div className="py-12 flex justify-center text-muted-foreground">
              <Loader2 className="size-6 animate-spin opacity-50" />
            </div>
          ) : plans.length === 0 ? (
            <div className="text-center py-12">
              <ShoppingBag className="size-12 mx-auto mb-4 text-muted-foreground/30" />
              <p className="text-muted-foreground">Belum ada daftar rencana belanja restok.</p>
            </div>
          ) : (
            <div className="space-y-2.5">
              {plans.map((plan) => (
                <div 
                  key={plan.id} 
                  className={`flex items-center justify-between p-3.5 rounded-2xl border transition-all ${
                    plan.isDone 
                      ? "bg-muted/30 border-border/40 opacity-60" 
                      : "bg-background border-border hover:border-primary/30"
                  }`}
                >
                  <div className="flex items-center gap-3">
                    <button 
                      type="button"
                      onClick={() => handleToggleDone(plan.id, plan.isDone)}
                      className={`flex size-6 shrink-0 items-center justify-center rounded-lg border transition-colors ${
                        plan.isDone 
                          ? "bg-primary text-primary-foreground border-primary" 
                          : "border-muted-foreground/30 hover:border-primary"
                      }`}
                    >
                      {plan.isDone === 1 && <Check className="size-3.5" />}
                    </button>
                    <div className={plan.isDone ? "line-through opacity-70" : ""}>
                      <p className="font-medium">{plan.productName}</p>
                      {plan.note && <p className="text-sm text-muted-foreground mt-0.5">{plan.note}</p>}
                      {plan.estimatedPrice > 0 && (
                        <p className="text-sm font-bold text-orange-700 dark:text-primary/80 mt-1">
                          Est: {formatCurrency(plan.estimatedPrice)}
                        </p>
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Kolom Kanan: Riwayat Pengeluaran */}
        <div className="w-full rounded-xl border border-border/60 bg-card/74 text-card-foreground shadow-[0_28px_70px_-45px_rgba(66,38,20,0.55)] overflow-hidden p-6 relative">
          <div className="flex items-center justify-between gap-2 mb-6">
            <div className="flex items-center gap-3">
              <div className="flex size-10 items-center justify-center rounded-xl bg-red-500/10 text-red-500">
                <BanknoteArrowDown className="size-5" />
              </div>
              <div>
                <h3 className="font-heading text-lg font-semibold">Riwayat Pengeluaran</h3>
                <p className="text-xs text-muted-foreground">Catatan operasional yang masuk ke buku laporan.</p>
              </div>
            </div>
            {expenses.length > 0 && (
              <span className="text-xs font-semibold px-2.5 py-1 rounded-full bg-red-500/10 text-red-600 dark:text-red-400">
                {expenses.length} Total Catatan
              </span>
            )}
          </div>

          {isLoadingExpenses ? (
            <div className="py-12 flex justify-center text-muted-foreground">
              <Loader2 className="size-6 animate-spin opacity-50" />
            </div>
          ) : expensesByMonth.length === 0 ? (
            <div className="text-center py-12">
              <BanknoteArrowDown className="size-12 mx-auto mb-4 text-muted-foreground/30" />
              <p className="text-muted-foreground">Belum ada pengeluaran operasional.</p>
            </div>
          ) : (
            <div className="space-y-6">
              {expensesByMonth.map((group, groupIdx) => (
                <div key={group.monthKey} className={cn("space-y-3", groupIdx > 0 && "pt-5 border-t border-border/70")}>
                  {/* Header Pemisah Bulan */}
                  <div className="flex items-center justify-between px-3.5 py-2.5 rounded-2xl bg-muted/40 border border-border/60">
                    <div className="flex items-center gap-2">
                      <CalendarDays className="size-4 text-primary" />
                      <span className="text-sm font-semibold text-foreground tracking-wide capitalize">
                        {group.monthLabel}
                      </span>
                      <span className="text-xs text-muted-foreground">
                        ({group.items.length} catatan)
                      </span>
                    </div>
                    <div className="text-xs font-bold text-red-600 dark:text-red-400 tabular-nums">
                      Total: {formatCurrency(group.totalAmount)}
                    </div>
                  </div>

                  {/* List Item Pengeluaran Bulan Ini */}
                  <div className="space-y-2.5">
                    {group.items.map((expense) => (
                      <div 
                        key={expense.id} 
                        className="flex items-center justify-between p-4 rounded-2xl border bg-background border-border hover:border-primary/30 transition-all shadow-sm"
                      >
                        <div className="min-w-0 pr-3">
                          <p className="font-medium text-foreground truncate">{expense.title}</p>
                          <p className="text-xs font-medium text-muted-foreground capitalize mt-0.5">{expense.category}</p>
                        </div>
                        <div className="text-right flex flex-col items-end shrink-0">
                          <p className="font-bold text-red-700 dark:text-red-400 tabular-nums">{formatCurrency(expense.amount)}</p>
                          <p className="text-xs text-muted-foreground mt-0.5 mb-1">
                            {new Intl.DateTimeFormat("id-ID", {
                              day: "numeric", month: "short"
                            }).format(new Date(expense.createdAt))}
                          </p>
                          <div className="inline-flex items-center gap-1 rounded-full bg-emerald-500/10 px-2 py-0.5 text-[10px] font-medium text-emerald-600 dark:text-emerald-400">
                            <Check className="size-3" />
                            Masuk Laporan
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
