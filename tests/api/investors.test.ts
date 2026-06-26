import { NextRequest } from "next/server";
import { describe, expect, it } from "vitest";
import { setupTestDb, WORKSPACE_ID } from "../setup";

function jsonRequest(url: string, body: unknown, method = "POST") {
  return new NextRequest(url, {
    method,
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  });
}

describe("investors and investments API", () => {
  it("creates, lists, updates, and soft-deletes investors with status filters", async () => {
    const { pool } = await setupTestDb();
    const investorsRoute = await import("@/app/api/investors/route");
    const investorRoute = await import("@/app/api/investors/[id]/route");

    const created = await investorsRoute.POST(
      jsonRequest("http://localhost/api/investors", {
        name: "Investor Baru",
        whatsapp: "081234567890",
        address: "Purworejo",
        notes: "Modal awal",
      })
    );
    const createdBody = await created.json();
    expect(created.status).toBe(200);
    expect(createdBody.investor).toMatchObject({
      name: "Investor Baru",
      isActive: 1,
    });

    const investorId = createdBody.investor.id as string;
    const active = await investorsRoute.GET(new NextRequest("http://localhost/api/investors"));
    const activeBody = await active.json();
    expect(activeBody.investors).toEqual(
      expect.arrayContaining([expect.objectContaining({ id: investorId, name: "Investor Baru" })])
    );

    const updated = await investorRoute.PATCH(
      jsonRequest(`http://localhost/api/investors/${investorId}`, { notes: "Update catatan" }, "PATCH"),
      { params: Promise.resolve({ id: investorId }) }
    );
    const updatedBody = await updated.json();
    expect(updated.status).toBe(200);
    expect(updatedBody.investor.notes).toBe("Update catatan");

    const deleted = await investorRoute.DELETE(
      new NextRequest(`http://localhost/api/investors/${investorId}`, { method: "DELETE" }),
      { params: Promise.resolve({ id: investorId }) }
    );
    const deletedBody = await deleted.json();
    expect(deleted.status).toBe(200);
    expect(deletedBody.investor.isActive).toBe(0);

    const inactive = await investorsRoute.GET(
      new NextRequest("http://localhost/api/investors?status=inactive")
    );
    const inactiveBody = await inactive.json();
    expect(inactiveBody.investors).toEqual(
      expect.arrayContaining([expect.objectContaining({ id: investorId, isActive: 0 })])
    );

    const audit = await pool.query(
      "select event_type from audit_logs where workspace_owner_id = $1 and event_type = 'INVESTOR_CREATED'",
      [WORKSPACE_ID]
    );
    expect(audit.rows).toHaveLength(1);
  });

  it("creates murabahah and goods consignment investments and updates stock/restock logs", async () => {
    const { pool } = await setupTestDb();
    const investorsRoute = await import("@/app/api/investors/route");
    const investmentsRoute = await import("@/app/api/investments/route");

    const created = await investorsRoute.POST(
      jsonRequest("http://localhost/api/investors", {
        name: "Investor Investasi",
        whatsapp: "0812",
      })
    );
    const investorId = ((await created.json()).investor as { id: string }).id;

    const money = await investmentsRoute.POST(
      jsonRequest("http://localhost/api/investments", {
        investorId,
        akadType: "murabahah_bil_wakalah",
        amount: 2_000_000,
        monthlyReturnRatePct: 2.5,
        startDate: "2026-06-10",
      })
    );
    const moneyBody = await money.json();
    expect(money.status).toBe(200);
    expect(moneyBody.investment).toMatchObject({
      investorId,
      type: "uang",
      akadType: "murabahah_bil_wakalah",
      amount: 2_000_000,
      monthlyReturnRatePct: 2.5,
    });

    const beforeStock = await pool.query("select stock from products where id = 'prd_roti'");
    expect(beforeStock.rows[0].stock).toBe(15);

    const goods = await investmentsRoute.POST(
      jsonRequest("http://localhost/api/investments", {
        investorId,
        akadType: "barang_titip_jual",
        productId: "prd_roti",
        unitCount: 10,
        unitCost: 3000,
        profitSharePerUnitPct: 15,
        startDate: "2026-06-10",
      })
    );
    const goodsBody = await goods.json();
    expect(goods.status).toBe(200);
    expect(goodsBody.investment).toMatchObject({
      investorId,
      type: "barang_titip_jual",
      akadType: "barang_titip_jual",
      productId: "prd_roti",
      unitCount: 10,
    });

    const afterStock = await pool.query("select stock from products where id = 'prd_roti'");
    expect(afterStock.rows[0].stock).toBe(25);

    const restock = await pool.query(
      "select quantity, unit_cost, note from restock_logs where workspace_owner_id = $1 and product_id = 'prd_roti'",
      [WORKSPACE_ID]
    );
    expect(restock.rows[0]).toMatchObject({
      quantity: 10,
      unit_cost: 3000,
      note: "Modal barang investor Investor Investasi",
    });

    const audit = await pool.query(
      "select event_type from audit_logs where workspace_owner_id = $1 and event_type = 'INVESTMENT_CREATED'",
      [WORKSPACE_ID]
    );
    expect(audit.rows).toHaveLength(2);
  });
});
