import { randomBytes, randomUUID } from "node:crypto";
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { db, pool } from "@/db/client";
import { invitations } from "@/db/schema";
import { auth } from "@/lib/auth";
import { getRequestUser } from "@/lib/server/app-service";
import { logEvent } from "@/lib/server/audit";
import { handleRouteError } from "@/lib/server/route-error";
import {
  assignRole,
  getUserRoleAssignment,
  requireRole,
} from "@/lib/server/rbac";

export const runtime = "nodejs";

const InviteUserSchema = z
  .object({
    email: z.string().trim().email("Email tidak valid.").transform((email) => email.toLowerCase()),
    role: z.enum(["pengelola_keuangan", "kasir"], {
      error: "Role hanya boleh pengelola_keuangan atau kasir.",
    }),
  })
  .strict();

function createInvitationId() {
  return `inv_${randomUUID().slice(0, 12)}`;
}

function createInvitationToken() {
  return randomBytes(32).toString("base64url");
}

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
    const body = InviteUserSchema.parse(await request.json());

    const existingUser = await pool.query<{ id: string; email: string; name: string }>(
      `select id, email, name from "user" where lower(email) = $1 limit 1`,
      [body.email]
    );

    let user = existingUser.rows[0] ?? null;
    let tempPassword: string | null = null;

    if (user?.id === workspaceOwnerId) {
      return NextResponse.json(
        { error: "Email pimpinan tidak perlu diundang." },
        { status: 409 }
      );
    }

    if (user) {
      const existingRole = await getUserRoleAssignment(user.id);

      if (existingRole?.workspaceOwnerId === workspaceOwnerId && existingRole.isActive === 1) {
        return NextResponse.json(
          { error: "Email sudah terdaftar di workspace ini." },
          { status: 409 }
        );
      }

      if (existingRole && existingRole.workspaceOwnerId !== workspaceOwnerId) {
        return NextResponse.json(
          { error: "User sudah terdaftar di workspace lain." },
          { status: 409 }
        );
      }
    }

    if (!user) {
      tempPassword = createTemporaryPassword();
      await auth.api.signUpEmail({
        body: {
          email: body.email,
          name: nameFromEmail(body.email),
          password: tempPassword,
        },
      });

      const created = await pool.query<{ id: string; email: string; name: string }>(
        `select id, email, name from "user" where lower(email) = $1 limit 1`,
        [body.email]
      );
      user = created.rows[0] ?? null;
    }

    if (!user) {
      throw new Error("User gagal dibuat.");
    }

    const timestamp = new Date().toISOString();
    const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString();
    const assignedRole = await assignRole(user.id, body.role, workspaceOwnerId);

    const [invitation] = await db
      .insert(invitations)
      .values({
        id: createInvitationId(),
        workspaceOwnerId,
        email: user.email.toLowerCase(),
        role: body.role,
        token: createInvitationToken(),
        status: "accepted",
        invitedByUserId: actor.userId,
        expiresAt,
        createdAt: timestamp,
        acceptedAt: timestamp,
      })
      .returning();

    await logEvent({ workspaceOwnerId, actorUserId: actor.userId }, {
      eventType: "USER_INVITED",
      entityType: "user",
      entityId: user.id,
      category: "auth",
      payload: {
        email: user.email,
        role: assignedRole.role,
        invitationId: invitation.id,
        createdNewUser: Boolean(tempPassword),
        reactivatedUser: !tempPassword && assignedRole.isActive === 1,
      },
    });

    return NextResponse.json({
      email: user.email,
      temporaryPassword: tempPassword,
      user: {
        id: user.id,
        name: user.name,
        email: user.email,
        role: assignedRole.role,
        isActive: assignedRole.isActive === 1,
      },
      invitation: {
        id: invitation.id,
        status: invitation.status,
        expiresAt: invitation.expiresAt,
      },
    });
  } catch (error) {
    return handleRouteError(error, "Gagal mengundang user.");
  }
}
