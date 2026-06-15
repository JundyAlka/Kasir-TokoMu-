import { NextRequest, NextResponse } from "next/server";
import { getRequestUser } from "@/lib/server/app-service";
import { logEvent } from "@/lib/server/audit";
import { getToolMessageForCommit, updateToolMessageResult } from "@/lib/server/ai/persist";
import {
  executeCommittedTool,
  verifyToolCommitSignature,
  type ToolResult,
} from "@/lib/server/ai/tools";
import { handleRouteError } from "@/lib/server/route-error";

export const runtime = "nodejs";

type CommitBody = {
  messageId?: unknown;
  toolCallId?: unknown;
  toolName?: unknown;
  payload?: unknown;
  signature?: unknown;
};

function parseBody(value: unknown) {
  const body = (value ?? {}) as CommitBody;

  if (
    typeof body.messageId !== "string" ||
    typeof body.toolCallId !== "string" ||
    typeof body.toolName !== "string" ||
    typeof body.signature !== "string" ||
    !body.payload ||
    typeof body.payload !== "object" ||
    Array.isArray(body.payload)
  ) {
    throw new Error("Payload konfirmasi AI tidak valid.");
  }

  return {
    messageId: body.messageId,
    toolCallId: body.toolCallId,
    toolName: body.toolName,
    payload: body.payload as Record<string, unknown>,
    signature: body.signature,
  };
}

export async function POST(request: NextRequest) {
  try {
    const body = parseBody(await request.json());
    const { userId, workspaceOwnerId } = await getRequestUser();
    const message = await getToolMessageForCommit({
      messageId: body.messageId,
      userId: workspaceOwnerId,
      toolCallId: body.toolCallId,
    });

    if (!message || message.toolName !== body.toolName) {
      return NextResponse.json({ error: "Konfirmasi AI tidak ditemukan." }, { status: 404 });
    }

    const stored = message.toolResult as
      | (ToolResult & {
          data?: { pending?: boolean; signature?: string; payload?: unknown; toolName?: string };
        })
      | null;

    if (!stored || stored.kind !== "preview" || stored.data?.pending !== true) {
      return NextResponse.json({ error: "Aksi AI sudah tidak menunggu konfirmasi." }, { status: 409 });
    }

    if (
      stored.data.toolName !== body.toolName ||
      stored.data.signature !== body.signature ||
      !verifyToolCommitSignature(workspaceOwnerId, body.toolName, body.payload, body.signature)
    ) {
      return NextResponse.json({ error: "Signature konfirmasi AI tidak valid." }, { status: 400 });
    }

    const result = await executeCommittedTool(workspaceOwnerId, body.toolName, body.payload);
    await updateToolMessageResult({
      messageId: body.messageId,
      userId: workspaceOwnerId,
      result,
    });

    await logEvent(
      { workspaceOwnerId, actorUserId: userId },
      "AI_TOOL_EXECUTED",
      { type: "ai_tool", id: body.toolCallId },
      {
        toolName: body.toolName,
        messageId: body.messageId,
        ok: result.ok,
        title: result.title,
        payload: body.payload,
      }
    );

    return NextResponse.json({ result });
  } catch (error) {
    return handleRouteError(error, "Gagal menjalankan aksi AI.");
  }
}
