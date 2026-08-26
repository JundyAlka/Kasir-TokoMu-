import { NextRequest } from "next/server";
import { describe, expect, it } from "vitest";
import { setupTestDb, WORKSPACE_ID } from "../setup";

const csv = [
  "Tanggal,No Nota,Metode Bayar,Nama Produk,Jumlah,Harga Jual,Subtotal,Catatan",
  "2026-08-01,01,Tunai,Beras 5kg,2,65000,130000,nota pertama",
  "2026-08-01,01,Tunai,Kopi Sachet,1,2000,2000,nota pertama",
  "2026-08-02,02,QRIS,Beras 5kg,1,65000,65000,nota kedua",
  "2026-08-02,02,QRIS,Kopi Sachet,2,2000,4000,nota kedua",
  "2026-08-02,02,QRIS,Roti,1,5000,5000,nota kedua",
].join("\n");

const adjustmentCsv = [
  "Tanggal,No Nota,Metode Bayar,Nama Produk,Jumlah,Harga Jual,Subtotal,Catatan,Total Nota",
  "2026-08-09,09,Tunai,Beras 5kg,1,65000,65000,Shift PENUH | hal.25,52000",
  "2026-08-09,09,Tunai,PENYESUAIAN CATATAN BUKU,,, -13000,Shift PENUH | hal.25,52000",
].join("\n");

const adjustmentWithoutParentCsv = [
  "Tanggal,No Nota,Metode Bayar,Nama Produk,Jumlah,Harga Jual,Subtotal,Catatan",
  "2026-08-09,,Tunai,PENYESUAIAN CATATAN BUKU,,, -13000,Shift SORE | hal.25",
].join("\n");

const negativeInvoiceCsv = [
  "Tanggal,No Nota,Metode Bayar,Nama Produk,Jumlah,Harga Jual,Subtotal,Catatan",
  "2026-08-09,09,Tunai,Beras 5kg,1,65000,-65000,Shift PAGI | hal.25",
].join("\n");

function fileRequest(url: string, content = csv) {
  const form = new FormData();
  form.append("file", new Blob([content], { type: "text/csv" }), "penjualan-agustus.csv");
  return new NextRequest(url, { method: "POST", body: form });
}

function largeBackfillCsv() {
  const lines = ["Tanggal,No Nota,Metode Bayar,Nama Produk,Jumlah,Harga Jual,Subtotal,Catatan"];
  let rowIndex = 0;
  const expectedByDate = new Map<string, number>();
  for (let invoice = 1; invoice <= 196; invoice += 1) {
    const date = `2026-08-${String(((invoice - 1) % 13) + 1).padStart(2, "0")}`;
    const itemRows = invoice <= 134 ? 6 : 5;
    for (let item = 0; item < itemRows; item += 1) {
      rowIndex += 1;
      const subtotal = rowIndex === 1114 ? 53_300 : 6_900;
      lines.push(`${date},${String(invoice).padStart(3, "0")},Tunai,Kopi Lama,1,${subtotal},${subtotal},Shift PAGI | buku`);
      expectedByDate.set(date, (expectedByDate.get(date) ?? 0) + subtotal);
    }
  }
  return { csv: lines.join("\n"), expectedByDate };
}

describe("transaction import API", () => {
  it("preview reports an unknown product without writing transactions", async () => {
    const { pool } = await setupTestDb();
    const { POST } = await import("@/app/api/transactions/import/preview/route");
    const response = await POST(fileRequest("http://localhost/api/transactions/import/preview", csv.replace("Beras 5kg", "Produk Tidak Ada")));
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.errors).toEqual(expect.arrayContaining([expect.objectContaining({ code: "PRODUK_TIDAK_DITEMUKAN" })]));
    expect((await pool.query("select count(*)::int as total from transactions")).rows[0]?.total).toBe(0);
  });

  it("does not commit any invoice when even one imported row has an error", async () => {
    const { pool } = await setupTestDb();
    const { POST } = await import("@/app/api/transactions/import/commit/route");
    const response = await POST(fileRequest("http://localhost/api/transactions/import/commit", csv.replace("Beras 5kg", "Produk Tidak Ada")));
    expect(response.status).toBe(400);
    expect((await pool.query("select count(*)::int as total from transactions")).rows[0]?.total).toBe(0);
  });

  it("rejects an adjustment line that has no valid parent invoice in its date and shift", async () => {
    const { pool } = await setupTestDb();
    const { POST } = await import("@/app/api/transactions/import/preview/route");
    const body = await (await POST(fileRequest("http://localhost/api/transactions/import/preview", adjustmentWithoutParentCsv))).json();
    expect(body.errors).toEqual(expect.arrayContaining([expect.objectContaining({ code: "PENYESUAIAN_TANPA_INDUK" })]));
  });

  it("rejects a non-positive invoice total", async () => {
    await setupTestDb();
    const { POST } = await import("@/app/api/transactions/import/preview/route");
    const body = await (await POST(fileRequest("http://localhost/api/transactions/import/preview", negativeInvoiceCsv))).json();
    expect(body.errors).toEqual(expect.arrayContaining([expect.objectContaining({ code: "NOTA_TOTAL_TIDAK_WAJAR" })]));
  });

  it("uses a saved alias on the next preview without unknown-product errors", async () => {
    await setupTestDb();
    const { POST: saveAlias } = await import("@/app/api/transactions/import/aliases/route");
    const aliasResponse = await saveAlias(new NextRequest("http://localhost/api/transactions/import/aliases", {
      method: "POST",
      body: JSON.stringify({ alias: "Kopi Lama", productId: "prd_kopi" }),
      headers: { "content-type": "application/json" },
    }));
    expect(aliasResponse.status).toBe(200);
    const { POST: preview } = await import("@/app/api/transactions/import/preview/route");
    const body = await (await preview(fileRequest("http://localhost/api/transactions/import/preview", csv.replaceAll("Beras 5kg", "Kopi Lama")))).json();
    expect(body.errors).not.toEqual(expect.arrayContaining([expect.objectContaining({ code: "PRODUK_TIDAK_DITEMUKAN" })]));
  });

  it("does not warn about negative stock for a consignment product", async () => {
    const { pool } = await setupTestDb();
    await pool.query("update products set is_consignment = true where id = 'prd_kopi'");
    const { POST } = await import("@/app/api/transactions/import/preview/route");
    const body = await (await POST(fileRequest("http://localhost/api/transactions/import/preview", [
      "Tanggal,No Nota,Metode Bayar,Nama Produk,Jumlah,Harga Jual,Subtotal,Catatan",
      "2026-08-01,01,Tunai,Kopi Sachet,100,2000,200000,Shift PAGI",
    ].join("\n")))).json();
    expect(body.warnings).not.toEqual(expect.arrayContaining([expect.objectContaining({ code: "STOK_MINUS", message: expect.stringContaining("Kopi Sachet") })]));
  });

  it("previews all 1,114 mapped rows as 196 invoices totaling Rp7,733,000 with exact daily totals", async () => {
    const { pool } = await setupTestDb();
    const { csv: fullCsv, expectedByDate } = largeBackfillCsv();
    const { POST: saveAlias } = await import("@/app/api/transactions/import/aliases/route");
    await saveAlias(new NextRequest("http://localhost/api/transactions/import/aliases", {
      method: "POST", body: JSON.stringify({ alias: "Kopi Lama", productId: "prd_kopi" }), headers: { "content-type": "application/json" },
    }));
    const { POST } = await import("@/app/api/transactions/import/preview/route");
    const body = await (await POST(fileRequest("http://localhost/api/transactions/import/preview", fullCsv))).json();
    expect(body.errors).toEqual([]);
    expect(body.source).toMatchObject({ rowCount: 1114, invoiceCount: 196, totalAmount: 7_733_000 });
    expect(body.invoiceCount).toBe(196);
    expect(body.itemCount).toBe(1114);
    expect(body.totalAmount).toBe(7_733_000);
    for (const day of body.byDate) expect(day.totalAmount).toBe(expectedByDate.get(day.date));

    const { POST: commit } = await import("@/app/api/transactions/import/commit/route");
    const committed = await (await commit(fileRequest("http://localhost/api/transactions/import/commit", fullCsv))).json();
    expect(committed).toMatchObject({ createdInvoices: 196, skippedInvoices: 0 });
    expect((await pool.query("select coalesce(sum(total), 0)::int as total from transactions where entry_source = 'import'"))
      .rows[0]?.total).toBe(7_733_000);
  });

  it("commits two invoices with event dates and exact stock reductions", async () => {
    const { pool } = await setupTestDb();
    const { POST } = await import("@/app/api/transactions/import/commit/route");
    const response = await POST(fileRequest("http://localhost/api/transactions/import/commit"));
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body).toMatchObject({ createdInvoices: 2, skippedInvoices: 0 });
    const imported = await pool.query(
      "select occurred_at, entry_source from transactions where import_batch_id = $1 order by occurred_at",
      [body.batchId]
    );
    expect(imported.rows).toHaveLength(2);
    expect(imported.rows.map((row: { entry_source: string }) => row.entry_source)).toEqual(["import", "import"]);
    expect(imported.rows[0]?.occurred_at.toISOString().startsWith("2026-08-01")).toBe(true);
    expect((await pool.query("select stock from products where id = 'prd_beras'")).rows[0]?.stock).toBe(7);
    expect((await pool.query("select stock from products where id = 'prd_kopi'")).rows[0]?.stock).toBe(17);
  });

  it("skips every invoice when the identical file is committed twice", async () => {
    await setupTestDb();
    const { POST } = await import("@/app/api/transactions/import/commit/route");
    await POST(fileRequest("http://localhost/api/transactions/import/commit"));
    const second = await POST(fileRequest("http://localhost/api/transactions/import/commit"));

    expect(await second.json()).toMatchObject({ createdInvoices: 0, skippedInvoices: 2 });
  });

  it("accepts a negative adjustment without changing stock, keeps the invoice balanced, and creates a closed historical shift", async () => {
    const { pool } = await setupTestDb();
    const { POST: preview } = await import("@/app/api/transactions/import/preview/route");
    const previewResponse = await preview(fileRequest("http://localhost/api/transactions/import/preview", adjustmentCsv));
    const previewBody = await previewResponse.json();
    expect(previewBody.errors).toEqual([]);
    expect(previewBody.warnings).toEqual(expect.arrayContaining([expect.objectContaining({ code: "ADA_BARIS_PENYESUAIAN" })]));
    expect(previewBody.byDate).toEqual([expect.objectContaining({ date: "2026-08-09", invoiceCount: 1, rowCount: 2, adjustmentCount: 1, totalAmount: 52000 })]);
    const { POST: commit } = await import("@/app/api/transactions/import/commit/route");
    const form = new FormData(); form.append("file", new Blob([adjustmentCsv], { type: "text/csv" }), "backfill.csv"); form.append("createHistoricalShifts", "true");
    const result = await (await commit(new NextRequest("http://localhost/api/transactions/import/commit", { method: "POST", body: form }))).json();
    expect(result.createdInvoices).toBe(1);
    expect((await pool.query("select stock from products where id = 'prd_beras'")).rows[0]?.stock).toBe(9);
    expect((await pool.query("select total from transactions where import_batch_id = $1", [result.batchId])).rows[0]?.total).toBe(52000);
    expect((await pool.query("select product_id, is_adjustment, unit_price, note from transaction_items where transaction_id = (select id from transactions where import_batch_id = $1)", [result.batchId])).rows).toEqual(expect.arrayContaining([expect.objectContaining({ product_id: null, is_adjustment: true, unit_price: -13000, note: "Shift PENUH | hal.25" })]));
    expect((await pool.query("select status, needs_review from shift_sessions where workspace_owner_id = $1", [WORKSPACE_ID])).rows).toEqual([expect.objectContaining({ status: "closed", needs_review: true })]);
  });

  it("rejects one invoice whose declared header total is not its item subtotals", async () => {
    await setupTestDb();
    const { POST } = await import("@/app/api/transactions/import/preview/route");
    const response = await POST(fileRequest("http://localhost/api/transactions/import/preview", adjustmentCsv.replace(",52000", ",51000")));
    expect((await response.json()).errors).toEqual(expect.arrayContaining([expect.objectContaining({ code: "TOTAL_NOTA_TIDAK_SEIMBANG" })]));
  });

  it("rolls back only imported transactions and restores stock", async () => {
    const { pool } = await setupTestDb();
    const { POST: commit } = await import("@/app/api/transactions/import/commit/route");
    const committed = await (await commit(fileRequest("http://localhost/api/transactions/import/commit"))).json();
    const { createTransaction } = await import("@/lib/server/app-service");
    await createTransaction(WORKSPACE_ID, {
      paymentMethod: "Tunai",
      paidAmount: 65000,
      items: [{ productId: "prd_beras", quantity: 1 }],
    });

    const { POST: rollback } = await import("@/app/api/transactions/import/rollback/route");
    const response = await rollback(
      new NextRequest("http://localhost/api/transactions/import/rollback", {
        method: "POST",
        body: JSON.stringify({ batchId: committed.batchId }),
        headers: { "content-type": "application/json" },
      })
    );

    expect(response.status).toBe(200);
    expect((await pool.query("select count(*)::int as total from transactions where entry_source = 'import'")).rows[0]?.total).toBe(0);
    expect((await pool.query("select count(*)::int as total from transactions where entry_source = 'pos'")).rows[0]?.total).toBe(1);
    expect((await pool.query("select stock from products where id = 'prd_beras'")).rows[0]?.stock).toBe(9);
  });

  it("rejects kasir from preview, commit, and rollback", async () => {
    await setupTestDb({ role: "kasir" });
    const preview = await import("@/app/api/transactions/import/preview/route");
    const commit = await import("@/app/api/transactions/import/commit/route");
    const rollback = await import("@/app/api/transactions/import/rollback/route");

    expect((await preview.POST(fileRequest("http://localhost/api/transactions/import/preview"))).status).toBe(403);
    expect((await commit.POST(fileRequest("http://localhost/api/transactions/import/commit"))).status).toBe(403);
    expect((await rollback.POST(new NextRequest("http://localhost/api/transactions/import/rollback", { method: "POST", body: "{}" }))).status).toBe(403);
  });

  it("returns 404 when another workspace tries to roll back a batch", async () => {
    const { pool } = await setupTestDb();
    await pool.query(
      `insert into transaction_import_batches (id, workspace_owner_id, file_name, invoice_count, item_count, total_amount, imported_by_user_id, created_at)
       values ('batch_other', 'workspace_other', 'other.csv', 1, 1, 1000, 'other_user', '2026-08-01T00:00:00.000Z')`
    );
    const { POST } = await import("@/app/api/transactions/import/rollback/route");
    const response = await POST(new NextRequest("http://localhost/api/transactions/import/rollback", {
      method: "POST",
      body: JSON.stringify({ batchId: "batch_other" }),
      headers: { "content-type": "application/json" },
    }));
    expect(response.status).toBe(404);
  });

  it("lists only the workspace import batches with the importer name", async () => {
    await setupTestDb();
    const { POST: commit } = await import("@/app/api/transactions/import/commit/route");
    await commit(fileRequest("http://localhost/api/transactions/import/commit"));
    const { GET } = await import("@/app/api/transactions/import/route");
    const response = await GET();

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toMatchObject({
      batches: [expect.objectContaining({ fileName: "penjualan-agustus.csv", importedByName: "Pimpinan" })],
    });
  });
});
