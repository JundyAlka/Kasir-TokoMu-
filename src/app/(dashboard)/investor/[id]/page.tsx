import Link from "next/link";
import { ArrowLeft, PackageOpen, WalletCards } from "lucide-react";
import { eq } from "drizzle-orm";
import { db } from "@/db/client";
import { products } from "@/db/schema";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { InvestmentFormDialog } from "@/components/tokomu/investment-form";
import { formatCurrency, formatDate } from "@/lib/format";
import { getRequestUser } from "@/lib/server/app-service";
import { getInvestor, listInvestments } from "@/lib/server/investor-service";
import { requireRole } from "@/lib/server/rbac";

export default async function InvestorDetailPage({
  params,
}: Readonly<{
  params: Promise<{ id: string }>;
}>) {
  await requireRole(["pimpinan", "pengelola_keuangan"]);
  const { workspaceOwnerId } = await getRequestUser();
  const { id } = await params;
  const [{ investor, payouts }, investmentRows, productRows] = await Promise.all([
    getInvestor(workspaceOwnerId, id),
    listInvestments(workspaceOwnerId, id),
    db
      .select({
        id: products.id,
        name: products.name,
        stock: products.stock,
        buyPrice: products.buyPrice,
        sellPrice: products.sellPrice,
      })
      .from(products)
      .where(eq(products.userId, workspaceOwnerId)),
  ]);

  const activeInvestments = investmentRows.filter((investment) => investment.isActive === 1);
  const totalModal = activeInvestments.reduce((total, investment) => {
    if (investment.type === "uang") return total + (investment.amount ?? 0);
    return total + (investment.unitCount ?? 0) * (investment.unitCost ?? 0);
  }, 0);

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
        <Button
          render={<Link href="/investor" />}
          nativeButton={false}
          variant="outline"
          className="w-fit rounded-full"
        >
          <ArrowLeft className="size-4" />
          Kembali
        </Button>
        <InvestmentFormDialog investorId={investor.id} products={productRows} />
      </div>

      <Card className="border-border/60 bg-card/80">
        <CardHeader>
          <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
            <div>
              <CardTitle className="font-heading text-3xl">{investor.name}</CardTitle>
              <CardDescription className="mt-2">
                {investor.whatsapp || "WA belum diisi"} · {investor.address || "Alamat belum diisi"}
              </CardDescription>
            </div>
            <Badge variant={investor.isActive === 1 ? "default" : "secondary"}>
              {investor.isActive === 1 ? "Aktif" : "Nonaktif"}
            </Badge>
          </div>
        </CardHeader>
        <CardContent className="grid gap-3 md:grid-cols-3">
          <div className="rounded-2xl border border-border/70 bg-background/55 p-4">
            <p className="text-sm text-muted-foreground">Total modal aktif</p>
            <p className="mt-2 font-heading text-2xl font-semibold">{formatCurrency(totalModal)}</p>
          </div>
          <div className="rounded-2xl border border-border/70 bg-background/55 p-4">
            <p className="text-sm text-muted-foreground">Investasi aktif</p>
            <p className="mt-2 font-heading text-2xl font-semibold">{activeInvestments.length}</p>
          </div>
          <div className="rounded-2xl border border-border/70 bg-background/55 p-4">
            <p className="text-sm text-muted-foreground">Riwayat payout</p>
            <p className="mt-2 font-heading text-2xl font-semibold">{payouts.length}</p>
          </div>
        </CardContent>
      </Card>

      <Tabs defaultValue="profil" className="gap-4">
        <TabsList className="h-10">
          <TabsTrigger value="profil" className="px-4">Profil</TabsTrigger>
          <TabsTrigger value="investasi" className="px-4">Investasi</TabsTrigger>
          <TabsTrigger value="payout" className="px-4">Riwayat Bagi Hasil</TabsTrigger>
        </TabsList>

        <TabsContent value="profil">
          <Card className="border-border/60 bg-card/80">
            <CardHeader>
              <CardTitle>Profil investor</CardTitle>
              <CardDescription>Data kontak dan catatan kesepakatan awal.</CardDescription>
            </CardHeader>
            <CardContent className="grid gap-4 md:grid-cols-2">
              <div>
                <p className="text-sm text-muted-foreground">Nama</p>
                <p className="mt-1 font-medium">{investor.name}</p>
              </div>
              <div>
                <p className="text-sm text-muted-foreground">WhatsApp</p>
                <p className="mt-1 font-medium">{investor.whatsapp || "-"}</p>
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Alamat</p>
                <p className="mt-1 font-medium">{investor.address || "-"}</p>
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Bergabung</p>
                <p className="mt-1 font-medium">{formatDate(investor.createdAt)}</p>
              </div>
              <div className="md:col-span-2">
                <p className="text-sm text-muted-foreground">Catatan</p>
                <p className="mt-1 leading-6">{investor.notes || "-"}</p>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="investasi">
          <Card className="border-border/60 bg-card/80">
            <CardHeader className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
              <div>
                <CardTitle>Investasi</CardTitle>
                <CardDescription>Modal uang dan barang titip jual yang tercatat.</CardDescription>
              </div>
              <InvestmentFormDialog investorId={investor.id} products={productRows} />
            </CardHeader>
            <CardContent>
              <Table className="min-w-[820px]">
                <TableHeader>
                  <TableRow>
                    <TableHead>Tipe</TableHead>
                    <TableHead>Nilai</TableHead>
                    <TableHead>Bagi hasil</TableHead>
                    <TableHead>Produk</TableHead>
                    <TableHead>Mulai</TableHead>
                    <TableHead>Status</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {investmentRows.map((investment) => (
                    <TableRow key={investment.id}>
                      <TableCell>
                        <Badge variant="outline">
                          {investment.type === "uang" ? (
                            <>
                              <WalletCards className="size-3" />
                              Uang
                            </>
                          ) : (
                            <>
                              <PackageOpen className="size-3" />
                              Barang titip jual
                            </>
                          )}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        {investment.type === "uang"
                          ? formatCurrency(investment.amount ?? 0)
                          : `${investment.unitCount ?? 0} unit · ${formatCurrency(investment.unitCost ?? 0)}/unit`}
                      </TableCell>
                      <TableCell>
                        {investment.type === "uang"
                          ? `${investment.profitSharePct ?? 0}%`
                          : `${investment.profitSharePerUnitPct ?? 0}% per unit`}
                      </TableCell>
                      <TableCell>{investment.productName ?? "-"}</TableCell>
                      <TableCell>{formatDate(investment.startDate)}</TableCell>
                      <TableCell>
                        <Badge variant={investment.isActive === 1 ? "default" : "secondary"}>
                          {investment.isActive === 1 ? "Aktif" : "Nonaktif"}
                        </Badge>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="payout">
          <Card className="border-border/60 bg-card/80">
            <CardHeader>
              <CardTitle>Riwayat bagi hasil</CardTitle>
              <CardDescription>Payout investor yang sudah dibuat dari laporan periode tertentu.</CardDescription>
            </CardHeader>
            <CardContent>
              <Table className="min-w-[760px]">
                <TableHeader>
                  <TableRow>
                    <TableHead>Periode</TableHead>
                    <TableHead>Profit dasar</TableHead>
                    <TableHead>Share</TableHead>
                    <TableHead>Nominal</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Catatan</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {payouts.map((payout) => (
                    <TableRow key={payout.id}>
                      <TableCell>
                        {formatDate(payout.periodStart)} - {formatDate(payout.periodEnd)}
                      </TableCell>
                      <TableCell>{formatCurrency(payout.baseProfit)}</TableCell>
                      <TableCell>{payout.sharePct}%</TableCell>
                      <TableCell>{formatCurrency(payout.amount)}</TableCell>
                      <TableCell>
                        <Badge variant={payout.status === "dibayar" ? "default" : "secondary"}>
                          {payout.status}
                        </Badge>
                      </TableCell>
                      <TableCell className="max-w-xs whitespace-normal">{payout.note || "-"}</TableCell>
                    </TableRow>
                  ))}
                  {payouts.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={6} className="h-24 text-center text-muted-foreground">
                        Belum ada riwayat bagi hasil.
                      </TableCell>
                    </TableRow>
                  ) : null}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
