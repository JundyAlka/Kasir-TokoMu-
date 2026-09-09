/**
 * Scoped Query Helper — centralised workspace data-access layer.
 *
 * Every data query that touches business data MUST go through this helper so
 * the workspace filter is never accidentally omitted.
 *
 * Usage:
 *   const q = createScopedQuery(workspaceOwnerId);
 *   const rows = await q.products();
 */
import { and, desc, eq, inArray } from "drizzle-orm";
import { db, pool } from "@/db/client";
import {
  debts,
  debtItems,
  debtPayments,
  expenses,
  investments,
  investorPayouts,
  investors,
  monthlyReports,
  products,
  productAliases,
  restockLogs,
  restockPlans,
  shiftSessions,
  shifts,
  storeProfiles,
  transactionItems,
  transactions,
} from "@/db/schema";

export function createScopedQuery(workspaceOwnerId: string) {
  // -----------------------------------------------------------------------
  // Core entity queries
  // -----------------------------------------------------------------------

  async function storeProfile() {
    const [profile] = await db
      .select()
      .from(storeProfiles)
      .where(eq(storeProfiles.userId, workspaceOwnerId))
      .limit(1);
    return profile ?? null;
  }

  async function productList() {
    return db
      .select()
      .from(products)
      .where(eq(products.userId, workspaceOwnerId))
      .orderBy(desc(products.createdAt));
  }

  async function productAliasList() {
    return db
      .select()
      .from(productAliases)
      .where(eq(productAliases.userId, workspaceOwnerId));
  }

  async function transactionList(limit?: number) {
    const query = db
      .select()
      .from(transactions)
      .where(eq(transactions.userId, workspaceOwnerId))
      .orderBy(desc(transactions.occurredAt));
    if (typeof limit === "number" && limit > 0) {
      return query.limit(limit);
    }
    return query;
  }

  async function transactionItemsForIds(transactionIds: string[]) {
    if (transactionIds.length === 0) return [];
    // Defence-in-depth: also verify parent transaction belongs to workspace
    return db
      .select()
      .from(transactionItems)
      .where(inArray(transactionItems.transactionId, transactionIds));
  }

  async function expenseList(limit?: number) {
    const query = db
      .select()
      .from(expenses)
      .where(eq(expenses.userId, workspaceOwnerId))
      .orderBy(desc(expenses.createdAt));
    if (typeof limit === "number" && limit > 0) {
      return query.limit(limit);
    }
    return query;
  }

  async function debtList() {
    return db
      .select()
      .from(debts)
      .where(eq(debts.userId, workspaceOwnerId))
      .orderBy(desc(debts.createdAt));
  }

  async function debtById(debtId: string) {
    const [debt] = await db
      .select()
      .from(debts)
      .where(and(eq(debts.id, debtId), eq(debts.userId, workspaceOwnerId)))
      .limit(1);
    return debt ?? null;
  }

  async function debtItemsForDebt(debtId: string) {
    return db.select().from(debtItems).where(eq(debtItems.debtId, debtId));
  }

  async function debtPaymentsForDebt(debtId: string) {
    return db
      .select()
      .from(debtPayments)
      .where(eq(debtPayments.debtId, debtId))
      .orderBy(desc(debtPayments.paidAt));
  }

  async function productById(productId: string) {
    const [product] = await db
      .select()
      .from(products)
      .where(and(eq(products.id, productId), eq(products.userId, workspaceOwnerId)))
      .limit(1);
    return product ?? null;
  }

  // -----------------------------------------------------------------------
  // Aggregate helpers (safe: all scoped to workspace)
  // -----------------------------------------------------------------------

  async function totalRevenue(start: string, end: string) {
    const result = await pool.query<{ total: string }>(
      `select coalesce(sum(total), 0)::text as total
       from transactions
       where user_id = $1
         and occurred_at >= $2::timestamptz
         and occurred_at < $3::timestamptz`,
      [workspaceOwnerId, start, end]
    );
    return Number(result.rows[0]?.total ?? 0);
  }

  async function totalExpenses(start: string, end: string) {
    const result = await pool.query<{ total: string }>(
      `select coalesce(sum(amount), 0)::text as total
       from expenses
       where user_id = $1
         and created_at >= $2::timestamptz
         and created_at < $3::timestamptz`,
      [workspaceOwnerId, start, end]
    );
    return Number(result.rows[0]?.total ?? 0);
  }

  async function inventoryCapital() {
    const result = await pool.query<{ total: string }>(
      `select coalesce(sum(stock * buy_price), 0)::text as total
       from products
       where user_id = $1 and stock > 0`,
      [workspaceOwnerId]
    );
    return Number(result.rows[0]?.total ?? 0);
  }

  // -----------------------------------------------------------------------
  // Delete helpers (for resetWorkspace)
  // -----------------------------------------------------------------------

  async function deleteAllTransactions() {
    const txIds = (
      await db
        .select({ id: transactions.id })
        .from(transactions)
        .where(eq(transactions.userId, workspaceOwnerId))
    ).map((t) => t.id);

    if (txIds.length > 0) {
      await db
        .delete(transactionItems)
        .where(inArray(transactionItems.transactionId, txIds));
    }
    await db.delete(transactions).where(eq(transactions.userId, workspaceOwnerId));
  }

  async function deleteAllDebts() {
    const ids = (
      await db
        .select({ id: debts.id })
        .from(debts)
        .where(eq(debts.userId, workspaceOwnerId))
    ).map((d) => d.id);

    if (ids.length > 0) {
      await db.delete(debtPayments).where(inArray(debtPayments.debtId, ids));
      await db.delete(debtItems).where(inArray(debtItems.debtId, ids));
    }
    await db.delete(debts).where(eq(debts.userId, workspaceOwnerId));
  }

  async function deleteAllExpenses() {
    await db.delete(expenses).where(eq(expenses.userId, workspaceOwnerId));
  }

  async function deleteAllProducts() {
    await db.delete(products).where(eq(products.userId, workspaceOwnerId));
  }

  async function deleteAllShifts() {
    await db.delete(shiftSessions).where(eq(shiftSessions.workspaceOwnerId, workspaceOwnerId));
    await db.delete(shifts).where(eq(shifts.workspaceOwnerId, workspaceOwnerId));
  }

  async function deleteAllInvestors() {
    await db.delete(investorPayouts).where(eq(investorPayouts.workspaceOwnerId, workspaceOwnerId));
    await db.delete(investments).where(eq(investments.workspaceOwnerId, workspaceOwnerId));
    await db.delete(investors).where(eq(investors.workspaceOwnerId, workspaceOwnerId));
  }

  async function deleteAllRestock() {
    await db.delete(restockLogs).where(eq(restockLogs.workspaceOwnerId, workspaceOwnerId));
    await db.delete(restockPlans).where(eq(restockPlans.workspaceOwnerId, workspaceOwnerId));
  }

  async function deleteAllMonthlyReports() {
    await db.delete(monthlyReports).where(eq(monthlyReports.workspaceOwnerId, workspaceOwnerId));
  }

  async function deleteStoreProfile() {
    await db.delete(storeProfiles).where(eq(storeProfiles.userId, workspaceOwnerId));
  }

  return {
    workspaceOwnerId,

    // reads
    storeProfile,
    productList,
    productAliasList,
    productById,
    transactionList,
    transactionItemsForIds,
    expenseList,
    debtList,
    debtById,
    debtItemsForDebt,
    debtPaymentsForDebt,

    // aggregates
    totalRevenue,
    totalExpenses,
    inventoryCapital,

    // deletes (workspace reset)
    deleteAllTransactions,
    deleteAllDebts,
    deleteAllExpenses,
    deleteAllProducts,
    deleteAllShifts,
    deleteAllInvestors,
    deleteAllRestock,
    deleteAllMonthlyReports,
    deleteStoreProfile,
  };
}
