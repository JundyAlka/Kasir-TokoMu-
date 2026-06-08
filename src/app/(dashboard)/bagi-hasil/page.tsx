import { forbidden } from "next/navigation";
import { BagiHasilClient } from "@/components/tokomu/payout-preview-table";
import { getRequestUser } from "@/lib/server/app-service";
import { requireRole } from "@/lib/server/rbac";

export default async function BagiHasilPage() {
  try {
    await requireRole(["pimpinan", "pengelola_keuangan"]);
  } catch (error) {
    if (error instanceof Error && error.message === "FORBIDDEN") {
      forbidden();
    }
    throw error;
  }

  await getRequestUser();

  return <BagiHasilClient />;
}
