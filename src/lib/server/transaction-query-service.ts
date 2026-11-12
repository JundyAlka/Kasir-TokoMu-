import { pool } from "@/db/client";
import { getJakartaDayRange } from "@/lib/server/timezone";
import type { PaymentMethod, Transaction } from "@/lib/types";

export type TransactionSortOption = "newest" | "oldest" | "highest" | "lowest";

export type TransactionQueryFilters = {
  q?: string;
  startDate?: string;
  endDate?: string;
  paymentMethod?: string;
  recordedBy?: string;
  entrySource?: string;
  shiftSessionId?: string;
  minTotal?: number | null;
  maxTotal?: number | null;
  sort?: TransactionSortOption;
  page?: number;
  pageSize?: number;
};

export type DetailedTransactionRow = Transaction & {
  shiftName?: string | null;
  cogs?: number;
  grossProfit?: number;
};

export type TransactionQueryResult = {
  items: DetailedTransactionRow[];
  pagination: {
    page: number;
    pageSize: number;
    totalCount: number;
    totalPages: number;
  };
  summary: {
    filteredCount: number;
    filteredTotal: number;
    filteredCogs?: number;
    filteredGrossProfit?: number;
    paymentBreakdown: Array<{
      method: string;
      count: number;
      total: number;
    }>;
  };
  filterOptions: {
    paymentMethods: string[];
    cashiers: string[];
  };
};

type WhereBuildResult = {
  whereSql: string;
  params: unknown[];
};

const DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;

function buildTransactionWhere(
  workspaceOwnerId: string,
  filters: TransactionQueryFilters
): WhereBuildResult {
  const conditions: string[] = [`t.user_id = $1`];
  const params: unknown[] = [workspaceOwnerId];

  const pushParam = (value: unknown) => {
    params.push(value);
    return `$${params.length}`;
  };

  if (filters.startDate && DATE_PATTERN.test(filters.startDate)) {
    const startIso = getJakartaDayRange(filters.startDate).start;
    const p = pushParam(startIso);
    conditions.push(`t.occurred_at >= ${p}::timestamptz`);
  }

  if (filters.endDate && DATE_PATTERN.test(filters.endDate)) {
    const endIso = getJakartaDayRange(filters.endDate).end;
    const p = pushParam(endIso);
    conditions.push(`t.occurred_at < ${p}::timestamptz`);
  }

  if (filters.paymentMethod && filters.paymentMethod !== "all") {
    const p = pushParam(filters.paymentMethod);
    conditions.push(`t.payment_method = ${p}`);
  }

  if (filters.recordedBy && filters.recordedBy !== "all") {
    const p = pushParam(filters.recordedBy);
    conditions.push(
      `coalesce(nullif(trim(t.recorded_by_name), ''), 'Kasir / Tanpa Nama') = ${p}`
    );
  }

  if (filters.entrySource === "pos" || filters.entrySource === "import") {
    const p = pushParam(filters.entrySource);
    conditions.push(`t.entry_source = ${p}`);
  }

  if (filters.shiftSessionId && filters.shiftSessionId.trim()) {
    const p = pushParam(filters.shiftSessionId.trim());
    conditions.push(`t.shift_session_id = ${p}`);
  }

  if (typeof filters.minTotal === "number" && Number.isFinite(filters.minTotal) && filters.minTotal >= 0) {
    const p = pushParam(Math.round(filters.minTotal));
    conditions.push(`t.total >= ${p}`);
  }

  if (typeof filters.maxTotal === "number" && Number.isFinite(filters.maxTotal) && filters.maxTotal >= 0) {
    const p = pushParam(Math.round(filters.maxTotal));
    conditions.push(`t.total <= ${p}`);
  }

  const trimmedSearch = filters.q?.trim();
  if (trimmedSearch) {
    const pattern = `%${trimmedSearch}%`;
    const p = pushParam(pattern);
    conditions.push(`(
      t.id ILIKE ${p}
      OR coalesce(t.external_ref, '') ILIKE ${p}
      OR coalesce(t.recorded_by_name, '') ILIKE ${p}
      OR t.payment_method ILIKE ${p}
      OR EXISTS (
        SELECT 1
        FROM transaction_items ti
        WHERE ti.transaction_id = t.id
          AND (ti.product_name ILIKE ${p} OR coalesce(ti.note, '') ILIKE ${p})
      )
    )`);
  }

  return {
    whereSql: conditions.join(" AND "),
    params,
  };
}

function getOrderBySql(sort?: TransactionSortOption): string {
  switch (sort) {
    case "oldest":
      return "t.occurred_at ASC, t.created_at ASC";
    case "highest":
      return "t.total DESC, t.occurred_at DESC";
    case "lowest":
      return "t.total ASC, t.occurred_at DESC";
    case "newest":
    default:
      return "t.occurred_at DESC, t.created_at DESC";
  }
}

export async function queryTransactions(
  workspaceOwnerId: string,
  filters: TransactionQueryFilters,
  options?: {
    includeProfit?: boolean;
  }
): Promise<TransactionQueryResult> {
  const includeProfit = Boolean(options?.includeProfit);
  const pageSize = Math.min(100, Math.max(1, Math.trunc(filters.pageSize ?? 25)));
  const requestedPage = Math.max(1, Math.trunc(filters.page ?? 1));
  const { whereSql, params } = buildTransactionWhere(workspaceOwnerId, filters);
  const orderBySql = getOrderBySql(filters.sort);

  // 1. Aggregate summary & count directly in PostgreSQL (low VPS RAM)
  const summaryPromise = pool.query<{
    total_count: string;
    total_amount: string;
  }>(
    `SELECT
       COUNT(*)::text AS total_count,
       COALESCE(SUM(t.total), 0)::text AS total_amount
     FROM transactions t
     WHERE ${whereSql}`,
    params
  );

  const paymentBreakdownPromise = pool.query<{
    method: string;
    cnt: string;
    total: string;
  }>(
    `SELECT
       t.payment_method AS method,
       COUNT(*)::text AS cnt,
       COALESCE(SUM(t.total), 0)::text AS total
     FROM transactions t
     WHERE ${whereSql}
     GROUP BY t.payment_method
     ORDER BY SUM(t.total) DESC`,
    params
  );

  const cogsPromise = includeProfit
    ? pool.query<{ total_cogs: string }>(
        `SELECT
           COALESCE(SUM(ti.cost_price * ti.quantity), 0)::text AS total_cogs
         FROM transaction_items ti
         JOIN transactions t ON t.id = ti.transaction_id
         WHERE ${whereSql}`,
        params
      )
    : Promise.resolve(null);

  const filterOptionsPromise = pool.query<{
    payment_methods: string[] | null;
    cashiers: string[] | null;
  }>(
    `SELECT
       (
         SELECT ARRAY(
           SELECT DISTINCT t2.payment_method
           FROM transactions t2
           WHERE t2.user_id = $1 AND t2.payment_method <> ''
           ORDER BY t2.payment_method ASC
         )
       ) AS payment_methods,
       (
         SELECT ARRAY(
           SELECT DISTINCT coalesce(nullif(trim(t3.recorded_by_name), ''), 'Kasir / Tanpa Nama')
           FROM transactions t3
           WHERE t3.user_id = $1
           ORDER BY 1 ASC
         )
       ) AS cashiers`,
    [workspaceOwnerId]
  );

  const [summaryRes, breakdownRes, cogsRes, optionsRes] = await Promise.all([
    summaryPromise,
    paymentBreakdownPromise,
    cogsPromise,
    filterOptionsPromise,
  ]);

  const totalCount = Number(summaryRes.rows[0]?.total_count ?? 0);
  const filteredTotal = Number(summaryRes.rows[0]?.total_amount ?? 0);
  const totalPages = Math.max(1, Math.ceil(totalCount / pageSize));
  const safePage = Math.min(requestedPage, totalPages);
  const offset = (safePage - 1) * pageSize;

  // 2. Fetch ONLY the active page of transactions (LIMIT / OFFSET)
  const limitParam = `$${params.length + 1}`;
  const offsetParam = `$${params.length + 2}`;
  const pageRes = await pool.query<{
    id: string;
    total: number;
    paid_amount: number;
    change_amount: number;
    payment_method: string;
    recorded_by_user_id: string;
    recorded_by_name: string;
    shift_session_id: string | null;
    shift_name: string | null;
    created_at: string;
    occurred_at: string;
    entry_source: string;
    external_ref: string | null;
  }>(
    `SELECT
       t.id,
       t.total,
       t.paid_amount,
       t.change_amount,
       t.payment_method,
       t.recorded_by_user_id,
       t.recorded_by_name,
       t.shift_session_id,
       s.name AS shift_name,
       t.created_at,
       t.occurred_at,
       t.entry_source,
       t.external_ref
     FROM transactions t
     LEFT JOIN shift_sessions ss ON ss.id = t.shift_session_id
     LEFT JOIN shifts s ON s.id = ss.shift_id
     WHERE ${whereSql}
     ORDER BY ${orderBySql}
     LIMIT ${limitParam} OFFSET ${offsetParam}`,
    [...params, pageSize, offset]
  );

  const txIds = pageRes.rows.map((r) => r.id);
  const itemsByTx = new Map<string, Transaction["items"]>();

  if (txIds.length > 0) {
    const itemsRes = await pool.query<{
      transaction_id: string;
      product_id: string | null;
      product_name: string;
      quantity: number;
      unit_price: number;
      cost_price: number;
    }>(
      `SELECT
         ti.transaction_id,
         ti.product_id,
         ti.product_name,
         ti.quantity,
         ti.unit_price,
         ti.cost_price
       FROM transaction_items ti
       WHERE ti.transaction_id = ANY($1::text[])
       ORDER BY ti.id ASC`,
      [txIds]
    );

    for (const item of itemsRes.rows) {
      const list = itemsByTx.get(item.transaction_id) ?? [];
      list.push({
        productId: item.product_id ?? "",
        productName: item.product_name,
        quantity: Number(item.quantity),
        unitPrice: Number(item.unit_price),
        costPrice: includeProfit ? Number(item.cost_price) : 0,
      });
      itemsByTx.set(item.transaction_id, list);
    }
  }

  const items: DetailedTransactionRow[] = pageRes.rows.map((row) => {
    const txItems = itemsByTx.get(row.id) ?? [];
    const total = Number(row.total);
    const cogs = includeProfit
      ? txItems.reduce((sum, item) => sum + item.costPrice * item.quantity, 0)
      : undefined;

    return {
      id: row.id,
      paymentMethod: row.payment_method as PaymentMethod,
      total,
      paidAmount: Number(row.paid_amount),
      changeAmount: Number(row.change_amount),
      createdAt: new Date(row.created_at).toISOString(),
      occurredAt: new Date(row.occurred_at).toISOString(),
      entrySource: (row.entry_source === "import" ? "import" : "pos") as Transaction["entrySource"],
      externalRef: row.external_ref,
      recordedByUserId: row.recorded_by_user_id || "",
      recordedByName: row.recorded_by_name || "",
      shiftSessionId: row.shift_session_id,
      shiftName: row.shift_name ?? null,
      items: txItems,
      ...(includeProfit
        ? {
            cogs,
            grossProfit: total - (cogs ?? 0),
          }
        : {}),
    };
  });

  const filteredCogs = cogsRes ? Number(cogsRes.rows[0]?.total_cogs ?? 0) : undefined;

  return {
    items,
    pagination: {
      page: safePage,
      pageSize,
      totalCount,
      totalPages,
    },
    summary: {
      filteredCount: totalCount,
      filteredTotal,
      ...(includeProfit
        ? {
            filteredCogs,
            filteredGrossProfit: filteredTotal - (filteredCogs ?? 0),
          }
        : {}),
      paymentBreakdown: breakdownRes.rows.map((r) => ({
        method: r.method,
        count: Number(r.cnt),
        total: Number(r.total),
      })),
    },
    filterOptions: {
      paymentMethods: optionsRes.rows[0]?.payment_methods ?? [],
      cashiers: optionsRes.rows[0]?.cashiers ?? [],
    },
  };
}

export async function exportTransactionsCsv(
  workspaceOwnerId: string,
  filters: TransactionQueryFilters,
  options?: {
    includeProfit?: boolean;
    maxRows?: number;
  }
): Promise<string> {
  const includeProfit = Boolean(options?.includeProfit);
  const maxRows = Math.min(5000, Math.max(100, options?.maxRows ?? 5000));
  const { whereSql, params } = buildTransactionWhere(workspaceOwnerId, filters);
  const orderBySql = getOrderBySql(filters.sort);

  const res = await pool.query<{
    id: string;
    occurred_at: string;
    payment_method: string;
    total: number;
    paid_amount: number;
    change_amount: number;
    recorded_by_name: string;
    shift_name: string | null;
    entry_source: string;
    external_ref: string | null;
    items_summary: string | null;
    cogs: string;
  }>(
    `SELECT
       t.id,
       t.occurred_at,
       t.payment_method,
       t.total,
       t.paid_amount,
       t.change_amount,
       coalesce(nullif(trim(t.recorded_by_name), ''), 'Kasir') AS recorded_by_name,
       s.name AS shift_name,
       t.entry_source,
       t.external_ref,
       (
         SELECT string_agg(ti.product_name || ' x' || ti.quantity::text, '; ' ORDER BY ti.id)
         FROM transaction_items ti
         WHERE ti.transaction_id = t.id
       ) AS items_summary,
       (
         SELECT coalesce(sum(ti.cost_price * ti.quantity), 0)::text
         FROM transaction_items ti
         WHERE ti.transaction_id = t.id
       ) AS cogs
     FROM transactions t
     LEFT JOIN shift_sessions ss ON ss.id = t.shift_session_id
     LEFT JOIN shifts s ON s.id = ss.shift_id
     WHERE ${whereSql}
     ORDER BY ${orderBySql}
     LIMIT $${params.length + 1}`,
    [...params, maxRows]
  );

  const escapeCsv = (value: unknown) => {
    const raw = String(value ?? "");
    const safe = /^[=+\-@\t\r]/.test(raw) ? `'${raw}` : raw;
    return `"${safe.replace(/"/g, '""')}"`;
  };

  const headers = [
    "ID Transaksi",
    "Waktu (WIB)",
    "Metode Pembayaran",
    "Total (Rp)",
    "Dibayar (Rp)",
    "Kembalian (Rp)",
    "Kasir / Pencatat",
    "Shift",
    "Sumber",
    "Ref Eksternal",
    "Daftar Produk",
    ...(includeProfit ? ["HPP (Rp)", "Laba Kotor (Rp)"] : []),
  ];

  const lines = [headers.map(escapeCsv).join(",")];

  for (const row of res.rows) {
    const wibTime = new Date(row.occurred_at).toLocaleString("id-ID", {
      timeZone: "Asia/Jakarta",
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
    });
    const total = Number(row.total);
    const cogs = Number(row.cogs ?? 0);

    lines.push(
      [
        row.id,
        wibTime,
        row.payment_method,
        total,
        Number(row.paid_amount),
        Number(row.change_amount),
        row.recorded_by_name,
        row.shift_name ?? "-",
        row.entry_source === "import" ? "Impor" : "Kasir POS",
        row.external_ref ?? "-",
        row.items_summary ?? "-",
        ...(includeProfit ? [cogs, total - cogs] : []),
      ]
        .map(escapeCsv)
        .join(",")
    );
  }

  return lines.join("\r\n");
}

