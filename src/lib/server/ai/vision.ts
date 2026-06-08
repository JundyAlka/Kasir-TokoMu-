import { callOpenRouter } from "@/lib/server/ai/openrouter";

export type ReceiptExtractedItem = {
  rawName: string;
  quantity: number;
  unitPrice?: number | null;
  lineTotal?: number | null;
  rawText?: string | null;
};

const SYSTEM_PROMPT =
  "Kamu adalah OCR struk restok toko. Dari gambar struk, ekstrak SETIAP item yang dibeli dalam JSON array {rawName, quantity, unitPrice, lineTotal}. Quantity adalah jumlah unit. Harga dalam Rupiah angka bulat. Jika ragu, isi null. JANGAN tambahkan komentar — hanya JSON valid.";

const DEFAULT_VISION_MODEL =
  process.env.AI_GATEWAY_VISION_MODEL ??
  process.env.OPENROUTER_VISION_MODEL ??
  "google/gemini-2.0-flash-exp";
const FALLBACK_VISION_MODEL =
  process.env.AI_GATEWAY_FALLBACK_VISION_MODEL ?? "openai/gpt-4o-mini";

function normalizeNumber(value: unknown) {
  if (typeof value === "number" && Number.isFinite(value)) {
    return Math.max(0, Math.round(value));
  }

  if (typeof value === "string") {
    const parsed = Number(value.replace(/[^\d.-]/g, ""));
    if (Number.isFinite(parsed)) {
      return Math.max(0, Math.round(parsed));
    }
  }

  return null;
}

function parseJsonArray(content: string): unknown {
  const trimmed = content.trim();
  if (trimmed.startsWith("[")) {
    return JSON.parse(trimmed);
  }

  const fenced = /```(?:json)?\s*([\s\S]*?)\s*```/i.exec(trimmed);
  if (fenced?.[1]?.trim().startsWith("[")) {
    return JSON.parse(fenced[1].trim());
  }

  const start = trimmed.indexOf("[");
  const end = trimmed.lastIndexOf("]");
  if (start >= 0 && end > start) {
    return JSON.parse(trimmed.slice(start, end + 1));
  }

  throw new Error("AI response is not a JSON array.");
}

function normalizeItems(value: unknown): ReceiptExtractedItem[] {
  if (!Array.isArray(value)) {
    return [];
  }

  return value.flatMap((item) => {
    if (!item || typeof item !== "object") {
      return [];
    }

    const row = item as Record<string, unknown>;
    const rawName = String(row.rawName ?? row.name ?? row.nama ?? "").trim();
    if (!rawName) {
      return [];
    }

    return [
      {
        rawName,
        quantity: normalizeNumber(row.quantity ?? row.qty ?? row.jumlah) ?? 1,
        unitPrice: normalizeNumber(row.unitPrice ?? row.harga ?? row.hargaSatuan),
        lineTotal: normalizeNumber(row.lineTotal ?? row.total ?? row.subtotal),
        rawText: typeof row.rawText === "string" ? row.rawText : null,
      },
    ];
  });
}

async function callVisionModel(imageDataUrl: string, model: string) {
  const response = await callOpenRouter({
    model,
    temperature: 0,
    messages: [
      { role: "system", content: SYSTEM_PROMPT },
      {
        role: "user",
        content: [
          {
            type: "text",
            text: "Ekstrak item belanja dari struk restok ini. Return hanya JSON array valid.",
          },
          {
            type: "image_url",
            image_url: { url: imageDataUrl },
          },
        ],
      },
    ],
  });

  return response.choices[0]?.message.content ?? "";
}

export async function extractReceiptItems(imageDataUrl: string): Promise<ReceiptExtractedItem[]> {
  const models = Array.from(new Set([DEFAULT_VISION_MODEL, FALLBACK_VISION_MODEL]));
  let lastError: unknown = null;

  for (const model of models) {
    let content = "";
    try {
      content = await callVisionModel(imageDataUrl, model);
    } catch (error) {
      lastError = error;
      console.warn(`Vision receipt extraction failed with ${model}.`, error);
      continue;
    }

    try {
      const parsed = parseJsonArray(content);
      return normalizeItems(parsed);
    } catch (error) {
      console.warn("Vision receipt extraction returned invalid JSON.", error);
      return [];
    }
  }

  if (lastError) {
    throw lastError;
  }

  return [];
}
