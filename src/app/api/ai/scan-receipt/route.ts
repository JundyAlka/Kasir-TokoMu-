import { NextRequest, NextResponse } from "next/server";
import { getRequestUser } from "@/lib/server/app-service";
import { extractReceiptItems } from "@/lib/server/ai/vision";
import { matchToProducts } from "@/lib/server/ai/receipt-matcher";
import { requireRole } from "@/lib/server/rbac";

export const runtime = "nodejs";
export const maxDuration = 60;

const MAX_IMAGE_BYTES = 5 * 1024 * 1024;

function estimateDataUrlBytes(value: string) {
  const base64 = value.split(",", 2)[1] ?? value;
  return Math.floor((base64.length * 3) / 4);
}

function validateImageDataUrl(value: unknown) {
  if (typeof value !== "string" || !value.startsWith("data:image/")) {
    throw new Error("Foto struk wajib berupa imageDataUrl base64.");
  }

  if (estimateDataUrlBytes(value) > MAX_IMAGE_BYTES) {
    throw new Error("Ukuran foto struk maksimal 5MB.");
  }

  return value;
}

export async function POST(request: NextRequest) {
  try {
    await requireRole(["pengelola_keuangan", "pimpinan"]);
    const { workspaceOwnerId } = await getRequestUser();
    const body = (await request.json()) as { imageDataUrl?: unknown };
    const imageDataUrl = validateImageDataUrl(body.imageDataUrl);
    const extractedItems = await extractReceiptItems(imageDataUrl);
    if (extractedItems.length === 0) {
      return NextResponse.json(
        { error: "AI belum menemukan item dari struk. Coba foto ulang dengan pencahayaan lebih jelas." },
        { status: 422 }
      );
    }

    const items = await matchToProducts(workspaceOwnerId, extractedItems);

    return NextResponse.json({ items });
  } catch (error) {
    if (error instanceof Error && error.message === "UNAUTHORIZED") {
      return NextResponse.json({ error: "UNAUTHORIZED" }, { status: 401 });
    }

    if (error instanceof Error && error.message === "FORBIDDEN") {
      return NextResponse.json({ error: "FORBIDDEN" }, { status: 403 });
    }

    if (
      error instanceof Error &&
      (error.message.includes("Gemini") ||
        error.message.includes("GEMINI_API_KEY") ||
        error.message.includes("AI response"))
    ) {
      return NextResponse.json(
        { error: "AI tidak bisa membaca struk saat ini, silakan restok manual." },
        { status: 502 }
      );
    }

    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Gagal membaca struk." },
      { status: 400 }
    );
  }
}
