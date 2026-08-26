import { and, eq } from "drizzle-orm";
import { db } from "@/db/client";
import { kasMovements } from "@/db/schema";
import { getOpenSession } from "@/lib/server/shift-service";
import { getShiftSummary } from "@/lib/server/shift-service";
import { notFoundError } from "@/lib/server/route-error";

export type KasBucket = "cash" | "coins" | "savings";

export type KasMovementDraft = {
  fromBucket: KasBucket;
  toBucket: KasBucket;
  amount: number;
  note?: string;
};

function createId() {
  return `kmv_${crypto.randomUUID().slice(0, 10)}`;
}

function nowIso() {
  return new Date().toISOString();
}

function validateDraft(draft: KasMovementDraft) {
  if (!Number.isSafeInteger(draft.amount) || draft.amount <= 0) {
    throw new Error("Nominal mutasi harus berupa bilangan bulat lebih dari nol.");
  }
  if (draft.fromBucket === draft.toBucket) {
    throw new Error("Pos asal dan tujuan mutasi harus berbeda.");
  }
}

/** Records only the allocation between cash buckets; it never changes total cash or profit. */
export async function createKasMovement(
  workspaceOwnerId: string,
  draft: KasMovementDraft,
  actorUserId: string,
  canManageOtherCashierShift = false
) {
  validateDraft(draft);
  const openShift = await getOpenSession(workspaceOwnerId);
  if (!openShift) throw new Error("Buka shift terlebih dahulu sebelum mencatat mutasi kas.");
  if (!canManageOtherCashierShift && openShift.cashierUserId !== actorUserId) throw notFoundError();
  const [movement] = await db.insert(kasMovements).values({
    id: createId(),
    userId: workspaceOwnerId,
    shiftSessionId: openShift.id,
    fromBucket: draft.fromBucket,
    toBucket: draft.toBucket,
    amount: draft.amount,
    note: draft.note?.trim() ?? "",
    createdAt: nowIso(),
  }).returning();
  if (!movement) throw new Error("Gagal mencatat mutasi kas.");
  return movement;
}

export async function listShiftKasMovements(
  workspaceOwnerId: string,
  shiftSessionId: string,
  actorUserId: string,
  canManageOtherCashierShift = false
) {
  const session = await getShiftSummary(workspaceOwnerId, shiftSessionId);
  if (!session || (!canManageOtherCashierShift && session.cashierUserId !== actorUserId)) throw notFoundError();
  return db.select().from(kasMovements).where(and(
    eq(kasMovements.userId, workspaceOwnerId),
    eq(kasMovements.shiftSessionId, shiftSessionId)
  ));
}
