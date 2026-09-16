import nextDynamic from "next/dynamic";

const KasirView = nextDynamic(
  () => import("@/components/warung/kasir-view").then((m) => m.KasirView),
);

export const dynamic = "force-dynamic";

export default function KasirPage() {
  return <KasirView />;
}
