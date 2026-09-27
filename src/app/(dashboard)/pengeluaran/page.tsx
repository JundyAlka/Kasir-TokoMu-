import { redirect } from "next/navigation";
import { getRequestUser } from "@/lib/server/app-service";
import type { Role } from "@/lib/server/rbac";
import { PengeluaranClient } from "./pengeluaran-client";

export const dynamic = "force-dynamic";

export default async function PengeluaranPage() {
  let role: Role = "pimpinan";
  try {
    const user = await getRequestUser();
    role = user.role;
  } catch {
    redirect("/auth");
  }

  return (
    <div className="w-full space-y-6">
      <PengeluaranClient />
    </div>
  );
}
