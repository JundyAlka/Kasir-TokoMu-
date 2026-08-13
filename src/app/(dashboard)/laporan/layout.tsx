import { redirectCashierFromFinancePage } from "@/lib/server/page-access";

export default async function ReportsLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  await redirectCashierFromFinancePage();
  return children;
}
