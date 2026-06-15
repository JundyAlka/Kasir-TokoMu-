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

function tokenize(value: string) {
  return normalizeName(value)
    .split(" ")
    .filter((word) => word.length >= 2);
}

function levenshtein(left: string, right: string) {
  if (left === right) return 0;
  if (left.length === 0) return right.length;
  if (right.length === 0) return left.length;

  const previous = Array.from({ length: right.length + 1 }, (_, index) => index);
  const current = Array.from({ length: right.length + 1 }, () => 0);

  for (let i = 1; i <= left.length; i += 1) {
    current[0] = i;
    for (let j = 1; j <= right.length; j += 1) {
      const cost = left[i - 1] === right[j - 1] ? 0 : 1;
      current[j] = Math.min(
        current[j - 1] + 1,
        previous[j] + 1,
        previous[j - 1] + cost
      );
    }

    for (let j = 0; j < previous.length; j += 1) {
      previous[j] = current[j];
    }
  }

  return previous[right.length] ?? Math.max(left.length, right.length);
}

function tokenSimilarity(left: string, right: string) {
  if (left === right) return 1;
  if (left.includes(right) || right.includes(left)) return 0.82;

  const longest = Math.max(left.length, right.length);
  if (longest < 4) return 0;

  const distance = levenshtein(left, right);
  return Math.max(0, 1 - distance / longest);
}

function fuzzyScore(rawName: string, productName: string) {
  const raw = normalizeName(rawName);
  const name = normalizeName(productName);
  if (!raw || !name) return 0;
  if (raw === name) return 1;
  if (name.startsWith(raw) || raw.startsWith(name)) return 0.9;
  if (name.includes(raw) || raw.includes(name)) return 0.78;

  const rawTokens = tokenize(raw);
  const productTokens = tokenize(name);
  if (rawTokens.length === 0 || productTokens.length === 0) return 0;

  const rawCoverage =
    rawTokens.reduce((sum, rawToken) => {
      const best = Math.max(
        ...productTokens.map((productToken) => tokenSimilarity(rawToken, productToken)),
        0
      );
      return sum + best;
    }, 0) / rawTokens.length;

  const productCoverage =
    productTokens.reduce((sum, productToken) => {
      const best = Math.max(
        ...rawTokens.map((rawToken) => tokenSimilarity(rawToken, productToken)),
        0
      );
      return sum + best;
    }, 0) / productTokens.length;

  return rawCoverage * 0.7 + productCoverage * 0.3;
}

function scoreConfidence(rawName: string, product: Product | null): ReceiptMatchConfidence {
  if (!product) {
    return "none";
  }

  const score = fuzzyScore(rawName, product.name);
  if (score >= 0.86) {
    return "high";
  }

  if (score >= 0.55) {
    return "medium";
  }

  if (score >= 0.28) {
    return "low";
  }

  return "none";
}

async function findCandidates(workspaceOwnerId: string, rawName: string) {
  const result = await pool.query<ProductRow>(
    `
      select
      id,
      name,
      category,
      buy_price as "buyPrice",
      sell_price as "sellPrice",
      stock,
      minimum_stock as "minimumStock",
      description
      from products
      where user_id = $1
      order by name asc
    `,
    [workspaceOwnerId]
  );

  return result.rows
    .map((row) => ({
      product: toProduct(row),
      score: fuzzyScore(rawName, row.name),
    }))
    .filter(({ score }) => score >= 0.28)
    .sort((left, right) => right.score - left.score || left.product.name.localeCompare(right.product.name))
    .slice(0, 6)
    .map(({ product }) => product);
}

export async function matchToProducts(
  workspaceOwnerId: string,
  items: ReceiptExtractedItem[]
): Promise<ReceiptMatchedItem[]> {
  return Promise.all(
    items.map(async (item) => {
      const alternatives = await findCandidates(workspaceOwnerId, item.rawName);
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
