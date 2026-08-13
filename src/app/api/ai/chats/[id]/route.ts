import { NextRequest, NextResponse } from "next/server";
import { getRequestUser } from "@/lib/server/app-service";
import { requireRoutePolicy } from "@/lib/server/route-policy";
import { handleRouteError } from "@/lib/server/route-error";
import { deleteChat } from "@/lib/server/ai/persist";

export const runtime = "nodejs";

export async function DELETE(
  _request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  try {
    await requireRoutePolicy("/api/ai/chats/[id]", "DELETE");
    const { userId } = await getRequestUser();
    const { id } = await context.params;

    const deleted = await deleteChat(userId, id);
    if (!deleted) {
      return NextResponse.json(
        { error: "Chat tidak ditemukan." },
        { status: 404 }
      );
    }

    return NextResponse.json({ ok: true });
  } catch (error) {
    return handleRouteError(error, "Gagal menghapus chat.");
  }
}
