/**
 * Workspace isolation tests.
 *
 * Two workspace owners (A and B) each have their own products, transactions,
 * expenses, debts, and reports. This suite verifies that data from workspace A
 * never leaks into workspace B and vice-versa, including aggregate queries
 * (SUM revenue, COUNT transactions, inventory capital, etc).
 */
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { newDb } from "pg-mem";
import { drizzle } from "drizzle-orm/node-postgres";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import * as schema from "@/db/schema";

// ---------------------------------------------------------------------------
// Constants: two completely independent workspace owners
// ---------------------------------------------------------------------------
const OWNER_A = "usr_owner_a";
const OWNER_B = "usr_owner_b";

type TestDb = ReturnType<typeof newDb>;

function sqlFromMigration(fileName: string) {
  return readFileSync(join(process.cwd(), "drizzle", fileName), "utf8")
    .split("-->  statement-breakpoint")
    .map((part) => part.trim())
    .filter(Boolean);
}

function sqlFromInsforgeMigration(fileName: string) {
  return readFileSync(join(process.cwd(), "migrations", fileName), "utf8")
    .split(";")
    .map((part) => part.trim())
    .filter(Boolean);
}

function applySchema(mem: TestDb) {
  for (const fileName of [
    "0005_explicit_schema.sql",
    "0007_audit_log_enhancements.sql",
    "0006_invitations.sql",
    "0007_akad_fields.sql",
    "0008_chairman_title.sql",
    "0008_debt_items_payments.sql",
    "0009_product_sku.sql",
    "0009_shifts.sql",
    "0010_transaction_cash_change.sql",
    "0015_lonely_scarecrow.sql",
    "0016_investment_unit_amount.sql",
    "0017_debt_optional_contact_deadline.sql",
  ]) {
    for (const statement of sqlFromMigration(fileName)) {
      mem.public.none(statement);
    }
  }

  // Columns from 0014 that aren't covered by individual migrations above.
  // Can't apply 0014 in full because it re-adds columns already present.
  for (const stmt of [
    `ALTER TABLE "store_profiles" ADD COLUMN "qris_payload" text DEFAULT '' NOT NULL`,
    `ALTER TABLE "store_profiles" ADD COLUMN "qris_image_url" text DEFAULT '' NOT NULL`,
    `ALTER TABLE "store_profiles" ADD COLUMN "bank_transfer_info" text DEFAULT '' NOT NULL`,
  ]) {
    mem.public.none(stmt);
  }

  for (const fileName of [
    "20260810160920_transaction-occurred-at.sql",
    "20260810163000_transaction-import-batches.sql",
  ]) {
    for (const statement of sqlFromInsforgeMigration(fileName)) {
      mem.public.none(statement);
    }
  }
}

function nowIso() {
  return new Date("2026-06-11T03:00:00.000Z").toISOString();
}

// Seed two workspaces, each with their own user, store profile, products
async function seedTwoWorkspaces(
  pool: InstanceType<ReturnType<TestDb["adapters"]["createPg"]>["Pool"]>
) {
  const timestamp = nowIso();

  // Create user rows
  await pool.query(
    `insert into "user" ("id", "name", "email", "emailVerified", "createdAt", "updatedAt")
     values
       ($1, 'Owner A', 'owner_a@tokomu.test', true, $3, $3),
       ($2, 'Owner B', 'owner_b@tokomu.test', true, $3, $3)`,
    [OWNER_A, OWNER_B, timestamp]
  );

  // Create user_roles (both are pimpinan of their own workspace)
  await pool.query(
    `insert into user_roles (user_id, role, workspace_owner_id, is_active, created_at, updated_at)
     values
       ($1, 'pimpinan', $1, 1, $3, $3),
       ($2, 'pimpinan', $2, 1, $3, $3)`,
    [OWNER_A, OWNER_B, timestamp]
  );

  // Create store profiles
  await pool.query(
    `insert into store_profiles (
       user_id, store_name, store_tagline, store_address, pcm_name,
       pcm_chairman_name, pcm_address, owner_name, owner_whatsapp, city,
       business_notes, stock_alert_threshold, profit_share_pcm_pct,
       profit_share_reserve_pct, enabled_payments, created_at, updated_at
     )
     values
       ($1, 'Toko A', 'Tagline A', 'Alamat A', '', '', '', 'Owner A',
        '08111', 'Kota A', '', 5, 30, 0, $3::jsonb, $4, $4),
       ($2, 'Toko B', 'Tagline B', 'Alamat B', '', '', '', 'Owner B',
        '08222', 'Kota B', '', 5, 30, 0, $3::jsonb, $4, $4)`,
    [OWNER_A, OWNER_B, JSON.stringify(["Tunai", "QRIS", "Transfer"]), timestamp]
  );

  // Products for workspace A
  await pool.query(
    `insert into products (
       id, user_id, name, category, buy_price, sell_price, stock,
       minimum_stock, description, created_at, updated_at
     )
     values
       ('prd_a1', $1, 'Beras A', 'Sembako', 50000, 65000, 20, 2, '', $2, $2),
       ('prd_a2', $1, 'Kopi A', 'Minuman', 1000, 2000, 50, 5, '', $2, $2)`,
    [OWNER_A, timestamp]
  );

  // Products for workspace B — different products, different prices
  await pool.query(
    `insert into products (
       id, user_id, name, category, buy_price, sell_price, stock,
       minimum_stock, description, created_at, updated_at
     )
     values
       ('prd_b1', $1, 'Gula B', 'Sembako', 12000, 15000, 30, 3, '', $2, $2),
       ('prd_b2', $1, 'Teh B', 'Minuman', 500, 1000, 100, 10, '', $2, $2)`,
    [OWNER_B, timestamp]
  );
}

// ---------------------------------------------------------------------------
// Test-local setup helper
// ---------------------------------------------------------------------------
async function setupIsolationDb() {
  vi.resetModules();

  const mem = newDb({ autoCreateForeignKeyIndices: true });
  applySchema(mem);

  const adapter = mem.adapters.createPg();
  class TestPool extends adapter.Pool {
    async query(config: unknown, values?: unknown, callback?: unknown) {
      if (
        config &&
        typeof config === "object" &&
        ("types" in config || "rowMode" in config)
      ) {
        const { rowMode, ...rest } = config as Record<string, unknown>;
        delete rest.types;
        const result = await super.query(rest, values as never, callback as never);
        if (rowMode === "array" && Array.isArray(result?.rows)) {
          return {
            ...result,
            rows: result.rows.map((row: Record<string, unknown>) =>
              Object.values(row)
            ),
          };
        }
        return result;
      }
      return super.query(config as never, values as never, callback as never);
    }
  }
  const pool = new TestPool();
  const db = drizzle({ client: pool as never, schema });

  await seedTwoWorkspaces(pool);

  vi.doMock("@/db/client", () => ({ db, pool }));
  vi.doMock("@/lib/auth", () => ({
    auth: {
      api: {
        getSession: vi.fn(async () => ({
          user: { id: OWNER_A, name: "Owner A", email: "owner_a@tokomu.test" },
        })),
      },
    },
  }));
  vi.doMock("next/headers", () => ({
    headers: vi.fn(async () => new Headers()),
  }));

  return { mem, pool, db };
}

afterEach(() => {
  vi.restoreAllMocks();
  vi.resetModules();
});

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------
describe("Workspace isolation", () => {
  it("bootstrap state only contains data from the correct workspace", async () => {
    await setupIsolationDb();
    const { getBootstrapState } = await import("@/lib/server/app-service");

    const stateA = await getBootstrapState(OWNER_A);
    const stateB = await getBootstrapState(OWNER_B);

    // Workspace A should see only its products
    expect(stateA.products).toHaveLength(2);
    expect(stateA.products.map((p) => p.id).sort()).toEqual(["prd_a1", "prd_a2"]);

    // Workspace B should see only its products
    expect(stateB.products).toHaveLength(2);
    expect(stateB.products.map((p) => p.id).sort()).toEqual(["prd_b1", "prd_b2"]);

    // No products from A in B
    expect(stateB.products.find((p) => p.id.startsWith("prd_a"))).toBeUndefined();
    // No products from B in A
    expect(stateA.products.find((p) => p.id.startsWith("prd_b"))).toBeUndefined();

    // Settings should match respective workspace
    expect(stateA.settings.storeName).toBe("Toko A");
    expect(stateB.settings.storeName).toBe("Toko B");
  });

  it("transactions created in workspace A are invisible to workspace B", async () => {
    await setupIsolationDb();
    const { createTransaction, getBootstrapState } = await import(
      "@/lib/server/app-service"
    );

    // Create a transaction in workspace A
    const result = await createTransaction(OWNER_A, {
      paymentMethod: "Tunai",
      paidAmount: 10000,
      items: [{ productId: "prd_a2", quantity: 3 }],
    });
    expect(result.transaction.total).toBe(6000); // 3 * 2000

    // Workspace B should have zero transactions
    const stateB = await getBootstrapState(OWNER_B);
    expect(stateB.transactions).toHaveLength(0);

    // Workspace A should have exactly one transaction
    const stateA = await getBootstrapState(OWNER_A);
    expect(stateA.transactions).toHaveLength(1);
    expect(stateA.transactions[0].total).toBe(6000);

    // Workspace B stock should be unaffected
    const productB2 = stateB.products.find((p) => p.id === "prd_b2");
    expect(productB2?.stock).toBe(100);
  });

  it("expenses created in workspace A do not affect workspace B", async () => {
    await setupIsolationDb();
    const { createExpense, getBootstrapState } = await import(
      "@/lib/server/app-service"
    );

    // Create expenses in workspace A
    await createExpense(OWNER_A, {
      title: "Listrik A",
      amount: 500000,
      category: "Operasional",
    });
    await createExpense(OWNER_A, {
      title: "Air A",
      amount: 100000,
      category: "Operasional",
    });

    const stateA = await getBootstrapState(OWNER_A);
    const stateB = await getBootstrapState(OWNER_B);

    expect(stateA.expenses).toHaveLength(2);
    expect(stateA.expenses.reduce((sum, e) => sum + e.amount, 0)).toBe(600000);

    // Workspace B should have zero expenses
    expect(stateB.expenses).toHaveLength(0);
  });

  it("debts created in workspace A are invisible to workspace B", async () => {
    await setupIsolationDb();
    const { createDebt, getBootstrapState } = await import(
      "@/lib/server/app-service"
    );

    // Create a debt in workspace A
    await createDebt(OWNER_A, {
      borrowerName: "Pak Budi",
      whatsapp: "08112345678",
      amount: 250000,
      items: [],
    });

    const stateA = await getBootstrapState(OWNER_A);
    const stateB = await getBootstrapState(OWNER_B);

    expect(stateA.debts).toHaveLength(1);
    expect(stateA.debts[0].borrowerName).toBe("Pak Budi");

    // Workspace B should have zero debts
    expect(stateB.debts).toHaveLength(0);
  });

  it("aggregate revenue from workspace A does not leak into workspace B", async () => {
    await setupIsolationDb();
    const { createTransaction } = await import("@/lib/server/app-service");
    const { createScopedQuery } = await import("@/lib/server/scoped-query");

    // Create transactions in both workspaces
    await createTransaction(OWNER_A, {
      paymentMethod: "Tunai",
      paidAmount: 130000,
      items: [{ productId: "prd_a1", quantity: 2 }], // 2 * 65000 = 130000
    });

    await createTransaction(OWNER_B, {
      paymentMethod: "Tunai",
      paidAmount: 15000,
      items: [{ productId: "prd_b1", quantity: 1 }], // 1 * 15000 = 15000
    });

    // Use scoped query to verify aggregates
    const qA = createScopedQuery(OWNER_A);
    const qB = createScopedQuery(OWNER_B);

    const revenueA = await qA.totalRevenue(
      "2026-01-01T00:00:00.000Z",
      "2027-01-01T00:00:00.000Z"
    );
    const revenueB = await qB.totalRevenue(
      "2026-01-01T00:00:00.000Z",
      "2027-01-01T00:00:00.000Z"
    );

    expect(revenueA).toBe(130000);
    expect(revenueB).toBe(15000);

    // Inventory capital should also be isolated
    const capitalA = await qA.inventoryCapital();
    const capitalB = await qB.inventoryCapital();

    // Workspace A: (20-2)*50000 + 50*1000 = 900000 + 50000 = 950000
    expect(capitalA).toBe(950000);
    // Workspace B: (30-1)*12000 + 100*500 = 348000 + 50000 = 398000
    expect(capitalB).toBe(398000);
  });

  it("resetting workspace A does not affect workspace B data", async () => {
    await setupIsolationDb();
    const { createTransaction, getBootstrapState, resetWorkspace } =
      await import("@/lib/server/app-service");

    // Create data in both workspaces
    await createTransaction(OWNER_A, {
      paymentMethod: "Tunai",
      paidAmount: 65000,
      items: [{ productId: "prd_a1", quantity: 1 }],
    });
    await createTransaction(OWNER_B, {
      paymentMethod: "Tunai",
      paidAmount: 15000,
      items: [{ productId: "prd_b1", quantity: 1 }],
    });

    // Verify both have data
    const beforeA = await getBootstrapState(OWNER_A);
    const beforeB = await getBootstrapState(OWNER_B);
    expect(beforeA.transactions).toHaveLength(1);
    expect(beforeB.transactions).toHaveLength(1);
    expect(beforeA.products).toHaveLength(2);
    expect(beforeB.products).toHaveLength(2);

    // Reset workspace A — this destroys all of A's data
    await resetWorkspace(OWNER_A);

    // Workspace A should be empty (fresh)
    const afterA = await getBootstrapState(OWNER_A);
    expect(afterA.transactions).toHaveLength(0);
    expect(afterA.products).toHaveLength(0);
    expect(afterA.settings.storeName).toBe("Warung Baru"); // default

    // Workspace B should be COMPLETELY UNAFFECTED
    const afterB = await getBootstrapState(OWNER_B);
    expect(afterB.transactions).toHaveLength(1);
    expect(afterB.transactions[0].total).toBe(15000);
    expect(afterB.products).toHaveLength(2);
    expect(afterB.products.map((p) => p.id).sort()).toEqual(["prd_b1", "prd_b2"]);
    expect(afterB.settings.storeName).toBe("Toko B");
  });
});
