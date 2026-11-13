import { pool } from "@/db/client";

export type RecommendationCategory =
  | "margin"
  | "produk_laris"
  | "stok_prioritas"
  | "stok_mengendap"
  | "arus_kas";

export type RecommendationPriority = "tinggi" | "sedang" | "info";

export type StoreRecommendationItem = {
  category: RecommendationCategory;
  title: string;
  detail: string;
  priority: RecommendationPriority;
};

export type ExpenseFlowBreakdown = {
  operationalExpense: number;
  kulakanExpense: number;
  titipanSettlement: number;
  cashMovementTotal: number;
  profitDistribution: number;
  recordedTitipanProfit: number;
  estimatedTitipanProfit: number;
  operationalCount: number;
  kulakanCount: number;
  titipanCount: number;
};

function formatRp(value: number): string {
  return new Intl.NumberFormat("id-ID", {
    style: "currency",
    currency: "IDR",
    maximumFractionDigits: 0,
  }).format(Math.round(value || 0));
}

function extractRecordedTitipanProfit(title: string): number {
  const match = /untung\s*toko\s*:?\s*rp\.?\s*([\d.]+)/i.exec(title);
  if (!match?.[1]) return 0;
  const digits = match[1].replace(/\./g, "");
  const parsed = Number(digits);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : 0;
}

/**
 * Computes separated outflow metrics so true operating expenses, supplier restock notes (kulakan),
 * and consignment settlements (titipan) never get conflated in financial reports.
 */
export async function getExpenseFlowBreakdown(
  workspaceOwnerId: string,
  periodStart: string,
  periodEnd: string
): Promise<ExpenseFlowBreakdown> {
  const result = await pool.query<{
    title: string;
    amount: string;
    expenseType: string;
    category: string;
    isCashMovement: boolean;
  }>(
    `
      select
        title,
        coalesce(amount, 0)::text as amount,
        coalesce(expense_type, category, 'operasional') as "expenseType",
        coalesce(category, 'operasional') as category,
        coalesce(is_cash_movement, false) as "isCashMovement"
      from expenses
      where user_id = $1
        and created_at >= $2::timestamptz
        and created_at < $3::timestamptz
    `,
    [workspaceOwnerId, periodStart, periodEnd]
  );

  const breakdown: ExpenseFlowBreakdown = {
    operationalExpense: 0,
    kulakanExpense: 0,
    titipanSettlement: 0,
    cashMovementTotal: 0,
    profitDistribution: 0,
    recordedTitipanProfit: 0,
    estimatedTitipanProfit: 0,
    operationalCount: 0,
    kulakanCount: 0,
    titipanCount: 0,
  };

  for (const row of result.rows) {
    const amount = Number(row.amount || 0);
    const typeKey = (row.expenseType || row.category || "operasional").toLowerCase().trim();

    if (typeKey === "bagi_hasil_investor") {
      breakdown.profitDistribution += amount;
      continue;
    }

    if (typeKey === "setoran_tabungan" || (row.isCashMovement && typeKey !== "sales_titipan" && typeKey !== "sales_toko")) {
      breakdown.cashMovementTotal += amount;
      continue;
    }

    if (typeKey === "sales_titipan" || typeKey === "titipan") {
      breakdown.titipanSettlement += amount;
      breakdown.titipanCount += 1;
      const recorded = extractRecordedTitipanProfit(row.title || "");
      breakdown.recordedTitipanProfit += recorded;
      continue;
    }

    if (typeKey === "sales_toko" || typeKey === "kulakan" || typeKey === "stok") {
      breakdown.kulakanExpense += amount;
      breakdown.kulakanCount += 1;
      continue;
    }

    // Default true operating expenses: 'operasional' | 'gaji_sosial'
    breakdown.operationalExpense += amount;
    breakdown.operationalCount += 1;
  }

  breakdown.estimatedTitipanProfit =
    breakdown.recordedTitipanProfit > 0
      ? breakdown.recordedTitipanProfit
      : Math.round(breakdown.titipanSettlement * 0.12);

  return breakdown;
}

export async function buildStoreRecommendations(
  workspaceOwnerId: string,
  periodStart: string,
  periodEnd: string,
  summary: {
    revenue: number;
    cogs: number;
    grossProfit: number;
    operationalExpense: number;
    netProfit: number;
    transactionCount: number;
  }
): Promise<StoreRecommendationItem[]> {
  const [salesPerfRes, slowStockRes, expenseFlow] = await Promise.all([
    pool.query<{
      productId: string;
      name: string;
      stock: number;
      minimumStock: number;
      buyPrice: number;
      sellPrice: number;
      soldQty: string;
      revenue: string;
      grossProfit: string;
    }>(
      `
        select
          p.id as "productId",
          p.name,
          coalesce(p.stock, 0)::int as stock,
          coalesce(p.minimum_stock, 5)::int as "minimumStock",
          coalesce(p.buy_price, 0)::int as "buyPrice",
          coalesce(p.sell_price, 0)::int as "sellPrice",
          coalesce(sum(ti.quantity), 0)::text as "soldQty",
          coalesce(sum(ti.quantity * ti.unit_price), 0)::text as revenue,
          coalesce(sum(ti.quantity * (ti.unit_price - ti.cost_price)), 0)::text as "grossProfit"
        from transaction_items ti
        join transactions t on t.id = ti.transaction_id
        left join products p on p.id = ti.product_id and p.user_id = t.user_id
        where t.user_id = $1
          and coalesce(t.occurred_at, t.created_at) >= $2::timestamptz
          and coalesce(t.occurred_at, t.created_at) < $3::timestamptz
          and p.id is not null
        group by p.id, p.name, p.stock, p.minimum_stock, p.buy_price, p.sell_price
        order by sum(ti.quantity * (ti.unit_price - ti.cost_price)) desc
      `,
      [workspaceOwnerId, periodStart, periodEnd]
    ),
    pool.query<{
      productId: string;
      name: string;
      stock: number;
      buyPrice: number;
      lockedCapital: string;
    }>(
      `
        select
          p.id as "productId",
          p.name,
          p.stock::int as stock,
          p.buy_price::int as "buyPrice",
          (p.stock * p.buy_price)::text as "lockedCapital"
        from products p
        where p.user_id = $1
          and p.stock > 0
          and p.buy_price > 0
          and not exists (
            select 1
            from transaction_items ti
            join transactions t on t.id = ti.transaction_id
            where t.user_id = p.user_id
              and ti.product_id = p.id
              and coalesce(t.occurred_at, t.created_at) >= $2::timestamptz
              and coalesce(t.occurred_at, t.created_at) < $3::timestamptz
          )
        order by (p.stock * p.buy_price) desc
        limit 5
      `,
      [workspaceOwnerId, periodStart, periodEnd]
    ),
    getExpenseFlowBreakdown(workspaceOwnerId, periodStart, periodEnd),
  ]);

  const items = salesPerfRes.rows.map((r) => {
    const soldQty = Number(r.soldQty || 0);
    const revenue = Number(r.revenue || 0);
    const grossProfit = Number(r.grossProfit || 0);
    const marginPct = revenue > 0 ? Math.round((grossProfit / revenue) * 1000) / 10 : 0;
    const unitProfit = soldQty > 0 ? Math.round(grossProfit / soldQty) : Math.max(0, r.sellPrice - r.buyPrice);
    return {
      productId: r.productId,
      name: r.name,
      stock: r.stock,
      minimumStock: r.minimumStock,
      soldQty,
      revenue,
      grossProfit,
      marginPct,
      unitProfit,
    };
  });

  const recommendations: StoreRecommendationItem[] = [];

  // 1. Margin evaluation & product mix strategy
  const grossMarginPct =
    summary.revenue > 0 ? Math.round((summary.grossProfit / summary.revenue) * 1000) / 10 : 0;
  const highMarginChampions = [...items]
    .filter((i) => i.grossProfit > 0)
    .sort((a, b) => b.grossProfit - a.grossProfit)
    .slice(0, 3);
  const thinMarginHighVol = [...items]
    .filter((i) => i.soldQty >= 3 && (i.marginPct <= 14 || i.unitProfit <= 1000))
    .sort((a, b) => b.soldQty - a.soldQty)
    .slice(0, 3);

  if (summary.revenue > 0) {
    const championNames = highMarginChampions
      .map((i) => `${i.name} (+${formatRp(i.grossProfit)}, margin ${i.marginPct}%)`)
      .join("; ");
    const thinNames = thinMarginHighVol
      .map((i) => `${i.name} (${i.soldQty} terjual, untung ~${formatRp(i.unitProfit)}/pcs)`)
      .join("; ");

    if (grossMarginPct < 18) {
      recommendations.push({
        category: "margin",
        priority: "tinggi",
        title: `Strategi Margin Toko (${grossMarginPct}% — Tipis Khas Sembako/Warung)`,
        detail:
          `Rata-rata margin kotor toko ${grossMarginPct}% (${formatRp(summary.grossProfit)} dari omzet ${formatRp(summary.revenue)}).` +
          (thinNames
            ? ` Barang pancingan margin tipis: ${thinNames}.`
            : "") +
          (championNames
            ? ` Dorong produk laba tertinggi: ${championNames} di rak depan/dekat kasir untuk mengatrol keuntungan bersih.`
            : " Tambahkan variasi jajanan/titipan bermargin >= 15-20% di dekat kasir agar tiap keranjang belanja menghasilkan profit lebih besar."),
      });
    } else {
      recommendations.push({
        category: "margin",
        priority: "info",
        title: `Margin Kotor Sehat (${grossMarginPct}%) — Pertahankan Komposisi Produk`,
        detail:
          championNames
            ? `Penyumbang laba kotor utama periode ini: ${championNames}. Jaga ketersediaan stok dan tampilkan di rak utama.`
            : `Margin kotor periode ini ${grossMarginPct}% (${formatRp(summary.grossProfit)}).`,
      });
    }
  }

  // 2. Top velocity products
  const topFastMovers = [...items].sort((a, b) => b.soldQty - a.soldQty).slice(0, 3);
  if (topFastMovers.length > 0) {
    recommendations.push({
      category: "produk_laris",
      priority: "info",
      title: "Produk Paling Cepat Berputar (Wajib Jaga Stok)",
      detail: `Produk dengan perputaran tercepat: ${topFastMovers
        .map((i) => `${i.name} (${i.soldQty} unit, omzet ${formatRp(i.revenue)})`)
        .join(", ")}. Pastikan tidak pernah kosong karena menjadi magnet pembeli datang ke toko.`,
    });
  }

  // 3. Priority restock for fast sellers running low
  const urgentRestock = items
    .filter((i) => i.soldQty > 0 && i.stock <= Math.max(i.minimumStock, 5))
    .sort((a, b) => b.soldQty - a.soldQty)
    .slice(0, 5);
  if (urgentRestock.length > 0) {
    recommendations.push({
      category: "stok_prioritas",
      priority: "tinggi",
      title: `Restok Mendesak ${urgentRestock.length} Produk Laris Hampir Habis`,
      detail: `Segera restok saat sales/kulakan datang: ${urgentRestock
        .map((i) => `${i.name} (sisa ${i.stock}, laku ${i.soldQty})`)
        .join("; ")}. Kekosongan barang laris berisiko menurunkan omzet harian.`,
    });
  }

  // 4. Slow-moving stock locking up capital
  const slowRows = slowStockRes.rows.slice(0, 3);
  if (slowRows.length > 0) {
    const totalLocked = slowRows.reduce((s, r) => s + Number(r.lockedCapital || 0), 0);
    recommendations.push({
      category: "stok_mengendap",
      priority: "sedang",
      title: `Evaluasi Stok Mengendap (~${formatRp(totalLocked)} Modal Tertahan)`,
      detail: `Produk belum terjual di periode ini namun menyedot modal: ${slowRows
        .map((r) => `${r.name} (${r.stock} unit = ${formatRp(Number(r.lockedCapital || 0))})`)
        .join("; ")}. Pertimbangkan promo paket hemat atau kurangi kulakan ulang item tersebut.`,
    });
  }

  // 5. Cashflow discipline: operating expense vs kulakan vs titipan
  const opsRatio =
    summary.revenue > 0 ? Math.round((expenseFlow.operationalExpense / summary.revenue) * 1000) / 10 : 0;
  recommendations.push({
    category: "arus_kas",
    priority: opsRatio > 10 ? "tinggi" : "info",
    title: "Evaluasi Arus Kas: Bedakan Operasional vs Kulakan vs Titipan",
    detail:
      `Beban operasional murni periode ini tercatat ${formatRp(expenseFlow.operationalExpense)} (${opsRatio}% dari omzet). ` +
      `Belanja kulakan/nota supplier (${formatRp(expenseFlow.kulakanExpense)}) dan setor barang titipan (${formatRp(expenseFlow.titipanSettlement)}` +
      `${expenseFlow.titipanSettlement > 0 ? `, est. untung toko +${formatRp(expenseFlow.estimatedTitipanProfit)}` : ""}) ` +
      `dicatat terpisah sebagai perputaran modal/konsinyasi sehingga tidak memotong laba toko dua kali. ` +
      `Tips: perbanyak mitra barang titipan laku harian karena tidak mengendapkan modal dan memberi komisi bersih langsung.`,
  });

  return recommendations;
}

