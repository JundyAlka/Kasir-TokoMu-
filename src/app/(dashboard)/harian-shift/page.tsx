import { redirect } from "next/navigation";
import { getRequestUser } from "@/lib/server/app-service";
import type { Role } from "@/lib/server/rbac";
import { HarianShiftClient } from "./harian-shift-client";

export const dynamic = "force-dynamic";

export default async function HarianShiftPage() {
  let role: Role = "pimpinan";
  try {
    const user = await getRequestUser();
    role = user.role;
  } catch {
    redirect("/auth");
  }

  return (
    <div className="w-full space-y-6">
      <div className="flex flex-col gap-2 md:flex-row md:items-end md:justify-between">
        <div>
          <h1 className="font-heading text-3xl font-bold text-foreground">Harian & Shift</h1>
          <p className="text-muted-foreground mt-1">
            Pantau sesi shift kasir aktif, riwayat penutupan kas, serta rekapitulasi laba rugi harian toko.
          </p>
        </div>
      </div>

      <HarianShiftClient />
    </div>
  );
}
