import { Pool } from 'pg';

const url = process.env.DATABASE_URL;

async function test() {
  const pool = new Pool({
    connectionString: url,
    ssl: { rejectUnauthorized: false },
  });

  console.log("Testing SQL queries against remote DB...");

  // 1. Check Store Profile
  const storeRes = await pool.query(`SELECT * FROM store_profiles LIMIT 1`);
  console.log("Store Profile count:", storeRes.rows.length, storeRes.rows[0]?.store_name);

  // 2. Check Products
  const prodRes = await pool.query(`SELECT count(*), max(sell_price) FROM products`);
  console.log("Products check:", prodRes.rows[0]);

  // 3. Check Transactions & Occurred_at
  const txRes = await pool.query(`SELECT id, total, payment_method, occurred_at, entry_source FROM transactions ORDER BY occurred_at DESC LIMIT 5`);
  console.log("Recent transactions check:", txRes.rows);

  // 4. Check Expenses with new columns
  const expRes = await pool.query(`SELECT id, title, amount, expense_type, is_cash_movement FROM expenses LIMIT 5`);
  console.log("Expenses check:", expRes.rows);

  // 5. Check Daily Reports table
  const dailyRes = await pool.query(`SELECT count(*) FROM daily_reports`);
  console.log("Daily reports table count:", dailyRes.rows[0].count);

  // 6. Check Shift Sessions table with new columns
  const shiftRes = await pool.query(`SELECT count(*) FROM shift_sessions`);
  console.log("Shift sessions count:", shiftRes.rows[0].count);

  // 7. Check Titipan Intakes & Kas Movements
  const titipanRes = await pool.query(`SELECT count(*) FROM titipan_intakes`);
  const kasRes = await pool.query(`SELECT count(*) FROM kas_movements`);
  console.log("Titipan intakes:", titipanRes.rows[0].count, "| Kas movements:", kasRes.rows[0].count);

  console.log("\n🎉 ALL DATABASE TABLES AND QUERIES ARE WORKING PERFECTLY!");
  await pool.end();
}

test().catch(console.error);
