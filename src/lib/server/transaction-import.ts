import * as XLSX from "xlsx";
import { and, eq, inArray } from "drizzle-orm";
import { db, pool } from "@/db/client";
import { auditLogs, products, transactionImportBatches, transactionItems, transactions } from "@/db/schema";
import { notFoundError } from "@/lib/server/route-error";

type PaymentMethod = "Tunai" | "QRIS" | "Transfer";
type IssueCode = "PRODUK_TIDAK_DITEMUKAN" | "TANGGAL_TIDAK_VALID" | "JUMLAH_TIDAK_VALID" | "KOLOM_WAJIB_KOSONG" | "METODE_BAYAR_TIDAK_DIKENAL";
export type ImportIssue = {
  row: number;
  code: IssueCode | "STOK_MINUS" | "NOTA_SUDAH_ADA" | "HARGA_BEDA_DARI_MASTER" | "MARGIN_MINUS";
  message: string;
  rowData?: Record<string, unknown>;
};

type ImportItem = {
  row: number; productId: string; productName: string; quantity: number; unitPrice: number; costPrice: number;
};
type ImportInvoice = { note: string; externalRef: string; occurredAt: string; paymentMethod: PaymentMethod; items: ImportItem[]; total: number };
export type ImportPreview = {
  invoiceCount: number; itemCount: number; totalAmount: number; dateRange: { start: string; end: string } | null;
  errors: ImportIssue[]; warnings: ImportIssue[]; invoices: ImportInvoice[];
};

const REQUIRED_COLUMNS = ["Tanggal", "No Nota", "Metode Bayar", "Nama Produk", "Jumlah", "Harga Jual", "Subtotal"] as const;
const paymentMethods: Record<string, PaymentMethod> = { tunai: "Tunai", qris: "QRIS", transfer: "Transfer" };
const newId = (prefix: string) => `${prefix}_${crypto.randomUUID().slice(0, 12)}`;
const normalized = (value: unknown) => String(value ?? "").trim().replace(/\s+/g, " ").toLocaleLowerCase("id-ID");

function addIssue(
  destination: ImportIssue[],
  row: number,
  code: ImportIssue["code"],
  message: string,
  rowData?: Record<string, unknown>
) {
  destination.push({ row, code, message, ...(rowData ? { rowData } : {}) });
}

function amount(value: unknown) {
  const compact = String(value ?? "").trim().replace(/[Rp\s.]/g, "").replace(",", ".");
  const parsed = Number(compact);
  return Number.isFinite(parsed) ? parsed : Number.NaN;
}

function occurredAt(value: unknown): string | null {
  if (typeof value === "number" && Number.isFinite(value)) {
    const parts = XLSX.SSF.parse_date_code(value);
    if (parts) return new Date(Date.UTC(parts.y, parts.m - 1, parts.d, 12)).toISOString();
  }
  const source = String(value ?? "").trim();
  const iso = /^(\d{4})-(\d{2})-(\d{2})$/.exec(source);
  const dmy = /^(\d{1,2})[/-](\d{1,2})[/-](\d{4})$/.exec(source);
  const date = iso ? new Date(`${source}T12:00:00.000Z`) : dmy ? new Date(Date.UTC(Number(dmy[3]), Number(dmy[2]) - 1, Number(dmy[1]), 12)) : null;
  return date && !Number.isNaN(date.getTime()) ? date.toISOString() : null;
}

function ref(note: string, occurred: string) {
  const date = occurred.slice(0, 10).replaceAll("-", "");
  const suffix = note.trim().replace(/^BF-\d{8}-/i, "").replace(/[^a-zA-Z0-9-]/g, "");
  return `BF-${date}-${suffix}`;
}

function sheetRows(file: ArrayBuffer) {
  const book = XLSX.read(file, { type: "array", cellDates: false });
  const sheet = book.Sheets[book.SheetNames[0] ?? ""];
  if (!sheet) throw new Error("File tidak memiliki sheet.");
  return XLSX.utils.sheet_to_json<Record<string, unknown>>(sheet, { defval: "", raw: true });
}

export async function previewTransactionImport(workspaceOwnerId: string, file: ArrayBuffer): Promise<ImportPreview> {
  const rows = sheetRows(file);
  const productRows = await db.select().from(products).where(eq(products.userId, workspaceOwnerId));
  const exact = new Map(productRows.map((p) => [p.name, p]));
  const relaxed = new Map(productRows.map((p) => [normalized(p.name), p]));
  const errors: ImportIssue[] = [];
  const warnings: ImportIssue[] = [];
  const invoices = new Map<string, ImportInvoice>();

  rows.forEach((row, index) => {
    const rowNumber = index + 2;
    for (const column of REQUIRED_COLUMNS) {
      if (String(row[column] ?? "").trim() === "") addIssue(errors, rowNumber, "KOLOM_WAJIB_KOSONG", `${column} wajib diisi.`, row);
    }
    const date = occurredAt(row.Tanggal);
    if (!date) addIssue(errors, rowNumber, "TANGGAL_TIDAK_VALID", "Tanggal tidak valid.", row);
    const quantity = amount(row.Jumlah);
    if (!Number.isInteger(quantity) || quantity <= 0) addIssue(errors, rowNumber, "JUMLAH_TIDAK_VALID", "Jumlah harus bilangan bulat lebih dari nol.", row);
    const payment = paymentMethods[normalized(row["Metode Bayar"])];
    if (!payment) addIssue(errors, rowNumber, "METODE_BAYAR_TIDAK_DIKENAL", "Metode bayar tidak dikenal.", row);
    const product = exact.get(String(row["Nama Produk"] ?? "").trim()) ?? relaxed.get(normalized(row["Nama Produk"]));
    if (!product) addIssue(errors, rowNumber, "PRODUK_TIDAK_DITEMUKAN", `Produk '${row["Nama Produk"]}' tidak ditemukan.`, row);
    const price = amount(row["Harga Jual"]);
    if (!Number.isFinite(price) || price < 0) addIssue(errors, rowNumber, "KOLOM_WAJIB_KOSONG", "Harga Jual tidak valid.", row);
    if (!date || !product || !payment || !Number.isInteger(quantity) || quantity <= 0 || !Number.isFinite(price) || price < 0) return;

    if (price !== product.sellPrice) addIssue(warnings, rowNumber, "HARGA_BEDA_DARI_MASTER", `Harga jual berbeda dari master ${product.name}.`, row);
    if (price < product.buyPrice) addIssue(warnings, rowNumber, "MARGIN_MINUS", `Harga jual ${product.name} di bawah HPP.`, row);
    const note = String(row["No Nota"]).trim();
    const key = `${date}:${note}`;
    const invoice = invoices.get(key) ?? { note, externalRef: ref(note, date), occurredAt: date, paymentMethod: payment, items: [], total: 0 };
    invoice.items.push({ row: rowNumber, productId: product.id, productName: product.name, quantity, unitPrice: price, costPrice: product.buyPrice });
    invoice.total += quantity * price;
    invoices.set(key, invoice);
  });

  const invoiceList = [...invoices.values()];
  const existingRefs = invoiceList.length === 0 ? [] : await db.select({ externalRef: transactions.externalRef }).from(transactions).where(and(eq(transactions.userId, workspaceOwnerId), inArray(transactions.externalRef, invoiceList.map((invoice) => invoice.externalRef))));
  const existing = new Set(existingRefs.flatMap((row) => row.externalRef ? [row.externalRef] : []));
  for (const invoice of invoiceList) if (existing.has(invoice.externalRef)) addIssue(warnings, invoice.items[0]?.row ?? 0, "NOTA_SUDAH_ADA", `Nota ${invoice.note} sudah pernah diimpor.`);
  const demanded = new Map<string, number>();
  for (const invoice of invoiceList) for (const item of invoice.items) demanded.set(item.productId, (demanded.get(item.productId) ?? 0) + item.quantity);
  for (const product of productRows) if ((product.stock - (demanded.get(product.id) ?? 0)) < 0) addIssue(warnings, 0, "STOK_MINUS", `Stok ${product.name} akan menjadi minus.`);
  const dates = invoiceList.map((invoice) => invoice.occurredAt).sort();
  return { invoiceCount: invoiceList.length, itemCount: invoiceList.reduce((sum, invoice) => sum + invoice.items.length, 0), totalAmount: invoiceList.reduce((sum, invoice) => sum + invoice.total, 0), dateRange: dates.length ? { start: dates[0], end: dates.at(-1)! } : null, errors, warnings, invoices: invoiceList };
}

export type TransactionImportBatchHistory = {
  id: string;
  fileName: string;
  invoiceCount: number;
  itemCount: number;
  totalAmount: number;
  importedByName: string;
  createdAt: string;
  rolledBackAt: string | null;
};

export async function listTransactionImportBatches(workspaceOwnerId: string): Promise<TransactionImportBatchHistory[]> {
  const result = await pool.query<{
    id: string; file_name: string; invoice_count: number; item_count: number; total_amount: number;
    imported_by_user_id: string; imported_by_name: string | null; imported_by_email: string | null;
    created_at: Date | string; rolled_back_at: Date | string | null;
  }>(
    `select b.id, b.file_name, b.invoice_count, b.item_count, b.total_amount, b.imported_by_user_id, b.created_at, b.rolled_back_at,
      u.name as imported_by_name, u.email as imported_by_email
     from transaction_import_batches b
     left join "user" u on u.id = b.imported_by_user_id
     where b.workspace_owner_id = $1
     order by b.created_at desc
     limit 100`,
    [workspaceOwnerId]
  );

  return result.rows.map((row) => ({
    id: row.id,
    fileName: row.file_name,
    invoiceCount: Number(row.invoice_count),
    itemCount: Number(row.item_count),
    totalAmount: Number(row.total_amount),
    importedByName: row.imported_by_name || row.imported_by_email || row.imported_by_user_id,
    createdAt: new Date(row.created_at).toISOString(),
    rolledBackAt: row.rolled_back_at ? new Date(row.rolled_back_at).toISOString() : null,
  }));
}

export async function commitTransactionImport(input: { workspaceOwnerId: string; actorUserId: string; fileName: string; file: ArrayBuffer }) {
  const preview = await previewTransactionImport(input.workspaceOwnerId, input.file);
  if (preview.errors.length > 0) throw new Error("IMPORT_VALIDATION_FAILED");
  const batchId = newId("imp");
  const timestamp = new Date().toISOString();
  let createdInvoices = 0;
  let skippedInvoices = 0;
  await db.transaction(async (tx) => {
    const refs = preview.invoices.map((invoice) => invoice.externalRef);
    const rows = refs.length ? await tx.select({ externalRef: transactions.externalRef }).from(transactions).where(and(eq(transactions.userId, input.workspaceOwnerId), inArray(transactions.externalRef, refs))) : [];
    const existing = new Set(rows.flatMap((row) => row.externalRef ? [row.externalRef] : []));
    const accepted = preview.invoices.filter((invoice) => !existing.has(invoice.externalRef));
    skippedInvoices = preview.invoices.length - accepted.length;
    const stockDelta = new Map<string, number>();
    for (const invoice of accepted) for (const item of invoice.items) stockDelta.set(item.productId, (stockDelta.get(item.productId) ?? 0) + item.quantity);
    const productRows = stockDelta.size ? await tx.select().from(products).where(and(eq(products.userId, input.workspaceOwnerId), inArray(products.id, [...stockDelta.keys()]))) : [];
    const byId = new Map(productRows.map((product) => [product.id, product]));
    for (const [productId, quantity] of stockDelta) {
      const product = byId.get(productId);
      if (!product) throw new Error("PRODUK_TIDAK_DITEMUKAN");
      await tx.update(products).set({ stock: product.stock - quantity, updatedAt: timestamp }).where(and(eq(products.id, productId), eq(products.userId, input.workspaceOwnerId)));
    }
    for (const invoice of accepted) {
      const transactionId = newId("trx");
      await tx.insert(transactions).values({ id: transactionId, userId: input.workspaceOwnerId, total: invoice.total, paidAmount: invoice.total, changeAmount: 0, paymentMethod: invoice.paymentMethod, recordedByUserId: input.actorUserId, recordedByName: "", createdAt: timestamp, occurredAt: invoice.occurredAt, entrySource: "import", externalRef: invoice.externalRef, importBatchId: batchId });
      await tx.insert(transactionItems).values(invoice.items.map((item) => ({ id: newId("itm"), transactionId, productId: item.productId, productName: item.productName, quantity: item.quantity, unitPrice: item.unitPrice, costPrice: item.costPrice })));
    }
    createdInvoices = accepted.length;
    await tx.insert(transactionImportBatches).values({ id: batchId, workspaceOwnerId: input.workspaceOwnerId, fileName: input.fileName, invoiceCount: createdInvoices, itemCount: accepted.reduce((sum, invoice) => sum + invoice.items.length, 0), totalAmount: accepted.reduce((sum, invoice) => sum + invoice.total, 0), importedByUserId: input.actorUserId, createdAt: timestamp });
    await tx.insert(auditLogs).values({ id: newId("audit"), workspaceOwnerId: input.workspaceOwnerId, actorUserId: input.actorUserId, eventType: "TRANSACTION_IMPORT_COMMITTED", entityType: "transaction_import_batch", entityId: batchId, category: "finance", payload: { fileName: input.fileName, invoiceCount: createdInvoices, totalAmount: accepted.reduce((sum, invoice) => sum + invoice.total, 0), importedByUserId: input.actorUserId }, createdAt: timestamp });
  });
  return { batchId, createdInvoices, skippedInvoices, preview };
}

export async function rollbackTransactionImport(workspaceOwnerId: string, actorUserId: string, batchId: string) {
  const timestamp = new Date().toISOString();
  await db.transaction(async (tx) => {
    const [batch] = await tx.select().from(transactionImportBatches).where(and(eq(transactionImportBatches.id, batchId), eq(transactionImportBatches.workspaceOwnerId, workspaceOwnerId))).limit(1);
    if (!batch || batch.rolledBackAt) throw notFoundError();
    const imported = await tx.select({ id: transactions.id }).from(transactions).where(and(eq(transactions.userId, workspaceOwnerId), eq(transactions.importBatchId, batchId), eq(transactions.entrySource, "import")));
    const ids = imported.map((row) => row.id);
    const items = ids.length ? await tx.select().from(transactionItems).where(inArray(transactionItems.transactionId, ids)) : [];
    const restore = new Map<string, number>();
    for (const item of items) restore.set(item.productId, (restore.get(item.productId) ?? 0) + item.quantity);
    for (const [productId, quantity] of restore) {
      const [product] = await tx.select().from(products).where(and(eq(products.id, productId), eq(products.userId, workspaceOwnerId))).limit(1);
      if (!product) throw notFoundError();
      await tx.update(products).set({ stock: product.stock + quantity, updatedAt: timestamp }).where(and(eq(products.id, productId), eq(products.userId, workspaceOwnerId)));
    }
    if (ids.length) await tx.delete(transactionItems).where(inArray(transactionItems.transactionId, ids));
    if (ids.length) await tx.delete(transactions).where(and(eq(transactions.userId, workspaceOwnerId), eq(transactions.importBatchId, batchId), eq(transactions.entrySource, "import")));
    await tx.update(transactionImportBatches).set({ rolledBackAt: timestamp, rolledBackByUserId: actorUserId }).where(and(eq(transactionImportBatches.id, batchId), eq(transactionImportBatches.workspaceOwnerId, workspaceOwnerId)));
    await tx.insert(auditLogs).values({ id: newId("audit"), workspaceOwnerId, actorUserId, eventType: "TRANSACTION_IMPORT_ROLLED_BACK", entityType: "transaction_import_batch", entityId: batchId, category: "finance", payload: { batchId, invoiceCount: ids.length }, createdAt: timestamp });
  });
  return { batchId };
}
