"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { Plus } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

export function TitipanIntakeDialog({ partners }: { partners: Array<{ id: string; name: string; partnerType: string }> }) {
  const router = useRouter(); const [open, setOpen] = useState(false); const [saving, setSaving] = useState(false);
  const [draft, setDraft] = useState({ investorId: "", intakeDate: new Date().toISOString().slice(0, 10), qtyIn: "", unitCost: "", unitPrice: "" });
  async function submit(event: React.FormEvent) { event.preventDefault(); setSaving(true); try { const response = await fetch("/api/titipan-intakes", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ ...draft, qtyIn: Number(draft.qtyIn), unitCost: Number(draft.unitCost), unitPrice: Number(draft.unitPrice) }) }); const data = await response.json(); if (!response.ok) throw new Error(data.error ?? "Gagal menyimpan barang titipan."); toast.success("Barang titipan masuk berhasil dicatat."); setOpen(false); router.refresh(); } catch (error) { toast.error(error instanceof Error ? error.message : "Gagal menyimpan barang titipan."); } finally { setSaving(false); } }
  return <Dialog open={open} onOpenChange={setOpen}><DialogTrigger render={<Button variant="outline" size="lg" className="rounded-2xl" />}><Plus className="size-4" />Barang Titipan Masuk</DialogTrigger><DialogContent><DialogHeader><DialogTitle>Barang Titipan Masuk</DialogTitle></DialogHeader><form className="space-y-3" onSubmit={submit}><Select value={draft.investorId} onValueChange={(investorId) => setDraft((d) => ({ ...d, investorId: investorId ?? "" }))}><SelectTrigger><SelectValue placeholder="Mitra titipan" /></SelectTrigger><SelectContent>{partners.map((partner) => <SelectItem key={partner.id} value={partner.id}>{partner.name}</SelectItem>)}</SelectContent></Select><Input type="date" value={draft.intakeDate} onChange={(event) => setDraft((d) => ({ ...d, intakeDate: event.target.value }))} /><Input type="number" placeholder="Jumlah masuk" value={draft.qtyIn} onChange={(event) => setDraft((d) => ({ ...d, qtyIn: event.target.value }))} /><Input type="number" placeholder="Harga modal per unit" value={draft.unitCost} onChange={(event) => setDraft((d) => ({ ...d, unitCost: event.target.value }))} /><Input type="number" placeholder="Harga jual per unit" value={draft.unitPrice} onChange={(event) => setDraft((d) => ({ ...d, unitPrice: event.target.value }))} /><DialogFooter><Button type="submit" disabled={saving || !draft.investorId}>{saving ? "Menyimpan..." : "Simpan"}</Button></DialogFooter></form></DialogContent></Dialog>;
}
