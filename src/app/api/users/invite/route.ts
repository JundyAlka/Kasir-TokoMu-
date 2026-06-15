import { randomBytes } from "node:crypto";
import { NextRequest, NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { db, pool } from "@/db/client";
import { userRoles } from "@/db/schema";
import { auth } from "@/lib/auth";
import { getRequestUser } from "@/lib/server/app-service";
import { logEvent } from "@/lib/server/audit";
import { handleRouteError } from "@/lib/server/route-error";
import { getUserRole, isRole, requireRole } from "@/lib/server/rbac";

export const runtime = "nodejs";

function createTemporaryPassword() {
  return `Tmp-${randomBytes(12).toString("base64url")}1`;
}

function nameFromEmail(email: string) {
  return email.split("@")[0]?.replace(/[._-]+/g, " ").trim() || email;
}

export async function POST(request: NextRequest) {
  try {
    const actor = await getRequestUser();
    const { workspaceOwnerId } = await requireRole(["pimpinan"]);
    const body = (await request.json()) as { email?: string; role?: unknown };
    const email = body.email?.trim().toLowerCase();

    if (!email || !email.includes("@")) {
      return NextResponse.json({ error: "Email tidak valid." }, { status: 400 });
    }

    if (!isRole(body.role)) {
      return NextResponse.json({ error: "Role tidak valid." }, { status: 400 });
    }

    const existingUser = await pool.query<{ id: string; email: string; name: string }>(
      `select id, email, name from "user" where lower(email) = $1 limit 1`,
      [email]
    );

    let user = existingUser.rows[0] ?? null;
    let tempPassword: string | null = null;

    if (!user) {
      tempPassword = createTemporaryPassword();
      await auth.api.signUpEmail({
        body: {
          email,
          name: nameFromEmail(email),
          password: tempPassword,
        },
      });

      const created = await pool.query<{ id: string; email: string; name: string }>(
        `select id, email, name from "user" where lower(email) = $1 limit 1`,
        [email]
      );
      user = created.rows[0] ?? null;
    }

    if (!user) {
      throw new Error("User gagal dibuat.");
    }

    const existingRole = await getUserRole(user.id);

    if (existingRole && existingRole.workspaceOwnerId !== workspaceOwnerId) {
      return NextResponse.json(
        { error: "User sudah terdaftar di workspace lain." },
        { status: 409 }
      );
    }

    const nextRole = user.id === workspaceOwnerId ? "pimpinan" : body.role;
    const timestamp = new Date().toISOString();

    await db
      .insert(userRoles)
      .values({
        userId: user.id,
        role: nextRole,
        workspaceOwnerId,
        createdAt: timestamp,
        updatedAt: timestamp,
      })
      .onConflictDoUpdate({
        target: userRoles.userId,
        set: {
          role: nextRole,
          workspaceOwnerId,
          updatedAt: timestamp,
        },
      });

    const [roleEntry] = await db
      .select()
      .from(userRoles)
      .where(eq(userRoles.userId, user.id))
      .limit(1);

    await logEvent(
      { workspaceOwnerId, actorUserId: actor.userId },
      "USER_INVITED",
      { type: "user", id: user.id },
      { email: user.email, role: roleEntry?.role ?? nextRole, createdNewUser: Boolean(tempPassword) }
    );

    return NextResponse.json({
      user: {
        id: user.id,
        name: user.name,
        email: user.email,
        role: roleEntry?.role ?? nextRole,
      },
      tempPassword,
    });
  } catch (error) {
    return handleRouteError(error, "Gagal mengundang user.");
  }
}
