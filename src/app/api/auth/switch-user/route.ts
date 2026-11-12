import crypto from "crypto";
import { NextRequest, NextResponse } from "next/server";
import { pool } from "@/db/client";
import { auth } from "@/lib/auth";
import { logEvent } from "@/lib/server/audit";
import { getUserRoleAssignment } from "@/lib/server/rbac";
import { handleRouteError } from "@/lib/server/route-error";
import { requireRoutePolicy } from "@/lib/server/route-policy";

export const runtime = "nodejs";

function generateToken(length = 32): string {
  const chars =
    "abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789";
  const bytes = crypto.randomBytes(length);
  let result = "";
  for (let i = 0; i < length; i++) {
    result += chars[bytes[i] % chars.length];
  }
  return result;
}

export async function POST(request: NextRequest) {
  try {
    const { userId, workspaceOwnerId } = await requireRoutePolicy(
      "/api/auth/switch-user",
      "POST"
    );

    const body = (await request.json().catch(() => null)) as
      | { targetUserId?: unknown }
      | null;
    const targetUserId =
      typeof body?.targetUserId === "string" ? body.targetUserId.trim() : "";

    if (!targetUserId) {
      return NextResponse.json(
        { error: "targetUserId wajib diisi." },
        { status: 400 }
      );
    }

    // Validate target user is in the same workspace and active
    const targetRole = await getUserRoleAssignment(targetUserId);

    if (!targetRole || targetRole.workspaceOwnerId !== workspaceOwnerId) {
      return NextResponse.json(
        { error: "User tidak ditemukan di workspace ini." },
        { status: 403 }
      );
    }

    if (targetRole.isActive !== 1) {
      return NextResponse.json(
        { error: "Akun user tidak aktif." },
        { status: 403 }
      );
    }

    const authContext = await auth.$context;
    const expiresInSeconds = authContext.sessionConfig.expiresIn ?? 7 * 24 * 60 * 60;

    // Create a new session for the target user
    const sessionId = generateToken(32);
    const token = generateToken(32);
    const now = new Date();
    const expiresAt = new Date(now.getTime() + expiresInSeconds * 1000);

    await pool.query(
      `INSERT INTO "session" (id, "expiresAt", token, "createdAt", "updatedAt", "ipAddress", "userAgent", "userId")
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
      [
        sessionId,
        expiresAt.toISOString(),
        token,
        now.toISOString(),
        now.toISOString(),
        request.headers.get("x-forwarded-for") ?? "127.0.0.1",
        request.headers.get("user-agent") ?? "switch-user",
        targetUserId,
      ]
    );

    await logEvent(
      { workspaceOwnerId, actorUserId: userId },
      {
        eventType: "USER_SWITCHED",
        entityType: "user",
        entityId: targetUserId,
        category: "auth",
        payload: { fromUserId: userId, toUserId: targetUserId },
      }
    );

    // Sign session token with the exact HMAC-SHA256 format better-auth expects
    const signature = crypto
      .createHmac("sha256", authContext.secret)
      .update(token)
      .digest("base64");
    const signedCookieValue = `${token}.${signature}`;

    const sessionCookieConfig = authContext.authCookies.sessionToken;
    const response = NextResponse.json({ ok: true });

    response.cookies.set(sessionCookieConfig.name, signedCookieValue, {
      httpOnly: sessionCookieConfig.attributes.httpOnly ?? true,
      secure: sessionCookieConfig.attributes.secure ?? false,
      sameSite: (sessionCookieConfig.attributes.sameSite ?? "lax") as "lax" | "strict" | "none",
      path: sessionCookieConfig.attributes.path ?? "/",
      maxAge: expiresInSeconds,
    });

    // Clear cached session_data cookie if present so better-auth reads the new session
    if (authContext.authCookies.sessionData?.name) {
      response.cookies.delete(authContext.authCookies.sessionData.name);
    }

    return response;
  } catch (error) {
    return handleRouteError(error, "Gagal ganti akun.");
  }
}
