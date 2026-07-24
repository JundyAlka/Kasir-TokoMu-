"use client";

import { useEffect, useState } from "react";
import { BanknoteArrowDown, Check, Loader2, Plus, ShoppingBag, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { formatCurrency } from "@/lib/format";

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
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [title, setTitle] = useState("");
  const [amount, setAmount] = useState("");
  const [category, setCategory] = useState<string>("Operasional");
  const [customCategory, setCustomCategory] = useState("");

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!title || !amount) {
      toast.error("Mohon isi semua data yang wajib.");
      return;
    }

    const finalCategory = category === "Lainnya" && customCategory.trim() 
      ? customCategory.trim() 
      : category;
    
    setIsSubmitting(true);
    try {
      const payload = {
        title,
        amount: parseInt(amount, 10),
        category: finalCategory,
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
      setCategory("Operasional");
      setCustomCategory("");
    } catch (err: any) {
      toast.error(err.message);
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md rounded-[28px] border-border bg-card p-6 shadow-2xl">
        <DialogHeader>
          <div className="mb-2 flex size-12 items-center justify-center rounded-2xl bg-primary/14 text-primary">
            <BanknoteArrowDown className="size-5" />
          </div>
          <DialogTitle className="font-heading text-2xl">Catat Pengeluaran</DialogTitle>
          <DialogDescription>
            Masukkan detail beban operasional seperti listrik, ATK, WiFi, dll.
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4 py-4">
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
            <Select value={category} onValueChange={(val) => setCategory(val || "")}>
              <SelectTrigger className="w-full h-12 rounded-xl">
                <SelectValue placeholder="Pilih Kategori" />
              </SelectTrigger>
              <SelectContent className="rounded-xl">
                <SelectItem value="Operasional">Operasional (Umum)</SelectItem>
                <SelectItem value="Listrik">Listrik</SelectItem>
                <SelectItem value="ATK">ATK (Alat Tulis Kantor)</SelectItem>
                <SelectItem value="WiFi">WiFi / Internet</SelectItem>
                <SelectItem value="Belanja">Belanja Modal</SelectItem>
                <SelectItem value="Utilitas">Utilitas Lainnya</SelectItem>
                <SelectItem value="Lainnya">Lainnya...</SelectItem>
              </SelectContent>
            </Select>
          </div>
          {category === "Lainnya" && (
            <div className="space-y-2 animate-in fade-in slide-in-from-top-2">
              <label className="text-sm font-medium text-primary">Kategori Lainnya</label>
              <Input 
                value={customCategory}
                onChange={(e) => setCustomCategory(e.target.value)}
                placeholder="Masukkan nama kategori" 
                className="h-12 rounded-xl border-primary/50 focus-visible:ring-primary"
              />
            </div>
          )}
          <div className="space-y-2">
            <label className="text-sm font-medium">Jumlah (Rp)</label>
            <Input 
              type="number"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              placeholder="Contoh: 50000"
              className="h-12 rounded-xl"
            />
          </div>
          <DialogFooter className="pt-4">
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

  return (
    <div className="w-full space-y-4 animate-in fade-in slide-in-from-bottom-2 duration-500">
      <ExpenseRecordDialog
        open={expenseDialogOpen}
        onOpenChange={setExpenseDialogOpen}
      />

      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-xl font-heading font-semibold">Pengeluaran & Restok</h2>
          <p className="text-sm text-muted-foreground mt-1">Catat belanja pengeluaran dan rencana produk untuk direstok.</p>
        </div>
        
        {/* Catat Pengeluaran Button sejajar di sini */}
        <Button 
          onClick={() => setExpenseDialogOpen(true)}
          className="rounded-xl h-11 px-5 shadow-md shadow-primary/20 hover:shadow-primary/30 transition-all font-medium"
        >
          <BanknoteArrowDown className="mr-2 size-4" />
          Catat Pengeluaran
        </Button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 w-full items-start">
        {/* Kolom Kiri: Daftar Rencana Restok */}
        <div className="w-full rounded-xl border border-border/60 bg-card/74 text-card-foreground shadow-[0_28px_70px_-45px_rgba(66,38,20,0.55)] overflow-hidden p-6 relative">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
          <div className="flex items-center gap-3">
            <div className="flex size-10 items-center justify-center rounded-xl bg-orange-500/10 text-orange-500">
              <ShoppingBag className="size-5" />
            </div>
            <h3 className="font-heading text-lg font-semibold">Daftar Rencana Restok</h3>
          </div>
          <Dialog open={isAdding} onOpenChange={setIsAdding}>
            <DialogTrigger render={<Button variant="secondary" className="rounded-xl h-10 px-4" />}>
              <Plus className="mr-2 size-4" />
              Tambah Barang
            </DialogTrigger>
            <DialogContent className="rounded-2xl max-w-md">
              <DialogHeader>
                <DialogTitle>Tambah Rencana Restok</DialogTitle>
                <DialogDescription>
                  Catat barang atau produk yang stoknya sudah menipis dan perlu Anda beli di waktu mendatang.
                </DialogDescription>
              </DialogHeader>
              <form onSubmit={handleAddPlan} className="space-y-4 py-2">
                <div className="space-y-2">
                  <label className="text-sm font-medium">Nama Produk / Barang</label>
                  <Input 
                    placeholder="Cth: Minyak Goreng 2L" 
                    value={productName} 
                    onChange={(e) => setProductName(e.target.value)} 
                    className="h-11 rounded-xl"
                    autoFocus
                  />
                </div>
                <div className="space-y-2">
                  <label className="text-sm font-medium">Catatan / Deskripsi Singkat (Opsional)</label>
                  <Input 
                    placeholder="Cth: Butuh 3 dus, cari di pasar" 
                    value={note} 
                    onChange={(e) => setNote(e.target.value)} 
                    className="h-11 rounded-xl"
                  />
                  <p className="text-[13px] text-muted-foreground leading-relaxed mt-1">
                    Gunakan untuk mencatat jumlah estimasi, di mana membelinya, atau spesifikasi barang.
                  </p>
                </div>
                <div className="space-y-2">
                  <label className="text-sm font-medium">Estimasi Harga / Nominal (Opsional)</label>
                  <Input 
                    type="number"
                    placeholder="Contoh: 150000" 
                    value={estimatedPrice} 
                    onChange={(e) => setEstimatedPrice(e.target.value)} 
                    className="h-11 rounded-xl"
                  />
                </div>
                <DialogFooter className="pt-4">
                  <Button type="submit" disabled={isSubmitting || !productName} className="w-full rounded-xl h-11">
                    {isSubmitting ? <Loader2 className="mr-2 size-4 animate-spin" /> : "Simpan"}
                  </Button>
                </DialogFooter>
              </form>
            </DialogContent>
          </Dialog>
        </div>

        {isLoading ? (
          <div className="py-12 flex justify-center text-muted-foreground">
            <Loader2 className="size-6 animate-spin opacity-50" />
          </div>
        ) : plans.length === 0 ? (
          <div className="text-center py-12">
            <ShoppingBag className="size-12 mx-auto mb-4 text-muted-foreground/30" />
            <p className="text-muted-foreground">Belum ada daftar rencana restok.</p>
          </div>
        ) : (
          <div className="space-y-3">
            {plans.map((plan) => (
              <div 
                key={plan.id} 
                className={`group flex items-center justify-between p-4 rounded-2xl border transition-all ${
                  plan.isDone 
                    ? "bg-muted/30 border-transparent opacity-60" 
                    : "bg-background border-border hover:border-primary/30"
                }`}
              >
                <div className="flex items-center gap-4">
                  <button 
                    onClick={() => handleToggleDone(plan.id, plan.isDone)}
                    className={`flex size-6 shrink-0 items-center justify-center rounded-full border-2 transition-colors ${
                      plan.isDone 
                        ? "border-primary bg-primary text-primary-foreground" 
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
          <div className="flex items-center gap-3 mb-6">
            <div className="flex size-10 items-center justify-center rounded-xl bg-red-500/10 text-red-500">
              <BanknoteArrowDown className="size-5" />
            </div>
            <h3 className="font-heading text-lg font-semibold">Riwayat Pengeluaran</h3>
          </div>

          {isLoadingExpenses ? (
            <div className="py-12 flex justify-center text-muted-foreground">
              <Loader2 className="size-6 animate-spin opacity-50" />
            </div>
          ) : expenses.length === 0 ? (
            <div className="text-center py-12">
              <BanknoteArrowDown className="size-12 mx-auto mb-4 text-muted-foreground/30" />
              <p className="text-muted-foreground">Belum ada pengeluaran operasional.</p>
            </div>
          ) : (
            <div className="space-y-3">
              {expenses.map((expense) => (
                <div 
                  key={expense.id} 
                  className="flex items-center justify-between p-4 rounded-2xl border bg-background border-border hover:border-primary/30 transition-all"
                >
                  <div>
                    <p className="font-medium">{expense.title}</p>
                    <p className="text-sm text-muted-foreground mt-0.5">{expense.category}</p>
                  </div>
                  <div className="text-right flex flex-col items-end">
                    <p className="font-bold text-red-700 dark:text-red-400">{formatCurrency(expense.amount)}</p>
                    <p className="text-xs text-muted-foreground mt-1 mb-1">
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
          )}
        </div>
      </div>
    </div>
  );
}
