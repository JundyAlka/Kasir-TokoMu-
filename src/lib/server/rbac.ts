import { headers } from "next/headers";
import { eq } from "drizzle-orm";
import { db } from "@/db/client";
import { userRoles } from "@/db/schema";
import { auth } from "@/lib/auth";

export type Role = "pimpinan" | "pengelola_keuangan" | "kasir";

export type RoleContext = {
  userId: string;
  role: Role;
  workspaceOwnerId: string;
};

const roles: Role[] = ["pimpinan", "pengelola_keuangan", "kasir"];

export function isRole(value: unknown): value is Role {
  return typeof value === "string" && roles.includes(value as Role);
}

export async function getUserRole(
  userId: string
): Promise<{ role: Role; workspaceOwnerId: string } | null> {
  const [entry] = await db
    .select({
      role: userRoles.role,
      workspaceOwnerId: userRoles.workspaceOwnerId,
    })
    .from(userRoles)
    .where(eq(userRoles.userId, userId))
    .limit(1);

  if (!entry || !isRole(entry.role)) {
    return null;
  }

  return {
    role: entry.role,
    workspaceOwnerId: entry.workspaceOwnerId,
  };
}

export async function getWorkspaceOwnerId(userId: string) {
  const role = await getUserRole(userId);
  return role?.workspaceOwnerId ?? userId;
}

export async function getCurrentRoleContext(): Promise<RoleContext> {
  const session = await auth.api.getSession({
    headers: await headers(),
  });

  if (!session?.user?.id) {
    throw new Error("UNAUTHORIZED");
  }

  const role = await getUserRole(session.user.id);

  return {
    userId: session.user.id,
    role: role?.role ?? "pimpinan",
    workspaceOwnerId: role?.workspaceOwnerId ?? session.user.id,
  };
}

export async function requireRole(allowed: Role[]) {
  const context = await getCurrentRoleContext();

  if (!allowed.includes(context.role)) {
    throw new Error("FORBIDDEN");
  }

  return context;
}
