import Link from "next/link";
import { Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { InvestorCard, type InvestorSummary } from "@/components/tokomu/investor-card";
import { getRequestUser } from "@/lib/server/app-service";
import { listInvestors } from "@/lib/server/investor-service";
import { requireRole } from "@/lib/server/rbac";
import { cn } from "@/lib/utils";

type InvestorStatus = "active" | "inactive" | "all";

function parseStatus(value: unknown): InvestorStatus {
  return value === "inactive" || value === "all" ? value : "active";
}

const filters: Array<{ value: InvestorStatus; label: string }> = [
  { value: "active", label: "Aktif" },
  { value: "inactive", label: "Nonaktif" },
  { value: "all", label: "Semua" },
];

export default async function InvestorPage({
  searchParams,
}: Readonly<{
  searchParams?: Promise<{ status?: string }>;
}>) {
  await requireRole(["pimpinan", "pengelola_keuangan"]);
  const { workspaceOwnerId } = await getRequestUser();
  const params = searchParams ? await searchParams : {};
  const status = parseStatus(params.status);
  const investors = (await listInvestors(workspaceOwnerId, { status })) as InvestorSummary[];

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
        <div className="inline-flex w-fit rounded-full bg-muted p-1">
          {filters.map((filter) => (
            <Link
              key={filter.value}
              href={filter.value === "active" ? "/investor" : `/investor?status=${filter.value}`}
              className={cn(
                "rounded-full px-4 py-2 text-sm font-medium transition-colors",
                status === filter.value
                  ? "bg-card text-foreground shadow-sm ring-1 ring-border/70"
                  : "text-muted-foreground hover:text-foreground"
              )}
            >
              {filter.label}
            </Link>
          ))}
        </div>
        <Button
          render={<Link href="/investor/baru" />}
          nativeButton={false}
          size="lg"
          className="rounded-2xl"
        >
          <Plus className="size-4" />
          Investor Baru
        </Button>
      </div>

      {investors.length > 0 ? (
        <div className="grid gap-4 xl:grid-cols-2">
          {investors.map((investor) => (
            <InvestorCard key={investor.id} investor={investor} />
          ))}
        </div>
      ) : (
        <Card className="border-border/60 bg-card/80">
          <CardContent className="flex min-h-60 flex-col items-center justify-center text-center">
            <p className="font-heading text-2xl font-semibold">Belum ada investor pada filter ini</p>
            <p className="mt-2 max-w-md text-sm text-muted-foreground">
              Tambahkan investor baru untuk mulai mencatat modal uang atau barang titip jual.
            </p>
            <Button
              render={<Link href="/investor/baru" />}
              nativeButton={false}
              className="mt-4 rounded-2xl"
            >
              <Plus className="size-4" />
              Investor Baru
            </Button>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
