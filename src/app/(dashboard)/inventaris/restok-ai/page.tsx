import { forbidden } from "next/navigation";
import { ReceiptRestockPage } from "@/components/tokomu/receipt-restock-page";
import { getRequestUser } from "@/lib/server/app-service";
import { requireRole } from "@/lib/server/rbac";

export default async function RestokAiPage() {
  try {
    await requireRole(["pengelola_keuangan", "pimpinan"]);
  } catch (error) {
    if (error instanceof Error && error.message === "FORBIDDEN") {
      forbidden();
    }
    throw error;
  }

  await getRequestUser();

  return <ReceiptRestockPage />;
}
