import { NextRequest, NextResponse } from "next/server";
import { getRequestUser } from "@/lib/server/app-service";
import { requireRoutePolicy } from "@/lib/server/route-policy";
import { handleRouteError } from "@/lib/server/route-error";
import { runUserTurn } from "@/lib/server/ai/chat";
import { getChat, listMessages } from "@/lib/server/ai/persist";

export const runtime = "nodejs";
export const maxDuration = 45;

export async function GET(
  _request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  try {
    await requireRoutePolicy("/api/ai/chats/[id]/messages", "GET");
    const { userId } = await getRequestUser();
    const { id } = await context.params;
    const chat = await getChat(userId, id);
    if (!chat) {
      return NextResponse.json({ error: "Chat tidak ditemukan." }, { status: 404 });
    }
    const messages = await listMessages(id);
    return NextResponse.json({ chat, messages });
  } catch (error) {
    return handleRouteError(error, "Gagal memuat pesan chat AI.");
  }
}

export async function POST(
  request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  try {
    await requireRoutePolicy("/api/ai/chats/[id]/messages", "POST");
    const { userId } = await getRequestUser();
    const { id } = await context.params;
    console.log(`[POST /messages] chatId=${id} userId=${userId}`);
    const chat = await getChat(userId, id);
    if (!chat) {
      console.log(`[POST /messages] getChat returned null for chatId=${id} and userId=${userId}`);
      return NextResponse.json({ error: "Chat tidak ditemukan." }, { status: 404 });
    }
    const body = (await request.json()) as { text?: string };
    const text = (body.text ?? "").trim();
    if (!text) {
      return NextResponse.json({ error: "Pesan kosong." }, { status: 400 });
    }
    const { newMessages } = await runUserTurn({
      userId,
      chatId: id,
      userText: text,
    });
    return NextResponse.json({ newMessages });
  } catch (error) {
    console.log("[POST /messages] error inside runUserTurn:", error);
    return handleRouteError(error, "Gagal mengirim pesan ke AI.");
  }
}
