"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { AlertTriangle, Check, Loader2, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { InvestorCard, type InvestorSummary } from "@/components/tokomu/investor-card";

export function InactiveInvestorManager({
  investors,
}: Readonly<{
  investors: InvestorSummary[];
}>) {
  const router = useRouter();
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [open, setOpen] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);

  const selectedInvestors = useMemo(
    () => investors.filter((investor) => selectedIds.has(investor.id)),
    [investors, selectedIds]
  );
  const allSelected = investors.length > 0 && selectedIds.size === investors.length;

  function setInvestorSelected(investorId: string, selected: boolean) {
    setSelectedIds((current) => {
      const next = new Set(current);
      if (selected) {
        next.add(investorId);
      } else {
        next.delete(investorId);
      }
      return next;
    });
  }

  function toggleAll(selected: boolean) {
    setSelectedIds(selected ? new Set(investors.map((investor) => investor.id)) : new Set());
  }

  function handleSingleDeleted(investorId: string) {
    setInvestorSelected(investorId, false);
  }

  async function handleBulkDelete() {
    if (selectedInvestors.length === 0) {
      return;
    }

    setIsDeleting(true);
    try {
      const results = await Promise.all(
        selectedInvestors.map(async (investor) => {
          const response = await fetch(`/api/investors/${encodeURIComponent(investor.id)}?mode=purge`, {
            method: "DELETE",
          });
          const data = (await response.json().catch(() => null)) as { error?: string } | null;
          if (!response.ok) {
            throw new Error(data?.error ?? `Gagal menghapus ${investor.name}.`);
          }
          return investor.id;
        })
      );

      toast.success(`${results.length} investor nonaktif berhasil dihapus.`);
      setSelectedIds(new Set());
      setOpen(false);
      router.refresh();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Gagal menghapus investor nonaktif.");
    } finally {
      setIsDeleting(false);
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-3 rounded-[24px] border border-border/60 bg-card/70 p-3 sm:flex-row sm:items-center sm:justify-between">
        <label className="flex cursor-pointer items-center gap-3 text-sm font-medium">
          <span className="grid size-9 place-items-center rounded-2xl border border-border/70 bg-background/60 text-transparent transition-colors has-[:checked]:border-primary has-[:checked]:bg-primary has-[:checked]:text-primary-foreground">
            <input
              type="checkbox"
              className="sr-only"
              checked={allSelected}
              onChange={(event) => toggleAll(event.target.checked)}
              aria-label="Pilih semua investor nonaktif"
            />
            <Check className="size-4" />
          </span>
          <span>
            Pilih semua
            <span className="ml-2 text-muted-foreground">
              {selectedIds.size > 0 ? `${selectedIds.size}/${investors.length} dipilih` : `${investors.length} investor`}
            </span>
          </span>
        </label>

        <Button
          type="button"
          variant="destructive"
          className="rounded-2xl"
          disabled={selectedIds.size === 0}
          onClick={() => setOpen(true)}
        >
          <Trash2 className="size-4" />
          Hapus terpilih
        </Button>
      </div>

      <div className="grid gap-4 xl:grid-cols-2">
        {investors.map((investor) => (
          <InvestorCard
            key={investor.id}
            investor={investor}
            selectable
            selected={selectedIds.has(investor.id)}
            onSelectedChange={setInvestorSelected}
            onDeleted={handleSingleDeleted}
          />
        ))}
      </div>

      <Dialog open={open} onOpenChange={(nextOpen) => !isDeleting && setOpen(nextOpen)}>
        <DialogContent className="max-w-md rounded-[28px] p-0">
          <DialogHeader className="p-6 pb-0">
            <div className="mb-2 flex size-12 items-center justify-center rounded-2xl bg-destructive/12 text-destructive">
              <AlertTriangle className="size-5" />
            </div>
            <DialogTitle className="font-heading text-2xl">Hapus investor terpilih?</DialogTitle>
            <DialogDescription>
              {selectedInvestors.length} investor nonaktif akan dihapus permanen dari sistem.
            </DialogDescription>
          </DialogHeader>

          <div className="px-6 pb-4">
            <div className="rounded-[22px] border border-destructive/25 bg-destructive/10 p-4 text-sm text-destructive">
              Riwayat investasi dan payout dari investor terpilih juga ikut dihapus. Aksi ini tidak bisa dibatalkan.
            </div>
          </div>

          <DialogFooter className="rounded-b-[28px]">
            <Button
              type="button"
              variant="outline"
              className="rounded-2xl"
              disabled={isDeleting}
              onClick={() => setOpen(false)}
            >
              Batal
            </Button>
            <Button
              type="button"
              variant="destructive"
              className="rounded-2xl"
              disabled={isDeleting}
              onClick={() => void handleBulkDelete()}
            >
              {isDeleting ? <Loader2 className="size-4 animate-spin" /> : <Trash2 className="size-4" />}
              Hapus permanen
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
