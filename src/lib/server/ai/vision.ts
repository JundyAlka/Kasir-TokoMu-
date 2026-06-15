import { callGemini } from "@/lib/server/ai/gemini";

export type ReceiptExtractedItem = {
  rawName: string;
  quantity: number;
  unit?: string | null;
  unitPrice?: number | null;
  lineTotal?: number | null;
  rawText?: string | null;
};

const SYSTEM_PROMPT =
  "Kamu membaca foto struk restok toko. Ekstrak SETIAP barang yang dibeli dalam JSON array berisi {rawName, quantity, unit, unitPrice, lineTotal, rawText}. Quantity dan harga harus angka bulat Rupiah. Jika tidak ada nilai, isi null. Jangan tambahkan komentar, hanya JSON valid.";

const UNIT_PROMPT =
  "Tambahkan field unit untuk setiap item. Unit adalah satuan tertulis di struk seperti Kg, Box, Pcs, Dus, atau null jika tidak ada. Jika ada teks baris asli, isi rawText. Return tetap hanya JSON array valid.";

const STRICT_RECEIPT_PROMPT =
  "Fokus hanya ke baris barang. Abaikan header toko, nomor struk, tanggal, subtotal, bayar, kembali, dan ucapan terima kasih. Jika baris struk berbentuk '4.000 Kg X 12.500', hasilnya quantity 4000, unit Kg, unitPrice 12500. Jangan mengubah Kg/Box menjadi Pcs.";

const USER_PROMPTS = [
  "Ekstrak item belanja dari struk restok ini. Sertakan satuan tertulis dari setiap baris, misalnya Kg, Box, atau Pcs. Return hanya JSON array valid.",
  "Baca struk sebagai daftar barang grosir. Setiap item biasanya terdiri dari nama barang lalu baris jumlah seperti '1600 Kg X 27.500' dan total Rupiah di kanan. Return JSON array valid tanpa teks lain.",
  "Transkrip baris barang saja dari gambar ini, lalu ubah menjadi JSON array. Format umum: nama barang di satu baris, baris berikutnya jumlah satuan X harga. Jangan sertakan subtotal atau pembayaran.",
];

const DEFAULT_VISION_MODEL = process.env.GEMINI_VISION_MODEL ?? "gemini-2.0-flash";
const FALLBACK_VISION_MODEL =
  process.env.GEMINI_FALLBACK_VISION_MODEL ?? "gemini-2.0-flash-lite";

function normalizeNumber(value: unknown) {
  if (typeof value === "number" && Number.isFinite(value)) {
    return Math.max(0, Math.round(value));
  }

  if (typeof value === "string") {
    const numeric = value.replace(/[^\d,.-]/g, "").trim();
    if (!numeric) {
      return null;
    }

    const hasDot = numeric.includes(".");
    const hasComma = numeric.includes(",");
    let normalized = numeric;

    if (hasDot && hasComma) {
      normalized =
        numeric.lastIndexOf(",") > numeric.lastIndexOf(".")
          ? numeric.replace(/\./g, "").replace(",", ".")
          : numeric.replace(/,/g, "");
    } else if (hasDot && /^-?\d{1,3}(?:\.\d{3})+$/.test(numeric)) {
      normalized = numeric.replace(/\./g, "");
    } else if (hasComma && /^-?\d{1,3}(?:,\d{3})+$/.test(numeric)) {
      normalized = numeric.replace(/,/g, "");
    } else if (hasComma) {
      normalized = numeric.replace(",", ".");
    }

    const parsed = Number(normalized);
    if (Number.isFinite(parsed)) {
      return Math.max(0, Math.round(parsed));
    }
  }

  return null;
}

function normalizeUnit(value: unknown) {
  if (typeof value !== "string") {
    return null;
  }

  const unit = value.trim();
  if (!unit) {
    return null;
  }

  const normalized = unit.toLowerCase();
  if (["kg", "kgs", "kilogram"].includes(normalized)) return "Kg";
  if (["box", "boks"].includes(normalized)) return "Box";
  if (["pcs", "pc", "piece", "pieces"].includes(normalized)) return "Pcs";
  if (["dus", "kardus"].includes(normalized)) return "Dus";
  if (["klg", "kaleng"].includes(normalized)) return "Klg";
  return unit.slice(0, 16);
}

function normalizeKey(value: string) {
  return value.toLowerCase().replace(/[^\p{L}\p{N}]/gu, "");
}

function pickAliasedValue(row: Record<string, unknown>, aliases: string[]) {
  const aliasSet = new Set(aliases.map(normalizeKey));

  for (const [key, value] of Object.entries(row)) {
    if (aliasSet.has(normalizeKey(key))) {
      return value;
    }
  }

  return undefined;
}

function pickString(row: Record<string, unknown>, aliases: string[]) {
  const value = pickAliasedValue(row, aliases);
  return typeof value === "string" ? value : null;
}

function inferUnit(...values: unknown[]) {
  for (const value of values) {
    if (typeof value !== "string") {
      continue;
    }

    const match =
      /\b(kg|kgs|kilogram|box|boks|pcs|pc|piece|pieces|dus|kardus|klg|kaleng)\b/i.exec(value);
    const unit = normalizeUnit(match?.[1]);
    if (unit) {
      return unit;
    }
  }

  return null;
}

type ReceiptLineDetail = {
  rawName: string | null;
  quantity: number | null;
  unit: string | null;
  unitPrice: number | null;
  lineTotal: number | null;
  rawText: string;
};

function isReceiptNoiseLine(line: string) {
  return (
    line.length === 0 ||
    /^[-\s.]+$/.test(line) ||
    /^rp\.?$/i.test(line) ||
    /\b(no\.?\s*struk|subtotal|bayar|kembali|terima kasih|atas kunjungan|toko|grosir|alamat|tanggal)\b/i.test(
      line
    ) ||
    /\d{1,2}[./-]\d{1,2}[./-]\d{2,4}/.test(line)
  );
}

function cleanItemName(value: string) {
  return value
    .replace(/^[\s|:;,.=-]+|[\s|:;,.=-]+$/g, "")
    .replace(/^(?:barang|item|nama)\s*[:.-]\s*/i, "")
    .replace(/\s+/g, " ")
    .trim();
}

function parseReceiptDetailLine(line: string): ReceiptLineDetail | null {
  const detailMatch = /^(?:(.+?)\s+)?([\d.,]+)\s*([A-Za-z]+)?\s*[xX]\s*(?:Rp\.?\s*)?([\d.,]+)(?:.*?(?:Rp\.?\s*)?([\d.,]+))?$/i.exec(
    line
  );

  if (!detailMatch) {
    return null;
  }

  const inlineName = cleanItemName(detailMatch[1] ?? "");

  return {
    rawName: inlineName && !isReceiptNoiseLine(inlineName) ? inlineName : null,
    quantity: normalizeNumber(detailMatch[2]),
    unit: normalizeUnit(detailMatch[3]),
    unitPrice: normalizeNumber(detailMatch[4]),
    lineTotal: normalizeNumber(detailMatch[5]),
    rawText: line,
  };
}

function parseReceiptTextLines(content: string) {
  return content
    .split(/\r?\n/)
    .map((line) => line.replace(/\s+/g, " ").trim())
    .filter((line) => !isReceiptNoiseLine(line));
}

function inferNameFromText(content: string) {
  for (const line of parseReceiptTextLines(content)) {
    const detail = parseReceiptDetailLine(line);
    if (detail?.rawName) {
      return detail.rawName;
    }

    if (!detail && !/[xX]\s*(?:Rp\.?\s*)?[\d.,]+/.test(line) && /[A-Za-z]/.test(line)) {
      const name = cleanItemName(line);
      if (name && !isReceiptNoiseLine(name)) {
        return name;
      }
    }
  }

  return null;
}

function inferDetailFromText(content: string) {
  for (const line of parseReceiptTextLines(content)) {
    const detail = parseReceiptDetailLine(line);
    if (detail) {
      return detail;
    }
  }

  return null;
}

function parseReceiptTextFallback(content: string): ReceiptExtractedItem[] {
  const lines = parseReceiptTextLines(content);
  const items: ReceiptExtractedItem[] = [];
  let pendingName = "";

  for (const line of lines) {
    const detail = parseReceiptDetailLine(line);

    if (detail) {
      const rawName = detail.rawName || pendingName;
      if (!rawName || isReceiptNoiseLine(rawName)) {
        pendingName = "";
        continue;
      }

      items.push({
        rawName,
        quantity: detail.quantity ?? 1,
        unit: detail.unit,
        unitPrice: detail.unitPrice,
        lineTotal: detail.lineTotal,
        rawText: detail.rawText,
      });
      pendingName = "";
      continue;
    }

    if (!/[xX]\s*[\d.,]+/.test(line) && /[A-Za-z]/.test(line)) {
      pendingName = cleanItemName(line);
    }
  }

  return items;
}

const PAYLOAD_ALIASES = [
  "items",
  "data",
  "result",
  "results",
  "receiptItems",
  "receipt_items",
  "lineItems",
  "line_items",
  "products",
  "barang",
  "daftarBarang",
  "daftar_barang",
  "produk",
];

const NESTED_PAYLOAD_ALIASES = ["receipt", "struk", "invoice", "ocr", "payload", "response"];

function parseJsonObjectPayload(value: unknown, depth = 0): unknown {
  if (!value || typeof value !== "object") {
    return value;
  }

  if (Array.isArray(value) || depth > 4) {
    return value;
  }

  const row = value as Record<string, unknown>;
  const directPayload = pickAliasedValue(row, PAYLOAD_ALIASES);
  if (directPayload !== undefined) {
    return parseJsonObjectPayload(directPayload, depth + 1);
  }

  const nestedPayload = pickAliasedValue(row, NESTED_PAYLOAD_ALIASES);
  if (nestedPayload !== undefined) {
    return parseJsonObjectPayload(nestedPayload, depth + 1);
  }

  return value;
}

function parseJsonArray(content: string): unknown {
  const trimmed = content.trim();
  if (trimmed.startsWith("[")) {
    return JSON.parse(trimmed);
  }

  if (trimmed.startsWith("{")) {
    return parseJsonObjectPayload(JSON.parse(trimmed));
  }

  const fenced = /```(?:json)?\s*([\s\S]*?)\s*```/i.exec(trimmed);
  const fencedPayload = fenced?.[1]?.trim();
  if (fencedPayload?.startsWith("[")) {
    return JSON.parse(fencedPayload);
  }
  if (fencedPayload?.startsWith("{")) {
    return parseJsonObjectPayload(JSON.parse(fencedPayload));
  }

  const start = trimmed.indexOf("[");
  const end = trimmed.lastIndexOf("]");
  if (start >= 0 && end > start) {
    return JSON.parse(trimmed.slice(start, end + 1));
  }

  const objectStart = trimmed.indexOf("{");
  const objectEnd = trimmed.lastIndexOf("}");
  if (objectStart >= 0 && objectEnd > objectStart) {
    return parseJsonObjectPayload(JSON.parse(trimmed.slice(objectStart, objectEnd + 1)));
  }

  throw new Error("AI response is not a JSON array.");
}

const RAW_NAME_ALIASES = [
  "rawName",
  "name",
  "nama",
  "item",
  "itemName",
  "product",
  "productName",
  "produk",
  "namaProduk",
  "nama_produk",
  "barang",
  "namaBarang",
  "nama_barang",
  "namaItem",
  "nama_item",
  "description",
  "deskripsi",
];

const QUANTITY_ALIASES = ["quantity", "qty", "jumlah", "kuantitas", "jumlahBarang", "jumlah_barang"];
const UNIT_ALIASES = ["unit", "satuan", "uom"];
const UNIT_PRICE_ALIASES = [
  "unitPrice",
  "unit_price",
  "harga",
  "price",
  "hargaSatuan",
  "harga_satuan",
  "hargaBeli",
  "harga_beli",
];
const LINE_TOTAL_ALIASES = [
  "lineTotal",
  "line_total",
  "total",
  "subtotal",
  "totalHarga",
  "total_harga",
  "jumlahHarga",
  "jumlah_harga",
];
const RAW_TEXT_ALIASES = ["rawText", "raw_text", "text", "line", "lineText", "line_text", "keterangan"];

function normalizeObjectItem(row: Record<string, unknown>): ReceiptExtractedItem[] {
  const rawText = pickString(row, RAW_TEXT_ALIASES);
  const detail = rawText ? inferDetailFromText(rawText) : null;
  const rawName = cleanItemName(
    String(pickAliasedValue(row, RAW_NAME_ALIASES) ?? detail?.rawName ?? (rawText ? inferNameFromText(rawText) : "") ?? "")
  );

  if (!rawName) {
    return [];
  }

  return [
    {
      rawName,
      quantity: normalizeNumber(pickAliasedValue(row, QUANTITY_ALIASES)) ?? detail?.quantity ?? 1,
      unit:
        normalizeUnit(pickAliasedValue(row, UNIT_ALIASES)) ??
        detail?.unit ??
        inferUnit(rawText, pickAliasedValue(row, RAW_NAME_ALIASES)),
      unitPrice: normalizeNumber(pickAliasedValue(row, UNIT_PRICE_ALIASES)) ?? detail?.unitPrice,
      lineTotal: normalizeNumber(pickAliasedValue(row, LINE_TOTAL_ALIASES)) ?? detail?.lineTotal,
      rawText,
    },
  ];
}

function normalizeArrayItem(row: unknown[]): ReceiptExtractedItem[] {
  const rawText = row
    .filter((value) => typeof value === "string")
    .join(" ")
    .trim();
  const detail = rawText ? inferDetailFromText(rawText) : null;
  const rawName = cleanItemName(String(row[0] ?? detail?.rawName ?? (rawText ? inferNameFromText(rawText) : "") ?? ""));

  if (!rawName) {
    return [];
  }

  const unitValue = typeof row[2] === "string" && !/\d/.test(row[2]) ? row[2] : undefined;
  const compactLineTotal = row.length === 3 ? row[2] : undefined;

  return [
    {
      rawName,
      quantity: normalizeNumber(row[1]) ?? detail?.quantity ?? 1,
      unit: normalizeUnit(unitValue) ?? detail?.unit ?? inferUnit(rawText, row[1]),
      unitPrice: normalizeNumber(row[3]) ?? detail?.unitPrice,
      lineTotal: normalizeNumber(row[4] ?? compactLineTotal) ?? detail?.lineTotal,
      rawText: rawText || null,
    },
  ];
}

function normalizeItems(value: unknown): ReceiptExtractedItem[] {
  if (!Array.isArray(value)) {
    if (value && typeof value === "object") {
      return normalizeObjectItem(value as Record<string, unknown>);
    }

    return [];
  }

  return value.flatMap((item) => {
    if (Array.isArray(item)) {
      return normalizeArrayItem(item);
    }

    if (!item || typeof item !== "object") {
      return [];
    }

    return normalizeObjectItem(item as Record<string, unknown>);
  });
}

export function parseReceiptItemsContent(content: string): ReceiptExtractedItem[] {
  try {
    const parsed = parseJsonArray(content);
    const items = normalizeItems(parsed);
    if (items.length > 0) {
      return items;
    }
  } catch {
    // Fall back to plain OCR-like text below.
  }

  return parseReceiptTextFallback(content);
}

async function callVisionModel(imageDataUrl: string, model: string, userPrompt: string) {
  const response = await callGemini({
    model,
    temperature: 0,
    messages: [
      { role: "system", content: SYSTEM_PROMPT },
      { role: "system", content: UNIT_PROMPT },
      { role: "system", content: STRICT_RECEIPT_PROMPT },
      {
        role: "user",
        content: [
          {
            type: "text",
            text: userPrompt,
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
  let sawResponse = false;

  for (const model of models) {
    for (const userPrompt of USER_PROMPTS) {
      let content = "";
      try {
        content = await callVisionModel(imageDataUrl, model, userPrompt);
        sawResponse = true;
      } catch (error) {
        lastError = error;
        console.warn(`Vision receipt extraction failed with ${model}.`, error);
        continue;
      }

      const items = parseReceiptItemsContent(content);
      if (items.length > 0) {
        return items;
      }
    }
  }

  if (!sawResponse && lastError) {
    throw lastError;
  }

  return [];
}
