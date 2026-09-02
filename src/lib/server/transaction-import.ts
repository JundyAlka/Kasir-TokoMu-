import * as XLSX from "xlsx";
import { and, eq, inArray } from "drizzle-orm";
import { db, pool } from "@/db/client";
import { auditLogs, productAliases, products, shiftSessions, shifts, transactionImportBatches, transactionItems, transactions } from "@/db/schema";
import { notFoundError } from "@/lib/server/route-error";
import { createScopedQuery } from "@/lib/server/scoped-query";

type PaymentMethod = "Tunai" | "QRIS" | "Transfer";
type ErrorCode = "PRODUK_TIDAK_DITEMUKAN" | "TANGGAL_TIDAK_VALID" | "JUMLAH_TIDAK_VALID" | "KOLOM_WAJIB_KOSONG" | "METODE_BAYAR_TIDAK_DIKENAL" | "TOTAL_NOTA_TIDAK_SEIMBANG" | "PENYESUAIAN_TANPA_INDUK" | "NOTA_TOTAL_TIDAK_WAJAR";
type WarningCode = "STOK_MINUS" | "NOTA_SUDAH_ADA" | "HARGA_BEDA_DARI_MASTER" | "MARGIN_MINUS" | "ADA_BARIS_PENYESUAIAN";
export type ProductSuggestion = { id: string; name: string; score: number };
export type ImportIssue = { row: number; code: ErrorCode | WarningCode; message: string; rowData?: Record<string, unknown>; productId?: string; productName?: string; suggestions?: ProductSuggestion[] };
type ImportItem = { row: number; productId: string | null; productName: string; quantity: number; unitPrice: number; costPrice: number; subtotal: number; isAdjustment: boolean; note: string; shiftName: string | null };
type ImportInvoice = { note: string; externalRef: string; occurredAt: string; paymentMethod: PaymentMethod; items: ImportItem[]; total: number; declaredTotal: number | null; lastRow: number };
export type ImportDateSummary = { date: string; invoiceCount: number; rowCount: number; totalAmount: number; adjustmentCount: number };
export type ImportPreview = {
  source: { rowCount: number; invoiceCount: number; totalAmount: number };
  invoiceCount: number; itemCount: number; totalAmount: number; errorRowCount: number;
  dateRange: { start: string; end: string } | null; errors: ImportIssue[]; warnings: ImportIssue[];
  warningGroups: Array<{ code: WarningCode; productName: string; productId?: string; count: number; issues: ImportIssue[] }>;
  excludedNames: Array<{ name: string; rowCount: number; totalAmount: number }>;
  invoices: ImportInvoice[]; byDate: ImportDateSummary[];
};

const REQUIRED_COLUMNS = ["Tanggal", "No Nota", "Metode Bayar", "Nama Produk", "Jumlah", "Harga Jual", "Subtotal"] as const;
const paymentMethods: Record<string, PaymentMethod> = {
  tunai: "Tunai",
  cash: "Tunai",
  kontan: "Tunai",
  qris: "QRIS",
  qr: "QRIS",
  qris_static: "QRIS",
  qris_dynamic: "QRIS",
  transfer: "Transfer",
  tf: "Transfer",
  trf: "Transfer",
  bank: "Transfer",
  bca: "Transfer",
  bri: "Transfer",
  mandiri: "Transfer",
  bni: "Transfer",
  bsi: "Transfer",
  cimb: "Transfer",
};

const HEADER_ALIASES: Record<string, string> = {
  tanggal: "Tanggal",
  tgl: "Tanggal",
  date: "Tanggal",
  waktu: "Tanggal",
  "tanggal transaksi": "Tanggal",
  "tgl transaksi": "Tanggal",
  "no nota": "No Nota",
  "no. nota": "No Nota",
  "no_nota": "No Nota",
  nonota: "No Nota",
  "nomor nota": "No Nota",
  nota: "No Nota",
  invoice: "No Nota",
  "no invoice": "No Nota",
  "no. invoice": "No Nota",
  "nomor invoice": "No Nota",
  "invoice no": "No Nota",
  "no transaksi": "No Nota",
  "metode bayar": "Metode Bayar",
  "metode_bayar": "Metode Bayar",
  metodebayar: "Metode Bayar",
  "metode pembayaran": "Metode Bayar",
  pembayaran: "Metode Bayar",
  payment: "Metode Bayar",
  "payment method": "Metode Bayar",
  "cara bayar": "Metode Bayar",
  "jenis bayar": "Metode Bayar",
  "nama produk": "Nama Produk",
  "nama_produk": "Nama Produk",
  namaproduk: "Nama Produk",
  "nama barang": "Nama Produk",
  "nama_barang": "Nama Produk",
  namabarang: "Nama Produk",
  produk: "Nama Produk",
  barang: "Nama Produk",
  item: "Nama Produk",
  "nama item": "Nama Produk",
  product: "Nama Produk",
  "product name": "Nama Produk",
  jumlah: "Jumlah",
  qty: "Jumlah",
  quantity: "Jumlah",
  banyak: "Jumlah",
  banyaknya: "Jumlah",
  jml: "Jumlah",
  kuantitas: "Jumlah",
  "harga jual": "Harga Jual",
  "harga_jual": "Harga Jual",
  hargajual: "Harga Jual",
  harga: "Harga Jual",
  price: "Harga Jual",
  "sell price": "Harga Jual",
  "unit price": "Harga Jual",
  "harga satuan": "Harga Jual",
  satuan: "Harga Jual",
  subtotal: "Subtotal",
  "sub total": "Subtotal",
  "sub_total": "Subtotal",
  "total harga": "Subtotal",
  "total item": "Subtotal",
  "jumlah harga": "Subtotal",
  catatan: "Catatan",
  note: "Catatan",
  notes: "Catatan",
  keterangan: "Catatan",
  shift: "Catatan",
  ket: "Catatan",
  "total nota": "Total Nota",
  "total_nota": "Total Nota",
  "total transaksi": "Total Nota",
  "grand total": "Total Nota",
  "total tagihan": "Total Nota",
  total: "Total Nota",
};

function normalizeRow(rawRow: Record<string, unknown>): Record<string, unknown> {
  const normalizedRow: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(rawRow)) {
    const cleanKey = String(key ?? "").trim().toLowerCase().replace(/[_\-]+/g, " ").replace(/\s+/g, " ");
    const canonical = HEADER_ALIASES[cleanKey] || key.trim();
    normalizedRow[canonical] = value;
  }
  return normalizedRow;
}

const newId = (prefix: string) => `${prefix}_${crypto.randomUUID().slice(0, 12)}`;
const normalized = (value: unknown) => String(value ?? "").trim().replace(/\s+/g, " ").toLocaleLowerCase("id-ID");
const fuzzyNormalized = (value: unknown) => normalized(value).replace(/[^\p{L}\p{N}]+/gu, "");
const adjustment = (row: Record<string, unknown>) => normalized(row["Nama Produk"]).startsWith("penyesuaian");
function addIssue(destination: ImportIssue[], row: number, code: ImportIssue["code"], message: string, rowData?: Record<string, unknown>, detail: Partial<ImportIssue> = {}) { destination.push({ row, code, message, ...(rowData ? { rowData } : {}), ...detail }); }
function amount(value: unknown) { const compact = String(value ?? "").trim().replace(/[Rp\s.]/g, "").replace(",", "."); const parsed = Number(compact); return Number.isFinite(parsed) ? Math.round(parsed) : Number.NaN; }

function smartNormalize(value: unknown): string {
  return normalized(value)
    .replace(/\bmie\b/g, "mi")
    .replace(/\bsedaap\b/g, "sedap")
    .replace(/\btelor\b/g, "telur")
    .replace(/\bcabe\b/g, "cabai")
    .replace(/\bcoklat\b/g, "cokelat")
    .replace(/\bekstra\b/g, "extra")
    .replace(/\bair mineral\b/g, "")
    .replace(/\bkemasan\b/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

function occurredAt(value: unknown): string | null {
  if (value instanceof Date && !Number.isNaN(value.getTime())) {
    return value.toISOString();
  }
  if (typeof value === "number" && Number.isFinite(value)) {
    const parts = XLSX.SSF.parse_date_code(value);
    if (parts) {
      const hours = parts.H ?? 12;
      const minutes = parts.M ?? 0;
      const seconds = Math.floor(parts.S ?? 0);
      return new Date(Date.UTC(parts.y, parts.m - 1, parts.d, hours, minutes, seconds)).toISOString();
    }
  }
  const source = String(value ?? "").trim();
  if (!source) return null;

  // Handle Excel float/integer serial numbers (e.g. "46266.555555555555" or "46266")
  const num = Number(source);
  if (!Number.isNaN(num) && num > 25569 && num < 100000) {
    const parts = XLSX.SSF.parse_date_code(num);
    if (parts) {
      const hours = parts.H ?? 12;
      const minutes = parts.M ?? 0;
      const seconds = Math.floor(parts.S ?? 0);
      return new Date(Date.UTC(parts.y, parts.m - 1, parts.d, hours, minutes, seconds)).toISOString();
    }
  }

  // Handles: 2026-09-01, 2026/09/01, 2026-9-1
  const iso = /^(\d{4})[/-](\d{1,2})[/-](\d{1,2})/.exec(source);
  if (iso) {
    return new Date(Date.UTC(Number(iso[1]), Number(iso[2]) - 1, Number(iso[3]), 12)).toISOString();
  }

  // Handles: 01/09/2026, 1-9-2026, 01-09-2026, 01.09.2026
  const dmy = /^(\d{1,2})[./-](\d{1,2})[./-](\d{4})/.exec(source);
  if (dmy) {
    return new Date(Date.UTC(Number(dmy[3]), Number(dmy[2]) - 1, Number(dmy[1]), 12)).toISOString();
  }

  // Indonesian month names: 01 September 2026, 1 Sept 2026, 01-Sep-2026
  const indonesianMonths: Record<string, number> = {
    januari: 0, jan: 0,
    februari: 1, feb: 1, pebruari: 1,
    maret: 2, mar: 2,
    april: 3, apr: 3,
    mei: 4, may: 4,
    juni: 5, jun: 5,
    juli: 6, jul: 6,
    agustus: 7, ags: 7, agu: 7, aug: 7,
    september: 8, sep: 8, sept: 8,
    oktober: 9, okt: 9, oct: 9,
    november: 10, nov: 10, nopember: 10,
    desember: 11, des: 11, dec: 11,
  };
  const wordMatch = /^(\d{1,2})[\s\-]+([a-zA-Z]+)[\s\-]+(\d{4})/.exec(source);
  if (wordMatch) {
    const month = indonesianMonths[wordMatch[2].toLowerCase()];
    if (month !== undefined) {
      return new Date(Date.UTC(Number(wordMatch[3]), month, Number(wordMatch[1]), 12)).toISOString();
    }
  }

  const parsed = new Date(source);
  return !Number.isNaN(parsed.getTime()) ? parsed.toISOString() : null;
}

function ref(note: string, occurred: string) { const date = occurred.slice(0, 10).replaceAll("-", ""); const suffix = note.trim().replace(/^BF-\d{8}-/i, "").replace(/[^a-zA-Z0-9-]/g, ""); return `BF-${date}-${suffix}`; }
function itemShift(note: string) { return /^\s*shift\s+([^|]+)/i.exec(note)?.[1]?.trim() || null; }
function importBook(file: ArrayBuffer) { return XLSX.read(file, { type: "array", cellDates: false }); }

function rowsFromBook(book: XLSX.WorkBook) {
  let chosenSheetName = book.SheetNames[0] ?? "";
  for (const name of book.SheetNames) {
    if (normalized(name) !== "kas & tabungan") {
      const sheet = book.Sheets[name];
      if (sheet) {
        const testRows = XLSX.utils.sheet_to_json<Record<string, unknown>>(sheet, { defval: "", raw: true });
        if (testRows.length > 0) {
          chosenSheetName = name;
          break;
        }
      }
    }
  }
  const sheet = book.Sheets[chosenSheetName];
  if (!sheet) throw new Error("File tidak memiliki sheet data yang valid.");
  const rows = XLSX.utils.sheet_to_json<Record<string, unknown>>(sheet, { defval: "", raw: true });
  if (rows.length === 0) throw new Error("Sheet data transaksi kosong.");
  return rows;
}

function declaredTotal(row: Record<string, unknown>) { const source = row["Total Nota"] ?? row.Total ?? row["Total Transaksi"]; return source === undefined || String(source).trim() === "" ? null : amount(source); }
function distance(a: string, b: string) { const previous = Array.from({ length: b.length + 1 }, (_, index) => index); for (let i = 1; i <= a.length; i += 1) { let diagonal = previous[0]; previous[0] = i; for (let j = 1; j <= b.length; j += 1) { const old = previous[j]; previous[j] = Math.min(previous[j] + 1, previous[j - 1] + 1, diagonal + Number(a[i - 1] !== b[j - 1])); diagonal = old; } } return previous[b.length]; }

function computeSimilarity(input: string, candidate: string): number {
  const normInput = normalized(input);
  const normCandidate = normalized(candidate);
  if (normInput === normCandidate) return 0;
  const smartInput = smartNormalize(input);
  const smartCandidate = smartNormalize(candidate);
  if (smartInput === smartCandidate) return 0;
  const fuzzyInput = fuzzyNormalized(input);
  const fuzzyCandidate = fuzzyNormalized(candidate);
  if (fuzzyInput === fuzzyCandidate) return 1;
  if (normCandidate.includes(normInput)) return 5 + Math.min(25, normCandidate.length - normInput.length);
  if (normInput.includes(normCandidate)) return 8 + Math.min(25, normInput.length - normCandidate.length);
  const inputWords = smartInput.split(/\s+/).filter((w) => w.length > 1);
  const candidateWords = smartCandidate.split(/\s+/).filter((w) => w.length > 1);
  if (inputWords.length > 0) {
    let matched = 0;
    for (const iw of inputWords) {
      if (candidateWords.some((cw) => cw === iw || cw.startsWith(iw) || iw.startsWith(cw))) matched += 1;
    }
    if (matched > 0) return 20 + Math.round((1 - matched / inputWords.length) * 30);
  }
  const lev = distance(fuzzyInput, fuzzyCandidate);
  const maxLen = Math.max(fuzzyInput.length, fuzzyCandidate.length, 1);
  if (lev / maxLen <= 0.4) return 40 + lev;
  return 100 + lev;
}

function suggestionsFor(name: string, productRows: Array<typeof products.$inferSelect>): ProductSuggestion[] {
  const seen = new Set<string>();
  const scored: ProductSuggestion[] = [];
  for (const product of productRows) {
    const key = `${product.id}:${product.name.trim().toLowerCase()}`;
    if (seen.has(key)) continue;
    seen.add(key);
    const score = computeSimilarity(name, product.name);
    if (score < 60) scored.push({ id: product.id, name: product.name, score });
  }
  return scored.sort((a, b) => a.score - b.score || a.name.localeCompare(b.name)).slice(0, 5);
}

function findBestMatchProduct(
  name: string,
  productRows: Array<typeof products.$inferSelect>,
  aliases: Map<string, string>,
  byId: Map<string, typeof products.$inferSelect>,
  exact: Map<string, typeof products.$inferSelect>
): typeof products.$inferSelect | null {
  // 1. Exact match
  const exactMatch = exact.get(name);
  if (exactMatch) return exactMatch;

  // 2. Alias match
  const aliasId = aliases.get(normalized(name)) || aliases.get(smartNormalize(name));
  if (aliasId) {
    const aliasProduct = byId.get(aliasId);
    if (aliasProduct) return aliasProduct;
  }

  // 3. Normalized match
  const normName = normalized(name);
  const normMatch = productRows.find((p) => normalized(p.name) === normName);
  if (normMatch) return normMatch;

  // 4. Smart normalized match (e.g. "Mi Sedaap Goreng" <-> "Mie Sedaap Goreng")
  const smartName = smartNormalize(name);
  const smartMatch = productRows.find((p) => smartNormalize(p.name) === smartName);
  if (smartMatch) return smartMatch;

  // 5. Non-alphanumeric fuzzy match
  const fuzzyName = fuzzyNormalized(name);
  const fuzzyMatch = productRows.find((p) => fuzzyNormalized(p.name) === fuzzyName);
  if (fuzzyMatch) return fuzzyMatch;

  // 6. Compound / slash / separator match (e.g. "Taro / Cotopie" -> "Taro")
  if (/[\/\\+,&|]/.test(name)) {
    const parts = name.split(/[\/\\+,&|]/).map((p) => p.trim()).filter((p) => p.length > 1);
    for (const part of parts) {
      const partMatch =
        exact.get(part) ||
        productRows.find((p) => normalized(p.name) === normalized(part)) ||
        productRows.find((p) => smartNormalize(p.name) === smartNormalize(part)) ||
        productRows.find((p) => fuzzyNormalized(p.name) === fuzzyNormalized(part));
      if (partMatch) return partMatch;
    }
  }

  // 7. Token set match (same words in different order, or subset)
  const nameTokens = smartName.split(/\s+/).filter((w) => w.length > 1);
  if (nameTokens.length > 0) {
    for (const p of productRows) {
      const pTokens = smartNormalize(p.name).split(/\s+/).filter((w) => w.length > 1);
      if (pTokens.length === nameTokens.length && nameTokens.every((t) => pTokens.includes(t))) {
        return p;
      }
    }
  }

  // 8. High confidence Levenshtein similarity (< 15 score difference, very close typo match)
  const suggestions = suggestionsFor(name, productRows);
  if (suggestions.length > 0 && suggestions[0].score <= 15) {
    // If only 1 suggestion or top suggestion is significantly better than 2nd suggestion
    if (suggestions.length === 1 || (suggestions[1].score - suggestions[0].score) >= 10) {
      return byId.get(suggestions[0].id) ?? null;
    }
  }

  return null;
}

function warningGroups(warnings: ImportIssue[]) { const groups = new Map<string, { code: WarningCode; productName: string; productId?: string; count: number; issues: ImportIssue[] }>(); for (const issue of warnings) { const code = issue.code as WarningCode; const productName = issue.productName ?? issue.message; const key = `${code}:${issue.productId ?? productName}`; const group = groups.get(key) ?? { code, productName, productId: issue.productId, count: 0, issues: [] }; group.count += 1; group.issues.push(issue); groups.set(key, group); } return [...groups.values()]; }

type ImportCash = { openingCash: number | null; openingCoins: number | null; openingSavings: number | null; closingCash: number | null; closingCoins: number | null; closingSavings: number | null };
function cashRows(book: XLSX.WorkBook) { const sheetName = book.SheetNames.find((name) => normalized(name) === "kas & tabungan"); if (!sheetName) return new Map<string, ImportCash>(); const rows = XLSX.utils.sheet_to_json<Record<string, unknown>>(book.Sheets[sheetName], { defval: "", raw: true }); const values = new Map<string, ImportCash>(); for (const rawRow of rows) { const row = normalizeRow(rawRow); const date = occurredAt(row.Tanggal); const shift = itemShift(String(row.Shift ?? "")) ?? String(row.Shift ?? "").trim(); if (!date || !shift) continue; const read = (...keys: string[]) => { const found = keys.map((key) => row[key]).find((value) => value !== undefined && String(value).trim() !== ""); const parsed = amount(found); return Number.isFinite(parsed) ? parsed : null; }; values.set(`${date.slice(0, 10)}:${normalized(shift)}`, { openingCash: read("Kas Awal"), openingCoins: read("Receh Awal"), openingSavings: read("Tabungan Awal"), closingCash: read("Kas Akhir"), closingCoins: read("Receh Akhir"), closingSavings: read("Tabungan Akhir") }); } return values; }

export async function saveProductAlias(workspaceOwnerId: string, input: { alias: string; productId: string }) {
  const alias = input.alias.trim(); if (!alias) throw new Error("Alias produk wajib diisi.");
  const scoped = createScopedQuery(workspaceOwnerId); const product = await scoped.productById(input.productId); if (!product) throw notFoundError();
  const existing = (await scoped.productAliasList()).find((row) => normalized(row.alias) === normalized(alias));
  const timestamp = new Date().toISOString();
  if (existing) { await db.update(productAliases).set({ productId: product.id }).where(eq(productAliases.id, existing.id)); return { ...existing, productId: product.id }; }
  const [created] = await db.insert(productAliases).values({ id: newId("pal"), userId: workspaceOwnerId, alias, productId: product.id, createdAt: timestamp }).returning();
  return created;
}

export async function previewTransactionImport(workspaceOwnerId: string, file: ArrayBuffer, options: { nonProductNames?: string[] } = {}): Promise<ImportPreview> {
  const book = importBook(file); const rows = rowsFromBook(book); const scoped = createScopedQuery(workspaceOwnerId);
  const [productRows, aliasRows] = await Promise.all([scoped.productList(), scoped.productAliasList()]);
  const exact = new Map(productRows.map((product) => [product.name, product])); const aliases = new Map(aliasRows.map((alias) => [normalized(alias.alias), alias.productId])); const byId = new Map(productRows.map((product) => [product.id, product]));
  const excluded = new Set((options.nonProductNames ?? []).map(normalized)); const errors: ImportIssue[] = []; const warnings: ImportIssue[] = []; const invoices = new Map<string, ImportInvoice>(); const adjustments: Array<{ row: number; rowData: Record<string, unknown>; occurredAt: string; paymentMethod: PaymentMethod; item: ImportItem }> = []; const excludedSummary = new Map<string, { name: string; rowCount: number; totalAmount: number }>();
  const sourceInvoices = new Set<string>(); let sourceTotal = 0; let adjustmentWarningAdded = false;
  for (const [index, rawRow] of rows.entries()) {
    const rowNumber = index + 2; const row = normalizeRow(rawRow); const name = String(row["Nama Produk"] ?? "").trim(); const isAdjustment = adjustment(row); const rawDate = row.Tanggal; const date = occurredAt(rawDate); if (date) { row.Tanggal = date.slice(0, 10); } const invoiceNote = String(row["No Nota"] ?? "").trim(); const subtotal = amount(row.Subtotal); const note = String(row.Catatan ?? "").trim(); const shiftName = itemShift(note);
    // Skip empty lines
    if (!name && !rawDate && !invoiceNote && (row.Subtotal === "" || row.Subtotal === undefined)) continue;
    if (Number.isFinite(subtotal)) sourceTotal += subtotal; if (date && invoiceNote) sourceInvoices.add(`${date}:${invoiceNote}`);
    if (!isAdjustment && excluded.has(normalized(name))) { const current = excludedSummary.get(normalized(name)) ?? { name, rowCount: 0, totalAmount: 0 }; current.rowCount += 1; current.totalAmount += Number.isFinite(subtotal) ? subtotal : 0; excludedSummary.set(normalized(name), current); continue; }
    const before = errors.length;
    for (const column of REQUIRED_COLUMNS) if (String(row[column] ?? "").trim() === "" && !(isAdjustment && ["No Nota", "Jumlah", "Harga Jual"].includes(column))) addIssue(errors, rowNumber, "KOLOM_WAJIB_KOSONG", `${column} wajib diisi.`, row);
    if (!date) addIssue(errors, rowNumber, "TANGGAL_TIDAK_VALID", "Tanggal tidak valid.", row);
    const payment = paymentMethods[normalized(row["Metode Bayar"])]; if (!payment) addIssue(errors, rowNumber, "METODE_BAYAR_TIDAK_DIKENAL", "Metode bayar tidak dikenal.", row);
    if (!Number.isFinite(subtotal)) addIssue(errors, rowNumber, "KOLOM_WAJIB_KOSONG", "Subtotal tidak valid.", row);
    const quantity = amount(row.Jumlah); const price = amount(row["Harga Jual"]);
    if (isAdjustment) {
      if (errors.length === before && date && payment && Number.isFinite(subtotal)) { adjustments.push({ row: rowNumber, rowData: row, occurredAt: date, paymentMethod: payment, item: { row: rowNumber, productId: null, productName: name, quantity: 1, unitPrice: subtotal, costPrice: 0, subtotal, isAdjustment: true, note, shiftName } }); if (!adjustmentWarningAdded) { addIssue(warnings, rowNumber, "ADA_BARIS_PENYESUAIAN", "Ada baris penyesuaian; stok tidak diubah.", row); adjustmentWarningAdded = true; } }
      continue;
    }
    const noteCandidate = /sumber\s+buku\s*:\s*([^|]+)/i.exec(note)?.[1]?.trim() || null;
    let product = findBestMatchProduct(name, productRows, aliases, byId, exact);
    if (!product && noteCandidate) {
      product = findBestMatchProduct(noteCandidate, productRows, aliases, byId, exact);
    }
    if (!Number.isInteger(quantity) || quantity <= 0) addIssue(errors, rowNumber, "JUMLAH_TIDAK_VALID", "Jumlah harus bilangan bulat lebih dari nol.", row);
    if (!Number.isFinite(price) || price < 0) addIssue(errors, rowNumber, "KOLOM_WAJIB_KOSONG", "Harga jual tidak valid.", row);
    if (!product) {
      const suggestions = suggestionsFor(name, productRows);
      if (noteCandidate && suggestions.length < 5) {
        const noteSug = suggestionsFor(noteCandidate, productRows);
        const seen = new Set(suggestions.map((s) => s.id));
        for (const s of noteSug) {
          if (!seen.has(s.id)) {
            suggestions.push(s);
            seen.add(s.id);
          }
        }
      }
      addIssue(errors, rowNumber, "PRODUK_TIDAK_DITEMUKAN", `Produk '${name}' tidak ditemukan.`, row, { suggestions, productName: name });
    }
    if (Number.isFinite(subtotal) && Number.isInteger(quantity) && Number.isFinite(price) && subtotal !== quantity * price) addIssue(errors, rowNumber, "TOTAL_NOTA_TIDAK_SEIMBANG", "Subtotal item tidak sama dengan jumlah x harga jual.", row);
    const rowHasBlockingError = errors.slice(before).some((issue) => issue.code !== "TOTAL_NOTA_TIDAK_SEIMBANG");
    if (rowHasBlockingError || !date || !payment || !product || !invoiceNote) continue;
    if (price !== product.sellPrice) addIssue(warnings, rowNumber, "HARGA_BEDA_DARI_MASTER", `Harga jual ${product.name} berbeda dari master.`, row, { productId: product.id, productName: product.name });
    if (price < product.buyPrice) addIssue(warnings, rowNumber, "MARGIN_MINUS", `Harga jual ${product.name} di bawah HPP.`, row, { productId: product.id, productName: product.name });
    const key = `${date}:${invoiceNote}`; const invoice = invoices.get(key) ?? { note: invoiceNote, externalRef: ref(invoiceNote, date), occurredAt: date, paymentMethod: payment, items: [], total: 0, declaredTotal: null, lastRow: rowNumber }; const total = declaredTotal(row); if (total !== null) { if (!Number.isFinite(total) || (invoice.declaredTotal !== null && invoice.declaredTotal !== total)) addIssue(errors, rowNumber, "TOTAL_NOTA_TIDAK_SEIMBANG", "Total nota tidak konsisten atau tidak valid.", row); else invoice.declaredTotal = total; }
    invoice.items.push({ row: rowNumber, productId: product.id, productName: product.name, quantity, unitPrice: price, costPrice: product.buyPrice, subtotal, isAdjustment: false, note, shiftName }); invoice.total += subtotal; invoice.lastRow = rowNumber; invoices.set(key, invoice);
  }
  const invoiceList = [...invoices.values()];
  for (const candidate of adjustments) { const shift = normalized(candidate.item.shiftName ?? ""); const target = invoiceList.filter((invoice) => invoice.occurredAt.slice(0, 10) === candidate.occurredAt.slice(0, 10) && invoice.lastRow < candidate.row && invoice.items.some((item) => normalized(item.shiftName ?? "") === shift)).sort((a, b) => b.lastRow - a.lastRow)[0]; if (!target) { addIssue(errors, candidate.row, "PENYESUAIAN_TANPA_INDUK", "Baris penyesuaian tidak memiliki nota produk pada tanggal dan shift yang sama.", candidate.rowData); continue; } target.items.push(candidate.item); target.total += candidate.item.subtotal; target.lastRow = Math.max(target.lastRow, candidate.row); }
  for (const invoice of invoiceList) { if (invoice.declaredTotal !== null && invoice.declaredTotal !== invoice.total) addIssue(errors, invoice.items[0]?.row ?? 0, "TOTAL_NOTA_TIDAK_SEIMBANG", `Total nota ${invoice.note} tidak sama dengan jumlah subtotal item.`); if (invoice.total <= 0) addIssue(errors, invoice.items[0]?.row ?? 0, "NOTA_TOTAL_TIDAK_WAJAR", `Total nota ${invoice.note} harus lebih dari nol.`); }
  const existingRefs = invoiceList.length ? await db.select({ externalRef: transactions.externalRef }).from(transactions).where(and(eq(transactions.userId, workspaceOwnerId), inArray(transactions.externalRef, invoiceList.map((invoice) => invoice.externalRef)))) : []; const existing = new Set(existingRefs.flatMap((row) => row.externalRef ? [row.externalRef] : [])); for (const invoice of invoiceList) if (existing.has(invoice.externalRef)) addIssue(warnings, invoice.items[0]?.row ?? 0, "NOTA_SUDAH_ADA", `Nota ${invoice.note} sudah pernah diimpor.`);
  const demanded = new Map<string, number>(); for (const invoice of invoiceList) for (const item of invoice.items) if (item.productId) demanded.set(item.productId, (demanded.get(item.productId) ?? 0) + item.quantity); for (const product of productRows) if (!product.isConsignment && product.stock - (demanded.get(product.id) ?? 0) < 0) addIssue(warnings, 0, "STOK_MINUS", `Stok ${product.name} akan menjadi minus.`, undefined, { productId: product.id, productName: product.name });
  const summary = new Map<string, ImportDateSummary>(); for (const invoice of invoiceList) { const date = invoice.occurredAt.slice(0, 10); const current = summary.get(date) ?? { date, invoiceCount: 0, rowCount: 0, totalAmount: 0, adjustmentCount: 0 }; current.invoiceCount += 1; current.rowCount += invoice.items.length; current.totalAmount += invoice.total; current.adjustmentCount += invoice.items.filter((item) => item.isAdjustment).length; summary.set(date, current); }
  const dates = invoiceList.map((invoice) => invoice.occurredAt).sort(); return { source: { rowCount: rows.length, invoiceCount: sourceInvoices.size, totalAmount: sourceTotal }, invoiceCount: invoiceList.length, itemCount: invoiceList.reduce((sum, invoice) => sum + invoice.items.length, 0), totalAmount: invoiceList.reduce((sum, invoice) => sum + invoice.total, 0), errorRowCount: new Set(errors.map((error) => error.row)).size, dateRange: dates.length ? { start: dates[0], end: dates.at(-1)! } : null, errors, warnings, warningGroups: warningGroups(warnings), excludedNames: [...excludedSummary.values()].sort((a, b) => b.totalAmount - a.totalAmount), invoices: invoiceList, byDate: [...summary.values()].sort((a, b) => a.date.localeCompare(b.date)) };
}

export type TransactionImportBatchHistory = { id: string; fileName: string; invoiceCount: number; itemCount: number; totalAmount: number; importedByName: string; createdAt: string; rolledBackAt: string | null };
export async function listTransactionImportBatches(workspaceOwnerId: string): Promise<TransactionImportBatchHistory[]> { const result = await pool.query<{ id: string; file_name: string; invoice_count: number; item_count: number; total_amount: number; imported_by_user_id: string; imported_by_name: string | null; imported_by_email: string | null; created_at: Date | string; rolled_back_at: Date | string | null }>(`select b.id, b.file_name, b.invoice_count, b.item_count, b.total_amount, b.imported_by_user_id, b.created_at, b.rolled_back_at, u.name as imported_by_name, u.email as imported_by_email from transaction_import_batches b left join "user" u on u.id = b.imported_by_user_id where b.workspace_owner_id = $1 order by b.created_at desc limit 100`, [workspaceOwnerId]); return result.rows.map((row) => ({ id: row.id, fileName: row.file_name, invoiceCount: Number(row.invoice_count), itemCount: Number(row.item_count), totalAmount: Number(row.total_amount), importedByName: row.imported_by_name || row.imported_by_email || row.imported_by_user_id, createdAt: new Date(row.created_at).toISOString(), rolledBackAt: row.rolled_back_at ? new Date(row.rolled_back_at).toISOString() : null })); }

export async function commitTransactionImport(input: { workspaceOwnerId: string; actorUserId: string; fileName: string; file: ArrayBuffer; createHistoricalShifts?: boolean; nonProductNames?: string[] }) {
  const preview = await previewTransactionImport(input.workspaceOwnerId, input.file, { nonProductNames: input.nonProductNames }); if (preview.errors.length) throw new Error("IMPORT_VALIDATION_FAILED");
  const batchId = newId("imp"); const timestamp = new Date().toISOString(); const cashByShift = cashRows(importBook(input.file)); let createdInvoices = 0; let skippedInvoices = 0;
  await db.transaction(async (tx) => {
    const refs = preview.invoices.map((invoice) => invoice.externalRef); const rows = refs.length ? await tx.select({ externalRef: transactions.externalRef }).from(transactions).where(and(eq(transactions.userId, input.workspaceOwnerId), inArray(transactions.externalRef, refs))) : []; const existing = new Set(rows.flatMap((row) => row.externalRef ? [row.externalRef] : [])); const accepted = preview.invoices.filter((invoice) => !existing.has(invoice.externalRef)); skippedInvoices = preview.invoices.length - accepted.length;
    const stockDelta = new Map<string, number>(); for (const invoice of accepted) for (const item of invoice.items) if (item.productId) stockDelta.set(item.productId, (stockDelta.get(item.productId) ?? 0) + item.quantity); const productRows = stockDelta.size ? await tx.select().from(products).where(and(eq(products.userId, input.workspaceOwnerId), inArray(products.id, [...stockDelta.keys()]))) : []; const byId = new Map(productRows.map((product) => [product.id, product])); for (const [productId, quantity] of stockDelta) { const product = byId.get(productId); if (!product) throw new Error("PRODUK_TIDAK_DITEMUKAN"); await tx.update(products).set({ stock: product.stock - quantity, updatedAt: timestamp }).where(and(eq(products.id, productId), eq(products.userId, input.workspaceOwnerId))); }
    const sessions = new Map<string, string>(); if (input.createHistoricalShifts) { const combinations = new Map<string, { date: string; shiftName: string }>(); for (const invoice of accepted) for (const item of invoice.items) if (item.shiftName) combinations.set(`${invoice.occurredAt.slice(0, 10)}:${normalized(item.shiftName)}`, { date: invoice.occurredAt.slice(0, 10), shiftName: item.shiftName }); for (const [key, value] of combinations) { const shiftId = newId("shf"); const sessionId = newId("ssn"); const cash = cashByShift.get(key); const openedAt = `${value.date}T00:00:00.000Z`; const closedAt = `${value.date}T23:59:59.999Z`; await tx.insert(shifts).values({ id: shiftId, workspaceOwnerId: input.workspaceOwnerId, name: `Impor ${value.shiftName}`, startTime: "00:00", endTime: "23:59", assignedUserId: input.actorUserId, isActive: 0, createdAt: timestamp }); await tx.insert(shiftSessions).values({ id: sessionId, workspaceOwnerId: input.workspaceOwnerId, shiftId, cashierUserId: input.actorUserId, startedAt: openedAt, endedAt: closedAt, openingCash: cash?.openingCash ?? null, openingCoins: cash?.openingCoins ?? null, openingSavings: cash?.openingSavings ?? null, closingCash: cash?.closingCash ?? null, closingCoins: cash?.closingCoins ?? null, closingSavings: cash?.closingSavings ?? null, expectedCash: null, expectedClosing: null, difference: null, variance: null, varianceNote: "Shift historis dari impor mundur.", status: "closed", openedAt, closedAt, openedByUserId: input.actorUserId, closedByUserId: input.actorUserId, needsReview: !cash }); sessions.set(key, sessionId); } }
    for (const invoice of accepted) { const transactionId = newId("trx"); const shiftNames = [...new Set(invoice.items.map((item) => item.shiftName).filter((value): value is string => Boolean(value)))]; const shiftSessionId = shiftNames.length === 1 ? sessions.get(`${invoice.occurredAt.slice(0, 10)}:${normalized(shiftNames[0])}`) ?? null : null; await tx.insert(transactions).values({ id: transactionId, userId: input.workspaceOwnerId, total: invoice.total, paidAmount: invoice.total, changeAmount: 0, paymentMethod: invoice.paymentMethod, recordedByUserId: input.actorUserId, recordedByName: "", shiftSessionId, createdAt: timestamp, occurredAt: invoice.occurredAt, entrySource: "import", externalRef: invoice.externalRef, importBatchId: batchId }); await tx.insert(transactionItems).values(invoice.items.map((item) => ({ id: newId("itm"), transactionId, productId: item.productId, productName: item.productName, quantity: item.quantity, unitPrice: item.unitPrice, costPrice: item.costPrice, isAdjustment: item.isAdjustment, note: item.note }))); }
    createdInvoices = accepted.length; await tx.insert(transactionImportBatches).values({ id: batchId, workspaceOwnerId: input.workspaceOwnerId, fileName: input.fileName, invoiceCount: createdInvoices, itemCount: accepted.reduce((sum, invoice) => sum + invoice.items.length, 0), totalAmount: accepted.reduce((sum, invoice) => sum + invoice.total, 0), importedByUserId: input.actorUserId, createdAt: timestamp }); await tx.insert(auditLogs).values({ id: newId("audit"), workspaceOwnerId: input.workspaceOwnerId, actorUserId: input.actorUserId, eventType: "TRANSACTION_IMPORT_COMMITTED", entityType: "transaction_import_batch", entityId: batchId, category: "finance", payload: { fileName: input.fileName, invoiceCount: createdInvoices, totalAmount: accepted.reduce((sum, invoice) => sum + invoice.total, 0), importedByUserId: input.actorUserId }, createdAt: timestamp });
  }); return { batchId, createdInvoices, skippedInvoices, preview };
}

export async function rollbackTransactionImport(workspaceOwnerId: string, actorUserId: string, batchId: string) { const timestamp = new Date().toISOString(); await db.transaction(async (tx) => { const [batch] = await tx.select().from(transactionImportBatches).where(and(eq(transactionImportBatches.id, batchId), eq(transactionImportBatches.workspaceOwnerId, workspaceOwnerId))).limit(1); if (!batch || batch.rolledBackAt) throw notFoundError(); const imported = await tx.select({ id: transactions.id }).from(transactions).where(and(eq(transactions.userId, workspaceOwnerId), eq(transactions.importBatchId, batchId), eq(transactions.entrySource, "import"))); const ids = imported.map((row) => row.id); const items = ids.length ? await tx.select().from(transactionItems).where(inArray(transactionItems.transactionId, ids)) : []; const restore = new Map<string, number>(); for (const item of items) if (item.productId && !item.isAdjustment) restore.set(item.productId, (restore.get(item.productId) ?? 0) + item.quantity); for (const [productId, quantity] of restore) { const [product] = await tx.select().from(products).where(and(eq(products.id, productId), eq(products.userId, workspaceOwnerId))).limit(1); if (!product) throw notFoundError(); await tx.update(products).set({ stock: product.stock + quantity, updatedAt: timestamp }).where(and(eq(products.id, productId), eq(products.userId, workspaceOwnerId))); } if (ids.length) await tx.delete(transactionItems).where(inArray(transactionItems.transactionId, ids)); if (ids.length) await tx.delete(transactions).where(and(eq(transactions.userId, workspaceOwnerId), eq(transactions.importBatchId, batchId), eq(transactions.entrySource, "import"))); await tx.update(transactionImportBatches).set({ rolledBackAt: timestamp, rolledBackByUserId: actorUserId }).where(and(eq(transactionImportBatches.id, batchId), eq(transactionImportBatches.workspaceOwnerId, workspaceOwnerId))); await tx.insert(auditLogs).values({ id: newId("audit"), workspaceOwnerId, actorUserId, eventType: "TRANSACTION_IMPORT_ROLLED_BACK", entityType: "transaction_import_batch", entityId: batchId, category: "finance", payload: { batchId, invoiceCount: ids.length }, createdAt: timestamp }); }); return { batchId }; }
