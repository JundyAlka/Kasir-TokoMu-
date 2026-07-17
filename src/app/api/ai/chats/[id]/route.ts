import { NextRequest, NextResponse } from "next/server";
import { getRequestUser } from "@/lib/server/app-service";
import { handleRouteError } from "@/lib/server/route-error";
import { deleteChat } from "@/lib/server/ai/persist";

export const runtime = "nodejs";

export async function DELETE(
  _request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const { workspaceOwnerId, role } = await getRequestUser();
    const { id } = await context.params;

    // Kasir cannot delete chat history
    if (role === "kasir") {
      return NextResponse.json(
        { error: "Anda tidak memiliki izin untuk menghapus riwayat chat." },
        { status: 403 }
      );
    }

    const deleted = await deleteChat(workspaceOwnerId, id);
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
