import Link from "next/link";
import { redirect } from "next/navigation";
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
import { TitipanIntakeDialog } from "@/components/tokomu/titipan-intake-dialog";
import { InvestorImportTitipanDialog } from "@/components/tokomu/investor-import-titipan-dialog";

export const dynamic = "force-dynamic";

type InvestorStatus = "active" | "inactive" | "all";
type PartnerTypeFilter = "all" | "investor_uang" | "titipan_bagihasil" | "sales_harian";

function parseStatus(value: unknown): InvestorStatus {
  return value === "inactive" || value === "all" ? value : "active";
}

function parsePartnerType(value: unknown): PartnerTypeFilter {
  return value === "investor_uang" || value === "titipan_bagihasil" || value === "sales_harian"
    ? value
    : "all";
}

const statusFilters: Array<{ value: InvestorStatus; label: string }> = [
  { value: "active", label: "Aktif" },
  { value: "inactive", label: "Nonaktif" },
  { value: "all", label: "Semua Status" },
];

const partnerTypeFilters: Array<{ value: PartnerTypeFilter; label: string }> = [
  { value: "all", label: "Semua" },
  { value: "investor_uang", label: "Investor uang" },
  { value: "titipan_bagihasil", label: "Titipan bagi hasil" },
  { value: "sales_harian", label: "Sales harian" },
];

function buildHref(status: InvestorStatus, partnerType: PartnerTypeFilter) {
  const parts: string[] = [];
  if (status !== "active") parts.push(`status=${status}`);
  if (partnerType !== "all") parts.push(`partnerType=${partnerType}`);
  return parts.length > 0 ? `/investor?${parts.join("&")}` : "/investor";
}

export default async function InvestorPage({
  searchParams,
}: Readonly<{
  searchParams?: Promise<{ status?: string; partnerType?: string }>;
}>) {
  let workspaceOwnerId = "";
  try {
    await requireRole(["pimpinan", "pengelola_keuangan", "kasir"]);
    const user = await getRequestUser();
    workspaceOwnerId = user.workspaceOwnerId;
  } catch (error) {
    if (error instanceof Error && error.message === "FORBIDDEN") {
      redirect("/dashboard");
    }
    if (error instanceof Error && error.message === "UNAUTHORIZED") {
      redirect("/auth");
    }
    throw error;
  }

  const params = searchParams ? await searchParams : {};
  const status = parseStatus(params.status);
  const partnerType = parsePartnerType(params.partnerType);

  const allInvestors = (await listInvestors(workspaceOwnerId, { status: "all" })) as InvestorSummary[];

  const investors = allInvestors.filter((inv) => {
    const matchesStatus =
      status === "all"
        ? true
        : status === "inactive"
        ? inv.isActive === 0
        : inv.isActive === 1;

    const matchesType =
      partnerType === "all" ? true : inv.partnerType === partnerType;

    return matchesStatus && matchesType;
  });

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
        <div className="inline-flex w-fit rounded-full bg-muted p-1">
          {statusFilters.map((filter) => (
            <Link
              key={filter.value}
              href={buildHref(filter.value, partnerType)}
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
          <InvestorImportTitipanDialog />
          <TitipanIntakeDialog partners={allInvestors.filter((investor) => investor.partnerType === "titipan_bagihasil" || investor.partnerType === "sales_harian")} />
          {status !== "inactive" ? <InvestorFormDialog /> : null}
        </div>
      </div>

      <div className="inline-flex flex-wrap w-fit rounded-full bg-muted p-1">
        {partnerTypeFilters.map((filter) => (
          <Link
            key={filter.value}
            href={buildHref(status, filter.value)}
            className={cn(
              "rounded-full px-4 py-2 text-sm font-medium transition-colors",
              partnerType === filter.value
                ? "bg-card text-foreground shadow-sm ring-1 ring-border/70"
                : "text-muted-foreground hover:text-foreground"
            )}
          >
            {filter.label}
          </Link>
        ))}
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
            <p className="font-heading text-2xl font-semibold">Belum ada mitra/investor pada filter ini</p>
            <p className="mt-2 max-w-md text-sm text-muted-foreground">
              {status === "inactive"
                ? "Mitra atau investor yang dinonaktifkan akan muncul di sini."
                : "Tambahkan mitra baru untuk mulai mencatat modal uang, barang titipan, atau sales harian."}
            </p>
            {status !== "inactive" ? (
              <div className="mt-4 flex flex-wrap items-center justify-center gap-2">
                <InvestorImportTitipanDialog />
                <InvestorFormDialog />
              </div>
            ) : null}
          </CardContent>
        </Card>
      )}
    </div>
  );
}
