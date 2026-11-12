import { redirect } from "next/navigation";

export const dynamic = "force-dynamic";

export default function TransaksiPage() {
  redirect("/harian-shift?tab=transaksi");
}

