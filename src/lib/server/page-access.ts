import { redirect } from "next/navigation";
import { getRequestUser } from "@/lib/server/app-service";

/** Redirect forbidden cashier pages to a useful screen without exposing a 403 page. */
export async function redirectCashierFromFinancePage() {
  const user = await getRequestUser();
  if (user.role === "kasir") {
    redirect("/dashboard?notice=akses-dibatasi");
  }
  return user;
}
