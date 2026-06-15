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
