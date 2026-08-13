import { NextRequest, NextResponse } from "next/server";
import * as XLSX from "xlsx";
import { createProduct, getRequestUser } from "@/lib/server/app-service";
import { requireRoutePolicy } from "@/lib/server/route-policy";
import { handleRouteError } from "@/lib/server/route-error";
import { logEvent } from "@/lib/server/audit";
import { generateSku } from "@/lib/sku";
import type { ProductCategory } from "@/lib/types";

export const runtime = "nodejs";

/**
 * Column name aliases – we normalise the user's header into one of our
 * canonical field names so the user doesn't have to remember exact spelling.
 */
const COLUMN_ALIASES: Record<string, string> = {
  // nama
  nama: "name",
  name: "name",
  "nama produk": "name",
  "nama barang": "name",
  product: "name",
  "product name": "name",
  produk: "name",
  barang: "name",

  // kategori
  kategori: "category",
  category: "category",
  jenis: "category",
  tipe: "category",
  type: "category",

  // harga beli
  "harga beli": "buyPrice",
  "harga_beli": "buyPrice",
  hargabeli: "buyPrice",
  "buy price": "buyPrice",
  buyprice: "buyPrice",
  "cost price": "buyPrice",
  costprice: "buyPrice",
  hpp: "buyPrice",
  modal: "buyPrice",

  // harga jual
  "harga jual": "buyPrice" === "buyPrice" ? "sellPrice" : "sellPrice",
  "harga_jual": "sellPrice",
  hargajual: "sellPrice",
  "sell price": "sellPrice",
  sellprice: "sellPrice",
  harga: "sellPrice",
  price: "sellPrice",

  // stok
  stok: "stock",
  stock: "stock",
  qty: "stock",
  quantity: "stock",
  jumlah: "stock",

  // stok minimum
  "stok minimum": "minimumStock",
  "stok_minimum": "minimumStock",
  "stok min": "minimumStock",
  stokminimum: "minimumStock",
  "minimum stock": "minimumStock",
  minimumstock: "minimumStock",
  "min stock": "minimumStock",
  minstock: "minimumStock",
  "stok_min": "minimumStock",
  stokmin: "minimumStock",

  // deskripsi
  deskripsi: "description",
  description: "description",
  catatan: "description",
  keterangan: "description",
  note: "description",
  notes: "description",

  // sku
  sku: "sku",
  kode: "sku",
  "kode barang": "sku",
  "kode produk": "sku",
  code: "sku",
};

// fix the harga jual alias that had a JS expression bug
COLUMN_ALIASES["harga jual"] = "sellPrice";

function normaliseHeader(raw: string): string | null {
  const key = raw.trim().toLowerCase().replace(/[_\-]+/g, " ").replace(/\s+/g, " ");
  return COLUMN_ALIASES[key] ?? null;
}

function parseNumber(value: unknown): number {
  if (value === null || value === undefined || value === "") return 0;
  if (typeof value === "number") return value;
  // strip "Rp", dots as thousand separator, and replace comma with dot
  const cleaned = String(value)
    .replace(/[Rr]p\.?\s*/g, "")
    .replace(/\./g, "")
    .replace(/,/g, ".")
    .replace(/[^\d.\-]/g, "")
    .trim();
  const num = Number(cleaned);
  return Number.isFinite(num) ? Math.round(num) : 0;
}

const VALID_CATEGORIES: ProductCategory[] = [
  "Makanan",
  "Minuman",
  "Sembako",
  "Kebutuhan Harian",
];

function normaliseCategory(value: unknown): ProductCategory {
  if (!value) return "Makanan";
  const str = String(value).trim();
  // exact match (case-insensitive)
  const found = VALID_CATEGORIES.find(
    (c) => c.toLowerCase() === str.toLowerCase()
  );
  if (found) return found;

  // partial match
  const partial = VALID_CATEGORIES.find((c) =>
    c.toLowerCase().includes(str.toLowerCase())
  );
  if (partial) return partial;

  return "Makanan";
}

interface ImportRow {
  name: string;
  category: ProductCategory;
  buyPrice: number;
  sellPrice: number;
  stock: number;
  minimumStock: number;
  description: string;
  sku: string;
}

export async function POST(request: NextRequest) {
  try {
    await requireRoutePolicy("/api/products/import", "POST");
    const { workspaceOwnerId, userId } = await getRequestUser();

    const formData = await request.formData();
    const file = formData.get("file") as File | null;

    if (!file) {
      return NextResponse.json(
        { error: "File tidak ditemukan. Upload file CSV atau Excel." },
        { status: 400 }
      );
    }

    const maxSizeMB = 5;
    if (file.size > maxSizeMB * 1024 * 1024) {
      return NextResponse.json(
        { error: `Ukuran file maksimal ${maxSizeMB}MB.` },
        { status: 400 }
      );
    }

    const buffer = Buffer.from(await file.arrayBuffer());
    const workbook = XLSX.read(buffer, { type: "buffer" });
    const sheetName = workbook.SheetNames[0];

    if (!sheetName) {
      return NextResponse.json(
        { error: "File tidak memiliki sheet data." },
        { status: 400 }
      );
    }

    const rawRows: Record<string, unknown>[] = XLSX.utils.sheet_to_json(
      workbook.Sheets[sheetName]
    );

    if (rawRows.length === 0) {
      return NextResponse.json(
        { error: "Sheet pertama kosong. Pastikan baris pertama berisi header kolom." },
        { status: 400 }
      );
    }

    // Map raw headers to canonical fields
    const firstRow = rawRows[0];
    const headerMap: Record<string, string> = {};
    const unmappedHeaders: string[] = [];

    for (const rawHeader of Object.keys(firstRow)) {
      const canonical = normaliseHeader(rawHeader);
      if (canonical) {
        headerMap[rawHeader] = canonical;
      } else {
        unmappedHeaders.push(rawHeader);
      }
    }

    // Must have at least "name"
    const mappedFields = new Set(Object.values(headerMap));
    if (!mappedFields.has("name")) {
      return NextResponse.json(
        {
          error:
            'Kolom "Nama" atau "Nama Produk" tidak ditemukan di header. ' +
            `Header yang terdeteksi: ${Object.keys(firstRow).join(", ")}`,
        },
        { status: 400 }
      );
    }

    // Parse all rows
    const importRows: ImportRow[] = [];
    const errors: string[] = [];

    for (let i = 0; i < rawRows.length; i++) {
      const raw = rawRows[i];
      const rowNum = i + 2; // +2 because row 1 is header

      const mapped: Record<string, unknown> = {};
      for (const [rawKey, canonical] of Object.entries(headerMap)) {
        mapped[canonical] = raw[rawKey];
      }

      const name = String(mapped.name ?? "").trim();
      if (!name) {
        errors.push(`Baris ${rowNum}: Nama produk kosong, dilewati.`);
        continue;
      }

      const sellPrice = parseNumber(mapped.sellPrice);
      if (sellPrice <= 0 && mappedFields.has("sellPrice")) {
        errors.push(
          `Baris ${rowNum} (${name}): Harga jual harus > 0, dilewati.`
        );
        continue;
      }

      importRows.push({
        name,
        category: normaliseCategory(mapped.category),
        buyPrice: Math.max(0, parseNumber(mapped.buyPrice)),
        sellPrice: Math.max(0, sellPrice),
        stock: Math.max(0, Math.round(parseNumber(mapped.stock))),
        minimumStock: Math.max(0, Math.round(parseNumber(mapped.minimumStock))),
        description: String(mapped.description ?? "").trim(),
        sku: String(mapped.sku ?? "").trim(),
      });
    }

    if (importRows.length === 0) {
      return NextResponse.json(
        {
          error: "Tidak ada produk valid untuk diimport.",
          details: errors,
        },
        { status: 400 }
      );
    }

    // Create products in bulk
    const created: Array<{ id: string; name: string; sku: string }> = [];
    const failed: string[] = [];

    for (const row of importRows) {
      try {
        const sku =
          row.sku || generateSku(row.name, row.category);
        const product = await createProduct(workspaceOwnerId, {
          ...row,
          sku,
        });
        created.push({ id: product.id, name: product.name, sku: product.sku });
      } catch (err) {
        failed.push(
          `${row.name}: ${err instanceof Error ? err.message : "Gagal"}`
        );
      }
    }

    if (created.length > 0) {
      await logEvent(
        { workspaceOwnerId, actorUserId: userId },
        {
          eventType: "PRODUCT_BULK_IMPORT",
          entityType: "product",
          entityId: `import_${Date.now()}`,
          category: "create",
          payload: {
            totalImported: created.length,
            totalFailed: failed.length,
            source: file.name,
          },
        }
      );
    }

    return NextResponse.json({
      success: true,
      imported: created.length,
      failed: failed.length,
      skipped: rawRows.length - importRows.length - failed.length,
      products: created,
      errors: [...errors, ...failed].slice(0, 20),
      mappedColumns: Object.fromEntries(
        Object.entries(headerMap).map(([k, v]) => [k, v])
      ),
    });
  } catch (error) {
    return handleRouteError(error, "Gagal mengimport produk.");
  }
}
