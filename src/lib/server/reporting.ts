import { Expense, Product, Transaction } from "@/lib/types";
import { pool } from "@/db/client";
import {
  getJakartaDayRange,
  getJakartaMonthRange,
  getJakartaWeekRange,
  isWithinJakartaRange,
  jakartaNow,
  JAKARTA_TIME_ZONE,
} from "@/lib/server/timezone";

export type ReportRange = "harian" | "mingguan" | "bulanan";

type ReportTransaction = Pick<Transaction, "createdAt" | "total" | "items">;
type ReportExpense = Pick<Expense, "createdAt" | "amount">;

function getRange(range: ReportRange, now = new Date()) {
  if (range === "harian") return getJakartaDayRange(now);
  if (range === "mingguan") return getJakartaWeekRange(now);
  const currentJakarta = jakartaNow();
  return getJakartaMonthRange(currentJakarta.getFullYear(), currentJakarta.getMonth() + 1);
}

export function getPeriodRange(year: number, month: number) {
  return getJakartaMonthRange(year, month);
}

export function summarizeReport(
  range: ReportRange,
  transactions: ReportTransaction[],
  expenses: ReportExpense[]
) {
  const selectedRange = getRange(range);
  const filteredTransactions = transactions.filter(
    (transaction) => isWithinJakartaRange(transaction.createdAt, selectedRange)
  );
  const filteredExpenses = expenses.filter(
    (expense) => isWithinJakartaRange(expense.createdAt, selectedRange)
  );

  const revenue = filteredTransactions.reduce((sum, transaction) => sum + transaction.total, 0);
  const cogs = filteredTransactions.reduce(
    (sum, transaction) =>
      sum +
      transaction.items.reduce(
        (itemSum, item) => itemSum + item.costPrice * item.quantity,
        0
      ),
    0
  );
  const expenseTotal = filteredExpenses.reduce((sum, expense) => sum + expense.amount, 0);
  const grossProfit = revenue - cogs;
  const netProfit = grossProfit - expenseTotal;
  const transactionCount = filteredTransactions.length;
  const averageTicket = transactionCount > 0 ? revenue / transactionCount : 0;

  return {
    revenue,
    cogs,
    grossProfit,
    expenseTotal,
    netProfit,
    transactionCount,
    averageTicket,
  };
}

export function buildSeries(range: ReportRange, transactions: ReportTransaction[]) {
  const now = new Date();

  if (range === "harian") {
    return Array.from({ length: 7 }, (_, index) => {
      const date = new Date(now);
      date.setDate(now.getDate() - (6 - index));
      const itemRange = getJakartaDayRange(date);
      const label = new Intl.DateTimeFormat("id-ID", {
        weekday: "short",
        timeZone: JAKARTA_TIME_ZONE,
      }).format(new Date(itemRange.start));
      const rows = transactions.filter((transaction) => {
        return isWithinJakartaRange(transaction.createdAt, itemRange);
      });

      return {
        label,
        revenue: rows.reduce((sum, transaction) => sum + transaction.total, 0),
        transactions: rows.length,
      };
    });
  }

  if (range === "mingguan") {
    return Array.from({ length: 6 }, (_, index) => {
      const anchor = new Date(now);
      anchor.setDate(now.getDate() - (5 - index) * 7);
      const itemRange = getJakartaWeekRange(anchor);
      const rows = transactions.filter((transaction) => {
        return isWithinJakartaRange(transaction.createdAt, itemRange);
      });
      const startLabel = new Intl.DateTimeFormat("id-ID", {
        day: "numeric",
        timeZone: JAKARTA_TIME_ZONE,
      }).format(new Date(itemRange.start));
      const endLabel = new Intl.DateTimeFormat("id-ID", {
        day: "numeric",
        timeZone: JAKARTA_TIME_ZONE,
      }).format(new Date(new Date(itemRange.end).getTime() - 1));

      return {
        label: `${startLabel}-${endLabel}`,
        revenue: rows.reduce((sum, transaction) => sum + transaction.total, 0),
        transactions: rows.length,
      };
    });
  }

  return Array.from({ length: 6 }, (_, index) => {
    const date = new Date(now.getFullYear(), now.getMonth() - (5 - index), 1);
    const year = date.getFullYear();
    const month = date.getMonth() + 1;
    const itemRange = getJakartaMonthRange(year, month);
    const rows = transactions.filter((transaction) => {
      return isWithinJakartaRange(transaction.createdAt, itemRange);
    });

    return {
      label: new Intl.DateTimeFormat("id-ID", {
        month: "short",
        timeZone: JAKARTA_TIME_ZONE,
      }).format(new Date(itemRange.start)),
      revenue: rows.reduce((sum, transaction) => sum + transaction.total, 0),
      transactions: rows.length,
    };
  });
}

export function estimateProductVelocity(products: Product[], transactions: ReportTransaction[]) {
  return products
    .map((product) => {
      const totals = transactions.reduce(
        (sum, transaction) => {
          for (const item of transaction.items) {
            if (item.productId !== product.id) continue;
            sum.sold += item.quantity;
            sum.revenue += item.quantity * item.unitPrice;
          }
          return sum;
        },
        { sold: 0, revenue: 0 }
      );

      return {
        productId: product.id,
        name: product.name,
        sold: totals.sold,
        revenue: totals.revenue,
      };
    })
    .sort((a, b) => b.sold - a.sold);
}

export async function getTopProductsForPeriod(
  workspaceOwnerId: string,
  periodStart: string,
  periodEnd: string,
  limit = 5
) {
  const result = await pool.query<{
    productId: string;
    name: string;
    sold: number;
    revenue: number;
  }>(
    `
      select
        ti.product_id as "productId",
        ti.product_name as name,
        sum(ti.quantity)::int as sold,
        sum(ti.quantity * ti.unit_price)::int as revenue
      from transaction_items ti
      join transactions t on t.id = ti.transaction_id
      where t.user_id = $1
        and t.created_at >= $2::timestamptz
        and t.created_at < $3::timestamptz
      group by ti.product_id, ti.product_name
      order by sold desc, revenue desc
      limit $4
    `,
    [workspaceOwnerId, periodStart, periodEnd, limit]
  );

  return result.rows;
}

// ---------------------------------------------------------------------------
// Dashboard metric detail builders
// ---------------------------------------------------------------------------

export type OmzetDetail = {
  revenue: number;
  txnCount: number;
  avgTicket: number;
  grossProfit: number;
  marginPct: number;
  vsYesterdayPct: number | null;
  byPaymentMethod: { method: string; total: number; count: number }[];
  hourlySeries: { hour: number; total: number }[];
};

export async function getOmzetDetail(
  workspaceOwnerId: string,
  date: Date
): Promise<OmzetDetail> {
  const todayRange = getJakartaDayRange(date);
  const yesterday = new Date(date);
  yesterday.setDate(yesterday.getDate() - 1);
  const yesterdayRange = getJakartaDayRange(yesterday);

  // Today's aggregates
  const aggResult = await pool.query<{
    revenue: string;
    txnCount: string;
    grossProfit: string;
  }>(
    `
    select
      coalesce(sum(t.total), 0)::text as "revenue",
      count(t.id)::text as "txnCount",
      coalesce(sum((ti.unit_price - ti.cost_price) * ti.quantity), 0)::text as "grossProfit"
    from transactions t
    left join transaction_items ti on ti.transaction_id = t.id
    where t.user_id = $1
      and t.created_at >= $2::timestamptz
      and t.created_at < $3::timestamptz
    `,
    [workspaceOwnerId, todayRange.start, todayRange.end]
  );

  const revenue = Number(aggResult.rows[0]?.revenue ?? 0);
  const txnCount = Number(aggResult.rows[0]?.txnCount ?? 0);
  const grossProfit = Number(aggResult.rows[0]?.grossProfit ?? 0);
  const avgTicket = txnCount > 0 ? Math.round(revenue / txnCount) : 0;
  const marginPct = revenue > 0 ? Math.round((grossProfit / revenue) * 10000) / 100 : 0;

  // Yesterday's revenue for comparison
  const yesterdayResult = await pool.query<{ revenue: string }>(
    `
    select coalesce(sum(total), 0)::text as "revenue"
    from transactions
    where user_id = $1
      and created_at >= $2::timestamptz
      and created_at < $3::timestamptz
    `,
    [workspaceOwnerId, yesterdayRange.start, yesterdayRange.end]
  );
  const yesterdayRevenue = Number(yesterdayResult.rows[0]?.revenue ?? 0);
  const vsYesterdayPct =
    yesterdayRevenue > 0
      ? Math.round(((revenue - yesterdayRevenue) / yesterdayRevenue) * 10000) / 100
      : null;

  // By payment method
  const payMethodResult = await pool.query<{
    method: string;
    total: string;
    count: string;
  }>(
    `
    select
      payment_method as method,
      coalesce(sum(total), 0)::text as total,
      count(*)::text as count
    from transactions
    where user_id = $1
      and created_at >= $2::timestamptz
      and created_at < $3::timestamptz
    group by payment_method
    order by total desc
    `,
    [workspaceOwnerId, todayRange.start, todayRange.end]
  );
  const byPaymentMethod = payMethodResult.rows.map((r) => ({
    method: r.method,
    total: Number(r.total),
    count: Number(r.count),
  }));

  // Hourly series (0-23)
  const hourlyResult = await pool.query<{ hour: string; total: string }>(
    `
    select
      extract(hour from created_at at time zone 'Asia/Jakarta')::int::text as hour,
      coalesce(sum(total), 0)::text as total
    from transactions
    where user_id = $1
      and created_at >= $2::timestamptz
      and created_at < $3::timestamptz
    group by 1
    order by 1
    `,
    [workspaceOwnerId, todayRange.start, todayRange.end]
  );
  const hourMap = new Map(hourlyResult.rows.map((r) => [Number(r.hour), Number(r.total)]));
  const hourlySeries = Array.from({ length: 24 }, (_, i) => ({
    hour: i,
    total: hourMap.get(i) ?? 0,
  }));

  return {
    revenue,
    txnCount,
    avgTicket,
    grossProfit,
    marginPct,
    vsYesterdayPct,
    byPaymentMethod,
    hourlySeries,
  };
}

export type TransaksiDetail = {
  txnCount: number;
  itemsSold: number;
  avgItemsPerTxn: number;
  largest: number;
  smallest: number;
  byPaymentMethod: { method: string; total: number; count: number }[];
  hourlySeries: { hour: number; count: number }[];
};

export async function getTransaksiDetail(
  workspaceOwnerId: string,
  date: Date
): Promise<TransaksiDetail> {
  const todayRange = getJakartaDayRange(date);

  const aggResult = await pool.query<{
    txnCount: string;
    itemsSold: string;
    largest: string;
    smallest: string;
  }>(
    `
    select
      count(distinct t.id)::text as "txnCount",
      coalesce(sum(ti.quantity), 0)::text as "itemsSold",
      coalesce(max(t.total), 0)::text as "largest",
      coalesce(min(t.total), 0)::text as "smallest"
    from transactions t
    left join transaction_items ti on ti.transaction_id = t.id
    where t.user_id = $1
      and t.created_at >= $2::timestamptz
      and t.created_at < $3::timestamptz
    `,
    [workspaceOwnerId, todayRange.start, todayRange.end]
  );

  const txnCount = Number(aggResult.rows[0]?.txnCount ?? 0);
  const itemsSold = Number(aggResult.rows[0]?.itemsSold ?? 0);
  const largest = Number(aggResult.rows[0]?.largest ?? 0);
  const smallest = Number(aggResult.rows[0]?.smallest ?? 0);
  const avgItemsPerTxn = txnCount > 0 ? Math.round((itemsSold / txnCount) * 10) / 10 : 0;

  // By payment method
  const payMethodResult = await pool.query<{
    method: string;
    total: string;
    count: string;
  }>(
    `
    select
      payment_method as method,
      coalesce(sum(total), 0)::text as total,
      count(*)::text as count
    from transactions
    where user_id = $1
      and created_at >= $2::timestamptz
      and created_at < $3::timestamptz
    group by payment_method
    order by count desc
    `,
    [workspaceOwnerId, todayRange.start, todayRange.end]
  );
  const byPaymentMethod = payMethodResult.rows.map((r) => ({
    method: r.method,
    total: Number(r.total),
    count: Number(r.count),
  }));

  // Hourly series
  const hourlyResult = await pool.query<{ hour: string; count: string }>(
    `
    select
      extract(hour from created_at at time zone 'Asia/Jakarta')::int::text as hour,
      count(*)::text as count
    from transactions
    where user_id = $1
      and created_at >= $2::timestamptz
      and created_at < $3::timestamptz
    group by 1
    order by 1
    `,
    [workspaceOwnerId, todayRange.start, todayRange.end]
  );
  const hourMap = new Map(hourlyResult.rows.map((r) => [Number(r.hour), Number(r.count)]));
  const hourlySeries = Array.from({ length: 24 }, (_, i) => ({
    hour: i,
    count: hourMap.get(i) ?? 0,
  }));

  return { txnCount, itemsSold, avgItemsPerTxn, largest, smallest, byPaymentMethod, hourlySeries };
}

export type StokMenipisItem = {
  id: string;
  name: string;
  category: string;
  stock: number;
  minimumStock: number;
  dailyVelocity: number;
  daysToEmpty: number | null;
  suggestedRestockQty: number;
};

export async function getStokMenipisDetail(
  workspaceOwnerId: string,
  _date: Date
): Promise<StokMenipisItem[]> {
  // Products where stock <= minimumStock (using the store's stockAlertThreshold too)
  const result = await pool.query<{
    id: string;
    name: string;
    category: string;
    stock: number;
    minimumStock: number;
    stockAlertThreshold: number;
    soldLast7d: string;
  }>(
    `
    select
      p.id,
      p.name,
      p.category,
      p.stock,
      p.minimum_stock as "minimumStock",
      sp.stock_alert_threshold as "stockAlertThreshold",
      coalesce(s.sold, 0)::text as "soldLast7d"
    from products p
    join store_profiles sp on sp.user_id = p.user_id
    left join lateral (
      select sum(ti.quantity) as sold
      from transaction_items ti
      join transactions t on t.id = ti.transaction_id
      where ti.product_id = p.id
        and t.created_at >= now() - interval '7 days'
    ) s on true
    where p.user_id = $1
      and p.stock <= greatest(p.minimum_stock, sp.stock_alert_threshold)
    order by p.stock asc, p.name asc
    `,
    [workspaceOwnerId]
  );

  return result.rows.map((r) => {
    const soldLast7d = Number(r.soldLast7d);
    const dailyVelocity = Math.round((soldLast7d / 7) * 10) / 10;
    const daysToEmpty = dailyVelocity > 0 ? Math.round((r.stock / dailyVelocity) * 10) / 10 : null;
    const target = Math.max(r.minimumStock, r.stockAlertThreshold) * 2;
    const suggestedRestockQty = Math.max(0, target - r.stock);

    return {
      id: r.id,
      name: r.name,
      category: r.category,
      stock: r.stock,
      minimumStock: r.minimumStock,
      dailyVelocity,
      daysToEmpty,
      suggestedRestockQty,
    };
  });
}

export type KasbonDetail = {
  totalOutstanding: number;
  debtorCount: number;
  nearestDue: string | null;
  overdueCount: number;
  overdueAmount: number;
  topDebtors: { borrowerName: string; whatsapp: string; total: number; count: number }[];
};

export async function getKasbonDetail(
  workspaceOwnerId: string,
  _date: Date
): Promise<KasbonDetail> {
  // Outstanding debts summary
  const aggResult = await pool.query<{
    totalOutstanding: string;
    debtorCount: string;
    nearestDue: string | null;
  }>(
    `
    select
      coalesce(sum(amount), 0)::text as "totalOutstanding",
      count(distinct borrower_name)::text as "debtorCount",
      min(due_date)::text as "nearestDue"
    from debts
    where user_id = $1
      and is_paid = 0
    `,
    [workspaceOwnerId]
  );

  const totalOutstanding = Number(aggResult.rows[0]?.totalOutstanding ?? 0);
  const debtorCount = Number(aggResult.rows[0]?.debtorCount ?? 0);
  const nearestDue = aggResult.rows[0]?.nearestDue ?? null;

  // Overdue
  const overdueResult = await pool.query<{
    overdueCount: string;
    overdueAmount: string;
  }>(
    `
    select
      count(*)::text as "overdueCount",
      coalesce(sum(amount), 0)::text as "overdueAmount"
    from debts
    where user_id = $1
      and is_paid = 0
      and due_date < now()
    `,
    [workspaceOwnerId]
  );
  const overdueCount = Number(overdueResult.rows[0]?.overdueCount ?? 0);
  const overdueAmount = Number(overdueResult.rows[0]?.overdueAmount ?? 0);

  // Top debtors
  const topResult = await pool.query<{
    borrowerName: string;
    whatsapp: string;
    total: string;
    count: string;
  }>(
    `
    select
      borrower_name as "borrowerName",
      whatsapp,
      sum(amount)::text as total,
      count(*)::text as count
    from debts
    where user_id = $1
      and is_paid = 0
    group by borrower_name, whatsapp
    order by total desc
    limit 10
    `,
    [workspaceOwnerId]
  );
  const topDebtors = topResult.rows.map((r) => ({
    borrowerName: r.borrowerName,
    whatsapp: r.whatsapp,
    total: Number(r.total),
    count: Number(r.count),
  }));

  return { totalOutstanding, debtorCount, nearestDue, overdueCount, overdueAmount, topDebtors };
}
