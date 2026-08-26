import { randomUUID } from "node:crypto";
import { NextRequest, NextResponse } from "next/server";
import { hashPassword } from "better-auth/crypto";
import { z } from "zod";
import { pool } from "@/db/client";
import { getRequestUser } from "@/lib/server/app-service";
import { logEvent } from "@/lib/server/audit";
import { getUserRoleAssignment } from "@/lib/server/rbac";
import { handleRouteError } from "@/lib/server/route-error";
import { requireRoutePolicy } from "@/lib/server/route-policy";

export const runtime = "nodejs";

const ResetPasswordSchema = z
  .object({
    password: z.string().min(6, "Password minimal 6 karakter."),
  })
  .strict();

export async function POST(
  request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const actor = await getRequestUser();
    const { workspaceOwnerId } = await requireRoutePolicy("/api/users/[id]/password", "POST");
    const { id: targetUserId } = await context.params;
    const body = ResetPasswordSchema.parse(await request.json());

    // Cek apakah target user ada di workspace yang sama
    const targetAssignment = await getUserRoleAssignment(targetUserId);
    if (!targetAssignment || targetAssignment.workspaceOwnerId !== workspaceOwnerId) {
      return NextResponse.json(
        { error: "User tidak ditemukan di workspace ini." },
        { status: 404 }
      );
    }

    // Hash password sesuai standar better-auth (scrypt)
    const hashedPassword = await hashPassword(body.password);

    // Ambil info email target user
    const userRes = await pool.query<{ id: string; email: string; name: string }>(
      `select id, email, name from "user" where id = $1 limit 1`,
      [targetUserId]
    );
    const user = userRes.rows[0];
    if (!user) {
      return NextResponse.json(
        { error: "User tidak ditemukan." },
        { status: 404 }
      );
    }

    // Update password di table account
    const updateResult = await pool.query(
      `update "account" set "password" = $1, "updatedAt" = now() where "userId" = $2 and "providerId" = 'credential'`,
      [hashedPassword, targetUserId]
    );

    if (updateResult.rowCount === 0) {
      // Jika akun credential belum ada, buat row baru di table account
      await pool.query(
        `insert into "account" ("id", "accountId", "providerId", "userId", "password", "createdAt", "updatedAt")
         values ($1, $2, 'credential', $3, $4, now(), now())`,
        [randomUUID(), user.email, targetUserId, hashedPassword]
      );
    }

    // Catat log audit
    await logEvent({ workspaceOwnerId, actorUserId: actor.userId }, {
      eventType: "USER_PASSWORD_RESET",
      entityType: "user",
      entityId: targetUserId,
      category: "auth",
      payload: {
        targetUserId,
        email: user.email,
        name: user.name,
      },
    });

    return NextResponse.json({
      success: true,
      email: user.email,
      name: user.name,
      password: body.password,
    });
  } catch (error) {
    return handleRouteError(error, "Gagal mereset password user.");
  }
}
