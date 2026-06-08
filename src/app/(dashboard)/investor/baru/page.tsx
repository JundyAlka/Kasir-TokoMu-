import { InvestorForm } from "@/components/tokomu/investor-form";
import { getRequestUser } from "@/lib/server/app-service";
import { requireRole } from "@/lib/server/rbac";

export default async function InvestorBaruPage() {
  await requireRole(["pimpinan", "pengelola_keuangan"]);
  await getRequestUser();

  return <InvestorForm />;
}
