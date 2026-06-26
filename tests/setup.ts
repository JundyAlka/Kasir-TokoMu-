import { readFileSync } from "node:fs";
import { join } from "node:path";
import { newDb } from "pg-mem";
import { drizzle } from "drizzle-orm/node-postgres";
import { afterEach, vi } from "vitest";
import * as schema from "@/db/schema";
import type { Role } from "@/lib/server/rbac";

export const WORKSPACE_ID = "usr_pimpinan";
export const CASHIER_ID = "usr_kasir";

type TestDb = ReturnType<typeof newDb>;

function sqlFromMigration(fileName: string) {
  return readFileSync(join(process.cwd(), "drizzle", fileName), "utf8")
    .split("--> statement-breakpoint")
    .map((part) => part.trim())
    .filter(Boolean);
}

function applySchema(mem: TestDb) {
  for (const fileName of [
    "0005_explicit_schema.sql",
    "0007_audit_log_enhancements.sql",
    "0006_invitations.sql",
    "0007_akad_fields.sql",
    "0008_debt_items_payments.sql",
    "0009_product_sku.sql",
    "0009_shifts.sql",
    "0010_transaction_cash_change.sql",
  ]) {
    for (const statement of sqlFromMigration(fileName)) {
      mem.public.none(statement);
    }
  }
}

function nowIso() {
  return new Date("2026-06-11T03:00:00.000Z").toISOString();
}

async function seedBase(pool: InstanceType<ReturnType<TestDb["adapters"]["createPg"]>["Pool"]>) {
  const timestamp = nowIso();

  await pool.query(
    `insert into "user" ("id", "name", "email", "emailVerified", "createdAt", "updatedAt")
     values
       ($1, 'Pimpinan', 'pimpinan@tokomu.test', true, $3, $3),
       ($2, 'Kasir', 'kasir@tokomu.test', true, $3, $3)`,
    [WORKSPACE_ID, CASHIER_ID, timestamp]
  );

  await pool.query(
    `insert into user_roles (user_id, role, workspace_owner_id, is_active, created_at, updated_at)
     values
       ($1, 'pimpinan', $1, 1, $3, $3),
       ($2, 'kasir', $1, 1, $3, $3)`,
    [WORKSPACE_ID, CASHIER_ID, timestamp]
  );

  await pool.query(
    `insert into store_profiles (
      user_id, store_name, store_tagline, store_address, pcm_name, pcm_chairman_name,
      pcm_address, owner_name, owner_whatsapp, city, business_notes, stock_alert_threshold,
      profit_share_pcm_pct, profit_share_reserve_pct, enabled_payments, created_at, updated_at
    )
    values ($1, 'TokoMu', 'Toko PCM', 'Jl. Pasar', 'PCM', 'Ketua PCM', 'Alamat PCM',
      'Pimpinan', '081234567890', 'Purworejo', '', 5, 0, 0, $2::jsonb, $3, $3)`,
    [WORKSPACE_ID, JSON.stringify(["Tunai", "QRIS", "Transfer"]), timestamp]
  );

  await pool.query(
    `insert into products (
      id, user_id, name, category, buy_price, sell_price, stock, minimum_stock,
      description, created_at, updated_at
    )
    values
      ('prd_beras', $1, 'Beras 5kg', 'Sembako', 50000, 65000, 10, 2, 'Beras premium', $2, $2),
      ('prd_kopi', $1, 'Kopi Sachet', 'Minuman', 1000, 2000, 20, 5, 'Kopi renceng', $2, $2),
      ('prd_roti', $1, 'Roti', 'Makanan', 3000, 5000, 15, 4, 'Roti pagi', $2, $2)`,
    [WORKSPACE_ID, timestamp]
  );
}

export async function setupTestDb(options: { role?: Role } = {}) {
  vi.resetModules();

  const mem = newDb({ autoCreateForeignKeyIndices: true });
  applySchema(mem);

  const adapter = mem.adapters.createPg();
  class TestPool extends adapter.Pool {
    async query(config: unknown, values?: unknown, callback?: unknown) {
      if (config && typeof config === "object" && ("types" in config || "rowMode" in config)) {
        const { rowMode, ...rest } = config as Record<string, unknown>;
        delete rest.types;
        const result = await super.query(rest, values as never, callback as never);
        if (rowMode === "array" && Array.isArray(result?.rows)) {
          return {
            ...result,
            rows: result.rows.map((row: Record<string, unknown>) => Object.values(row)),
          };
        }
        return result;
      }

      return super.query(config as never, values as never, callback as never);
    }
  }
  const pool = new TestPool();
  const db = drizzle({ client: pool as never, schema });

  await seedBase(pool);

  vi.doMock("@/db/client", () => ({ db, pool }));
  vi.doMock("@/lib/auth", () => ({
    auth: {
      api: {
        getSession: vi.fn(async () => ({
          user: {
            id: options.role === "kasir" ? CASHIER_ID : WORKSPACE_ID,
            name: options.role === "kasir" ? "Kasir" : "Pimpinan",
            email: options.role === "kasir" ? "kasir@tokomu.test" : "pimpinan@tokomu.test",
          },
        })),
        signUpEmail: vi.fn(
          async ({
            body,
          }: {
            body: {
              email: string;
              name: string;
              password: string;
            };
          }) => {
            const userId = `usr_${body.email.split("@")[0]?.replace(/[^a-z0-9]+/gi, "_")}`;
            const timestamp = nowIso();

            await pool.query(
              `insert into "user" ("id", "name", "email", "emailVerified", "createdAt", "updatedAt")
               values ($1, $2, $3, false, $4, $4)`,
              [userId, body.name, body.email, timestamp]
            );

            return {
              user: {
                id: userId,
                name: body.name,
                email: body.email,
              },
            };
          }
        ),
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
