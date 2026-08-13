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

function fileRequest(url: string, content = csv) {
  const form = new FormData();
  form.append("file", new Blob([content], { type: "text/csv" }), "penjualan-agustus.csv");
  return new NextRequest(url, { method: "POST", body: form });
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
