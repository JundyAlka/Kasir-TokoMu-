import { and, desc, eq } from "drizzle-orm";
import { db, pool } from "@/db/client";
import {
  investorPayouts,
  investments,
  investors,
  products,
  restockLogs,
} from "@/db/schema";

type InvestmentType = "uang" | "barang_titip_jual";

type InvestorDraft = {
  name?: string;
  whatsapp?: string;
  address?: string;
  notes?: string;
};

type InvestmentDraft = {
  investorId?: string;
  type?: unknown;
  amount?: unknown;
  profitSharePct?: unknown;
  productId?: unknown;
  unitCount?: unknown;
  unitCost?: unknown;
  profitSharePerUnitPct?: unknown;
  startDate?: unknown;
  endDate?: unknown;
};

function createId(prefix: string) {
  return `${prefix}_${crypto.randomUUID().slice(0, 8)}`;
}

function nowIso() {
  return new Date().toISOString();
}

function parseText(value: unknown, field: string, required = false) {
  if (value === undefined || value === null) {
    if (required) throw new Error(`${field} wajib diisi.`);
    return "";
  }

  if (typeof value !== "string") {
    throw new Error(`${field} tidak valid.`);
  }

  const text = value.trim();
  if (required && text.length === 0) {
    throw new Error(`${field} wajib diisi.`);
  }

  return text;
}

function parseOptionalText(value: unknown, field: string) {
  if (value === undefined || value === null) {
    return undefined;
  }

  return parseText(value, field);
}

function parseNumber(value: unknown, field: string) {
  const numberValue = typeof value === "string" && value.trim() !== "" ? Number(value) : value;
  if (typeof numberValue !== "number" || !Number.isFinite(numberValue)) {
    throw new Error(`${field} harus berupa angka.`);
  }

  return Math.round(numberValue);
}

function parsePercentage(value: unknown, field: string) {
  const percentage = parseNumber(value, field);
  if (percentage < 0 || percentage > 100) {
    throw new Error(`${field} harus antara 0 sampai 100.`);
  }

  return percentage;
}

function parsePositiveNumber(value: unknown, field: string) {
  const numberValue = parseNumber(value, field);
  if (numberValue <= 0) {
    throw new Error(`${field} harus lebih dari 0.`);
  }

  return numberValue;
}

function parseDate(value: unknown, field: string) {
  if (value === undefined || value === null || value === "") {
    return nowIso();
  }

  if (typeof value !== "string") {
    throw new Error(`${field} tidak valid.`);
  }

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    throw new Error(`${field} tidak valid.`);
  }

  return date.toISOString();
}

function parseNullableDate(value: unknown, field: string) {
  if (value === undefined) {
    return undefined;
  }

  if (value === null || value === "") {
    return null;
  }

  return parseDate(value, field);
}

function parseInvestmentType(value: unknown): InvestmentType {
  if (value !== "uang" && value !== "barang_titip_jual") {
    throw new Error("Tipe investasi harus uang atau barang_titip_jual.");
  }

  return value;
}

async function findInvestor(workspaceOwnerId: string, id: string) {
  const [investor] = await db
    .select()
    .from(investors)
    .where(and(eq(investors.workspaceOwnerId, workspaceOwnerId), eq(investors.id, id)))
    .limit(1);

  return investor ?? null;
}

async function findInvestment(workspaceOwnerId: string, id: string) {
  const [investment] = await db
    .select()
    .from(investments)
    .where(and(eq(investments.workspaceOwnerId, workspaceOwnerId), eq(investments.id, id)))
    .limit(1);

  return investment ?? null;
}

async function ensureProduct(workspaceOwnerId: string, productId: string) {
  const [product] = await db
    .select()
    .from(products)
    .where(and(eq(products.userId, workspaceOwnerId), eq(products.id, productId)))
    .limit(1);

  if (!product) {
    throw new Error("Produk titipan tidak ditemukan di workspace ini.");
  }

  return product;
}

async function validateInvestorForInvestment(workspaceOwnerId: string, investorId: string) {
  const investor = await findInvestor(workspaceOwnerId, investorId);
  if (!investor || investor.isActive !== 1) {
    throw new Error("Investor tidak ditemukan atau tidak aktif.");
  }

  return investor;
}

function normalizeCreateInvestmentDraft(draft: InvestmentDraft) {
  const type = parseInvestmentType(draft.type);
  const startDate = parseDate(draft.startDate, "Tanggal mulai");
  const endDate = parseNullableDate(draft.endDate, "Tanggal selesai") ?? null;

  if (type === "uang") {
    return {
      type,
      amount: parsePositiveNumber(draft.amount, "Nominal modal"),
      profitSharePct: parsePercentage(draft.profitSharePct, "Persentase bagi hasil"),
      productId: null,
      unitCount: null,
      unitCost: null,
      profitSharePerUnitPct: null,
      startDate,
      endDate,
    };
  }

  return {
    type,
    amount: null,
    profitSharePct: null,
    productId: parseText(draft.productId, "Produk titipan", true),
    unitCount: parsePositiveNumber(draft.unitCount, "Jumlah unit"),
    unitCost: parsePositiveNumber(draft.unitCost, "Modal per unit"),
    profitSharePerUnitPct: parsePercentage(
      draft.profitSharePerUnitPct,
      "Persentase bagi hasil per unit"
    ),
    startDate,
    endDate,
  };
}

function normalizeUpdateInvestmentDraft(
  current: typeof investments.$inferSelect,
  draft: InvestmentDraft
) {
  const type = draft.type === undefined ? (current.type as InvestmentType) : parseInvestmentType(draft.type);
  const startDate = draft.startDate === undefined ? current.startDate : parseDate(draft.startDate, "Tanggal mulai");
  const endDate =
    draft.endDate === undefined
      ? current.endDate
      : parseNullableDate(draft.endDate, "Tanggal selesai") ?? null;

  if (type === "uang") {
    return {
      type,
      amount:
        draft.amount === undefined
          ? current.amount ?? 0
          : parsePositiveNumber(draft.amount, "Nominal modal"),
      profitSharePct:
        draft.profitSharePct === undefined
          ? current.profitSharePct ?? 0
          : parsePercentage(draft.profitSharePct, "Persentase bagi hasil"),
      productId: null,
      unitCount: null,
      unitCost: null,
      profitSharePerUnitPct: null,
      startDate,
      endDate,
    };
  }

  return {
    type,
    amount: null,
    profitSharePct: null,
    productId:
      draft.productId === undefined
        ? current.productId ?? ""
        : parseText(draft.productId, "Produk titipan", true),
    unitCount:
      draft.unitCount === undefined
        ? current.unitCount ?? 0
        : parsePositiveNumber(draft.unitCount, "Jumlah unit"),
    unitCost:
      draft.unitCost === undefined
        ? current.unitCost ?? 0
        : parsePositiveNumber(draft.unitCost, "Modal per unit"),
    profitSharePerUnitPct:
      draft.profitSharePerUnitPct === undefined
        ? current.profitSharePerUnitPct ?? 0
        : parsePercentage(draft.profitSharePerUnitPct, "Persentase bagi hasil per unit"),
    startDate,
    endDate,
  };
}

export async function createInvestor(workspaceOwnerId: string, draft: InvestorDraft) {
  const timestamp = nowIso();
  const [investor] = await db
    .insert(investors)
    .values({
      id: createId("inv"),
      workspaceOwnerId,
      name: parseText(draft.name, "Nama investor", true),
      whatsapp: parseText(draft.whatsapp, "WhatsApp"),
      address: parseText(draft.address, "Alamat"),
      notes: parseText(draft.notes, "Catatan"),
      isActive: 1,
      createdAt: timestamp,
      updatedAt: timestamp,
    })
    .returning();

  return investor;
}

export async function listInvestors(
  workspaceOwnerId: string,
  options: { status?: "active" | "inactive" | "all" } = {}
) {
  const status = options.status ?? "active";
  const statusWhere =
    status === "all" ? "" : status === "inactive" ? "and inv.is_active = 0" : "and inv.is_active = 1";

  const result = await pool.query<{
    id: string;
    name: string;
    whatsapp: string;
    address: string;
    notes: string;
    isActive: number;
    createdAt: string;
    updatedAt: string;
    investmentCount: number;
    totalModal: number;
    totalModalUang: number;
    totalModalBarang: number;
    payoutCountThisMonth: number;
    payoutAmountThisMonth: number;
  }>(
    `
      select
        inv.id,
        inv.name,
        inv.whatsapp,
        inv.address,
        inv.notes,
        inv.is_active as "isActive",
        inv.created_at as "createdAt",
        inv.updated_at as "updatedAt",
        coalesce(summary.investment_count, 0)::int as "investmentCount",
        coalesce(summary.total_modal, 0)::int as "totalModal",
        coalesce(summary.total_modal_uang, 0)::int as "totalModalUang",
        coalesce(summary.total_modal_barang, 0)::int as "totalModalBarang",
        coalesce(payouts.payout_count_this_month, 0)::int as "payoutCountThisMonth",
        coalesce(payouts.payout_amount_this_month, 0)::int as "payoutAmountThisMonth"
      from investors inv
      left join lateral (
        select
          count(*)::int as investment_count,
          coalesce(sum(case
            when i.type = 'uang' then i.amount
            when i.type = 'barang_titip_jual' then i.unit_count * i.unit_cost
            else 0
          end), 0)::int as total_modal,
          coalesce(sum(case when i.type = 'uang' then i.amount else 0 end), 0)::int as total_modal_uang,
          coalesce(sum(case
            when i.type = 'barang_titip_jual' then i.unit_count * i.unit_cost
            else 0
          end), 0)::int as total_modal_barang
        from investments i
        where i.workspace_owner_id = $1
          and i.investor_id = inv.id
          and i.is_active = 1
      ) summary on true
      left join lateral (
        select
          count(*)::int as payout_count_this_month,
          coalesce(sum(p.amount), 0)::int as payout_amount_this_month
        from investor_payouts p
        where p.workspace_owner_id = $1
          and p.investor_id = inv.id
          and date_trunc('month', p.period_end) = date_trunc('month', now())
      ) payouts on true
      where inv.workspace_owner_id = $1
      ${statusWhere}
      order by inv.created_at desc
    `,
    [workspaceOwnerId]
  );

  return result.rows;
}

export async function getInvestor(workspaceOwnerId: string, id: string) {
  const investor = await findInvestor(workspaceOwnerId, id);
  if (!investor) {
    throw new Error("Investor tidak ditemukan.");
  }

  const [investmentRows, payoutRows] = await Promise.all([
    db
      .select()
      .from(investments)
      .where(and(eq(investments.workspaceOwnerId, workspaceOwnerId), eq(investments.investorId, id)))
      .orderBy(desc(investments.createdAt)),
    db
      .select()
      .from(investorPayouts)
      .where(and(eq(investorPayouts.workspaceOwnerId, workspaceOwnerId), eq(investorPayouts.investorId, id)))
      .orderBy(desc(investorPayouts.periodEnd)),
  ]);

  return {
    investor,
    investments: investmentRows,
    payouts: payoutRows,
  };
}

export async function updateInvestor(
  workspaceOwnerId: string,
  id: string,
  draft: InvestorDraft
) {
  const existing = await findInvestor(workspaceOwnerId, id);
  if (!existing) {
    throw new Error("Investor tidak ditemukan.");
  }

  const next = {
    name: parseOptionalText(draft.name, "Nama investor") ?? existing.name,
    whatsapp: parseOptionalText(draft.whatsapp, "WhatsApp") ?? existing.whatsapp,
    address: parseOptionalText(draft.address, "Alamat") ?? existing.address,
    notes: parseOptionalText(draft.notes, "Catatan") ?? existing.notes,
    updatedAt: nowIso(),
  };

  if (next.name.length === 0) {
    throw new Error("Nama investor wajib diisi.");
  }

  const [investor] = await db
    .update(investors)
    .set(next)
    .where(and(eq(investors.workspaceOwnerId, workspaceOwnerId), eq(investors.id, id)))
    .returning();

  return investor;
}

export async function deleteInvestor(workspaceOwnerId: string, id: string) {
  const existing = await findInvestor(workspaceOwnerId, id);
  if (!existing) {
    throw new Error("Investor tidak ditemukan.");
  }

  const timestamp = nowIso();
  const [investor] = await db
    .update(investors)
    .set({ isActive: 0, updatedAt: timestamp })
    .where(and(eq(investors.workspaceOwnerId, workspaceOwnerId), eq(investors.id, id)))
    .returning();

  await db
    .update(investments)
    .set({ isActive: 0, endDate: timestamp, updatedAt: timestamp })
    .where(and(eq(investments.workspaceOwnerId, workspaceOwnerId), eq(investments.investorId, id)));

  return investor;
}

export async function listInvestments(workspaceOwnerId: string, investorId?: string) {
  const filters = [eq(investments.workspaceOwnerId, workspaceOwnerId)];
  if (investorId) {
    filters.push(eq(investments.investorId, investorId));
  }

  return db
    .select({
      id: investments.id,
      investorId: investments.investorId,
      investorName: investors.name,
      workspaceOwnerId: investments.workspaceOwnerId,
      type: investments.type,
      amount: investments.amount,
      profitSharePct: investments.profitSharePct,
      productId: investments.productId,
      productName: products.name,
      unitCount: investments.unitCount,
      unitCost: investments.unitCost,
      profitSharePerUnitPct: investments.profitSharePerUnitPct,
      startDate: investments.startDate,
      endDate: investments.endDate,
      isActive: investments.isActive,
      createdAt: investments.createdAt,
      updatedAt: investments.updatedAt,
    })
    .from(investments)
    .leftJoin(investors, eq(investors.id, investments.investorId))
    .leftJoin(products, eq(products.id, investments.productId))
    .where(and(...filters))
    .orderBy(desc(investments.createdAt));
}

export async function createInvestment(
  workspaceOwnerId: string,
  investorId: string,
  draft: InvestmentDraft
) {
  const investor = await validateInvestorForInvestment(workspaceOwnerId, investorId);
  const next = normalizeCreateInvestmentDraft(draft);

  if (next.type === "barang_titip_jual") {
    await ensureProduct(workspaceOwnerId, next.productId);
  }

  const timestamp = nowIso();
  const investmentId = createId("ivt");

  const [investment] = await db.transaction(async (tx) => {
    const inserted = await tx
      .insert(investments)
      .values({
        id: investmentId,
        investorId,
        workspaceOwnerId,
        ...next,
        isActive: 1,
        createdAt: timestamp,
        updatedAt: timestamp,
      })
      .returning();

    if (next.type === "barang_titip_jual") {
      const [product] = await tx
        .select()
        .from(products)
        .where(and(eq(products.userId, workspaceOwnerId), eq(products.id, next.productId)))
        .limit(1);

      if (!product) {
        throw new Error("Produk titipan tidak ditemukan di workspace ini.");
      }

      await tx
        .update(products)
        .set({
          stock: product.stock + next.unitCount,
          updatedAt: timestamp,
        })
        .where(and(eq(products.userId, workspaceOwnerId), eq(products.id, next.productId)));

      await tx.insert(restockLogs).values({
        id: createId("rsl"),
        workspaceOwnerId,
        productId: next.productId,
        performedByUserId: workspaceOwnerId,
        source: "manual",
        quantity: next.unitCount,
        unitCost: next.unitCost,
        receiptImageUrl: null,
        ocrRaw: null,
        note: `Modal barang investor ${investor.name}`,
        createdAt: timestamp,
      });
    }

    return inserted;
  });

  return investment;
}

export async function updateInvestment(
  workspaceOwnerId: string,
  id: string,
  draft: InvestmentDraft
) {
  const existing = await findInvestment(workspaceOwnerId, id);
  if (!existing) {
    throw new Error("Investasi tidak ditemukan.");
  }

  const next = normalizeUpdateInvestmentDraft(existing, draft);

  if (next.type === "barang_titip_jual") {
    await ensureProduct(workspaceOwnerId, next.productId);
  }

  const [investment] = await db
    .update(investments)
    .set({
      ...next,
      updatedAt: nowIso(),
    })
    .where(and(eq(investments.workspaceOwnerId, workspaceOwnerId), eq(investments.id, id)))
    .returning();

  return investment;
}

export async function deactivateInvestment(workspaceOwnerId: string, id: string) {
  const existing = await findInvestment(workspaceOwnerId, id);
  if (!existing) {
    throw new Error("Investasi tidak ditemukan.");
  }

  const timestamp = nowIso();
  const [investment] = await db
    .update(investments)
    .set({
      isActive: 0,
      endDate: existing.endDate ?? timestamp,
      updatedAt: timestamp,
    })
    .where(and(eq(investments.workspaceOwnerId, workspaceOwnerId), eq(investments.id, id)))
    .returning();

  return investment;
}
