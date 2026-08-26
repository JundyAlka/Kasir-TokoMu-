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
const paymentMethods: Record<string, PaymentMethod> = { tunai: "Tunai", qris: "QRIS", transfer: "Transfer" };
const newId = (prefix: string) => `${prefix}_${crypto.randomUUID().slice(0, 12)}`;
const normalized = (value: unknown) => String(value ?? "").trim().replace(/\s+/g, " ").toLocaleLowerCase("id-ID");
const fuzzyNormalized = (value: unknown) => normalized(value).replace(/[^\p{L}\p{N}]+/gu, "");
const adjustment = (row: Record<string, unknown>) => normalized(row["Nama Produk"]).startsWith("penyesuaian");
function addIssue(destination: ImportIssue[], row: number, code: ImportIssue["code"], message: string, rowData?: Record<string, unknown>, detail: Partial<ImportIssue> = {}) { destination.push({ row, code, message, ...(rowData ? { rowData } : {}), ...detail }); }
function amount(value: unknown) { const compact = String(value ?? "").trim().replace(/[Rp\s.]/g, "").replace(",", "."); const parsed = Number(compact); return Number.isFinite(parsed) ? Math.round(parsed) : Number.NaN; }
function occurredAt(value: unknown): string | null {
  if (typeof value === "number" && Number.isFinite(value)) { const parts = XLSX.SSF.parse_date_code(value); if (parts) return new Date(Date.UTC(parts.y, parts.m - 1, parts.d, 12)).toISOString(); }
  const source = String(value ?? "").trim(); const iso = /^(\d{4})-(\d{2})-(\d{2})$/.exec(source); const dmy = /^(\d{1,2})[/-](\d{1,2})[/-](\d{4})$/.exec(source);
  const date = iso ? new Date(`${source}T12:00:00.000Z`) : dmy ? new Date(Date.UTC(Number(dmy[3]), Number(dmy[2]) - 1, Number(dmy[1]), 12)) : null;
  return date && !Number.isNaN(date.getTime()) ? date.toISOString() : null;
}
function ref(note: string, occurred: string) { const date = occurred.slice(0, 10).replaceAll("-", ""); const suffix = note.trim().replace(/^BF-\d{8}-/i, "").replace(/[^a-zA-Z0-9-]/g, ""); return `BF-${date}-${suffix}`; }
function itemShift(note: string) { return /^\s*shift\s+([^|]+)/i.exec(note)?.[1]?.trim() || null; }
function importBook(file: ArrayBuffer) { return XLSX.read(file, { type: "array", cellDates: false }); }
function rowsFromBook(book: XLSX.WorkBook) { const sheet = book.Sheets[book.SheetNames[0] ?? ""]; if (!sheet) throw new Error("File tidak memiliki sheet."); return XLSX.utils.sheet_to_json<Record<string, unknown>>(sheet, { defval: "", raw: true }); }
function declaredTotal(row: Record<string, unknown>) { const source = row["Total Nota"] ?? row.Total ?? row["Total Transaksi"]; return source === undefined || String(source).trim() === "" ? null : amount(source); }
function distance(a: string, b: string) { const previous = Array.from({ length: b.length + 1 }, (_, index) => index); for (let i = 1; i <= a.length; i += 1) { let diagonal = previous[0]; previous[0] = i; for (let j = 1; j <= b.length; j += 1) { const old = previous[j]; previous[j] = Math.min(previous[j] + 1, previous[j - 1] + 1, diagonal + Number(a[i - 1] !== b[j - 1])); diagonal = old; } } return previous[b.length]; }

function computeSimilarity(input: string, candidate: string): number {
  const normInput = normalized(input);
  const normCandidate = normalized(candidate);
  if (normInput === normCandidate) return 0;
  const fuzzyInput = fuzzyNormalized(input);
  const fuzzyCandidate = fuzzyNormalized(candidate);
  if (fuzzyInput === fuzzyCandidate) return 1;
  if (normCandidate.includes(normInput)) return 5 + Math.min(25, normCandidate.length - normInput.length);
  if (normInput.includes(normCandidate)) return 8 + Math.min(25, normInput.length - normCandidate.length);
  const inputWords = normInput.split(/\s+/).filter((w) => w.length > 1);
  const candidateWords = normCandidate.split(/\s+/).filter((w) => w.length > 1);
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
function warningGroups(warnings: ImportIssue[]) { const groups = new Map<string, { code: WarningCode; productName: string; productId?: string; count: number; issues: ImportIssue[] }>(); for (const issue of warnings) { const code = issue.code as WarningCode; const productName = issue.productName ?? issue.message; const key = `${code}:${issue.productId ?? productName}`; const group = groups.get(key) ?? { code, productName, productId: issue.productId, count: 0, issues: [] }; group.count += 1; group.issues.push(issue); groups.set(key, group); } return [...groups.values()]; }

type ImportCash = { openingCash: number | null; openingCoins: number | null; openingSavings: number | null; closingCash: number | null; closingCoins: number | null; closingSavings: number | null };
function cashRows(book: XLSX.WorkBook) { const sheetName = book.SheetNames.find((name) => normalized(name) === "kas & tabungan"); if (!sheetName) return new Map<string, ImportCash>(); const rows = XLSX.utils.sheet_to_json<Record<string, unknown>>(book.Sheets[sheetName], { defval: "", raw: true }); const values = new Map<string, ImportCash>(); for (const row of rows) { const date = occurredAt(row.Tanggal); const shift = itemShift(String(row.Shift ?? "")) ?? String(row.Shift ?? "").trim(); if (!date || !shift) continue; const read = (...keys: string[]) => { const found = keys.map((key) => row[key]).find((value) => value !== undefined && String(value).trim() !== ""); const parsed = amount(found); return Number.isFinite(parsed) ? parsed : null; }; values.set(`${date.slice(0, 10)}:${normalized(shift)}`, { openingCash: read("Kas Awal"), openingCoins: read("Receh Awal"), openingSavings: read("Tabungan Awal"), closingCash: read("Kas Akhir"), closingCoins: read("Receh Akhir"), closingSavings: read("Tabungan Akhir") }); } return values; }

export async function saveProductAlias(workspaceOwnerId: string, input: { alias: string; productId: string }) {
  const alias = input.alias.trim(); if (!alias) throw new Error("Alias produk wajib diisi.");
  const scoped = createScopedQuery(workspaceOwnerId); const product = await scoped.productById(input.productId); if (!product) throw notFoundError();
  // The database constraint is case-insensitive. Compare the normalized value
  // here too, so a user can correct an existing alias instead of hitting it.
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
  for (const [index, row] of rows.entries()) {
    const rowNumber = index + 2; const name = String(row["Nama Produk"] ?? "").trim(); const isAdjustment = adjustment(row); const date = occurredAt(row.Tanggal); const invoiceNote = String(row["No Nota"] ?? "").trim(); const subtotal = amount(row.Subtotal); const note = String(row.Catatan ?? "").trim(); const shiftName = itemShift(note);
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
    let product = exact.get(name); if (!product) product = byId.get(aliases.get(normalized(name)) ?? ""); if (!product) { const exactFuzzy = productRows.filter((candidate) => fuzzyNormalized(candidate.name) === fuzzyNormalized(name)); if (exactFuzzy.length === 1) product = exactFuzzy[0]; }
    if (!Number.isInteger(quantity) || quantity <= 0) addIssue(errors, rowNumber, "JUMLAH_TIDAK_VALID", "Jumlah harus bilangan bulat lebih dari nol.", row);
    if (!Number.isFinite(price) || price < 0) addIssue(errors, rowNumber, "KOLOM_WAJIB_KOSONG", "Harga jual tidak valid.", row);
    if (!product) addIssue(errors, rowNumber, "PRODUK_TIDAK_DITEMUKAN", `Produk '${name}' tidak ditemukan.`, row, { suggestions: suggestionsFor(name, productRows), productName: name });
    if (Number.isFinite(subtotal) && Number.isInteger(quantity) && Number.isFinite(price) && subtotal !== quantity * price) addIssue(errors, rowNumber, "TOTAL_NOTA_TIDAK_SEIMBANG", "Subtotal item tidak sama dengan jumlah x harga jual.", row);
    // A subtotal arithmetic error still forms a draft invoice so the later
    // invoice-level guard can report a non-positive total. It remains an error
    // and therefore can never be committed.
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
