import { Expense, Product, Transaction } from "@/lib/types";
import { pool } from "@/db/client";

export type ReportRange = "harian" | "mingguan" | "bulanan";

type ReportTransaction = Pick<Transaction, "createdAt" | "total" | "items">;
type ReportExpense = Pick<Expense, "createdAt" | "amount">;

function startOfDay(date: Date) {
  const value = new Date(date);
  value.setHours(0, 0, 0, 0);
  return value;
}

function startOfWeek(date: Date) {
  const value = startOfDay(date);
  const day = value.getDay();
  const diff = day === 0 ? 6 : day - 1;
  value.setDate(value.getDate() - diff);
  return value;
}

function startOfMonth(date: Date) {
  const value = startOfDay(date);
  value.setDate(1);
  return value;
}

function getRangeStart(range: ReportRange, now = new Date()) {
  if (range === "harian") return startOfDay(now);
  if (range === "mingguan") return startOfWeek(now);
  return startOfMonth(now);
}

export function getPeriodRange(year: number, month: number) {
  if (!Number.isInteger(year) || year < 2000 || year > 2100) {
    throw new Error("Tahun periode tidak valid.");
  }

  if (!Number.isInteger(month) || month < 1 || month > 12) {
    throw new Error("Bulan periode tidak valid.");
  }

  const start = new Date(Date.UTC(year, month - 1, 1, 0, 0, 0, 0));
  const end = new Date(Date.UTC(year, month, 1, 0, 0, 0, 0));

  return {
    start: start.toISOString(),
    end: end.toISOString(),
  };
}

export function summarizeReport(
  range: ReportRange,
  transactions: ReportTransaction[],
  expenses: ReportExpense[]
) {
  const start = getRangeStart(range);
  const filteredTransactions = transactions.filter(
    (transaction) => new Date(transaction.createdAt) >= start
  );
  const filteredExpenses = expenses.filter(
    (expense) => new Date(expense.createdAt) >= start
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
      const date = startOfDay(now);
      date.setDate(now.getDate() - (6 - index));
      const label = new Intl.DateTimeFormat("id-ID", { weekday: "short" }).format(date);
      const rows = transactions.filter((transaction) => {
        const value = new Date(transaction.createdAt);
        return (
          value.getFullYear() === date.getFullYear() &&
          value.getMonth() === date.getMonth() &&
          value.getDate() === date.getDate()
        );
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
      const start = startOfWeek(now);
      start.setDate(start.getDate() - (5 - index) * 7);
      const end = new Date(start);
      end.setDate(start.getDate() + 7);
      const rows = transactions.filter((transaction) => {
        const value = new Date(transaction.createdAt);
        return value >= start && value < end;
      });
      const endLabel = new Date(end.getTime() - 1);

      return {
        label: `${start.getDate()}-${endLabel.getDate()}`,
        revenue: rows.reduce((sum, transaction) => sum + transaction.total, 0),
        transactions: rows.length,
      };
    });
  }

  return Array.from({ length: 6 }, (_, index) => {
    const date = new Date(now.getFullYear(), now.getMonth() - (5 - index), 1);
    const rows = transactions.filter((transaction) => {
      const value = new Date(transaction.createdAt);
      return value.getFullYear() === date.getFullYear() && value.getMonth() === date.getMonth();
    });

    return {
      label: new Intl.DateTimeFormat("id-ID", { month: "short" }).format(date),
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
