import Link from "next/link";
import { Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { InactiveInvestorManager } from "@/components/tokomu/inactive-investor-manager";
import { InvestorCard, type InvestorSummary } from "@/components/tokomu/investor-card";
import { InvestorOverviewDialog } from "@/components/tokomu/investor-overview-dialog";
import { InvestorFormDialog } from "@/components/tokomu/investor-form-dialog";
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
  await requireRole(["pimpinan", "pengelola_keuangan", "kasir"]);
  const { workspaceOwnerId } = await getRequestUser();
  const params = searchParams ? await searchParams : {};
  const status = parseStatus(params.status);
  const [investors, allInvestors] = (await Promise.all([
    listInvestors(workspaceOwnerId, { status }),
    listInvestors(workspaceOwnerId, { status: "all" }),
  ])) as [InvestorSummary[], InvestorSummary[]];

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
        <div className="flex flex-wrap gap-2">
          {allInvestors.length > 0 ? <InvestorOverviewDialog investors={allInvestors} /> : null}
          {status !== "inactive" ? <InvestorFormDialog /> : null}
        </div>
      </div>

      {investors.length > 0 ? (
        status === "inactive" ? (
          <InactiveInvestorManager investors={investors} />
        ) : (
          <div className="grid gap-4 md:grid-cols-2">
            {investors.map((investor) => (
              <InvestorCard key={investor.id} investor={investor} />
            ))}
          </div>
        )
      ) : (
        <Card className="border-border/60 bg-card/80">
          <CardContent className="flex min-h-60 flex-col items-center justify-center text-center">
            <p className="font-heading text-2xl font-semibold">Belum ada investor pada filter ini</p>
            <p className="mt-2 max-w-md text-sm text-muted-foreground">
              {status === "inactive"
                ? "Investor yang dinonaktifkan dari kartu atau halaman detail akan muncul di sini."
                : "Tambahkan investor baru untuk mulai mencatat modal uang atau barang titip jual."}
            </p>
            {status !== "inactive" ? (
              <InvestorFormDialog />
            ) : null}
          </CardContent>
        </Card>
      )}
    </div>
  );
}
