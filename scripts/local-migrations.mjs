import { readFile, readdir } from "node:fs/promises";
import { existsSync, readFileSync } from "node:fs";
import { join, resolve } from "node:path";
import { pathToFileURL } from "node:url";
import pg from "pg";

const { Pool } = pg;
const LOCAL_MIGRATION_START = "20260810160920";
const TRACKING_TABLE = "local_app_migrations";
const defaultLocalUrl = "postgresql://postgres:postgres@127.0.0.1:5439/warungos";

function loadLocalEnvironment() {
  const envPath = resolve(".env.local");
  if (!existsSync(envPath)) return;

  const source = readFileSync(envPath, "utf8");
  for (const line of source.split(/\r?\n/)) {
    const match = line.match(/^\s*([A-Z0-9_]+)=(.*)$/);
    if (!match) continue;
    const [, key, rawValue] = match;
    if (process.env[key] !== undefined) continue;
    process.env[key] = rawValue.trim().replace(/^['\"]|['\"]$/g, "");
  }
}

function localDatabaseUrl() {
  loadLocalEnvironment();
  const value = process.env.LOCAL_DATABASE_URL ?? process.env.DATABASE_URL ?? defaultLocalUrl;
  const parsed = new URL(value);
  const localHosts = new Set(["localhost", "127.0.0.1", "::1"]);

  if (!localHosts.has(parsed.hostname) || (parsed.port && parsed.port !== "5439")) {
    throw new Error("DATABASE_URL lokal harus menunjuk ke localhost:5439. Gunakan LOCAL_DATABASE_URL bila perlu.");
  }

  return value;
}

async function migrationFiles() {
  const directory = resolve("migrations");
  return (await readdir(directory))
    .filter((file) => file.endsWith(".sql") && file.slice(0, 14) >= LOCAL_MIGRATION_START)
    .sort()
    .map((file) => ({ file, path: join(directory, file) }));
}

async function appliedMigrationNames(pool) {
  const table = await pool.query("select to_regclass($1) as name", [`public.${TRACKING_TABLE}`]);
  if (!table.rows[0]?.name) return new Set();

  const result = await pool.query(`select migration_name from ${TRACKING_TABLE}`);
  return new Set(result.rows.map((row) => row.migration_name));
}

export async function getLocalMigrationStatus() {
  const pool = new Pool({ connectionString: localDatabaseUrl() });
  try {
    const files = await migrationFiles();
    const applied = await appliedMigrationNames(pool);
    return {
      applied: files.filter(({ file }) => applied.has(file)).map(({ file }) => file),
      pending: files.filter(({ file }) => !applied.has(file)).map(({ file }) => file),
    };
  } finally {
    await pool.end();
  }
}

function sqlStatements(source) {
  return source
    .split(";")
    .map((statement) => statement.trim())
    .filter(Boolean);
}

export async function applyLocalMigrations() {
  const pool = new Pool({ connectionString: localDatabaseUrl() });
  try {
    await pool.query(`
      create table if not exists ${TRACKING_TABLE} (
        migration_name text primary key,
        applied_at timestamptz not null default now()
      )
    `);

    const files = await migrationFiles();
    const applied = await appliedMigrationNames(pool);
    const pending = files.filter(({ file }) => !applied.has(file));

    for (const migration of pending) {
      const source = await readFile(migration.path, "utf8");
      const client = await pool.connect();
      try {
        await client.query("begin");
        for (const statement of sqlStatements(source)) {
          await client.query(statement);
        }
        await client.query(`insert into ${TRACKING_TABLE} (migration_name) values ($1)`, [migration.file]);
        await client.query("commit");
      } catch (error) {
        await client.query("rollback");
        throw new Error(`Migrasi lokal gagal pada ${migration.file}: ${error instanceof Error ? error.message : "unknown error"}`);
      } finally {
        client.release();
      }
    }

    return { applied: pending.map(({ file }) => file), pending: [] };
  } finally {
    await pool.end();
  }
}

async function main() {
  const mode = process.argv[2] ?? "--check";
  if (mode === "--apply") {
    const result = await applyLocalMigrations();
    console.log(result.applied.length ? `Migrasi lokal diterapkan: ${result.applied.join(", ")}` : "Tidak ada migrasi lokal baru.");
    return;
  }

  if (mode !== "--check") throw new Error("Gunakan --check atau --apply.");
  const result = await getLocalMigrationStatus();
  if (result.pending.length === 0) {
    console.log("Migrasi lokal sudah sinkron.");
    return;
  }

  console.log(`Migrasi lokal tertunda (${result.pending.length}): ${result.pending.join(", ")}`);
  process.exitCode = 1;
}

if (import.meta.url === pathToFileURL(process.argv[1]).href) {
  main().catch((error) => {
    console.error(error instanceof Error ? error.message : error);
    process.exitCode = 1;
  });
}
