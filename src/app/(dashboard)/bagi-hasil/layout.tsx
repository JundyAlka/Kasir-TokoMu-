import { redirectCashierFromFinancePage } from "@/lib/server/page-access";

export default async function ProfitSharingLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  await redirectCashierFromFinancePage();
  return children;
}
