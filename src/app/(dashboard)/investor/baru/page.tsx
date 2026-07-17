import { redirect } from "next/navigation";
import { getRequestUser } from "@/lib/server/app-service";
import { requireRole } from "@/lib/server/rbac";

export default async function InvestorBaruPage() {
  await requireRole(["pimpinan", "pengelola_keuangan", "kasir"]);
  await getRequestUser();

  redirect("/investor");
}
