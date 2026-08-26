import { headers } from "next/headers";
import { and, count, eq } from "drizzle-orm";
import { db, pool } from "@/db/client";
import { userRoles } from "@/db/schema";
import { auth } from "@/lib/auth";

export type Role = "pimpinan" | "pengelola_keuangan" | "kasir";
export type StaffRole = Exclude<Role, "pimpinan">;

export type RoleContext = {
  userId: string;
  role: Role;
  workspaceOwnerId: string;
};

export type UserRoleAssignment = RoleContext & {
  isActive: number;
};

export type ShiftStatusInfo = {
  isCurrentShiftActive: boolean;
  activeSessionId?: string | null;
  activeShiftName?: string | null;
  activeStartedAt?: string | null;
  lastShiftName?: string | null;
  lastStartedAt?: string | null;
  lastEndedAt?: string | null;
};

export type WorkspaceUser = {
  id: string;
  name: string;
  email: string;
  role: Role;
  isActive: boolean;
  monthlySalary: number;
  shiftStatus?: ShiftStatusInfo;
};

const roles: Role[] = ["pimpinan", "pengelola_keuangan", "kasir"];
const staffRoles: StaffRole[] = ["pengelola_keuangan", "kasir"];
type WorkspaceUserRow = Omit<WorkspaceUser, "role"> & { role: string };

export function isRole(value: unknown): value is Role {
  return typeof value === "string" && roles.includes(value as Role);
}

export function isStaffRole(value: unknown): value is StaffRole {
  return typeof value === "string" && staffRoles.includes(value as StaffRole);
}

export async function getUserRoleAssignment(userId: string): Promise<UserRoleAssignment | null> {
  const [entry] = await db
    .select({
      role: userRoles.role,
      workspaceOwnerId: userRoles.workspaceOwnerId,
      isActive: userRoles.isActive,
    })
    .from(userRoles)
    .where(eq(userRoles.userId, userId))
    .limit(1);

  if (!entry || !isRole(entry.role)) {
    return null;
  }

  return {
    userId,
    role: entry.role,
    workspaceOwnerId: entry.workspaceOwnerId,
    isActive: entry.isActive,
  };
}

export async function getUserRole(
  userId: string
): Promise<{ role: Role; workspaceOwnerId: string } | null> {
  const entry = await getUserRoleAssignment(userId);

  if (!entry || entry.isActive !== 1) {
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

export async function getWorkspaceUserRole(
  userId: string,
  workspaceOwnerId: string
): Promise<UserRoleAssignment | null> {
  const [entry] = await db
    .select({
      role: userRoles.role,
      workspaceOwnerId: userRoles.workspaceOwnerId,
      isActive: userRoles.isActive,
    })
    .from(userRoles)
    .where(and(eq(userRoles.userId, userId), eq(userRoles.workspaceOwnerId, workspaceOwnerId)))
    .limit(1);

  if (!entry || !isRole(entry.role)) {
    return null;
  }

  return {
    userId,
    role: entry.role,
    workspaceOwnerId: entry.workspaceOwnerId,
    isActive: entry.isActive,
  };
}

export async function assignRole(userId: string, role: Role, workspaceOwnerId: string) {
  const existing = await getUserRoleAssignment(userId);

  if (existing && existing.workspaceOwnerId !== workspaceOwnerId) {
    throw new Error("User sudah terdaftar di workspace lain.");
  }

  const timestamp = new Date().toISOString();
  await db
    .insert(userRoles)
    .values({
      userId,
      role,
      workspaceOwnerId,
      isActive: 1,
      createdAt: timestamp,
      updatedAt: timestamp,
    })
    .onConflictDoUpdate({
      target: userRoles.userId,
      set: {
        role,
        workspaceOwnerId,
        isActive: 1,
        updatedAt: timestamp,
      },
    });

  const assigned = await getWorkspaceUserRole(userId, workspaceOwnerId);

  if (!assigned) {
    throw new Error("Role user gagal disimpan.");
  }

  return assigned;
}

export async function listWorkspaceUsers(workspaceOwnerId: string): Promise<WorkspaceUser[]> {
  const [usersResult, sessionsResult] = await Promise.all([
    pool.query<{
      id: string;
      name: string;
      email: string;
      role: string;
      isActive: boolean;
      monthlySalary: number;
    }>(
      `
        select
          u.id,
          u.name,
          u.email,
          ur.role,
          (ur.is_active = 1) as "isActive",
          ur.monthly_salary as "monthlySalary"
        from user_roles ur
        join "user" u on u.id = ur.user_id
        where ur.workspace_owner_id = $1
        order by
          ur.is_active desc,
          case ur.role
            when 'pimpinan' then 0
            when 'pengelola_keuangan' then 1
            else 2
          end,
          u.name asc
      `,
      [workspaceOwnerId]
    ),
    pool.query<{
      sessionId: string;
      cashierUserId: string;
      shiftName: string;
      status: string;
      startedAt: string;
      endedAt: string | null;
    }>(
      `
        select
          ss.id as "sessionId",
          ss.cashier_user_id as "cashierUserId",
          s.name as "shiftName",
          ss.status,
          ss.started_at as "startedAt",
          ss.ended_at as "endedAt"
        from shift_sessions ss
        join shifts s on s.id = ss.shift_id
        where ss.workspace_owner_id = $1
        order by ss.started_at desc
      `,
      [workspaceOwnerId]
    ).catch(() => ({ rows: [] })),
  ]);

  const sessions = sessionsResult.rows;

  return usersResult.rows.reduce<WorkspaceUser[]>((users, user: any) => {
    if (isRole(user.role)) {
      const userSessions = sessions.filter((s) => s.cashierUserId === user.id);
      const activeSession = userSessions.find((s) => s.status === "open" || !s.endedAt);
      const lastSession = userSessions.find((s) => s.status === "closed" && Boolean(s.endedAt));

      users.push({
        id: user.id,
        name: user.name,
        email: user.email,
        role: user.role as Role,
        isActive: user.isActive,
        monthlySalary: user.monthlySalary ?? 0,
        shiftStatus: {
          isCurrentShiftActive: Boolean(activeSession),
          activeSessionId: activeSession?.sessionId ?? null,
          activeShiftName: activeSession?.shiftName ?? null,
          activeStartedAt: activeSession?.startedAt ? String(activeSession.startedAt) : null,
          lastShiftName: lastSession?.shiftName ?? null,
          lastStartedAt: lastSession?.startedAt ? String(lastSession.startedAt) : null,
          lastEndedAt: lastSession?.endedAt ? String(lastSession.endedAt) : null,
        },
      });
    }

    return users;
  }, []);
}

export async function countActivePimpinan(workspaceOwnerId: string) {
  const [result] = await db
    .select({ total: count() })
    .from(userRoles)
    .where(
      and(
        eq(userRoles.workspaceOwnerId, workspaceOwnerId),
        eq(userRoles.role, "pimpinan"),
        eq(userRoles.isActive, 1)
      )
    );

  return result?.total ?? 0;
}

export async function deactivateWorkspaceUser(userId: string, workspaceOwnerId: string) {
  const [updated] = await db
    .update(userRoles)
    .set({
      isActive: 0,
      updatedAt: new Date().toISOString(),
    })
    .where(and(eq(userRoles.userId, userId), eq(userRoles.workspaceOwnerId, workspaceOwnerId)))
    .returning();

  if (!updated || !isRole(updated.role)) {
    return null;
  }

  return {
    userId: updated.userId,
    role: updated.role,
    workspaceOwnerId: updated.workspaceOwnerId,
    isActive: updated.isActive,
  };
}

export async function getCurrentRoleContext(): Promise<RoleContext> {
  const session = await auth.api.getSession({
    headers: await headers(),
  });

  if (!session?.user?.id) {
    throw new Error("UNAUTHORIZED");
  }

  const role = await getUserRoleAssignment(session.user.id);

  if (role && role.isActive !== 1) {
    throw new Error("FORBIDDEN");
  }

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
