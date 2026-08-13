import { NextRequest, NextResponse } from "next/server";
import { getRequestUser } from "@/lib/server/app-service";
import { requireRoutePolicy } from "@/lib/server/route-policy";
import { handleRouteError } from "@/lib/server/route-error";
import { createChat, listChats } from "@/lib/server/ai/persist";

export const runtime = "nodejs";

export async function GET() {
  try {
    await requireRoutePolicy("/api/ai/chats", "GET");
    const { userId } = await getRequestUser();
    const chats = await listChats(userId);
    console.log("[GET /chats] user:", userId, "found chats:", chats.length);
    return NextResponse.json({ chats });
  } catch (error) {
    return handleRouteError(error, "Gagal memuat daftar chat AI.");
  }
}

export async function POST(request: NextRequest) {
  try {
    await requireRoutePolicy("/api/ai/chats", "POST");
    const { userId } = await getRequestUser();
    const body = (await request.json().catch(() => ({}))) as { title?: string };
    const chat = await createChat(userId, body.title?.trim() || "Percakapan baru");
    console.log("[POST /chats] created chat:", chat.id, "for user:", userId);
    return NextResponse.json({ chat });
  } catch (error) {
    return handleRouteError(error, "Gagal membuat chat baru.");
  }
}
