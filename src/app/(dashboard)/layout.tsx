import { Suspense } from "react";
import { redirect } from "next/navigation";
import { AppShell } from "@/components/app-shell";
import { getRequestUser } from "@/lib/server/app-service";
import type { Role } from "@/lib/server/rbac";

export const dynamic = "force-dynamic";

export default async function DashboardLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  let role: Role = "pimpinan";

  try {
    const user = await getRequestUser();
    role = user.role;
  } catch {
    redirect("/auth");
  }

  return (
    <Suspense fallback={null}>
      <AppShell role={role}>{children}</AppShell>
    </Suspense>
  );
}
