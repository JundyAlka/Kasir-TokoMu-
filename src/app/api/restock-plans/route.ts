import { NextRequest, NextResponse } from "next/server";
import { db } from "@/db/client";
import { restockPlans } from "@/db/schema";
import { getRequestUser } from "@/lib/server/app-service";
import { handleRouteError } from "@/lib/server/route-error";
import { z } from "zod";
import { and, desc, eq } from "drizzle-orm";
import crypto from "crypto";

export const runtime = "nodejs";

const RestockPlanCreateSchema = z.object({
  productName: z.string().trim().min(1, "Nama produk wajib diisi."),
  note: z.string().trim().default(""),
  estimatedPrice: z.number().int().min(0).default(0),
});

function createId(prefix: string) {
  return `${prefix}_${crypto.randomUUID().slice(0, 8)}`;
}

export async function GET(request: NextRequest) {
  try {
    const { workspaceOwnerId } = await getRequestUser();
    const plans = await db
      .select()
      .from(restockPlans)
      .where(eq(restockPlans.workspaceOwnerId, workspaceOwnerId))
      .orderBy(desc(restockPlans.createdAt))
      .limit(50);

    return NextResponse.json({ plans });
  } catch (error) {
    return handleRouteError(error, "Gagal mengambil daftar restok.");
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const parsed = RestockPlanCreateSchema.parse(body);
    const { workspaceOwnerId } = await getRequestUser();
    
    const timestamp = new Date().toISOString();
    const [plan] = await db
      .insert(restockPlans)
      .values({
        id: createId("rstpl"),
        workspaceOwnerId,
        productName: parsed.productName,
        note: parsed.note,
        estimatedPrice: parsed.estimatedPrice,
        isDone: 0,
        createdAt: timestamp,
        updatedAt: timestamp,
      })
      .returning();

    return NextResponse.json({ plan });
  } catch (error) {
    return handleRouteError(error, "Gagal menambahkan rencana restok.");
  }
}

export async function PATCH(request: NextRequest) {
  try {
    const body = await request.json();
    const { id, isDone } = z.object({ id: z.string(), isDone: z.number() }).parse(body);
    const { workspaceOwnerId } = await getRequestUser();

    const [plan] = await db
      .update(restockPlans)
      .set({ isDone, updatedAt: new Date().toISOString() })
      .where(and(eq(restockPlans.id, id), eq(restockPlans.workspaceOwnerId, workspaceOwnerId)))
      .returning();

    return NextResponse.json({ plan });
  } catch (error) {
    return handleRouteError(error, "Gagal mengupdate rencana restok.");
  }
}
