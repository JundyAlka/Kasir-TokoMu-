"use client";

import Link from "next/link";
import { ArrowRight, BadgeDollarSign, Check, WalletCards } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { InvestorDeactivateButton, InvestorDeleteButton } from "@/components/tokomu/investor-actions";
import { Button } from "@/components/ui/button";
import { formatCurrency } from "@/lib/format";
import { cn } from "@/lib/utils";

export type InvestorSummary = {
  id: string;
  name: string;
  whatsapp: string;
  address: string;
  notes: string;
  partnerType: string;
  isActive: number;
  investmentCount: number;
  totalModal: number;
  totalModalUang: number;
  totalModalBarang: number;
  payoutCountThisMonth: number;
  payoutAmountThisMonth: number;
};

export function InvestorCard({
  investor,
  onDeleted,
  onSelectedChange,
  selectable = false,
  selected = false,
}: Readonly<{
  investor: InvestorSummary;
  onDeleted?: (investorId: string) => void;
  onSelectedChange?: (investorId: string, selected: boolean) => void;
  selectable?: boolean;
  selected?: boolean;
}>) {
  return (
    <Card
      className={cn(
        "border-border/60 bg-card/80 transition-colors",
        selected && "border-primary/70 bg-primary/5 ring-1 ring-primary/45"
      )}
    >
      <CardHeader>
        <div className="flex items-start justify-between gap-3">
          <div className="flex min-w-0 gap-3">
            {selectable ? (
              <label className="mt-0.5 grid size-8 shrink-0 cursor-pointer place-items-center rounded-xl border border-border/70 bg-background/60 text-transparent transition-colors hover:border-primary/60 has-[:checked]:border-primary has-[:checked]:bg-primary has-[:checked]:text-primary-foreground">
                <input
                  type="checkbox"
                  className="sr-only"
                  checked={selected}
                  onChange={(event) => onSelectedChange?.(investor.id, event.target.checked)}
                  aria-label={`Pilih ${investor.name}`}
                />
                <Check className="size-4" />
              </label>
            ) : null}
            <div className="min-w-0">
              <CardTitle className="truncate font-heading text-xl">{investor.name}</CardTitle>
              <p className="mt-1 text-sm text-muted-foreground">{investor.whatsapp || "WA belum diisi"}</p>
            </div>
          </div>
          <Badge variant={investor.isActive === 1 ? "default" : "secondary"}>
            {investor.isActive === 1 ? "Aktif" : "Nonaktif"}
          </Badge>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid gap-3 sm:grid-cols-2">
          <div className="rounded-2xl border border-border/70 bg-background/55 p-3">
            <div className="flex items-center gap-2 text-xs text-muted-foreground">
              <WalletCards className="size-3.5" />
              Total modal aktif
            </div>
            <p className="mt-2 font-heading text-2xl font-semibold">
              {formatCurrency(investor.totalModal)}
            </p>
          </div>
          <div className="rounded-2xl border border-border/70 bg-background/55 p-3">
            <div className="flex items-center gap-2 text-xs text-muted-foreground">
              <BadgeDollarSign className="size-3.5" />
              Payout bulan ini
            </div>
            <p className="mt-2 font-heading text-2xl font-semibold">
              {formatCurrency(investor.payoutAmountThisMonth)}
            </p>
            <p className="mt-1 text-xs text-muted-foreground">{investor.payoutCountThisMonth} payout</p>
          </div>
        </div>
        <div className="text-sm text-muted-foreground">
          <p>{investor.investmentCount} investasi aktif</p>
          <p className="mt-1 line-clamp-2">{investor.notes || investor.address || "Belum ada catatan."}</p>
        </div>
      </CardContent>
      <CardFooter className="flex flex-wrap justify-end gap-2">
        {investor.isActive === 1 ? (
          <InvestorDeactivateButton investorId={investor.id} investorName={investor.name} />
        ) : (
          <InvestorDeleteButton investorId={investor.id} investorName={investor.name} onDeleted={onDeleted} />
        )}
        <Button
          render={<Link href={`/investor/${investor.id}`} />}
          nativeButton={false}
          variant="outline"
          className="rounded-full"
        >
          Lihat detail
          <ArrowRight className="size-4" />
        </Button>
      </CardFooter>
    </Card>
  );
}
