import { NextRequest, NextResponse } from "next/server";
import { getRequestUser } from "@/lib/server/app-service";
import { extractReceiptItems } from "@/lib/server/ai/vision";
import { matchToProducts } from "@/lib/server/ai/receipt-matcher";
import { requireRoutePolicy } from "@/lib/server/route-policy";
import { handleRouteError } from "@/lib/server/route-error";

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
    await requireRoutePolicy("/api/ai/scan-receipt", "POST");
    const { workspaceOwnerId } = await getRequestUser();
    const body = (await request.json()) as { imageDataUrl?: unknown };
    const imageDataUrl = validateImageDataUrl(body.imageDataUrl);
    const extractedItems = await extractReceiptItems(imageDataUrl, workspaceOwnerId);
    if (extractedItems.length === 0) {
      return NextResponse.json(
        { error: "AI belum menemukan item dari struk. Coba foto ulang dengan pencahayaan lebih jelas." },
        { status: 422 }
      );
    }

    const items = await matchToProducts(workspaceOwnerId, extractedItems);

    return NextResponse.json({ items });
  } catch (error) {
    return handleRouteError(error, "Gagal membaca struk.");
  }
}
