"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Loader2, Plus, Save, X } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";

export function InvestorFormDialog() {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [draft, setDraft] = useState({
    name: "",
    whatsapp: "",
    address: "",
    notes: "",
  });

  function reset() {
    setDraft({
      name: "",
      whatsapp: "",
      address: "",
      notes: "",
    });
  }

  function handleOpenChange(nextOpen: boolean) {
    setOpen(nextOpen);
    if (!nextOpen && !isSubmitting) {
      reset();
    }
  }

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setIsSubmitting(true);

    try {
      const response = await fetch("/api/investors", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(draft),
      });
      const data = (await response.json()) as {
        investor?: { id: string };
        error?: string;
      };

      if (!response.ok || !data.investor) {
        throw new Error(data.error ?? "Gagal menambah investor.");
      }

      toast.success("Investor baru berhasil ditambahkan.");
      setOpen(false);
      reset();
      router.push(`/investor/${data.investor.id}`);
      router.refresh();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Gagal menambah investor.");
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogTrigger render={<Button size="lg" className="rounded-2xl" />}>
        <Plus className="size-4" />
        Investor Baru
      </DialogTrigger>
      <DialogContent className="max-w-3xl rounded-[28px] p-0">
        <DialogHeader className="border-b border-border/70 px-5 pt-5 pb-4 sm:px-6">
          <DialogTitle className="font-heading text-2xl">Tambah investor baru</DialogTitle>
          <DialogDescription>
            Data ini dipakai untuk mencatat modal uang, barang titip jual, dan riwayat bagi hasil.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={(event) => void handleSubmit(event)}>
          <div className="grid gap-4 px-5 py-4 sm:px-6">
            <div className="grid gap-2">
              <Label htmlFor="investor-name">Nama investor</Label>
              <Input
                id="investor-name"
                value={draft.name}
                onChange={(event) => setDraft((current) => ({ ...current, name: event.target.value }))}
                placeholder="Contoh: H. Ahmad Fauzan"
                className="h-11 rounded-2xl"
                required
              />
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              <div className="grid gap-2">
                <Label htmlFor="investor-whatsapp">WhatsApp</Label>
                <Input
                  id="investor-whatsapp"
                  value={draft.whatsapp}
                  onChange={(event) => setDraft((current) => ({ ...current, whatsapp: event.target.value }))}
                  placeholder="0812..."
                  className="h-11 rounded-2xl"
                />
              </div>
              <div className="grid gap-2">
                <Label htmlFor="investor-address">Alamat</Label>
                <Input
                  id="investor-address"
                  value={draft.address}
                  onChange={(event) => setDraft((current) => ({ ...current, address: event.target.value }))}
                  placeholder="Grabag, Purworejo"
                  className="h-11 rounded-2xl"
                />
              </div>
            </div>

            <div className="grid gap-2">
              <Label htmlFor="investor-notes">Catatan</Label>
              <Textarea
                id="investor-notes"
                value={draft.notes}
                onChange={(event) => setDraft((current) => ({ ...current, notes: event.target.value }))}
                placeholder="Catatan sumber modal, kesepakatan awal, atau kontak tambahan."
                className="min-h-28 rounded-2xl"
              />
            </div>
          </div>

          <DialogFooter className="m-0 rounded-b-[28px] px-5 py-4 sm:px-6">
            <Button
              type="button"
              size="lg"
              variant="outline"
              className="rounded-2xl"
              disabled={isSubmitting}
              onClick={() => handleOpenChange(false)}
            >
              <X className="size-4" />
              Batal
            </Button>
            <Button type="submit" size="lg" className="rounded-2xl" disabled={isSubmitting}>
              {isSubmitting ? <Loader2 className="size-4 animate-spin" /> : <Save className="size-4" />}
              Simpan investor
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
