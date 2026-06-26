import type { ProductCategory } from "@/lib/types";

const CATEGORY_CODES: Record<ProductCategory, string> = {
  Makanan: "MKN",
  Minuman: "MNM",
  Sembako: "SMB",
  "Kebutuhan Harian": "KHR",
};

function normalizeToken(value: string) {
  return value
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9\s]/gi, " ")
    .trim()
    .toUpperCase();
}

function nameCode(name: string) {
  const words = normalizeToken(name).split(/\s+/).filter(Boolean);
  if (words.length === 0) {
    return "PRD";
  }

  if (words.length === 1) {
    return words[0].slice(0, 4).padEnd(3, "X");
  }

  const initials = words.map((word) => word[0]).join("").slice(0, 4);
  return initials.length >= 3 ? initials : words.join("").slice(0, 4).padEnd(3, "X");
}

export function generateSku(
  name: string,
  category: ProductCategory,
  existingSkus: Array<string | null | undefined> = []
) {
  const used = new Set(
    existingSkus
      .map((sku) => sku?.trim().toUpperCase())
      .filter((sku): sku is string => Boolean(sku))
  );
  const base = `${nameCode(name)}-${CATEGORY_CODES[category]}`;

  for (let index = 1; index <= 999; index += 1) {
    const candidate = `${base}-${String(index).padStart(3, "0")}`;
    if (!used.has(candidate)) {
      return candidate;
    }
  }

  return `${base}-${Date.now().toString().slice(-4)}`;
}
