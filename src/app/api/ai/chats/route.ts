import { NextRequest, NextResponse } from "next/server";
import { getRequestUser } from "@/lib/server/app-service";
import { handleRouteError } from "@/lib/server/route-error";
import { createChat, listChats } from "@/lib/server/ai/persist";

export const runtime = "nodejs";

export async function GET() {
  try {
    const { workspaceOwnerId } = await getRequestUser();
    const chats = await listChats(workspaceOwnerId);
    return NextResponse.json({ chats });
  } catch (error) {
    return handleRouteError(error, "Gagal memuat daftar chat AI.");
  }
}

export async function POST(request: NextRequest) {
  try {
    const { workspaceOwnerId } = await getRequestUser();
    const body = (await request.json().catch(() => ({}))) as { title?: string };
    const chat = await createChat(workspaceOwnerId, body.title?.trim() || "Percakapan baru");
    return NextResponse.json({ chat });
  } catch (error) {
    return handleRouteError(error, "Gagal membuat chat baru.");
  }
}
