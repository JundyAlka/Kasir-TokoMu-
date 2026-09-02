import { redirect } from "next/navigation";
import { getRequestUser } from "@/lib/server/app-service";
import { requireRole } from "@/lib/server/rbac";

export const dynamic = "force-dynamic";

export default async function InvestorBaruPage() {
  try {
    await requireRole(["pimpinan", "pengelola_keuangan", "kasir"]);
    await getRequestUser();
  } catch (error) {
    if (error instanceof Error && error.message === "FORBIDDEN") {
      redirect("/dashboard");
    }
    if (error instanceof Error && error.message === "UNAUTHORIZED") {
      redirect("/auth");
    }
    throw error;
  }

  redirect("/investor");
}
