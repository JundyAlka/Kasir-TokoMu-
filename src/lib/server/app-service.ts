import { headers } from "next/headers";
import { timingSafeEqual } from "node:crypto";
import { and, desc, eq, inArray } from "drizzle-orm";
import { db, pool } from "@/db/client";
import { createScopedQuery } from "@/lib/server/scoped-query";
import {
  debts,
  debtItems,
  debtPayments,
  expenses,
  investments,
  investors,
  monthlyReports,
  productAliases,
  products,
  restockLogs,
  shiftSessions,
  shifts,
  storeProfiles,
  transactionItems,
  transactions,
  userRoles,
} from "@/db/schema";
import { auth } from "@/lib/auth";
import { getUserRole, getUserRoleAssignment, Role } from "@/lib/server/rbac";
import {
  DebtCreateSchema,
  DebtPaymentCreateSchema,
  ProductCreateSchema,
  ProductUpdateSchema,
  RestockBodySchema,
  SettingsUpdateSchema,
  TransactionCheckoutSchema,
  ExpenseCreateSchema,
} from "@/lib/server/validation";
import { AppState, Debt, DebtDetail, DebtDraft, ExpenseDraft, PaymentMethod, ProductDraft, Settings, Transaction } from "@/lib/types";
import { getJakartaDayRange } from "@/lib/server/timezone";
import { notFoundError } from "@/lib/server/route-error";
import { getOpenSession } from "@/lib/server/shift-service";

let initializationPromise: Promise<void> | null = null;
const supportedPaymentMethods: PaymentMethod[] = ["Tunai", "QRIS", "Transfer"];

type SessionHint = {
  user?: {
    id?: string;
    name?: string | null;
    email?: string | null;
  };
} | null;

function createId(prefix: string) {
  return `${prefix}_${crypto.randomUUID().slice(0, 8)}`;
}

function nowIso() {
  return new Date().toISOString();
}

function parseDueDate(value: string) {
  if (value.includes("T")) {
    return new Date(value).toISOString();
  }

  return new Date(`${value}T00:00:00.000Z`).toISOString();
}

function effectiveDebtStatus(debt: Pick<typeof debts.$inferSelect, "amount" | "paidAmount" | "dueDate" | "isPaid" | "status">) {
  if (debt.isPaid === 1 || debt.status === "lunas" || debt.paidAmount >= debt.amount) {
    return "lunas" as const;
  }

  if (debt.dueDate && new Date(debt.dueDate).getTime() < new Date(getJakartaDayRange().start).getTime()) {
    return "lewat_tempo" as const;
  }

  return "aktif" as const;
}

function mapDebt(debt: typeof debts.$inferSelect): Debt {
  const paidAmount = Math.min(debt.amount, Math.max(0, debt.paidAmount ?? (debt.isPaid === 1 ? debt.amount : 0)));
  const status = effectiveDebtStatus({ ...debt, paidAmount });

  return {
    id: debt.id,
    borrowerName: debt.borrowerName,
    whatsapp: debt.whatsapp,
    amount: debt.amount,
    paidAmount,
    remainingAmount: Math.max(0, debt.amount - paidAmount),
    status,
    createdAt: debt.createdAt,
    dueDate: debt.dueDate,
    isPaid: status === "lunas",
    lastReminderAt: debt.lastReminderAt ?? undefined,
  };
}

async function ensureDatabaseReady() {
  await pool.query("select 1");
}

async function ensureWorkspace(userId: string, session?: SessionHint) {
  const existingRole = await getUserRoleAssignment(userId);
  if (existingRole) {
    if (existingRole.isActive !== 1) {
      throw new Error("FORBIDDEN");
    }

    return {
      role: existingRole.role,
      workspaceOwnerId: existingRole.workspaceOwnerId,
    };
  }

  const existing = await db
    .select({ userId: storeProfiles.userId })
    .from(storeProfiles)
    .where(eq(storeProfiles.userId, userId))
    .limit(1);

  const timestamp = nowIso();
  const role = { role: "pimpinan" as Role, workspaceOwnerId: userId };

  await db.transaction(async (tx) => {
    if (existing.length === 0) {
      await tx.insert(storeProfiles).values({
        userId,
        storeName: session?.user?.name ? `Warung ${session.user.name}` : "Warung Baru",
        storeTagline: "Warung harian untuk warga sekitar",
        storeAddress: "Alamat belum diisi",
        pcmName: "",
        pcmChairmanName: "",
        pcmChairmanTitle: "Ketua PCM",
        pcmAddress: "",
        ownerName: session?.user?.name ?? "Pemilik Warung",
        ownerWhatsapp: "-",
        city: "Indonesia",
        businessNotes: "",
        stockAlertThreshold: 8,
        profitSharePcmPct: 30,
        profitShareReservePct: 20,
        enabledPayments: ["Tunai", "QRIS", "Transfer"],
        qrisPayload: "",
        qrisImageUrl: "",
        bankTransferInfo: "",
        createdAt: timestamp,
        updatedAt: timestamp,
      });
    }

    await tx
      .insert(userRoles)
      .values({
        userId,
        role: role.role,
        workspaceOwnerId: role.workspaceOwnerId,
        isActive: 1,
        createdAt: timestamp,
        updatedAt: timestamp,
      })
      .onConflictDoNothing();
  });

  return (await getUserRole(userId)) ?? role;
}

export async function ensureAppReady() {
  if (!initializationPromise) {
    initializationPromise = ensureDatabaseReady();
  }

  await initializationPromise;
}

/**
 * Static Bearer-token auth for API testing in production.
 *
 * Active only when BOTH `API_TEST_TOKEN` and `API_TEST_USER_ID` env vars are
 * set. A request with `Authorization: Bearer <API_TEST_TOKEN>` is treated as
 * the user identified by `API_TEST_USER_ID`. Token compare is constant-time.
 *
 * This is a long-lived credential with no expiry — keep it secret, scope it to
 * a throwaway test account, and rotate it by changing the env var.
 */
function resolveTestBearer(headerList: Headers): SessionHint {
  const token = process.env.API_TEST_TOKEN;
  const testUserId = process.env.API_TEST_USER_ID;
  if (!token || !testUserId) {
    return null;
  }

  const match = /^Bearer\s+(.+)$/i.exec((headerList.get("authorization") ?? "").trim());
  if (!match) {
    return null;
  }

  const provided = Buffer.from(match[1]);
  const expected = Buffer.from(token);
  if (provided.length !== expected.length || !timingSafeEqual(provided, expected)) {
    return null;
  }

  return {
    user: {
      id: testUserId,
      name: process.env.API_TEST_USER_NAME ?? "API Test",
      email: process.env.API_TEST_USER_EMAIL ?? null,
    },
  };
}

export async function getRequestUser() {
  await ensureAppReady();

  const headerList = await headers();

  const testSession = resolveTestBearer(headerList);
  if (testSession?.user?.id) {
    const role = await ensureWorkspace(testSession.user.id, testSession);
    return {
      userId: testSession.user.id,
      role: role.role,
      workspaceOwnerId: role.workspaceOwnerId,
      session: testSession,
    };
  }

  const session = await auth.api.getSession({
    headers: headerList,
  });

  if (!session?.user?.id) {
    throw new Error("UNAUTHORIZED");
  }

  const role = await ensureWorkspace(session.user.id, session);
  return {
    userId: session.user.id,
    role: role.role,
    workspaceOwnerId: role.workspaceOwnerId,
    session,
  };
}

function mapSettings(profile: typeof storeProfiles.$inferSelect): Settings {
  return {
    storeName: profile.storeName,
    storeTagline: profile.storeTagline,
    storeAddress: profile.storeAddress,
    pcmName: profile.pcmName,
    pcmChairmanName: profile.pcmChairmanName,
    pcmChairmanTitle: profile.pcmChairmanTitle ?? "Ketua PCM",
    pcmAddress: profile.pcmAddress,
    ownerName: profile.ownerName,
    ownerWhatsapp: profile.ownerWhatsapp,
    city: profile.city,
    businessNotes: profile.businessNotes,
    stockAlertThreshold: profile.stockAlertThreshold,
    profitSharePcmPct: profile.profitSharePcmPct,
    profitShareReservePct: profile.profitShareReservePct,
    enabledPayments: profile.enabledPayments,
    qrisPayload: profile.qrisPayload,
    qrisImageUrl: profile.qrisImageUrl,
    bankTransferInfo: profile.bankTransferInfo,
  };
}

function normalizeSettings(settings: Settings): Settings {
  const enabledPayments = Array.from(
    new Set(
      settings.enabledPayments.filter((method): method is PaymentMethod =>
        supportedPaymentMethods.includes(method)
      )
    )
  );

  return {
    storeName: settings.storeName.trim(),
    storeTagline: settings.storeTagline.trim(),
    storeAddress: settings.storeAddress.trim(),
    pcmName: settings.pcmName.trim(),
    pcmChairmanName: settings.pcmChairmanName.trim(),
    pcmChairmanTitle: (settings.pcmChairmanTitle ?? "Ketua PCM").trim(),
    pcmAddress: settings.pcmAddress.trim(),
    ownerName: settings.ownerName.trim(),
    ownerWhatsapp: settings.ownerWhatsapp.trim(),
    city: settings.city.trim(),
    businessNotes: settings.businessNotes.trim(),
    stockAlertThreshold: Math.max(1, Math.round(settings.stockAlertThreshold || 0)),
    profitSharePcmPct: Math.min(100, Math.max(0, Math.round(settings.profitSharePcmPct || 0))),
    profitShareReservePct: Math.min(100, Math.max(0, Math.round(settings.profitShareReservePct || 0))),
    enabledPayments,
    qrisPayload: settings.qrisPayload.trim(),
    qrisImageUrl: settings.qrisImageUrl.trim(),
    bankTransferInfo: settings.bankTransferInfo.trim(),
  };
}

export async function getBootstrapState(userId: string): Promise<AppState> {
  await ensureAppReady();

  const q = createScopedQuery(userId);

  const profile = await q.storeProfile();
  if (!profile) {
    throw new Error("Profil warung tidak ditemukan.");
  }

  const productRows = await q.productList();
  const transactionRows = await q.transactionList();

  const transactionIds = transactionRows.map((transaction) => transaction.id);
  const itemRows = await q.transactionItemsForIds(transactionIds);

  const debtRows = await q.debtList();
  const expenseRows = await q.expenseList();

  const itemsByTransaction = new Map<string, Transaction["items"]>();
  for (const item of itemRows) {
    const existing = itemsByTransaction.get(item.transactionId) ?? [];
    existing.push({
      productId: item.productId ?? "",
      productName: item.productName,
      quantity: item.quantity,
      unitPrice: item.unitPrice,
      costPrice: item.costPrice,
    });
    itemsByTransaction.set(item.transactionId, existing);
  }

  return {
    products: productRows.map((product) => ({
      id: product.id,
      sku: product.sku,
      name: product.name,
      category: product.category as AppState["products"][number]["category"],
      buyPrice: product.buyPrice,
      sellPrice: product.sellPrice,
      stock: product.stock,
      minimumStock: product.minimumStock,
      description: product.description,
    })),
    cart: [],
    paymentMethod: (profile.enabledPayments[0] ?? "Tunai") as PaymentMethod,
    transactions: transactionRows.map((transaction) => ({
      id: transaction.id,
      paymentMethod: transaction.paymentMethod as PaymentMethod,
      total: transaction.total,
      paidAmount: transaction.paidAmount,
      changeAmount: transaction.changeAmount,
      createdAt: transaction.createdAt,
      occurredAt: transaction.occurredAt,
      entrySource: transaction.entrySource as Transaction["entrySource"],
      externalRef: transaction.externalRef,
      recordedByUserId: transaction.recordedByUserId || transaction.userId,
      recordedByName: transaction.recordedByName || "",
      shiftSessionId: transaction.shiftSessionId,
      items: itemsByTransaction.get(transaction.id) ?? [],
    })),
    debts: debtRows.map(mapDebt),
    expenses: expenseRows.map((expense) => ({
      id: expense.id,
      title: expense.title,
      amount: expense.amount,
      createdAt: expense.createdAt,
      category: expense.category as AppState["expenses"][number]["category"],
    })),
    settings: mapSettings(profile),
  };
}

export async function createProduct(userId: string, draft: ProductDraft) {
  const nextDraft = ProductCreateSchema.parse(draft);
  const timestamp = nowIso();
  const [product] = await db
    .insert(products)
    .values({
      id: createId("prd"),
      userId,
      sku: nextDraft.sku,
      name: nextDraft.name,
      category: nextDraft.category,
      buyPrice: nextDraft.buyPrice,
      sellPrice: nextDraft.sellPrice,
      stock: nextDraft.stock,
      minimumStock: nextDraft.minimumStock,
      description: nextDraft.description,
      createdAt: timestamp,
      updatedAt: timestamp,
    })
    .returning();

  return {
    id: product.id,
    sku: product.sku,
    name: product.name,
    category: product.category as AppState["products"][number]["category"],
    buyPrice: product.buyPrice,
    sellPrice: product.sellPrice,
    stock: product.stock,
    minimumStock: product.minimumStock,
    description: product.description,
  };
}

export async function updateProduct(userId: string, productId: string, draft: ProductDraft) {
  const nextDraft = ProductUpdateSchema.parse(draft);
  const [updated] = await db
    .update(products)
    .set({
      name: nextDraft.name,
      sku: nextDraft.sku,
      category: nextDraft.category,
      buyPrice: nextDraft.buyPrice,
      sellPrice: nextDraft.sellPrice,
      stock: nextDraft.stock,
      minimumStock: nextDraft.minimumStock,
      description: nextDraft.description,
      updatedAt: nowIso(),
    })
    .where(and(eq(products.id, productId), eq(products.userId, userId)))
    .returning();

  if (!updated) {
    throw notFoundError();
  }

  return {
    id: updated.id,
    sku: updated.sku,
    name: updated.name,
    category: updated.category as AppState["products"][number]["category"],
    buyPrice: updated.buyPrice,
    sellPrice: updated.sellPrice,
    stock: updated.stock,
    minimumStock: updated.minimumStock,
    description: updated.description,
  };
}

export async function deleteProduct(userId: string, productId: string) {
  await db
    .delete(productAliases)
    .where(and(eq(productAliases.userId, userId), eq(productAliases.productId, productId)));

  const [deleted] = await db
    .delete(products)
    .where(and(eq(products.id, productId), eq(products.userId, userId)))
    .returning();

  if (!deleted) {
    throw notFoundError();
  }

  return {
    id: deleted.id,
    sku: deleted.sku,
    name: deleted.name,
    category: deleted.category as AppState["products"][number]["category"],
    buyPrice: deleted.buyPrice,
    sellPrice: deleted.sellPrice,
    stock: deleted.stock,
    minimumStock: deleted.minimumStock,
    description: deleted.description,
  };
}

export async function deleteBulkProducts(userId: string, productIds: string[]) {
  if (productIds.length === 0) {
    return [];
  }

  await db
    .delete(productAliases)
    .where(and(eq(productAliases.userId, userId), inArray(productAliases.productId, productIds)));

  const deleted = await db
    .delete(products)
    .where(and(eq(products.userId, userId), inArray(products.id, productIds)))
    .returning();

  return deleted.map((item) => ({
    id: item.id,
    sku: item.sku,
    name: item.name,
  }));
}

export async function restockProduct(userId: string, productId: string, quantity: number) {
  const { quantity: nextQuantity } = RestockBodySchema.parse({ quantity });
  const [existing] = await db
    .select()
    .from(products)
    .where(and(eq(products.id, productId), eq(products.userId, userId)))
    .limit(1);

  if (!existing) {
    throw notFoundError();
  }

  const [updated] = await db
    .update(products)
    .set({
      stock: existing.stock + nextQuantity,
      updatedAt: nowIso(),
    })
    .where(and(eq(products.id, productId), eq(products.userId, userId)))
    .returning();

  return {
    id: updated.id,
    sku: updated.sku,
    name: updated.name,
    category: updated.category as AppState["products"][number]["category"],
    buyPrice: updated.buyPrice,
    sellPrice: updated.sellPrice,
    stock: updated.stock,
    minimumStock: updated.minimumStock,
    description: updated.description,
  };
}

export async function createTransaction(
  userId: string,
  payload: {
    paymentMethod: PaymentMethod;
    paidAmount?: number;
    items: Array<{ productId: string; quantity: number }>;
    recordedByUserId?: string;
    recordedByName?: string;
    shiftSessionId?: string | null;
  }
) {
  const nextPayload = TransactionCheckoutSchema.parse({
    paymentMethod: payload.paymentMethod,
    paidAmount: payload.paidAmount,
    items: payload.items,
  });

  if (nextPayload.items.length === 0) {
    throw new Error("Keranjang masih kosong.");
  }

  const productIds = nextPayload.items.map((item) => item.productId);
  const productRows = await db
    .select()
    .from(products)
    .where(and(eq(products.userId, userId), inArray(products.id, productIds)));

  const productMap = new Map(productRows.map((product) => [product.id, product]));
  const lineItems = nextPayload.items.map((item) => {
    const product = productMap.get(item.productId);
    if (!product) {
      throw new Error("Salah satu produk tidak ditemukan.");
    }

    if (product.stock < item.quantity) {
      throw new Error(`Stok ${product.name} tidak cukup.`);
    }

    return { product, quantity: item.quantity };
  });

  const transactionId = createId("trx");
  const createdAt = nowIso();
  const total = lineItems.reduce(
    (sum, item) => sum + item.product.sellPrice * item.quantity,
    0
  );
  const paidAmount =
    nextPayload.paymentMethod === "Tunai" ? nextPayload.paidAmount ?? total : total;
  const changeAmount = nextPayload.paymentMethod === "Tunai" ? paidAmount - total : 0;

  if (nextPayload.paymentMethod === "Tunai" && paidAmount < total) {
    throw new Error("Uang dibayarkan kurang dari total tagihan.");
  }

  await db.transaction(async (tx) => {
    await tx.insert(transactions).values({
      id: transactionId,
      userId,
      total,
      paidAmount,
      changeAmount,
      paymentMethod: nextPayload.paymentMethod,
      recordedByUserId: payload.recordedByUserId ?? userId,
      recordedByName: payload.recordedByName ?? "",
      shiftSessionId: payload.shiftSessionId ?? null,
      createdAt,
      occurredAt: createdAt,
      entrySource: "pos",
      externalRef: null,
    });

    await tx.insert(transactionItems).values(
      lineItems.map((item) => ({
        id: createId("itm"),
        transactionId,
        productId: item.product.id,
        productName: item.product.name,
        quantity: item.quantity,
        unitPrice: item.product.sellPrice,
        costPrice: item.product.buyPrice,
      }))
    );

    for (const item of lineItems) {
      await tx
        .update(products)
        .set({
          stock: item.product.stock - item.quantity,
          updatedAt: createdAt,
        })
        .where(and(eq(products.id, item.product.id), eq(products.userId, userId)));
    }
  });

  const nextState = await getBootstrapState(userId);
  const transaction = nextState.transactions.find((item) => item.id === transactionId);

  if (!transaction) {
    throw new Error("Transaksi gagal dibuat.");
  }

  return {
    transaction,
    products: nextState.products,
  };
}

export async function createExpense(userId: string, draft: ExpenseDraft) {
  // Legacy internal helper retained for AI tools and historical tests. HTTP
  // expense writes use createShiftExpense and therefore require an open shift.
  if (!draft.title.trim() || !Number.isInteger(draft.amount) || draft.amount <= 0) {
    throw new Error("Data pengeluaran tidak valid.");
  }
  const timestamp = nowIso();
  const expenseId = createId("exp");
  
  const [expense] = await db
    .insert(expenses)
    .values({
      id: expenseId,
      userId,
      title: draft.title.trim(),
      amount: draft.amount,
      category: draft.category,
      expenseType: "operasional",
      isCashMovement: false,
      createdAt: timestamp,
    })
    .returning();

  if (!expense) {
    throw new Error("Gagal mencatat pengeluaran.");
  }

  return {
    id: expense.id,
    title: expense.title,
    amount: expense.amount,
    category: expense.category,
    createdAt: expense.createdAt,
  };
}

export async function createDebt(userId: string, draft: DebtDraft) {
  const nextDraft = DebtCreateSchema.parse(draft);
  const openShift = await getOpenSession(userId);
  if (!openShift) throw new Error("Buka shift terlebih dahulu sebelum mencatat kasbon.");
  const timestamp = nowIso();
  const itemDrafts = nextDraft.items.map((item) => ({
    ...item,
    lineTotal: item.quantity * item.unitPrice,
  }));
  const amount =
    itemDrafts.length > 0
      ? itemDrafts.reduce((sum, item) => sum + item.lineTotal, 0)
      : nextDraft.amount ?? 0;

  const debtId = createId("debt");
  let createdDebt: typeof debts.$inferSelect | null = null;

  await db.transaction(async (tx) => {
    const [debt] = await tx
      .insert(debts)
      .values({
        id: debtId,
        userId,
        borrowerName: nextDraft.borrowerName,
        whatsapp: nextDraft.whatsapp,
        amount,
        paidAmount: 0,
        status: "aktif",
        createdAt: timestamp,
        dueDate: nextDraft.dueDate ? parseDueDate(nextDraft.dueDate) : null,
        shiftSessionId: openShift.id,
        isPaid: 0,
        lastReminderAt: null,
      })
      .returning();

    createdDebt = debt;

    if (itemDrafts.length > 0) {
      await tx.insert(debtItems).values(
        itemDrafts.map((item) => ({
          id: createId("ditm"),
          debtId,
          productId: item.productId ?? null,
          name: item.name,
          quantity: item.quantity,
          unitPrice: item.unitPrice,
          lineTotal: item.lineTotal,
        }))
      );
    }
  });

  if (!createdDebt) {
    throw new Error("Kasbon gagal dibuat.");
  }

  return mapDebt(createdDebt);
}

export async function getDebtDetail(userId: string, debtId: string): Promise<DebtDetail> {
  const [debt] = await db
    .select()
    .from(debts)
    .where(and(eq(debts.id, debtId), eq(debts.userId, userId)))
    .limit(1);

  if (!debt) {
    throw notFoundError();
  }

  const [items, payments] = await Promise.all([
    db.select().from(debtItems).where(eq(debtItems.debtId, debtId)),
    db.select().from(debtPayments).where(eq(debtPayments.debtId, debtId)).orderBy(desc(debtPayments.paidAt)),
  ]);

  return {
    ...mapDebt(debt),
    items: items.map((item) => ({
      id: item.id,
      debtId: item.debtId,
      productId: item.productId,
      name: item.name,
      quantity: item.quantity,
      unitPrice: item.unitPrice,
      lineTotal: item.lineTotal,
    })),
    payments: payments.map((payment) => ({
      id: payment.id,
      debtId: payment.debtId,
      amount: payment.amount,
      paidAt: payment.paidAt,
      note: payment.note,
      recordedByUserId: payment.recordedByUserId,
    })),
  };
}

export async function updateDebt(
  userId: string,
  debtId: string,
  draft: {
    borrowerName?: string;
    whatsapp?: string;
    dueDate?: string | null;
    status?: "aktif" | "lunas" | "lewat_tempo";
    isPaid?: true;
  }
) {
  if (draft.isPaid || draft.status === "lunas") {
    return markDebtPaid(userId, debtId);
  }

  const [existing] = await db
    .select()
    .from(debts)
    .where(and(eq(debts.id, debtId), eq(debts.userId, userId)))
    .limit(1);

  if (!existing) {
    throw notFoundError();
  }

  const [updated] = await db
    .update(debts)
    .set({
      borrowerName: draft.borrowerName ?? existing.borrowerName,
      whatsapp: draft.whatsapp ?? existing.whatsapp,
      dueDate: draft.dueDate !== undefined ? (draft.dueDate ? parseDueDate(draft.dueDate) : null) : existing.dueDate,
      status: draft.status ?? effectiveDebtStatus(existing),
    })
    .where(and(eq(debts.id, debtId), eq(debts.userId, userId)))
    .returning();

  return mapDebt(updated);
}

export async function recordDebtPayment(
  userId: string,
  debtId: string,
  draft: { amount: number; paidAt?: string; note?: string },
  recordedByUserId = userId
) {
  const nextDraft = DebtPaymentCreateSchema.parse({
    ...draft,
    note: draft.note ?? "",
  });
  const openShift = await getOpenSession(userId);
  if (!openShift) throw new Error("Buka shift terlebih dahulu sebelum mencatat pelunasan kasbon.");
  let updatedDebt: typeof debts.$inferSelect | null = null;
  let paymentResult: {
    id: string;
    debtId: string;
    amount: number;
    paidAt: string;
    note: string;
    recordedByUserId: string;
  } | null = null;

  await db.transaction(async (tx) => {
    const [existing] = await tx
      .select()
      .from(debts)
      .where(and(eq(debts.id, debtId), eq(debts.userId, userId)))
      .limit(1);

    if (!existing) {
      throw notFoundError();
    }

    if (effectiveDebtStatus(existing) === "lunas") {
      throw new Error("Kasbon sudah lunas.");
    }

    const remaining = Math.max(0, existing.amount - existing.paidAmount);
    const paymentAmount = Math.min(nextDraft.amount, remaining);
    const nextPaidAmount = Math.min(existing.amount, existing.paidAmount + paymentAmount);
    const isFullyPaid = nextPaidAmount >= existing.amount;

    const [payment] = await tx
      .insert(debtPayments)
      .values({
        id: createId("dpay"),
        debtId,
        amount: paymentAmount,
        paidAt: nextDraft.paidAt ? parseDueDate(nextDraft.paidAt) : nowIso(),
        note: nextDraft.note,
        recordedByUserId,
        shiftSessionId: openShift.id,
      })
      .returning();

    const [updated] = await tx
      .update(debts)
      .set({
        paidAmount: nextPaidAmount,
        status: isFullyPaid ? "lunas" : effectiveDebtStatus({ ...existing, paidAmount: nextPaidAmount }),
        isPaid: isFullyPaid ? 1 : 0,
      })
      .where(and(eq(debts.id, debtId), eq(debts.userId, userId)))
      .returning();

    paymentResult = {
      id: payment.id,
      debtId: payment.debtId,
      amount: payment.amount,
      paidAt: payment.paidAt,
      note: payment.note,
      recordedByUserId: payment.recordedByUserId,
    };
    updatedDebt = updated;
  });

  if (!updatedDebt || !paymentResult) {
    throw new Error("Pembayaran gagal dicatat.");
  }

  return {
    debt: mapDebt(updatedDebt),
    payment: paymentResult,
  };
}

export async function markDebtPaid(userId: string, debtId: string, recordedByUserId = userId) {
  const [existing] = await db
    .select()
    .from(debts)
    .where(and(eq(debts.id, debtId), eq(debts.userId, userId)))
    .limit(1);

  if (!existing) {
    throw notFoundError();
  }

  if (effectiveDebtStatus(existing) === "lunas") {
    return mapDebt(existing);
  }

  const remaining = Math.max(0, existing.amount - existing.paidAmount);
  const result = await recordDebtPayment(
    userId,
    debtId,
    {
      amount: remaining,
      note: "Ditandai lunas",
    },
    recordedByUserId
  );

  return result.debt;
}

export async function remindDebt(userId: string, debtId: string) {
  const [updated] = await db
    .update(debts)
    .set({
      lastReminderAt: nowIso(),
    })
    .where(and(eq(debts.id, debtId), eq(debts.userId, userId)))
    .returning();

  if (!updated) {
    throw notFoundError();
  }

  return mapDebt(updated);
}



export async function updateStoreSettings(userId: string, settings: Settings) {
  const nextSettings = normalizeSettings(SettingsUpdateSchema.parse(settings));

  if (
    nextSettings.storeName.length === 0 ||
    nextSettings.storeAddress.length === 0 ||
    nextSettings.ownerName.length === 0 ||
    nextSettings.ownerWhatsapp.length < 10 ||
    nextSettings.city.length === 0 ||
    nextSettings.enabledPayments.length === 0
  ) {
    throw new Error(
      "Lengkapi nama warung, alamat, pemilik, WhatsApp, kota, dan pilih minimal satu metode bayar."
    );
  }

  const [updated] = await db
    .update(storeProfiles)
    .set({
      storeName: nextSettings.storeName,
      storeTagline: nextSettings.storeTagline,
      storeAddress: nextSettings.storeAddress,
      pcmName: nextSettings.pcmName,
      pcmChairmanName: nextSettings.pcmChairmanName,
      pcmChairmanTitle: nextSettings.pcmChairmanTitle ?? "Ketua PCM",
      pcmAddress: nextSettings.pcmAddress,
      ownerName: nextSettings.ownerName,
      ownerWhatsapp: nextSettings.ownerWhatsapp,
      city: nextSettings.city,
      businessNotes: nextSettings.businessNotes,
      stockAlertThreshold: nextSettings.stockAlertThreshold,
      profitSharePcmPct: nextSettings.profitSharePcmPct,
      profitShareReservePct: nextSettings.profitShareReservePct,
      enabledPayments: nextSettings.enabledPayments,
      qrisPayload: nextSettings.qrisPayload,
      qrisImageUrl: nextSettings.qrisImageUrl,
      bankTransferInfo: nextSettings.bankTransferInfo,
      updatedAt: nowIso(),
    })
    .where(eq(storeProfiles.userId, userId))
    .returning();

  if (!updated) {
    throw new Error("Pengaturan warung tidak ditemukan.");
  }

  return mapSettings(updated);
}

export async function resetWorkspace(userId: string) {
  await ensureAppReady();

  const q = createScopedQuery(userId);

  await q.deleteAllTransactions();
  await q.deleteAllDebts();
  await q.deleteAllShifts();
  await q.deleteAllExpenses();
  await q.deleteAllRestock();
  await q.deleteAllMonthlyReports();
  await q.deleteAllInvestors();
  await q.deleteAllProducts();
  await q.deleteStoreProfile();

  const timestamp = nowIso();
  await db.insert(storeProfiles).values({
    userId,
    storeName: "Warung Baru",
    storeTagline: "Warung harian untuk warga sekitar",
    storeAddress: "Alamat belum diisi",
    pcmName: "",
    pcmChairmanName: "",
    pcmChairmanTitle: "Ketua PCM",
    pcmAddress: "",
    ownerName: "Pemilik Warung",
    ownerWhatsapp: "-",
    city: "Indonesia",
    businessNotes: "",
    stockAlertThreshold: 8,
    profitSharePcmPct: 30,
    profitShareReservePct: 20,
    enabledPayments: ["Tunai", "QRIS", "Transfer"],
    createdAt: timestamp,
    updatedAt: timestamp,
  });

  return getBootstrapState(userId);
}
