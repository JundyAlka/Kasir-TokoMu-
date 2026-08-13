import { redirectCashierFromFinancePage } from "@/lib/server/page-access";

export default async function PcmReportsLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  await redirectCashierFromFinancePage();
  return children;
}
