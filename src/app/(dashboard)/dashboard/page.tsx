import nextDynamic from "next/dynamic";

const DashboardView = nextDynamic(
  () => import("@/components/warung/dashboard-view").then((m) => m.DashboardView),
);

export const dynamic = "force-dynamic";

export default function DashboardPage() {
  return <DashboardView />;
}
