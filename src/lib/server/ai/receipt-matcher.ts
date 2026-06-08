import { pool } from "@/db/client";
import type { ReceiptExtractedItem } from "@/lib/server/ai/vision";
import type { Product, ProductCategory } from "@/lib/types";

export type ReceiptMatchConfidence = "high" | "medium" | "low" | "none";

export type ReceiptMatchedItem = ReceiptExtractedItem & {
  suggestedProduct: Product | null;
  alternatives: Product[];
  confidence: ReceiptMatchConfidence;
};

type ProductRow = {
  id: string;
  name: string;
  category: string;
  buyPrice: number;
  sellPrice: number;
  stock: number;
  minimumStock: number;
  description: string;
  score?: number | null;
};

function toProduct(row: ProductRow): Product {
  return {
    id: row.id,
    name: row.name,
    category: row.category as ProductCategory,
    buyPrice: row.buyPrice,
    sellPrice: row.sellPrice,
    stock: row.stock,
    minimumStock: row.minimumStock,
    description: row.description,
  };
}

function normalizeName(value: string) {
  return value
    .toLowerCase()
    .replace(/[^\p{L}\p{N}\s]/gu, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function escapeLike(value: string) {
  return value.replace(/[\\%_]/g, (match) => `\\${match}`);
}

function scoreConfidence(rawName: string, product: Product | null): ReceiptMatchConfidence {
  if (!product) {
    return "none";
  }

  const raw = normalizeName(rawName);
  const name = normalizeName(product.name);
  if (raw === name) {
    return "high";
  }

  if (name.startsWith(raw) || raw.startsWith(name)) {
    return "medium";
  }

  if (name.includes(raw) || raw.includes(name)) {
    return "low";
  }

  return "low";
}

async function hasPgTrgm() {
  try {
    const result = await pool.query<{ exists: boolean }>(
      "select exists(select 1 from pg_extension where extname = 'pg_trgm') as exists"
    );
    return Boolean(result.rows[0]?.exists);
  } catch {
    return false;
  }
}

async function findCandidates(workspaceOwnerId: string, rawName: string, useTrgm: boolean) {
  const normalized = normalizeName(rawName);
  const words = normalized
    .split(" ")
    .filter((word) => word.length >= 3)
    .slice(0, 5);
  const escaped = escapeLike(normalized);
  const wordPatterns = words.map((word) => `%${escapeLike(word)}%`);

  const baseSelect = `
    select
      id,
      name,
      category,
      buy_price as "buyPrice",
      sell_price as "sellPrice",
      stock,
      minimum_stock as "minimumStock",
      description
  `;

  if (useTrgm) {
    const result = await pool.query<ProductRow>(
      `
        ${baseSelect},
        greatest(
          similarity(lower(name), $2),
          case
            when lower(name) = $2 then 1
            when lower(name) like $3 escape '\\' then 0.85
            when $2 like '%' || lower(name) || '%' then 0.7
            else 0
          end
        ) as score
        from products
        where user_id = $1
          and (
            lower(name) % $2
            or lower(name) like $3 escape '\\'
            or $2 like '%' || lower(name) || '%'
            or (${wordPatterns.length} = 0 or lower(name) ilike any($4::text[]))
          )
        order by score desc, name asc
        limit 3
      `,
      [workspaceOwnerId, normalized, `%${escaped}%`, wordPatterns]
    );

    return result.rows.map(toProduct);
  }

  const result = await pool.query<ProductRow>(
    `
      ${baseSelect}
      from products
      where user_id = $1
        and (
          lower(name) = $2
          or lower(name) like $3 escape '\\'
          or $2 like '%' || lower(name) || '%'
          or (${wordPatterns.length} = 0 or lower(name) ilike any($4::text[]))
        )
      order by
        case
          when lower(name) = $2 then 0
          when lower(name) like $2 || '%' escape '\\' then 1
          when lower(name) like $3 escape '\\' then 2
          else 3
        end,
        name asc
      limit 3
    `,
    [workspaceOwnerId, normalized, `%${escaped}%`, wordPatterns]
  );

  return result.rows.map(toProduct);
}

export async function matchToProducts(
  workspaceOwnerId: string,
  items: ReceiptExtractedItem[]
): Promise<ReceiptMatchedItem[]> {
  const useTrgm = await hasPgTrgm();

  return Promise.all(
    items.map(async (item) => {
      const alternatives = await findCandidates(workspaceOwnerId, item.rawName, useTrgm);
      const suggestedProduct = alternatives[0] ?? null;

      return {
        ...item,
        suggestedProduct,
        alternatives,
        confidence: scoreConfidence(item.rawName, suggestedProduct),
      };
    })
  );
}
