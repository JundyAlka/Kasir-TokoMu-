import { Expense, Product, Transaction } from "@/lib/types";
import {
  getJakartaDayRange,
  getJakartaMonthRange,
  getJakartaWeekRange,
  isWithinJakartaRange,
  jakartaNow,
  JAKARTA_TIME_ZONE,
} from "@/lib/server/timezone";

export type ReportRange = "harian" | "mingguan" | "bulanan";

function getRange(range: ReportRange, now = new Date()) {
  if (range === "harian") {
    return getJakartaDayRange(now);
  }

  if (range === "mingguan") {
    return getJakartaWeekRange(now);
  }

  const currentJakarta = jakartaNow();
  return getJakartaMonthRange(currentJakarta.getFullYear(), currentJakarta.getMonth() + 1);
}

export function summarizeReport(
  range: ReportRange,
  transactions: Transaction[],
  expenses: Expense[]
) {
  const selectedRange = getRange(range);
  const filteredTransactions = transactions.filter(
    (transaction) => isWithinJakartaRange(transaction.createdAt, selectedRange)
  );
  const filteredExpenses = expenses.filter(
    (expense) => isWithinJakartaRange(expense.createdAt, selectedRange)
  );

  const revenue = filteredTransactions.reduce(
    (sum, transaction) => sum + transaction.total,
    0
  );
  const costOfGoods = filteredTransactions.reduce(
    (sum, transaction) =>
      sum +
      transaction.items.reduce(
        (itemSum, item) => itemSum + item.costPrice * item.quantity,
        0
      ),
    0
  );
  const expenseTotal = filteredExpenses.reduce(
    (sum, expense) => sum + expense.amount,
    0
  );
  const grossProfit = revenue - costOfGoods;
  const netProfit = grossProfit - expenseTotal;
  const averageTicket =
    filteredTransactions.length > 0 ? revenue / filteredTransactions.length : 0;

  return {
    revenue,
    costOfGoods,
    expenseTotal,
    grossProfit,
    netProfit,
    averageTicket,
    transactionCount: filteredTransactions.length,
  };
}

export function buildSeries(range: ReportRange, transactions: Transaction[]) {
  const now = new Date();

  if (range === "harian") {
    return Array.from({ length: 7 }, (_, index) => {
      const date = new Date(now);
      date.setDate(now.getDate() - (6 - index));
      const itemRange = getJakartaDayRange(date);
      const label = new Intl.DateTimeFormat("id-ID", {
        timeZone: JAKARTA_TIME_ZONE,
        weekday: "short",
      }).format(new Date(itemRange.start));
      const revenue = transactions
        .filter((transaction) => {
          return isWithinJakartaRange(transaction.createdAt, itemRange);
        })
        .reduce((sum, transaction) => sum + transaction.total, 0);
      return { label, revenue };
    });
  }

  if (range === "mingguan") {
    return Array.from({ length: 6 }, (_, index) => {
      const anchor = new Date(now);
      anchor.setDate(now.getDate() - (5 - index) * 7);
      const itemRange = getJakartaWeekRange(anchor);
      const startLabel = new Intl.DateTimeFormat("id-ID", {
        day: "numeric",
        timeZone: JAKARTA_TIME_ZONE,
      }).format(new Date(itemRange.start));
      const endLabel = new Intl.DateTimeFormat("id-ID", {
        day: "numeric",
        timeZone: JAKARTA_TIME_ZONE,
      }).format(new Date(new Date(itemRange.end).getTime() - 1));
      const label = `${startLabel}-${endLabel}`;
      const revenue = transactions
        .filter((transaction) => {
          return isWithinJakartaRange(transaction.createdAt, itemRange);
        })
        .reduce((sum, transaction) => sum + transaction.total, 0);
      return { label, revenue };
    });
  }

  return Array.from({ length: 6 }, (_, index) => {
    const date = new Date(now.getFullYear(), now.getMonth() - (5 - index), 1);
    const itemRange = getJakartaMonthRange(date.getFullYear(), date.getMonth() + 1);
    const label = new Intl.DateTimeFormat("id-ID", {
      month: "short",
      timeZone: JAKARTA_TIME_ZONE,
    }).format(new Date(itemRange.start));
    const revenue = transactions
      .filter((transaction) => {
        return isWithinJakartaRange(transaction.createdAt, itemRange);
      })
      .reduce((sum, transaction) => sum + transaction.total, 0);
    return { label, revenue };
  });
}

export function estimateProductVelocity(products: Product[], transactions: Transaction[]) {
  return products.map((product) => {
    const sold = transactions.reduce((sum, transaction) => {
      const matchedTotal = transaction.items
        .filter((item) => item.productId === product.id)
        .reduce((itemSum, item) => itemSum + item.quantity, 0);
      return sum + matchedTotal;
    }, 0);

    return {
      productId: product.id,
      name: product.name,
      sold,
    };
  });
}
