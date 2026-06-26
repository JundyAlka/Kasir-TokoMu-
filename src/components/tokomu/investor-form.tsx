"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Loader2, Save, X } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";

export function InvestorForm() {
  const router = useRouter();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [draft, setDraft] = useState({
    name: "",
    whatsapp: "",
    address: "",
    notes: "",
  });

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
      router.push(`/investor/${data.investor.id}`);
      router.refresh();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Gagal menambah investor.");
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <Card className="mx-auto max-w-3xl border-border/60 bg-card/80">
      <CardHeader>
        <CardTitle className="font-heading text-2xl">Tambah investor baru</CardTitle>
        <CardDescription>
          Data ini dipakai untuk mencatat modal uang, barang titip jual, dan riwayat bagi hasil.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <form className="grid gap-4" onSubmit={(event) => void handleSubmit(event)}>
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

          <div className="flex flex-wrap justify-end gap-2">
            <Button
              type="button"
              size="lg"
              variant="outline"
              className="rounded-2xl"
              disabled={isSubmitting}
              onClick={() => router.push("/investor")}
            >
              <X className="size-4" />
              Batal
            </Button>
            <Button type="submit" size="lg" className="rounded-2xl" disabled={isSubmitting}>
              {isSubmitting ? <Loader2 className="size-4 animate-spin" /> : <Save className="size-4" />}
              Simpan investor
            </Button>
          </div>
        </form>
      </CardContent>
    </Card>
  );
}
