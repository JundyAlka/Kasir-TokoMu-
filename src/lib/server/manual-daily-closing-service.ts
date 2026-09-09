import { pool } from "@/db/client";
import { createScopedQuery } from "@/lib/server/scoped-query";
import { getJakartaDayRange } from "@/lib/server/timezone";

export type ExpenseLine = {
  name: string;
  amount: number;
};

export type ManualClosingInput = {
  reportDate: string; // YYYY-MM-DD
  openingCash: number;
  openingCoins?: number;
  openingSavings?: number;
  revenue: number;
  cashierIncome?: number;
  otherIncome?: number;
  storeExpenses: ExpenseLine[];
  titipanExpenses: ExpenseLine[];
  closingCash: number;
  closingCoins: number;
  closingSavings: number;
  note?: string;
};

export type ManualClosingRecord = {
  id: string;
  reportDate: string;
  openingCash: number;
  openingCoins: number;
  openingSavings: number;
  openingTotal: number;
  revenue: number;
  cashierIncome: number;
  otherIncome: number;
  storeExpenses: ExpenseLine[];
  titipanExpenses: ExpenseLine[];
  totalStoreExpense: number;
  totalTitipanExpense: number;
  totalExpense: number;
  netCash: number;
  closingCash: number;
  closingCoins: number;
  closingSavings: number;
  closingTotal: number;
  variance: number;
  note: string;
  status: "locked";
  updatedAt: string;
};

function nowIso() {
  return new Date().toISOString();
}

function toIsoDate(val: unknown): string {
  if (!val) return "";
  if (val instanceof Date) {
    const y = val.getFullYear();
    const m = String(val.getMonth() + 1).padStart(2, "0");
    const d = String(val.getDate()).padStart(2, "0");
    return `${y}-${m}-${d}`;
  }
  const s = String(val).trim();
  if (/^\d{4}-\d{2}-\d{2}/.test(s)) return s.slice(0, 10);
  const parsed = new Date(s);
  if (!isNaN(parsed.getTime())) {
    const y = parsed.getFullYear();
    const m = String(parsed.getMonth() + 1).padStart(2, "0");
    const d = String(parsed.getDate()).padStart(2, "0");
    return `${y}-${m}-${d}`;
  }
  return s.slice(0, 10);
}

function scopedWorkspace(workspaceOwnerId: string) {
  return createScopedQuery(workspaceOwnerId).workspaceOwnerId;
}

/**
 * Mencari kas tutup (closing cash) dari hari sebelumnya sebelum tanggal target.
 * Digunakan agar Kas Awal hari ini otomatis terisi dari Kas Tutup hari kemarin.
 */
export async function getPreviousDayClosing(
  workspaceOwnerId: string,
  beforeDate: string
): Promise<{
  reportDate: string;
  closingCash: number;
  closingCoins: number;
  closingSavings: number;
  closingTotal: number;
} | null> {
  const ownerId = scopedWorkspace(workspaceOwnerId);

  // Cari shift_session closed atau daily_report sebelum tanggal ini
  const result = await pool.query<{
    report_date: unknown;
    closing_cash: number | string | null;
    closing_coins: number | string | null;
    closing_savings: number | string | null;
    closing_total: number | string | null;
  }>(
    `select
       ss.ended_at::date as report_date,
       coalesce(ss.closing_cash, 0) as closing_cash,
       coalesce(ss.closing_coins, 0) as closing_coins,
       coalesce(ss.closing_savings, 0) as closing_savings,
       coalesce(ss.closing_cash, 0) + coalesce(ss.closing_coins, 0) + coalesce(ss.closing_savings, 0) as closing_total
     from shift_sessions ss
     where ss.workspace_owner_id = $1
       and ss.ended_at::date < $2::date
       and ss.status = 'closed'
       and ss.closing_cash is not null
     order by ss.ended_at::date desc
     limit 1`,
    [ownerId, beforeDate]
  );

  if (!result.rows[0]) {
    // Cek alternatif dari daily_reports
    const altResult = await pool.query<{
      report_date: unknown;
      closing_total: number | string | null;
    }>(
      `select report_date, closing_total
       from daily_reports
       where user_id = $1 and report_date < $2::date
       order by report_date desc
       limit 1`,
      [ownerId, beforeDate]
    );

    if (!altResult.rows[0]) return null;
    const row = altResult.rows[0];
    const total = Number(row.closing_total ?? 0);
    return {
      reportDate: toIsoDate(row.report_date),
      closingCash: total,
      closingCoins: 0,
      closingSavings: 0,
      closingTotal: total,
    };
  }

  const row = result.rows[0];
  const cash = Number(row.closing_cash ?? 0);
  const coins = Number(row.closing_coins ?? 0);
  const savings = Number(row.closing_savings ?? 0);
  return {
    reportDate: toIsoDate(row.report_date),
    closingCash: cash,
    closingCoins: coins,
    closingSavings: savings,
    closingTotal: cash + coins + savings,
  };
}

/**
 * Mengambil data tutup buku manual untuk suatu tanggal jika sudah pernah diinput.
 */
export async function getManualClosingForDate(
  workspaceOwnerId: string,
  reportDate: string
): Promise<ManualClosingRecord | null> {
  const ownerId = scopedWorkspace(workspaceOwnerId);
  const sessionId = `ss_manual_${ownerId.slice(-6)}_${reportDate}`;

  const [sessionRes, dailyRes, expenseRes] = await Promise.all([
    pool.query<{
      id: string;
      opening_cash: number | string | null;
      opening_coins: number | string | null;
      opening_savings: number | string | null;
      closing_cash: number | string | null;
      closing_coins: number | string | null;
      closing_savings: number | string | null;
      variance_note: string | null;
      ended_at: string;
    }>(
      `select id, opening_cash, opening_coins, opening_savings,
              closing_cash, closing_coins, closing_savings, variance_note, ended_at
       from shift_sessions
       where id = $1 and workspace_owner_id = $2
       limit 1`,
      [sessionId, ownerId]
    ),
    pool.query<{
      id: string;
      revenue: number | string | null;
      expense_total: number | string | null;
      net_profit: number | string | null;
      closing_total: number | string | null;
      updated_at: string;
    }>(
      `select id, revenue, expense_total, net_profit, closing_total, updated_at
       from daily_reports
       where user_id = $1 and report_date = $2::date
       limit 1`,
      [ownerId, reportDate]
    ),
    pool.query<{
      title: string;
      amount: number | string | null;
      category: string;
    }>(
      `select title, amount, category
       from expenses
       where user_id = $1 and shift_session_id = $2
       order by id asc`,
      [ownerId, sessionId]
    ),
  ]);

  if (!dailyRes.rows[0]) {
    return null;
  }

  const sessionRow = sessionRes.rows[0];
  const dailyRow = dailyRes.rows[0];

  const storeExpenses: ExpenseLine[] = [];
  const titipanExpenses: ExpenseLine[] = [];

  for (const exp of expenseRes.rows) {
    const item = { name: exp.title, amount: Number(exp.amount ?? 0) };
    if (exp.category === "titipan") {
      titipanExpenses.push(item);
    } else {
      storeExpenses.push(item);
    }
  }

  const openingCash = Number(sessionRow?.opening_cash ?? 0);
  const openingCoins = Number(sessionRow?.opening_coins ?? 0);
  const openingSavings = Number(sessionRow?.opening_savings ?? 0);
  const closingCash = Number(sessionRow?.closing_cash ?? dailyRow.closing_total ?? 0);
  const closingCoins = Number(sessionRow?.closing_coins ?? 0);
  const closingSavings = Number(sessionRow?.closing_savings ?? 0);

  const totalStore = storeExpenses.reduce((sum, e) => sum + e.amount, 0);
  const totalTitipan = titipanExpenses.reduce((sum, e) => sum + e.amount, 0);
  const totalExpense = totalStore + totalTitipan;
  const revenue = Number(dailyRow.revenue ?? 0);
  const netCash = revenue - totalExpense;
  const closingTotal = closingCash + closingCoins + closingSavings;

  return {
    id: dailyRow.id,
    reportDate,
    openingCash,
    openingCoins,
    openingSavings,
    openingTotal: openingCash + openingCoins + openingSavings,
    revenue,
    cashierIncome: revenue,
    otherIncome: 0,
    storeExpenses,
    titipanExpenses,
    totalStoreExpense: totalStore,
    totalTitipanExpense: totalTitipan,
    totalExpense,
    netCash,
    closingCash,
    closingCoins,
    closingSavings,
    closingTotal,
    variance: netCash - closingTotal,
    note: sessionRow?.variance_note ?? "",
    status: "locked",
    updatedAt: dailyRow.updated_at,
  };
}

/**
 * Daftar tutup buku harian untuk periode tertentu (misal 1 bulan).
 */
export async function listManualClosings(
  workspaceOwnerId: string,
  start: string,
  end: string
): Promise<ManualClosingRecord[]> {
  const ownerId = scopedWorkspace(workspaceOwnerId);

  const dailyReportsRes = await pool.query<{
    id: string;
    report_date: string;
    opening_total: number | string | null;
    revenue: number | string | null;
    expense_total: number | string | null;
    net_profit: number | string | null;
    closing_total: number | string | null;
    status: string;
    updated_at: string;
  }>(
    `select id, report_date, opening_total, revenue, expense_total,
            net_profit, closing_total, status, updated_at
     from daily_reports
     where user_id = $1
       and report_date >= $2::date
       and report_date <= $3::date
     order by report_date asc`,
    [ownerId, start, end]
  );

  const records: ManualClosingRecord[] = [];

  for (const daily of dailyReportsRes.rows) {
    const reportDate = toIsoDate(daily.report_date);
    const item = await getManualClosingForDate(ownerId, reportDate);
    if (item) {
      records.push(item);
    } else {
      // Fallback jika ada daily report yang bukan dibuat via manual close
      const rev = Number(daily.revenue ?? 0);
      const exp = Number(daily.expense_total ?? 0);
      const cls = Number(daily.closing_total ?? 0);
      records.push({
        id: daily.id,
        reportDate,
        openingCash: Number(daily.opening_total ?? 0),
        openingCoins: 0,
        openingSavings: 0,
        openingTotal: Number(daily.opening_total ?? 0),
        revenue: rev,
        cashierIncome: rev,
        otherIncome: 0,
        storeExpenses: [],
        titipanExpenses: [],
        totalStoreExpense: exp,
        totalTitipanExpense: 0,
        totalExpense: exp,
        netCash: rev - exp,
        closingCash: cls,
        closingCoins: 0,
        closingSavings: 0,
        closingTotal: cls,
        variance: rev - exp - cls,
        note: "",
        status: "locked",
        updatedAt: daily.updated_at,
      });
    }
  }

  return records;
}

/**
 * Menyimpan Rekap Tutup Buku Harian.
 * Menghubungkan Kas Tutup hari ini dengan Kas Awal hari esok.
 */
export async function saveManualClosing(
  workspaceOwnerId: string,
  actorUserId: string,
  payload: ManualClosingInput
): Promise<ManualClosingRecord> {
  const ownerId = scopedWorkspace(workspaceOwnerId);
  const { reportDate } = payload;
  if (!/^\d{4}-\d{2}-\d{2}$/.test(reportDate)) {
    throw new Error("Format tanggal tidak valid (harus YYYY-MM-DD).");
  }

  const client = await pool.connect();

  try {
    await client.query("BEGIN");

    const sessionId = `ss_manual_${ownerId.slice(-6)}_${reportDate}`;
    const trxId = `trx_manual_${ownerId.slice(-6)}_${reportDate}`;
    const dailyId = `drp_manual_${ownerId.slice(-6)}_${reportDate}`;
    const timestamp = nowIso();

    // 1. Pastikan shift default tersedia untuk workspace ini
    let shiftId = "shf_harian";
    const shiftCheck = await client.query<{ id: string }>(
      `select id from shifts where workspace_owner_id = $1 limit 1`,
      [ownerId]
    );
    if (shiftCheck.rows[0]) {
      shiftId = shiftCheck.rows[0].id;
    } else {
      await client.query(
        `insert into shifts (id, workspace_owner_id, name, start_time, end_time, is_active, created_at)
         values ($1, $2, 'Shift Operasional Harian', '07:00', '21:00', 1, $3::timestamptz)
         on conflict (id) do nothing`,
        [shiftId, ownerId, timestamp]
      );
    }

    const totalStore = payload.storeExpenses.reduce((sum, e) => sum + Number(e.amount || 0), 0);
    const totalTitipan = payload.titipanExpenses.reduce((sum, e) => sum + Number(e.amount || 0), 0);
    const totalExpense = totalStore + totalTitipan;
    const revenue = Number(payload.revenue || 0);
    const netCash = revenue - totalExpense;

    const openingCash = Number(payload.openingCash || 0);
    const openingCoins = Number(payload.openingCoins || 0);
    const openingSavings = Number(payload.openingSavings || 0);
    const openingTotal = openingCash + openingCoins + openingSavings;

    const closingCash = Number(payload.closingCash || 0);
    const closingCoins = Number(payload.closingCoins || 0);
    const closingSavings = Number(payload.closingSavings || 0);
    const closingTotal = closingCash + closingCoins + closingSavings;
    const variance = netCash - closingTotal;

    // 2. Simpan atau perbarui shift_sessions tertutup
    await client.query(
      `insert into shift_sessions (
         id, workspace_owner_id, shift_id, cashier_user_id,
         started_at, ended_at, opened_at, closed_at,
         opening_cash, opening_coins, opening_savings,
         closing_cash, closing_coins, closing_savings,
         expected_closing, variance, variance_note,
         status, opened_by_user_id, closed_by_user_id
       ) values (
         $1, $2, $3, $4,
         $5::timestamptz, $6::timestamptz, $5::timestamptz, $6::timestamptz,
         $7, $8, $9,
         $10, $11, $12,
         $13, $14, $15,
         'closed', $4, $4
       )
       on conflict (id) do update set
         opening_cash = excluded.opening_cash,
         opening_coins = excluded.opening_coins,
         opening_savings = excluded.opening_savings,
         closing_cash = excluded.closing_cash,
         closing_coins = excluded.closing_coins,
         closing_savings = excluded.closing_savings,
         expected_closing = excluded.expected_closing,
         variance = excluded.variance,
         variance_note = excluded.variance_note,
         status = 'closed',
         closed_at = excluded.closed_at,
         closed_by_user_id = excluded.closed_by_user_id`,
      [
        sessionId,
        ownerId,
        shiftId,
        actorUserId,
        `${reportDate}T07:00:00.000Z`,
        `${reportDate}T21:00:00.000Z`,
        openingCash,
        openingCoins,
        openingSavings,
        closingCash,
        closingCoins,
        closingSavings,
        netCash,
        variance,
        payload.note || "Tutup buku kas harian",
      ]
    );

    // 3. Hapus pengeluaran manual sebelumnya untuk sesi ini agar tidak duplikat
    await client.query(
      `delete from expenses where user_id = $1 and shift_session_id = $2`,
      [ownerId, sessionId]
    );

    // 4. Masukkan baris pengeluaran toko
    for (let i = 0; i < payload.storeExpenses.length; i++) {
      const item = payload.storeExpenses[i];
      if (!item.name || item.amount <= 0) continue;
      const expId = `exp_m_${ownerId.slice(-4)}_${reportDate}_s${i}`;
      await client.query(
        `insert into expenses (id, user_id, title, amount, category, shift_session_id, expense_type, is_cash_movement, created_at)
         values ($1, $2, $3, $4, 'operasional', $5, 'sales_toko', false, $6::timestamptz)`,
        [expId, ownerId, item.name, item.amount, sessionId, `${reportDate}T12:00:00.000Z`]
      );
    }

    // 5. Masukkan baris pengeluaran titipan
    for (let i = 0; i < payload.titipanExpenses.length; i++) {
      const item = payload.titipanExpenses[i];
      if (!item.name || item.amount <= 0) continue;
      const expId = `exp_m_${ownerId.slice(-4)}_${reportDate}_t${i}`;
      await client.query(
        `insert into expenses (id, user_id, title, amount, category, shift_session_id, expense_type, is_cash_movement, created_at)
         values ($1, $2, $3, $4, 'titipan', $5, 'sales_titipan', false, $6::timestamptz)`,
        [expId, ownerId, item.name, item.amount, sessionId, `${reportDate}T12:00:00.000Z`]
      );
    }

    // 6. Masukkan atau perbarui transaksi ringkasan omzet
    await client.query(
      `delete from transaction_items where transaction_id = $1`,
      [trxId]
    );
    await client.query(
      `delete from transactions where id = $1`,
      [trxId]
    );

    if (revenue > 0) {
      await client.query(
        `insert into transactions (
           id, user_id, total, paid_amount, change_amount, payment_method,
           recorded_by_user_id, recorded_by_name, shift_session_id,
           entry_source, occurred_at, created_at
         ) values (
           $1, $2, $3, $3, 0, 'Tunai',
           $4, 'Buku Kas Harian', $5,
           'manual_closing', $6::timestamptz, $6::timestamptz
         )`,
        [trxId, ownerId, revenue, actorUserId, sessionId, `${reportDate}T20:00:00.000Z`]
      );

      await client.query(
        `insert into transaction_items (
           id, transaction_id, product_name, quantity, unit_price, cost_price, is_adjustment, note
         ) values (
           $1, $2, 'Total Penjualan Harian', 1, $3, 0, true, 'Rekapitulasi tutup buku harian'
         )`,
        [`itm_m_${trxId}`, trxId, revenue]
      );
    }

    // 7. Simpan ke daily_reports (status locked)
    await client.query(
      `insert into daily_reports (
         id, user_id, report_date, opening_total, revenue, cogs, expense_total,
         gross_profit, net_profit, closing_total, transaction_count, profit_distribution,
         status, locked_at, locked_by_user_id, created_at, updated_at
       ) values (
         $1, $2, $3::date, $4, $5, 0, $6,
         $5, $7, $8, 1, 0,
         'locked', $9::timestamptz, $10, $9::timestamptz, $9::timestamptz
       )
       on conflict (user_id, report_date) do update set
         opening_total = excluded.opening_total,
         revenue = excluded.revenue,
         expense_total = excluded.expense_total,
         gross_profit = excluded.gross_profit,
         net_profit = excluded.net_profit,
         closing_total = excluded.closing_total,
         transaction_count = 1,
         status = 'locked',
         locked_at = excluded.locked_at,
         locked_by_user_id = excluded.locked_by_user_id,
         updated_at = excluded.updated_at`,
      [
        dailyId,
        ownerId,
        reportDate,
        openingTotal,
        revenue,
        totalExpense,
        revenue - totalExpense,
        closingTotal,
        timestamp,
        actorUserId,
      ]
    );

    // 8. Cek apakah ada hari berikutnya yang sudah diinput;
    // jika ada, perbarui kas awal hari berikutnya jika kas tutup hari ini berubah!
    const nextSession = await client.query<{ id: string; opening_cash: number | string | null }>(
      `select id, opening_cash
       from shift_sessions
       where workspace_owner_id = $1
         and ended_at::date > $2::date
       order by ended_at::date asc
       limit 1`,
      [ownerId, reportDate]
    );

    if (nextSession.rows[0]) {
      await client.query(
        `update shift_sessions
         set opening_cash = $1
         where id = $2`,
        [closingCash, nextSession.rows[0].id]
      );
    }

    await client.query("COMMIT");

    return {
      id: dailyId,
      reportDate,
      openingCash,
      openingCoins,
      openingSavings,
      openingTotal,
      revenue,
      cashierIncome: payload.cashierIncome ?? revenue,
      otherIncome: payload.otherIncome ?? 0,
      storeExpenses: payload.storeExpenses,
      titipanExpenses: payload.titipanExpenses,
      totalStoreExpense: totalStore,
      totalTitipanExpense: totalTitipan,
      totalExpense,
      netCash,
      closingCash,
      closingCoins,
      closingSavings,
      closingTotal,
      variance,
      note: payload.note ?? "",
      status: "locked",
      updatedAt: timestamp,
    };
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }
}

/**
 * Menghapus rekap tutup buku harian pada tanggal tertentu.
 */
export async function deleteManualClosing(
  workspaceOwnerId: string,
  actorUserId: string,
  reportDate: string
) {
  const ownerId = scopedWorkspace(workspaceOwnerId);
  const sessionId = `ss_manual_${ownerId.slice(-6)}_${reportDate}`;
  const trxId = `trx_manual_${ownerId.slice(-6)}_${reportDate}`;

  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    await client.query(`delete from expenses where user_id = $1 and shift_session_id = $2`, [ownerId, sessionId]);
    await client.query(`delete from transaction_items where transaction_id = $1`, [trxId]);
    await client.query(`delete from transactions where id = $1`, [trxId]);
    await client.query(`delete from shift_sessions where id = $1 and workspace_owner_id = $2`, [sessionId, ownerId]);
    await client.query(`delete from daily_reports where user_id = $1 and report_date = $2::date`, [ownerId, reportDate]);
    await client.query("COMMIT");
    return { success: true, reportDate };
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }
}
