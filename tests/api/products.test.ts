import { describe, expect, it } from "vitest";
import { setupTestDb, WORKSPACE_ID } from "../setup";

describe("products service", () => {
  it("creates a product with validated server-side values", async () => {
    const { pool } = await setupTestDb();
    const { createProduct } = await import("@/lib/server/app-service");

    const product = await createProduct(WORKSPACE_ID, {
      name: "  Gula Pasir  ",
      category: "Sembako",
      buyPrice: 12000,
      sellPrice: 15000,
      stock: 8,
      minimumStock: 2,
      description: "  ",
    });

    expect(product.name).toBe("Gula Pasir");
    expect(product.sellPrice).toBe(15000);

    const row = await pool.query("select name, stock from products where id = $1", [product.id]);
    expect(row.rows[0]).toMatchObject({ name: "Gula Pasir", stock: 8 });
  });

  it("rejects negative product stock", async () => {
    await setupTestDb();
    const { createProduct } = await import("@/lib/server/app-service");

    await expect(
      createProduct(WORKSPACE_ID, {
        name: "Produk Rusak",
        category: "Makanan",
        buyPrice: 1000,
        sellPrice: 2000,
        stock: -1,
        minimumStock: 0,
        description: "",
      })
    ).rejects.toThrow("Stok tidak boleh negatif");
  });

  it("updates product, restocks stock, and resets workspace data", async () => {
    const { pool } = await setupTestDb();
    const {
      createExpense,
      getBootstrapState,
      resetWorkspace,
      restockProduct,
      updateProduct,
      updateStoreSettings,
    } = await import("@/lib/server/app-service");

    const updated = await updateProduct(WORKSPACE_ID, "prd_roti", {
      name: "  Roti Coklat  ",
      category: "Makanan",
      buyPrice: 3500,
      sellPrice: 6000,
      stock: 15,
      minimumStock: 3,
      description: "Display depan",
    });
    expect(updated).toMatchObject({ name: "Roti Coklat", sellPrice: 6000 });

    const restocked = await restockProduct(WORKSPACE_ID, "prd_roti", 5);
    expect(restocked.stock).toBe(20);

    const expense = await createExpense(WORKSPACE_ID, {
      title: "Listrik",
      amount: 100000,
      category: "Utilitas",
    });
    expect(expense.amount).toBe(100000);

    const state = await getBootstrapState(WORKSPACE_ID);
    const settings = await updateStoreSettings(WORKSPACE_ID, {
      ...state.settings,
      storeName: "  TokoMu Baru  ",
      ownerWhatsapp: "081234567890",
      stockAlertThreshold: 2,
      profitSharePcmPct: 30,
      profitShareReservePct: 21,
      enabledPayments: ["Tunai", "QRIS", "Tunai"],
    });
    expect(settings.storeName).toBe("TokoMu Baru");
    expect(settings.enabledPayments).toEqual(["Tunai", "QRIS"]);
    expect(settings.stockAlertThreshold).toBe(2);

    const resetState = await resetWorkspace(WORKSPACE_ID);
    expect(resetState.products).toEqual([]);
    expect(resetState.settings.storeName).toBe("Warung Baru");

    const products = await pool.query("select count(*)::int as count from products where user_id = $1", [
      WORKSPACE_ID,
    ]);
    expect(products.rows[0].count).toBe(0);
  });
});
