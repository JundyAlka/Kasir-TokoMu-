"use client";

import { createContext, useContext } from "react";
import type { ReactNode } from "react";
import type { Role } from "@/lib/server/rbac";

const RoleContext = createContext<Role | null>(null);

export function RoleProvider({
  children,
  role,
}: Readonly<{
  children: ReactNode;
  role: Role;
}>) {
  return <RoleContext.Provider value={role}>{children}</RoleContext.Provider>;
}

export function useCurrentRole() {
  const role = useContext(RoleContext);
  if (!role) {
    throw new Error("useCurrentRole harus dipakai di dalam RoleProvider.");
  }
  return role;
}

export function RoleGate({
  children,
  role,
  currentRole,
}: Readonly<{
  children: ReactNode;
  role: Role[];
  currentRole?: Role;
}>) {
  const contextRole = useContext(RoleContext);
  const resolvedRole = currentRole ?? contextRole;

  if (!resolvedRole || !role.includes(resolvedRole)) {
    return null;
  }

  return <>{children}</>;
}
