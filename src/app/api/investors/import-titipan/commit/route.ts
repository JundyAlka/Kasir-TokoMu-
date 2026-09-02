import { NextRequest, NextResponse } from "next/server";
import { getRequestUser } from "@/lib/server/app-service";
import { handleRouteError } from "@/lib/server/route-error";
import { requireRoutePolicy } from "@/lib/server/route-policy";
import {
  commitInvestorTitipanImport,
  type CommitInvestorTitipanPayload,
} from "@/lib/server/investor-titipan-import";

export const runtime = "nodejs";

export async function POST(request: NextRequest) {
  try {
    await requireRoutePolicy("/api/investors/import-titipan/commit", "POST");
    const { userId, workspaceOwnerId } = await getRequestUser();
    const payload = (await request.json()) as CommitInvestorTitipanPayload;

    if (!payload?.groups?.length) {
      throw new Error("Payload kelompok investor titipan tidak boleh kosong.");
    }

    const result = await commitInvestorTitipanImport(workspaceOwnerId, userId, payload);
    return NextResponse.json(result);
  } catch (error) {
    return handleRouteError(error, "Gagal menyimpan data investor titipan ke sistem.");
  }
}
