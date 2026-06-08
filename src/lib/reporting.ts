import { Expense, Product, Transaction } from "@/lib/types";

export type ReportRange = "harian" | "mingguan" | "bulanan";

function startOfDay(date: Date) {
  const value = new Date(date);
  value.setHours(0, 0, 0, 0);
  return value;
}

function startOfWeek(date: Date) {
  const value = startOfDay(date);
  const currentDay = value.getDay();
  const diff = currentDay === 0 ? 6 : currentDay - 1;
  value.setDate(value.getDate() - diff);
  return value;
}

function startOfMonth(date: Date) {
  const value = startOfDay(date);
  value.setDate(1);
  return value;
}

export function getRangeStart(range: ReportRange, now = new Date()) {
  if (range === "harian") {
    return startOfDay(now);
  }

  if (range === "mingguan") {
    return startOfWeek(now);
  }

  return startOfMonth(now);
}

export function summarizeReport(
  range: ReportRange,
  transactions: Transaction[],
  expenses: Expense[]
) {
  const start = getRangeStart(range);
  const filteredTransactions = transactions.filter(
    (transaction) => new Date(transaction.createdAt) >= start
  );
  const filteredExpenses = expenses.filter(
    (expense) => new Date(expense.createdAt) >= start
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
      const label = new Intl.DateTimeFormat("id-ID", { weekday: "short" }).format(
        date
      );
      const revenue = transactions
        .filter((transaction) => {
          const value = new Date(transaction.createdAt);
          return (
            value.getFullYear() === date.getFullYear() &&
            value.getMonth() === date.getMonth() &&
            value.getDate() === date.getDate()
          );
        })
        .reduce((sum, transaction) => sum + transaction.total, 0);
      return { label, revenue };
    });
  }

  if (range === "mingguan") {
    return Array.from({ length: 6 }, (_, index) => {
      const start = startOfWeek(now);
      start.setDate(start.getDate() - (5 - index) * 7);
      const end = new Date(start);
      end.setDate(start.getDate() + 7);
      const label = `${start.getDate()}-${new Date(end.getTime() - 1).getDate()}`;
      const revenue = transactions
        .filter((transaction) => {
          const value = new Date(transaction.createdAt);
          return value >= start && value < end;
        })
        .reduce((sum, transaction) => sum + transaction.total, 0);
      return { label, revenue };
    });
  }

  return Array.from({ length: 6 }, (_, index) => {
    const date = new Date(now.getFullYear(), now.getMonth() - (5 - index), 1);
    const label = new Intl.DateTimeFormat("id-ID", { month: "short" }).format(date);
    const revenue = transactions
      .filter((transaction) => {
        const value = new Date(transaction.createdAt);
        return (
          value.getFullYear() === date.getFullYear() &&
          value.getMonth() === date.getMonth()
        );
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
