import Link from "next/link";
import { ArrowRight, BadgeDollarSign, WalletCards } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { formatCurrency } from "@/lib/format";

export type InvestorSummary = {
  id: string;
  name: string;
  whatsapp: string;
  address: string;
  notes: string;
  isActive: number;
  investmentCount: number;
  totalModal: number;
  totalModalUang: number;
  totalModalBarang: number;
  payoutCountThisMonth: number;
  payoutAmountThisMonth: number;
};

export function InvestorCard({ investor }: Readonly<{ investor: InvestorSummary }>) {
  return (
    <Card className="border-border/60 bg-card/80">
      <CardHeader>
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <CardTitle className="truncate font-heading text-xl">{investor.name}</CardTitle>
            <p className="mt-1 text-sm text-muted-foreground">{investor.whatsapp || "WA belum diisi"}</p>
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
              {investor.payoutCountThisMonth}
            </p>
          </div>
        </div>
        <div className="text-sm text-muted-foreground">
          <p>{investor.investmentCount} investasi aktif</p>
          <p className="mt-1 line-clamp-2">{investor.notes || investor.address || "Belum ada catatan."}</p>
        </div>
      </CardContent>
      <CardFooter>
        <Button
          render={<Link href={`/investor/${investor.id}`} />}
          nativeButton={false}
          variant="outline"
          className="ml-auto rounded-full"
        >
          Lihat detail
          <ArrowRight className="size-4" />
        </Button>
      </CardFooter>
    </Card>
  );
}
