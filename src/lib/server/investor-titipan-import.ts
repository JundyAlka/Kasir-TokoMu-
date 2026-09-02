import { and, eq, ilike } from "drizzle-orm";
import * as XLSX from "xlsx";
import { db } from "@/db/client";
import { investments, investors, products } from "@/db/schema";
import { logEvent } from "@/lib/server/audit";

export type TitipanItemRow = {
  productName: string;
  category: string;
  buyPrice: number;
  sellPrice: number;
  stock: number;
  minimumStock: number;
  description: string;
  existsInCatalog: boolean;
  productId: string | null;
  unitMargin: number;
};

export type InvestorTitipanGroup = {
  investorName: string;
  partnerType: "titipan_bagihasil";
  whatsapp?: string;
  address?: string;
  notes?: string;
  itemCount: number;
  totalStock: number;
  totalBuyValue: number;
  totalSellValue: number;
  items: TitipanItemRow[];
};

export type TitipanImportPreview = {
  totalProducts: number;
  totalInvestors: number;
  totalCatalogMatched: number;
  totalNewProducts: number;
  totalStock: number;
  totalInvestmentValue: number;
  groups: InvestorTitipanGroup[];
};

const newId = (prefix: string) => `${prefix}_${crypto.randomUUID().slice(0, 10)}`;

export function detectInvestorName(productName: string, description?: string): string {
  const name = String(productName || "").trim();

  // 1. Parenthesized brand
  const parenMatch = /\(([^)]+)\)/.exec(name);
  if (parenMatch) {
    const inside = parenMatch[1].trim();
    if (/berkah/i.test(inside)) return "Berkah";
    if (/dua ikan mas/i.test(inside)) return "Slondok Dua Ikan Mas";
    if (/dj aksessoris|dj aksesoris/i.test(inside)) return "DJ Aksesoris";
    if (/mutyara/i.test(inside)) return "Mutyara Camilan";
    if (/aodo/i.test(inside)) return "Aodo";
    if (/bodeng/i.test(inside)) return "Pia Bodeng";
    if (/padimas/i.test(inside)) return "Padimas";
  }

  // 2. Common prefix brands & groups
  const prefixes: Array<[string, RegExp]> = [
    ["Alfinda", /^Alfinda\b/i],
    ["Padimas", /^Padimas\b/i],
    ["Raden", /^Raden\b/i],
    ["Pia Ru", /^Pia Ru\b/i],
    ["Kecimpring", /^Kecimpring\b/i],
    ["Intern Parfum", /^Intern Parfum\b/i],
    ["Swallow", /^Swallow\b|^Sun Swallow\b/i],
    ["Melly", /^Melly\b/i],
    ["Cinos", /^Cinos\b/i],
    ["Boxer", /^Boxer\b/i],
    ["Pia Bodeng", /^Pia Bodeng\b|^Pia AA\b/i],
    ["Aodo", /^Roti Aodo\b|^Roti sisir\b/i],
    ["Slondok Dua Ikan Mas", /^Slondok\b/i],
    ["Teh Tarik", /^Teh Tarik\b/i],
    ["Krupuk", /^Krupuk\b|^Kerupuk\b/i],
    ["Pakaian Dalam CD", /^CD\b|^Mini Set\b/i],
    ["Pakaian Olahraga & Kaos", /^Kaos\b|^Sport BH\b|^BH Sport\b/i],
    ["Topi", /^Topi\b/i],
    ["Bu Baryem", /^Bu Baryem\b/i],
    ["Lamor Parfum", /^Lamor Parfum\b/i],
    ["Arsaka Parfum", /^Arsaka Parfum\b/i],
    ["Sedulur Parfum", /^Sedulur Parfum\b/i],
    ["Bakpia AR", /^Bakpia AR\b/i],
    ["Roti Linda Sari", /^Roti Linda\b/i],
    ["Roti Madu Saji", /^Roti Madu\b/i],
    ["Kripik Tempe Sanah", /^Kripik Tempe\b/i],
    ["Criping Telo", /^Criping Telo\b/i],
  ];

  for (const [groupName, regex] of prefixes) {
    if (regex.test(name)) return groupName;
  }

  // Fallback: clean up name
  const cleaned = name.replace(/[()]/g, "").trim();
  const words = cleaned.split(/\s+/);
  if (words.length >= 2 && words[0].length > 3) {
    return `${words[0]} ${words[1]}`;
  }
  return cleaned;
}

function parseNumber(value: unknown): number {
  if (typeof value === "number" && Number.isFinite(value)) return Math.round(value);
  const clean = String(value ?? "").replace(/[Rp\s.]/g, "").replace(",", ".");
  const num = Number(clean);
  return Number.isFinite(num) ? Math.round(num) : 0;
}

export async function previewInvestorTitipanImport(
  workspaceOwnerId: string,
  fileBuffer: ArrayBuffer
): Promise<TitipanImportPreview> {
  const wb = XLSX.read(fileBuffer, { type: "array", cellDates: false });
  const sheetName = wb.SheetNames[0];
  if (!sheetName) throw new Error("File Excel tidak memiliki sheet yang valid.");
  const sheet = wb.Sheets[sheetName];
  const rawRows = XLSX.utils.sheet_to_json<Record<string, unknown>>(sheet, { defval: "" });

  if (rawRows.length === 0) {
    throw new Error("File Excel tidak memiliki baris data produk titipan.");
  }

  // Fetch current products for this workspace
  const catalogProducts = await db
    .select()
    .from(products)
    .where(eq(products.userId, workspaceOwnerId));

  const exactMap = new Map(catalogProducts.map((p) => [p.name.trim().toLowerCase(), p]));
  const norm = (s: string) => s.trim().toLowerCase().replace(/[\s\-_()]+/g, "");
  const fuzzyMap = new Map(catalogProducts.map((p) => [norm(p.name), p]));

  const groupsMap = new Map<string, InvestorTitipanGroup>();
  let totalStock = 0;
  let totalInvestmentValue = 0;
  let totalCatalogMatched = 0;
  let totalNewProducts = 0;

  for (const row of rawRows) {
    const rawName = String(
      row["Nama Produk"] || row["nama_produk"] || row["Nama"] || row["Barang"] || ""
    ).trim();
    if (!rawName) continue;

    const category = String(row["Kategori"] || row["kategori"] || "Snack & Camilan").trim();
    const buyPrice = parseNumber(row["Harga Beli"] || row["harga_beli"] || row["Modal"]);
    const sellPrice = parseNumber(row["Harga Jual"] || row["harga_jual"] || row["Harga"]);
    const stock = parseNumber(row["Stok"] || row["stok"] || row["Jumlah"] || 0);
    const minimumStock = parseNumber(row["Stok Minimum"] || row["stok_minimum"] || 1);
    const description = String(row["Deskripsi"] || row["deskripsi"] || "").trim();

    // Check catalog matching
    let matchedProduct = exactMap.get(rawName.toLowerCase()) || fuzzyMap.get(norm(rawName));
    const existsInCatalog = Boolean(matchedProduct);
    if (existsInCatalog) {
      totalCatalogMatched += 1;
    } else {
      totalNewProducts += 1;
    }

    const unitMargin = Math.max(0, sellPrice - buyPrice);
    totalStock += stock;
    totalInvestmentValue += buyPrice * stock;

    const item: TitipanItemRow = {
      productName: rawName,
      category: category || (matchedProduct?.category ?? "Snack & Camilan"),
      buyPrice: buyPrice > 0 ? buyPrice : (matchedProduct?.buyPrice ?? 0),
      sellPrice: sellPrice > 0 ? sellPrice : (matchedProduct?.sellPrice ?? 0),
      stock: stock > 0 ? stock : (matchedProduct?.stock ?? 0),
      minimumStock: minimumStock > 0 ? minimumStock : (matchedProduct?.minimumStock ?? 1),
      description,
      existsInCatalog,
      productId: matchedProduct?.id ?? null,
      unitMargin,
    };

    const investorName = detectInvestorName(rawName, description);
    const group = groupsMap.get(investorName) ?? {
      investorName,
      partnerType: "titipan_bagihasil",
      whatsapp: "",
      address: "",
      notes: `Mitra titipan konsinyasi ${investorName}`,
      itemCount: 0,
      totalStock: 0,
      totalBuyValue: 0,
      totalSellValue: 0,
      items: [],
    };

    group.itemCount += 1;
    group.totalStock += item.stock;
    group.totalBuyValue += item.buyPrice * item.stock;
    group.totalSellValue += item.sellPrice * item.stock;
    group.items.push(item);
    groupsMap.set(investorName, group);
  }

  const groups = [...groupsMap.values()].sort((a, b) => b.items.length - a.items.length || a.investorName.localeCompare(b.investorName));

  return {
    totalProducts: totalCatalogMatched + totalNewProducts,
    totalInvestors: groups.length,
    totalCatalogMatched,
    totalNewProducts,
    totalStock,
    totalInvestmentValue,
    groups,
  };
}

export type CommitInvestorTitipanPayload = {
  groups: Array<{
    investorName: string;
    partnerType?: "titipan_bagihasil" | "sales_harian";
    whatsapp?: string;
    address?: string;
    notes?: string;
    items: Array<{
      productName: string;
      category: string;
      buyPrice: number;
      sellPrice: number;
      stock: number;
      minimumStock: number;
      description: string;
      productId?: string | null;
    }>;
  }>;
};

export async function commitInvestorTitipanImport(
  workspaceOwnerId: string,
  actorUserId: string,
  payload: CommitInvestorTitipanPayload
) {
  if (!payload.groups || payload.groups.length === 0) {
    throw new Error("Tidak ada data investor titipan yang akan disimpan.");
  }

  const timestamp = new Date().toISOString();
  let createdInvestorsCount = 0;
  let createdInvestmentsCount = 0;
  let createdProductsCount = 0;
  let updatedProductsCount = 0;

  await db.transaction(async (tx) => {
    // 1. Fetch current investors for this workspace
    const existingInvestors = await tx
      .select()
      .from(investors)
      .where(eq(investors.workspaceOwnerId, workspaceOwnerId));

    const investorNameMap = new Map(
      existingInvestors.map((inv) => [inv.name.trim().toLowerCase(), inv])
    );

    // 2. Fetch current products for this workspace
    const existingProducts = await tx
      .select()
      .from(products)
      .where(eq(products.userId, workspaceOwnerId));

    const productMap = new Map(
      existingProducts.map((p) => [p.name.trim().toLowerCase(), p])
    );

    // 3. Fetch existing investments to prevent duplicates
    const existingInvestments = await tx
      .select()
      .from(investments)
      .where(eq(investments.workspaceOwnerId, workspaceOwnerId));

    const investmentSet = new Set(
      existingInvestments.map((ivt) => `${ivt.investorId}:${ivt.productId}`)
    );

    for (const group of payload.groups) {
      const invName = group.investorName.trim();
      if (!invName) continue;

      let investorId = "";
      const existingInv = investorNameMap.get(invName.toLowerCase());

      if (existingInv) {
        investorId = existingInv.id;
        // Ensure partnerType is set
        if (existingInv.partnerType !== "titipan_bagihasil" && existingInv.partnerType !== "sales_harian") {
          await tx
            .update(investors)
            .set({ partnerType: "titipan_bagihasil", updatedAt: timestamp })
            .where(eq(investors.id, existingInv.id));
        }
      } else {
        investorId = newId("inv");
        const [createdInv] = await tx
          .insert(investors)
          .values({
            id: investorId,
            workspaceOwnerId,
            name: invName,
            whatsapp: group.whatsapp?.trim() || "",
            address: group.address?.trim() || "",
            notes: group.notes?.trim() || `Mitra titipan produk ${invName}`,
            isActive: 1,
            partnerType: group.partnerType || "titipan_bagihasil",
            createdAt: timestamp,
            updatedAt: timestamp,
          })
          .returning();
        investorNameMap.set(invName.toLowerCase(), createdInv);
        createdInvestorsCount += 1;
      }

      for (const item of group.items) {
        const pName = item.productName.trim();
        if (!pName) continue;

        let targetProductId = item.productId ?? "";
        let existingProd = targetProductId
          ? existingProducts.find((p) => p.id === targetProductId)
          : productMap.get(pName.toLowerCase());

        if (existingProd) {
          targetProductId = existingProd.id;
          // Mark product as consignment if not already
          if (!existingProd.isConsignment) {
            await tx
              .update(products)
              .set({ isConsignment: true, updatedAt: timestamp })
              .where(eq(products.id, existingProd.id));
            updatedProductsCount += 1;
          }
        } else {
          // Create product in catalog
          targetProductId = newId("prd");
          const [newProd] = await tx
            .insert(products)
            .values({
              id: targetProductId,
              userId: workspaceOwnerId,
              name: pName,
              sku: "",
              category: item.category || "Snack & Camilan",
              buyPrice: item.buyPrice || 0,
              sellPrice: item.sellPrice || 0,
              stock: item.stock || 0,
              minimumStock: item.minimumStock || 1,
              isConsignment: true,
              description: item.description || "Produk titipan warga",
              createdAt: timestamp,
              updatedAt: timestamp,
            })
            .returning();
          productMap.set(pName.toLowerCase(), newProd);
          createdProductsCount += 1;
        }

        // Link investment record
        const invKey = `${investorId}:${targetProductId}`;
        if (!investmentSet.has(invKey)) {
          const investmentId = newId("ivt");
          const margin = Math.max(0, item.sellPrice - item.buyPrice);

          await tx.insert(investments).values({
            id: investmentId,
            investorId,
            workspaceOwnerId,
            type: "barang_titip_jual",
            akadType: "barang_titip_jual",
            productId: targetProductId,
            unitCount: item.stock || 0,
            unitCost: item.buyPrice || 0,
            profitSharePerUnitAmount: margin,
            profitSharePerUnitPct: null,
            startDate: "2026-08-01T00:00:00.000Z",
            endDate: null,
            isActive: 1,
            createdAt: timestamp,
            updatedAt: timestamp,
          });

          investmentSet.add(invKey);
          createdInvestmentsCount += 1;
        }
      }
    }

    await logEvent(
      { workspaceOwnerId, actorUserId },
      {
        eventType: "INVESTOR_TITIPAN_IMPORTED",
        entityType: "investor",
        entityId: workspaceOwnerId,
        category: "create",
        payload: {
          createdInvestorsCount,
          createdInvestmentsCount,
          createdProductsCount,
          updatedProductsCount,
        },
      }
    );
  });

  return {
    success: true,
    createdInvestorsCount,
    createdInvestmentsCount,
    createdProductsCount,
    updatedProductsCount,
  };
}
