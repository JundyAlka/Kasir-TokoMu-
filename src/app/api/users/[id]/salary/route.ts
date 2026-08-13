import { NextRequest, NextResponse } from "next/server";
import { eq, and } from "drizzle-orm";
import { db } from "@/db/client";
import { userRoles } from "@/db/schema";
import { requireRoutePolicy } from "@/lib/server/route-policy";
import { getRequestUser } from "@/lib/server/app-service";
import { handleRouteError } from "@/lib/server/route-error";

export const runtime = "nodejs";
export const maxDuration = 15;

export async function PATCH(
  request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  try {
    await requireRoutePolicy("/api/users/[id]/salary", "PATCH");
    const { workspaceOwnerId } = await getRequestUser();
    const { id } = await context.params;

    const body = (await request.json()) as { monthlySalary?: number };
    const monthlySalary = Number(body.monthlySalary);

    if (isNaN(monthlySalary) || monthlySalary < 0) {
      return NextResponse.json(
        { error: "Gaji bulanan tidak valid." },
        { status: 400 }
      );
    }

    const [updated] = await db
      .update(userRoles)
      .set({
        monthlySalary,
        updatedAt: new Date().toISOString(),
      })
      .where(
        and(
          eq(userRoles.userId, id),
          eq(userRoles.workspaceOwnerId, workspaceOwnerId)
        )
      )
      .returning({
        userId: userRoles.userId,
        monthlySalary: userRoles.monthlySalary,
      });

    if (!updated) {
      return NextResponse.json(
        { error: "Gagal memperbarui gaji atau karyawan tidak ditemukan." },
        { status: 404 }
      );
    }

    return NextResponse.json({ success: true, monthlySalary: updated.monthlySalary });
  } catch (error) {
    return handleRouteError(error, "Gagal memperbarui gaji karyawan.");
  }
}
