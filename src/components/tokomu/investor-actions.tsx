"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { AlertTriangle, Loader2, Trash2, UserX } from "lucide-react";
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
import { cn } from "@/lib/utils";

export function InvestorDeactivateButton({
  className,
  investorId,
  investorName,
  redirectToInactive = false,
  size = "sm",
}: Readonly<{
  className?: string;
  investorId: string;
  investorName: string;
  redirectToInactive?: boolean;
  size?: "sm" | "lg";
}>) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  async function handleDeactivate() {
    setIsSubmitting(true);
    try {
      const response = await fetch(`/api/investors/${encodeURIComponent(investorId)}`, {
        method: "DELETE",
      });
      const data = (await response.json().catch(() => null)) as { error?: string } | null;

      if (!response.ok) {
        throw new Error(data?.error ?? "Gagal menonaktifkan investor.");
      }

      toast.success("Investor berhasil dinonaktifkan.", {
        description: `${investorName} sekarang muncul di daftar investor nonaktif.`,
      });

      setOpen(false);
      if (redirectToInactive) {
        router.push("/investor?status=inactive");
      }
      router.refresh();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Gagal menonaktifkan investor.");
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <>
      <Button
        type="button"
        variant="destructive"
        size={size}
        className={cn("rounded-full", className)}
        disabled={isSubmitting}
        onClick={() => setOpen(true)}
      >
        {isSubmitting ? <Loader2 className="size-4 animate-spin" /> : <UserX className="size-4" />}
        Nonaktifkan
      </Button>

      <Dialog open={open} onOpenChange={(nextOpen) => !isSubmitting && setOpen(nextOpen)}>
        <DialogContent className="max-w-md rounded-[28px] p-0">
          <DialogHeader className="p-6 pb-0">
            <div className="mb-2 flex size-12 items-center justify-center rounded-2xl bg-destructive/12 text-destructive">
              <AlertTriangle className="size-5" />
            </div>
            <DialogTitle className="font-heading text-2xl">Nonaktifkan investor?</DialogTitle>
            <DialogDescription>
              {investorName} akan dipindahkan ke daftar Nonaktif dan semua investasi aktifnya akan ditutup.
            </DialogDescription>
          </DialogHeader>

          <div className="px-6 pb-4">
            <div className="rounded-[22px] border border-border/70 bg-card/65 p-4 text-sm text-muted-foreground">
              Data riwayat investasi dan payout tetap tersimpan untuk laporan. Investor nonaktif tidak bisa dipakai untuk investasi baru.
            </div>
          </div>

          <DialogFooter className="rounded-b-[28px]">
            <Button
              type="button"
              variant="outline"
              className="rounded-2xl"
              disabled={isSubmitting}
              onClick={() => setOpen(false)}
            >
              Batal
            </Button>
            <Button
              type="button"
              variant="destructive"
              className="rounded-2xl"
              disabled={isSubmitting}
              onClick={() => void handleDeactivate()}
            >
              {isSubmitting ? <Loader2 className="size-4 animate-spin" /> : <UserX className="size-4" />}
              Nonaktifkan
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}

export function InvestorDeleteButton({
  className,
  investorId,
  investorName,
  onDeleted,
  redirectToInactive = false,
  size = "sm",
}: Readonly<{
  className?: string;
  investorId: string;
  investorName: string;
  onDeleted?: (investorId: string) => void;
  redirectToInactive?: boolean;
  size?: "sm" | "lg";
}>) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  async function handleDelete() {
    setIsSubmitting(true);
    try {
      const response = await fetch(`/api/investors/${encodeURIComponent(investorId)}?mode=purge`, {
        method: "DELETE",
      });
      const data = (await response.json().catch(() => null)) as { error?: string } | null;

      if (!response.ok) {
        throw new Error(data?.error ?? "Gagal menghapus investor.");
      }

      toast.success("Investor nonaktif berhasil dihapus.", {
        description: `${investorName} sudah dihapus dari daftar investor.`,
      });

      setOpen(false);
      onDeleted?.(investorId);
      if (redirectToInactive) {
        router.push("/investor?status=inactive");
      }
      router.refresh();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Gagal menghapus investor.");
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <>
      <Button
        type="button"
        variant="destructive"
        size={size}
        className={cn("rounded-full", className)}
        disabled={isSubmitting}
        onClick={() => setOpen(true)}
      >
        {isSubmitting ? <Loader2 className="size-4 animate-spin" /> : <Trash2 className="size-4" />}
        Hapus
      </Button>

      <Dialog open={open} onOpenChange={(nextOpen) => !isSubmitting && setOpen(nextOpen)}>
        <DialogContent className="max-w-md rounded-[28px] p-0">
          <DialogHeader className="p-6 pb-0">
            <div className="mb-2 flex size-12 items-center justify-center rounded-2xl bg-destructive/12 text-destructive">
              <AlertTriangle className="size-5" />
            </div>
            <DialogTitle className="font-heading text-2xl">Hapus investor nonaktif?</DialogTitle>
            <DialogDescription>
              {investorName} akan dihapus permanen dari daftar investor nonaktif.
            </DialogDescription>
          </DialogHeader>

          <div className="px-6 pb-4">
            <div className="rounded-[22px] border border-destructive/25 bg-destructive/10 p-4 text-sm text-destructive">
              Riwayat investasi dan payout investor ini juga akan ikut dihapus. Aksi ini tidak bisa dibatalkan.
            </div>
          </div>

          <DialogFooter className="rounded-b-[28px]">
            <Button
              type="button"
              variant="outline"
              className="rounded-2xl"
              disabled={isSubmitting}
              onClick={() => setOpen(false)}
            >
              Batal
            </Button>
            <Button
              type="button"
              variant="destructive"
              className="rounded-2xl"
              disabled={isSubmitting}
              onClick={() => void handleDelete()}
            >
              {isSubmitting ? <Loader2 className="size-4 animate-spin" /> : <Trash2 className="size-4" />}
              Hapus permanen
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
