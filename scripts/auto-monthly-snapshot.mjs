import pg from "pg";
import crypto from "crypto";
import { getPoolConfig } from "./db-ssl-helper.mjs";

const { Pool } = pg;

function createId(prefix) {
  return `${prefix}_${crypto.randomUUID().slice(0, 8)}`;
}

function nowIso() {
  return new Date().toISOString();
}

function getPeriodRange(year, month) {
  const pad = (n) => String(n).padStart(2, "0");
  const nextYear = month === 12 ? year + 1 : year;
  const nextMonth = month === 12 ? 1 : month + 1;

  // Jakarta is UTC+7 (2026-09-01 00:00:00+07:00 == 2026-08-31 17:00:00.000Z)
  const start = `${year}-${pad(month)}-01T00:00:00+07:00`;
  const end = `${nextYear}-${pad(nextMonth)}-01T00:00:00+07:00`;
  const startDateStr = `${year}-${pad(month)}-01`;
  const endDateStr = `${nextYear}-${pad(nextMonth)}-01`;

  const monthNames = [
    "Januari", "Februari", "Maret", "April", "Mei", "Juni",
    "Juli", "Agustus", "September", "Oktober", "November", "Desember"
  ];
  const label = `${monthNames[month - 1]} ${year}`;

  return { start, end, startDateStr, endDateStr, label };
}

function normalizeAddress(value) {
  if (!value || value.trim() === "" || value.includes("[Alamat") || value === "Grabag, Magelang") {
    return "Grabag, Purworejo";
  }
  return value;
}

function normalizeCity(value) {
  if (!value || value.trim() === "" || value === "Magelang") {
    return "Purworejo";
  }
  return value;
}

function normalizeOwnerName(value) {
  if (!value || value.trim() === "" || value.includes("[Nama Bapak]")) {
    return "Pimpinan TokoMu";
  }
  return value;
}

export async function snapshotMonthlyForWorkspace(pool, workspaceOwnerId, targetYear, targetMonth, options = {}) {
  const { lockPendingDailyReports = true } = options;
  const { start, end, startDateStr, endDateStr, label } = getPeriodRange(targetYear, targetMonth);

  console.log(`\n======================================================`);
  console.log(`Memproses snapshot ${label} untuk workspace: ${workspaceOwnerId}`);

  // 1. Kunci laporan harian yang masih draft (jika ada) untuk tanggal lampau
  if (lockPendingDailyReports) {
    const lockRes = await pool.query(
      `UPDATE daily_reports
       SET status = 'locked', locked_at = now()
       WHERE user_id = $1
         AND report_date >= $2::date
         AND report_date < $3::date
         AND status <> 'locked'
       RETURNING report_date`,
      [workspaceOwnerId, startDateStr, endDateStr]
    );
    if (lockRes.rows.length > 0) {
      console.log(`[Auto-Lock] Mengunci ${lockRes.rows.length} laporan harian yang belum locked.`);
    }
  }

  // 2. Ambil rollup dari daily_reports
  const dailyRes = await pool.query(
    `SELECT
       report_date::text as "reportDate",
       revenue,
       cogs,
       expense_total as "expenseTotal",
       gross_profit as "grossProfit",
       net_profit as "netProfit",
       profit_distribution as "profitDistribution",
       transaction_count as "transactionCount",
       status
     FROM daily_reports
     WHERE user_id = $1
       AND report_date >= $2::date
       AND report_date < $3::date
     ORDER BY report_date ASC`,
    [workspaceOwnerId, startDateStr, endDateStr]
  );

  const dailyReports = dailyRes.rows.map((r) => ({
    reportDate: r.reportDate.slice(0, 10),
    revenue: Number(r.revenue || 0),
    cogs: Number(r.cogs || 0),
    expenseTotal: Number(r.expenseTotal || 0),
    grossProfit: Number(r.grossProfit || 0),
    netProfit: Number(r.netProfit || 0),
    profitDistribution: Number(r.profitDistribution || 0),
    transactionCount: Number(r.transactionCount || 0),
    status: r.status === "locked" ? "locked" : "draft",
  }));

  let totals;
  let source = "daily_reports";

  if (dailyReports.length > 0) {
    totals = dailyReports.reduce(
      (sum, row) => ({
        revenue: sum.revenue + row.revenue,
        cogs: sum.cogs + row.cogs,
        grossProfit: sum.grossProfit + row.grossProfit,
        expenseTotal: sum.expenseTotal + row.expenseTotal,
        netProfit: sum.netProfit + row.netProfit,
        profitDistribution: sum.profitDistribution + row.profitDistribution,
        transactionCount: sum.transactionCount + row.transactionCount,
      }),
      { revenue: 0, cogs: 0, grossProfit: 0, expenseTotal: 0, netProfit: 0, profitDistribution: 0, transactionCount: 0 }
    );
  } else {
    // Fallback hitung live dari transaksi jika belum ada daily reports
    console.log(`[Notice] Belum ada daily_reports untuk ${label}, menghitung dari live transaksi...`);
    const txRes = await pool.query(
      `SELECT coalesce(sum(total), 0)::int as revenue, count(*)::int as count
       FROM transactions
       WHERE user_id = $1 AND occurred_at >= $2::timestamptz AND occurred_at < $3::timestamptz`,
      [workspaceOwnerId, start, end]
    );
    const cogsRes = await pool.query(
      `SELECT coalesce(sum(ti.quantity * ti.cost_price), 0)::int as cogs
       FROM transaction_items ti
       JOIN transactions t ON t.id = ti.transaction_id
       WHERE t.user_id = $1 AND t.occurred_at >= $2::timestamptz AND t.occurred_at < $3::timestamptz`,
      [workspaceOwnerId, start, end]
    );
    const expRes = await pool.query(
      `SELECT coalesce(sum(amount), 0)::int as expenses
       FROM expenses
       WHERE user_id = $1 AND created_at >= $2::timestamptz AND created_at < $3::timestamptz
         AND is_cash_movement = false AND expense_type <> 'bagi_hasil_investor'`,
      [workspaceOwnerId, start, end]
    );

    const revenue = Number(txRes.rows[0]?.revenue || 0);
    const cogs = Number(cogsRes.rows[0]?.cogs || 0);
    const expenseTotal = Number(expRes.rows[0]?.expenses || 0);
    const transactionCount = Number(txRes.rows[0]?.count || 0);
    const grossProfit = revenue - cogs;
    const netProfit = grossProfit - expenseTotal;

    totals = {
      revenue,
      cogs,
      grossProfit,
      expenseTotal,
      netProfit,
      profitDistribution: 0,
      transactionCount,
    };
    source = "live_transactions";
  }

  // Jika tidak ada omzet dan tidak ada transaksi sama sekali, lewati
  if (totals.revenue === 0 && totals.transactionCount === 0 && dailyReports.length === 0) {
    console.log(`[Skip] Tidak ada transaksi/aktivitas di bulan ${label} untuk workspace ini.`);
    return null;
  }

  const averageTicket = totals.transactionCount > 0 ? Math.round(totals.revenue / totals.transactionCount) : 0;

  // 3. Ambil data store profile
  const profileRes = await pool.query(
    `SELECT
       store_name, store_tagline, store_address, city, owner_name,
       pcm_name, pcm_chairman_name, pcm_chairman_title, pcm_address,
       coalesce(profit_share_pcm_pct, 30)::int as profit_share_pcm_pct,
       coalesce(profit_share_reserve_pct, 20)::int as profit_share_reserve_pct
     FROM store_profiles
     WHERE user_id = $1
     LIMIT 1`,
    [workspaceOwnerId]
  );
  const profile = profileRes.rows[0] || {};

  // 4. Ambil kategori pengeluaran
  const expCatRes = await pool.query(
    `SELECT category, coalesce(sum(amount), 0)::text as amount
     FROM expenses
     WHERE user_id = $1
       AND created_at >= $2::timestamptz
       AND created_at < $3::timestamptz
       AND is_cash_movement = false
       AND expense_type <> 'bagi_hasil_investor'
     GROUP BY category
     ORDER BY sum(amount) DESC, category ASC`,
    [workspaceOwnerId, start, end]
  );
  const expTotal = expCatRes.rows.reduce((sum, r) => sum + Number(r.amount || 0), 0);
  const expenseCategories = expCatRes.rows.map((r) => {
    const amt = Number(r.amount || 0);
    return {
      category: r.category || "Operasional Umum",
      amount: amt,
      percentage: expTotal > 0 ? `${((amt / expTotal) * 100).toFixed(1)}%` : "0%",
    };
  });

  // 5. Ambil data gaji
  const salaryRes = await pool.query(
    `SELECT coalesce(sum(monthly_salary), 0)::int as total_salary
     FROM user_roles
     WHERE workspace_owner_id = $1 AND is_active = 1`,
    [workspaceOwnerId]
  );
  const totalSalaries = Number(salaryRes.rows[0]?.total_salary || 0);

  // 6. Ambil investasi aktif & hitung bagi hasil investor
  const invRes = await pool.query(
    `SELECT
       i.id, i.investor_id as "investorId", inv.name as "investorName",
       i.type, i.akad_type as "akadType", i.amount,
       i.monthly_return_rate_pct as "monthlyReturnRatePct",
       i.profit_share_pct as "profitSharePct",
       i.product_id as "productId", p.name as "productName",
       coalesce(p.stock, 0)::int as "currentStock",
       p.sell_price as "sellPrice",
       i.unit_count as "unitCount",
       coalesce(i.unit_cost, p.buy_price, 0)::int as "unitCost",
       i.profit_share_per_unit_pct as "profitSharePerUnitPct",
       i.profit_share_per_unit_amount as "profitSharePerUnitAmount",
       i.start_date as "startDate", i.end_date as "endDate"
     FROM investments i
     JOIN investors inv ON inv.id = i.investor_id AND inv.workspace_owner_id = i.workspace_owner_id
     LEFT JOIN products p ON p.id = i.product_id AND p.user_id = i.workspace_owner_id
     WHERE i.workspace_owner_id = $1
       AND i.is_active = 1
       AND inv.is_active = 1
       AND i.start_date < $3::timestamptz
       AND (i.end_date is null OR i.end_date >= $2::timestamptz)
     ORDER BY inv.name ASC, i.created_at ASC`,
    [workspaceOwnerId, start, end]
  );

  const payouts = [];
  for (const inv of invRes.rows) {
    const akad = inv.akadType || (inv.type === "barang_titip_jual" ? "barang_titip_jual" : "murabahah_bil_wakalah");
    const capital = Number(inv.amount || (inv.unitCount || 0) * (inv.unitCost || 0));

    if (akad === "murabahah_bil_wakalah") {
      const rate = Number(inv.monthlyReturnRatePct || 2.5);
      const amount = Math.round(capital * (rate / 100));
      payouts.push({
        investmentId: inv.id,
        investorId: inv.investorId,
        investorName: inv.investorName,
        akadType: akad,
        type: "uang",
        baseAmount: capital,
        baseProfit: capital,
        capital,
        ratePct: rate,
        sharePct: rate,
        shareMode: "percentage",
        amount,
        note: `Murabahah fixed-rate ${rate}% per bulan.`,
      });
    } else if (akad === "mudharabah" || akad === "musyarakah") {
      const rate = Number(inv.profitSharePct || 0);
      const baseProfit = Math.max(totals.netProfit, 0);
      const amount = Math.round(baseProfit * (rate / 100));
      payouts.push({
        investmentId: inv.id,
        investorId: inv.investorId,
        investorName: inv.investorName,
        akadType: akad,
        type: "uang",
        baseAmount: baseProfit,
        baseProfit,
        capital,
        ratePct: rate,
        sharePct: rate,
        shareMode: "percentage",
        amount,
        note: `${akad === "mudharabah" ? "Mudharabah" : "Musyarakah"} ${rate}% dari laba bersih.`,
      });
    } else if (akad === "barang_titip_jual" || akad === "sales_titipan") {
      // Hitung penjualan produk titipan di periode
      const saleRes = await pool.query(
        `SELECT
           coalesce(sum(ti.quantity * (ti.unit_price - $4::int)), 0)::int as "baseAmount",
           coalesce(sum(ti.quantity), 0)::int as "quantitySold"
         FROM transaction_items ti
         JOIN transactions t ON t.id = ti.transaction_id
         WHERE t.user_id = $1
           AND ti.product_id = $2
           AND t.occurred_at >= $3::timestamptz
           AND t.occurred_at < $5::timestamptz`,
        [workspaceOwnerId, inv.productId, start, inv.unitCost || 0, end]
      );
      const sold = Number(saleRes.rows[0]?.quantitySold || 0);
      const baseAmt = Number(saleRes.rows[0]?.baseAmount || 0);
      const nominalPerUnit = inv.profitSharePerUnitAmount !== null && inv.profitSharePerUnitAmount !== undefined
        ? Number(inv.profitSharePerUnitAmount)
        : null;
      let amount = 0;
      if (nominalPerUnit !== null) {
        amount = sold * nominalPerUnit;
      } else {
        const ratePct = Number(inv.profitSharePerUnitPct || inv.profitSharePct || 0);
        amount = Math.round(baseAmt * (ratePct / 100));
      }
      payouts.push({
        investmentId: inv.id,
        investorId: inv.investorId,
        investorName: inv.investorName,
        akadType: akad,
        type: "barang_titip_jual",
        baseAmount: baseAmt,
        baseProfit: baseAmt,
        capital,
        amount,
        quantitySold: sold,
        productName: inv.productName,
        note: `Titipan ${inv.productName || "produk"} terjual ${sold} pcs.`,
      });
    }
  }

  const totalInvestorPayout = payouts.reduce((sum, p) => sum + p.amount, 0);
  const remaining = totals.netProfit - totalInvestorPayout;
  const positiveRemaining = Math.max(remaining, 0);

  const profitSharePcmPct = profile.profit_share_pcm_pct ?? 30;
  const profitShareReservePct = profile.profit_share_reserve_pct ?? 20;

  const pcmShare = Math.round(positiveRemaining * (profitSharePcmPct / 100));
  const reserveShare = Math.round(positiveRemaining * (profitShareReservePct / 100));
  const storeShare = positiveRemaining - pcmShare - reserveShare;

  const timestamp = nowIso();

  // 7. Bangun data terpadu (Kasir Monthly + Pimpinan PCM)
  const unifiedData = {
    version: 1,
    generatedAt: timestamp,
    note: "Snapshot bulanan otomatis akhir periode.",
    period: {
      year: targetYear,
      month: targetMonth,
      label,
      start,
      end,
    },
    identity: {
      storeName: profile.store_name || "Warung tokomu",
      storeTagline: profile.store_tagline || "Toko Amal Usaha PCM Muhammadiyah Grabag",
      storeAddress: normalizeAddress(profile.store_address),
      city: normalizeCity(profile.city),
      ownerName: normalizeOwnerName(profile.owner_name),
      pcmName: profile.pcm_name || "PCM Muhammadiyah Grabag",
      pcmChairmanName: profile.pcm_chairman_name || "",
      pcmChairmanTitle: profile.pcm_chairman_title || "Ketua PCM",
      pcmAddress: normalizeAddress(profile.pcm_address),
    },
    financial: {
      revenue: totals.revenue,
      cogs: totals.cogs,
      grossProfit: totals.grossProfit,
      expenses: totals.expenseTotal,
      salaries: totalSalaries,
      expenseTotal: totals.expenseTotal,
      netProfit: totals.netProfit,
      profitDistribution: totalInvestorPayout + pcmShare + reserveShare,
      transactionCount: totals.transactionCount,
      averageTicket,
      totalInvestorPayout,
      pcmShare,
      reserveShare,
      storeShare,
      profitSharePcmPct,
      profitShareReservePct,
    },
    payouts,
    expenseCategories,

    // Properti khusus untuk Kasir view (/laporan -> Riwayat Laporan Selesai):
    revenue: totals.revenue,
    cogs: totals.cogs,
    grossProfit: totals.grossProfit,
    expenseTotal: totals.expenseTotal,
    netProfit: totals.netProfit,
    profitDistribution: totalInvestorPayout + pcmShare + reserveShare,
    transactionCount: totals.transactionCount,
    averageTicket,
    dailyReports,
    dailyTransactions: [],
    source,
  };

  // 8. Cek apakah record sudah ada di monthly_reports
  const existingRes = await pool.query(
    `SELECT id, data FROM monthly_reports
     WHERE workspace_owner_id = $1 AND period_year = $2 AND period_month = $3
     LIMIT 1`,
    [workspaceOwnerId, targetYear, targetMonth]
  );

  let resultReport;
  if (existingRes.rows.length > 0) {
    const existingId = existingRes.rows[0].id;
    const existingData = existingRes.rows[0].data || {};
    const mergedData = { ...existingData, ...unifiedData };

    const updateRes = await pool.query(
      `UPDATE monthly_reports
       SET data = $1, status = 'final', finalized_at = $2, updated_at = $2
       WHERE id = $3
       RETURNING id, status, finalized_at`,
      [JSON.stringify(mergedData), timestamp, existingId]
    );
    resultReport = updateRes.rows[0];
    console.log(`[Update] Berhasil memperbarui snapshot ${label} (ID: ${existingId}) ke status FINAL.`);
  } else {
    const newId = createId("mrep");
    const insertRes = await pool.query(
      `INSERT INTO monthly_reports (
         id, workspace_owner_id, period_year, period_month, data, status, finalized_at, created_at, updated_at
       ) VALUES ($1, $2, $3, $4, $5, 'final', $6, $6, $6)
       RETURNING id, status, finalized_at`,
      [newId, workspaceOwnerId, targetYear, targetMonth, JSON.stringify(unifiedData), timestamp]
    );
    resultReport = insertRes.rows[0];
    console.log(`[Insert] Berhasil membuat snapshot baru ${label} (ID: ${newId}) dengan status FINAL.`);
  }

  console.log(`Ringkasan Keuangan ${label}:`);
  console.log(`  - Omzet: Rp ${totals.revenue.toLocaleString("id-ID")}`);
  console.log(`  - HPP: Rp ${totals.cogs.toLocaleString("id-ID")}`);
  console.log(`  - Laba Kotor: Rp ${totals.grossProfit.toLocaleString("id-ID")}`);
  console.log(`  - Beban Total: Rp ${totals.expenseTotal.toLocaleString("id-ID")}`);
  console.log(`  - Laba Bersih: Rp ${totals.netProfit.toLocaleString("id-ID")}`);
  console.log(`  - Transaksi: ${totals.transactionCount} kali (Rata-rata: Rp ${averageTicket.toLocaleString("id-ID")})`);
  console.log(`  - Daily Reports: ${dailyReports.length} hari terkunci.`);
  console.log(`======================================================\n`);

  return resultReport;
}

async function main() {
  const connectionString =
    process.env.DATABASE_URL ||
    "postgresql://kasiruser:PasswordKasirKuat123@localhost:5432/kasirtokomu";

  const pool = new Pool(getPoolConfig(connectionString));

  try {
    // Parsing target periode dari CLI atau default ke bulan sebelumnya (WIB)
    let targetYear;
    let targetMonth;

    if (process.argv[2] && process.argv[3]) {
      targetYear = parseInt(process.argv[2], 10);
      targetMonth = parseInt(process.argv[3], 10);
      if (isNaN(targetYear) || isNaN(targetMonth) || targetMonth < 1 || targetMonth > 12) {
        console.error("Format argumen tidak valid. Contoh penggunaan: node scripts/auto-monthly-snapshot.mjs 2026 9");
        process.exit(1);
      }
    } else {
      // Default: Bulan sebelumnya berdasarkan zona waktu Asia/Jakarta
      const now = new Date();
      const parts = new Intl.DateTimeFormat("en-CA", {
        timeZone: "Asia/Jakarta",
        year: "numeric",
        month: "2-digit",
        day: "2-digit",
      }).format(now).split("-");
      const currentYear = parseInt(parts[0], 10);
      const currentMonth = parseInt(parts[1], 10);

      targetYear = currentMonth === 1 ? currentYear - 1 : currentYear;
      targetMonth = currentMonth === 1 ? 12 : currentMonth - 1;
    }

    console.log(`Menjalankan Auto Monthly Snapshot untuk Periode: ${targetYear}-${String(targetMonth).padStart(2, "0")}`);

    // Dapatkan semua active workspace owners
    const ownersRes = await pool.query(
      `SELECT DISTINCT u.id, u.email, u.name
       FROM "user" u
       LEFT JOIN store_profiles sp ON sp.user_id = u.id
       WHERE u.id IN (
         SELECT workspace_owner_id FROM user_roles WHERE is_active = 1
         UNION
         SELECT user_id FROM store_profiles
         UNION
         SELECT user_id FROM daily_reports
       )`
    );

    console.log(`Ditemukan ${ownersRes.rows.length} workspace:`, ownersRes.rows.map(o => `${o.email} (${o.id})`));

    for (const owner of ownersRes.rows) {
      try {
        await snapshotMonthlyForWorkspace(pool, owner.id, targetYear, targetMonth);
      } catch (err) {
        console.error(`[Error] Gagal memproses workspace ${owner.email}:`, err);
      }
    }

    console.log("Semua proses snapshot bulanan selesai.");
  } finally {
    await pool.end();
  }
}

// Jalankan jika dieksekusi langsung
if (process.argv[1] && process.argv[1].endsWith("auto-monthly-snapshot.mjs")) {
  main().catch((err) => {
    console.error("Fatal error running auto-monthly-snapshot:", err);
    process.exit(1);
  });
}
