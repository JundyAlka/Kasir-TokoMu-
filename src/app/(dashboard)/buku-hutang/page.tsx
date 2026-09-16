import nextDynamic from "next/dynamic";

const BukuHutangView = nextDynamic(
  () => import("@/components/warung/buku-hutang-view").then((m) => m.BukuHutangView),
);

export const dynamic = "force-dynamic";

export default function BukuHutangPage() {
  return <BukuHutangView />;
}
