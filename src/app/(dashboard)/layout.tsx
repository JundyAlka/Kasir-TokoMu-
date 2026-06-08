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
  let role: Role;

  try {
    role = (await getRequestUser()).role;
  } catch (error) {
    if (error instanceof Error && error.message !== "UNAUTHORIZED") {
      throw error;
    }
    redirect("/auth");
  }

  return <AppShell role={role}>{children}</AppShell>;
}
