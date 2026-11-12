import { desc, eq } from "drizzle-orm";
import { db, pool } from "@/db/client";
import {
  storeProfiles,
  whatsappDispatchLogs,
  whatsappReportConfigs,
} from "@/db/schema";
import { logEvent } from "@/lib/server/audit";
import { getReportRollupByMode } from "@/lib/server/monthly-report-service";
import {
  getOpenWaSessionStatus,
  normalizeOpenWaBaseUrl,
  parseWhatsAppRecipients,
  sendOpenWaDocument,
  sendOpenWaText,
} from "@/lib/server/openwa-client";
import {
  getAssetCapitalSummary,
  getPeriodRange,
  getTopProductsForPeriod,
} from "@/lib/server/reporting";
import {
  getJakartaWeekRange,
  JAKARTA_TIME_ZONE,
} from "@/lib/server/timezone";

export type WhatsAppTriggerType =
  | "auto_weekly"
  | "auto_monthly"
  | "manual"
  | "test";

export interface WhatsAppReportConfigDto {
  workspaceOwnerId: string;
  enabled: boolean;
  baseUrl: string;
  apiKeyMasked: string;
  hasApiKey: boolean;
  sessionId: string;
  recipients: string[];
  weeklyEnabled: boolean;
  weeklyDayOfWeek: number;
  weeklyHour: number;
  attachWeeklyPdf: boolean;
  monthlyEnabled: boolean;
  monthlyDayOfMonth: number;
  monthlyHour: number;
  attachMonthlyPdf: boolean;
  lastWeeklyPeriodSent: string | null;
  lastMonthlyPeriodSent: string | null;
  lastError: string | null;
  updatedAt: string;
}

export interface WhatsAppReportConfigUpdateInput {
  enabled?: boolean;
  baseUrl?: string;
  apiKey?: string;
  clearApiKey?: boolean;
  sessionId?: string;
  recipients?: string[] | string;
  weeklyEnabled?: boolean;
  weeklyDayOfWeek?: number;
  weeklyHour?: number;
  attachWeeklyPdf?: boolean;
  monthlyEnabled?: boolean;
  monthlyDayOfMonth?: number;
  monthlyHour?: number;
  attachMonthlyPdf?: boolean;
}

export interface WhatsAppDispatchLogDto {
  id: string;
  triggerType: string;
  reportMode: string;
  periodKey: string;
  recipients: string[];
  status: string;
  summaryText: string;
  pdfAttached: boolean;
  errorMessage: string | null;
  createdAt: string;
}

let tablesEnsured = false;
let schedulerRunning = false;

export async function ensureWhatsAppTables() {
  if (tablesEnsured) return;
  await pool.query(`
    CREATE TABLE IF NOT EXISTS "whatsapp_report_configs" (
      "workspace_owner_id" text PRIMARY KEY NOT NULL,
      "enabled" boolean DEFAULT false NOT NULL,
      "base_url" text DEFAULT 'http://localhost:2785' NOT NULL,
      "api_key" text DEFAULT '' NOT NULL,
      "session_id" text DEFAULT 'tokomu-wa' NOT NULL,
      "recipients" jsonb DEFAULT '[]'::jsonb NOT NULL,
      "weekly_enabled" boolean DEFAULT true NOT NULL,
      "weekly_day_of_week" integer DEFAULT 1 NOT NULL,
      "weekly_hour" integer DEFAULT 8 NOT NULL,
      "attach_weekly_pdf" boolean DEFAULT true NOT NULL,
      "monthly_enabled" boolean DEFAULT true NOT NULL,
      "monthly_day_of_month" integer DEFAULT 1 NOT NULL,
      "monthly_hour" integer DEFAULT 8 NOT NULL,
      "attach_monthly_pdf" boolean DEFAULT true NOT NULL,
      "last_weekly_period_sent" text,
      "last_monthly_period_sent" text,
      "last_error" text,
      "created_at" timestamp with time zone NOT NULL,
      "updated_at" timestamp with time zone NOT NULL
    );
  `);
  await pool.query(`
    ALTER TABLE "whatsapp_report_configs"
      ADD COLUMN IF NOT EXISTS "attach_weekly_pdf" boolean DEFAULT true NOT NULL;
  `);
  await pool.query(`
    CREATE TABLE IF NOT EXISTS "whatsapp_dispatch_logs" (
      "id" text PRIMARY KEY NOT NULL,
      "workspace_owner_id" text NOT NULL,
      "trigger_type" text NOT NULL,
      "report_mode" text NOT NULL,
      "period_key" text NOT NULL,
      "recipients" jsonb NOT NULL,
      "status" text NOT NULL,
      "summary_text" text NOT NULL,
      "pdf_attached" boolean DEFAULT false NOT NULL,
      "error_message" text,
      "created_at" timestamp with time zone NOT NULL
    );
  `);
  await pool.query(`
    CREATE INDEX IF NOT EXISTS "whatsapp_dispatch_logs_ws_created_idx"
      ON "whatsapp_dispatch_logs" USING btree ("workspace_owner_id", "created_at");
  `);
  tablesEnsured = true;
}

function maskApiKey(value: string): string {
  const trimmed = value.trim();
  if (!trimmed) return "";
  if (trimmed.length <= 6) return "*".repeat(trimmed.length);
  return `${trimmed.slice(0, 3)}***${trimmed.slice(-3)}`;
}

function formatRupiah(value: number): string {
  return new Intl.NumberFormat("id-ID", {
    style: "currency",
    currency: "IDR",
    maximumFractionDigits: 0,
  }).format(Math.round(value || 0));
}

function formatJakartaDateLabel(dateInput: Date | string): string {
  return new Intl.DateTimeFormat("id-ID", {
    timeZone: JAKARTA_TIME_ZONE,
    day: "numeric",
    month: "short",
    year: "numeric",
  }).format(new Date(dateInput));
}

export interface JakartaNowParts {
  year: number;
  month: number;
  day: number;
  dayOfWeek: number;
  hour: number;
  minute: number;
  dateKey: string;
}

const WEEKDAY_MAP: Record<string, number> = {
  Sun: 0,
  Mon: 1,
  Tue: 2,
  Wed: 3,
  Thu: 4,
  Fri: 5,
  Sat: 6,
};

export function getJakartaNowParts(date = new Date()): JakartaNowParts {
  const formatter = new Intl.DateTimeFormat("en-US", {
    timeZone: JAKARTA_TIME_ZONE,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    weekday: "short",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  });
  const parts = formatter.formatToParts(date);
  const lookup = new Map(parts.map((p) => [p.type, p.value]));

  const year = Number(lookup.get("year") ?? "2026");
  const month = Number(lookup.get("month") ?? "1");
  const day = Number(lookup.get("day") ?? "1");
  const hourRaw = Number(lookup.get("hour") ?? "0");
  const hour = hourRaw === 24 ? 0 : hourRaw;
  const minute = Number(lookup.get("minute") ?? "0");
  const weekdayStr = lookup.get("weekday") ?? "Mon";
  const dayOfWeek = WEEKDAY_MAP[weekdayStr] ?? 1;
  const dateKey = `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;

  return { year, month, day, dayOfWeek, hour, minute, dateKey };
}

function shiftDateKey(dateKey: string, deltaDays: number): string {
  const [y, m, d] = dateKey.split("-").map(Number);
  const utc = new Date(Date.UTC(y, m - 1, d + deltaDays));
  return `${utc.getUTCFullYear()}-${String(utc.getUTCMonth() + 1).padStart(2, "0")}-${String(utc.getUTCDate()).padStart(2, "0")}`;
}

export function getScheduledWeeklyTargetDateKey(
  parts: JakartaNowParts,
  weeklyDayOfWeek: number
): string {
  // Sunday schedule sends the week ending today; Monday/Tue/... sends the previous completed week.
  if (weeklyDayOfWeek === 0) {
    return parts.dateKey;
  }
  const diffToPrevSunday = parts.dayOfWeek === 0 ? 7 : parts.dayOfWeek;
  return shiftDateKey(parts.dateKey, -diffToPrevSunday);
}

export function getScheduledMonthlyTargetPeriod(
  parts: JakartaNowParts,
  monthlyDayOfMonth: number
): string {
  // Day 1..15 summarizes the previous completed month; day 16..28 summarizes the current month-to-date.
  if (monthlyDayOfMonth <= 15) {
    const prevMonth = parts.month === 1 ? 12 : parts.month - 1;
    const prevYear = parts.month === 1 ? parts.year - 1 : parts.year;
    return `${prevYear}-${String(prevMonth).padStart(2, "0")}`;
  }
  return `${parts.year}-${String(parts.month).padStart(2, "0")}`;
}

export async function getRawWhatsAppReportConfig(workspaceOwnerId: string) {
  await ensureWhatsAppTables();

  const [existing] = await db
    .select()
    .from(whatsappReportConfigs)
    .where(eq(whatsappReportConfigs.workspaceOwnerId, workspaceOwnerId))
    .limit(1);

  if (existing) {
    return existing;
  }

  const [profile] = await db
    .select({ ownerWhatsapp: storeProfiles.ownerWhatsapp })
    .from(storeProfiles)
    .where(eq(storeProfiles.userId, workspaceOwnerId))
    .limit(1);

  let initialRecipients: string[] = [];
  if (profile?.ownerWhatsapp?.trim()) {
    try {
      initialRecipients = parseWhatsAppRecipients(profile.ownerWhatsapp);
    } catch {
      initialRecipients = [];
    }
  }

  const now = new Date().toISOString();
  const defaultBaseUrl =
    process.env.OPENWA_BASE_URL?.trim() || "http://localhost:2785";
  const defaultApiKey = process.env.OPENWA_API_KEY?.trim() || "";
  const defaultSessionId =
    process.env.OPENWA_SESSION_ID?.trim() || "tokomu-wa";

  const [created] = await db
    .insert(whatsappReportConfigs)
    .values({
      workspaceOwnerId,
      enabled: false,
      baseUrl: defaultBaseUrl,
      apiKey: defaultApiKey,
      sessionId: defaultSessionId,
      recipients: initialRecipients,
      weeklyEnabled: true,
      weeklyDayOfWeek: 1,
      weeklyHour: 8,
      attachWeeklyPdf: true,
      monthlyEnabled: true,
      monthlyDayOfMonth: 1,
      monthlyHour: 8,
      attachMonthlyPdf: true,
      lastWeeklyPeriodSent: null,
      lastMonthlyPeriodSent: null,
      lastError: null,
      createdAt: now,
      updatedAt: now,
    })
    .onConflictDoNothing()
    .returning();

  if (created) {
    return created;
  }

  const [refetched] = await db
    .select()
    .from(whatsappReportConfigs)
    .where(eq(whatsappReportConfigs.workspaceOwnerId, workspaceOwnerId))
    .limit(1);

  if (!refetched) {
    throw new Error("Gagal membuat konfigurasi WhatsApp.");
  }

  return refetched;
}

function toConfigDto(
  row: typeof whatsappReportConfigs.$inferSelect
): WhatsAppReportConfigDto {
  return {
    workspaceOwnerId: row.workspaceOwnerId,
    enabled: row.enabled,
    baseUrl: row.baseUrl,
    apiKeyMasked: maskApiKey(row.apiKey),
    hasApiKey: row.apiKey.trim().length > 0,
    sessionId: row.sessionId,
    recipients: Array.isArray(row.recipients) ? row.recipients : [],
    weeklyEnabled: row.weeklyEnabled,
    weeklyDayOfWeek: row.weeklyDayOfWeek,
    weeklyHour: row.weeklyHour,
    attachWeeklyPdf: row.attachWeeklyPdf,
    monthlyEnabled: row.monthlyEnabled,
    monthlyDayOfMonth: row.monthlyDayOfMonth,
    monthlyHour: row.monthlyHour,
    attachMonthlyPdf: row.attachMonthlyPdf,
    lastWeeklyPeriodSent: row.lastWeeklyPeriodSent ?? null,
    lastMonthlyPeriodSent: row.lastMonthlyPeriodSent ?? null,
    lastError: row.lastError ?? null,
    updatedAt: row.updatedAt,
  };
}

export async function getWhatsAppReportConfig(
  workspaceOwnerId: string
): Promise<WhatsAppReportConfigDto> {
  const row = await getRawWhatsAppReportConfig(workspaceOwnerId);
  return toConfigDto(row);
}

export async function updateWhatsAppReportConfig(
  workspaceOwnerId: string,
  actorUserId: string,
  input: WhatsAppReportConfigUpdateInput
): Promise<WhatsAppReportConfigDto> {
  const existing = await getRawWhatsAppReportConfig(workspaceOwnerId);

  const nextBaseUrl =
    input.baseUrl !== undefined
      ? normalizeOpenWaBaseUrl(input.baseUrl)
      : existing.baseUrl;

  const nextSessionId =
    input.sessionId !== undefined
      ? input.sessionId.trim() || "tokomu-wa"
      : existing.sessionId;

  let nextApiKey = existing.apiKey;
  if (input.clearApiKey) {
    nextApiKey = "";
  } else if (typeof input.apiKey === "string") {
    const trimmedKey = input.apiKey.trim();
    if (trimmedKey && trimmedKey !== "__KEEP__") {
      nextApiKey = trimmedKey;
    }
  }

  const nextRecipients =
    input.recipients !== undefined
      ? parseWhatsAppRecipients(input.recipients)
      : existing.recipients;

  const weeklyDayOfWeek =
    input.weeklyDayOfWeek !== undefined
      ? Math.min(6, Math.max(0, Math.round(input.weeklyDayOfWeek)))
      : existing.weeklyDayOfWeek;

  const weeklyHour =
    input.weeklyHour !== undefined
      ? Math.min(23, Math.max(0, Math.round(input.weeklyHour)))
      : existing.weeklyHour;

  const monthlyDayOfMonth =
    input.monthlyDayOfMonth !== undefined
      ? Math.min(28, Math.max(1, Math.round(input.monthlyDayOfMonth)))
      : existing.monthlyDayOfMonth;

  const monthlyHour =
    input.monthlyHour !== undefined
      ? Math.min(23, Math.max(0, Math.round(input.monthlyHour)))
      : existing.monthlyHour;

  const now = new Date().toISOString();
  const [updated] = await db
    .update(whatsappReportConfigs)
    .set({
      enabled: input.enabled ?? existing.enabled,
      baseUrl: nextBaseUrl,
      apiKey: nextApiKey,
      sessionId: nextSessionId,
      recipients: nextRecipients,
      weeklyEnabled: input.weeklyEnabled ?? existing.weeklyEnabled,
      weeklyDayOfWeek,
      weeklyHour,
      attachWeeklyPdf: input.attachWeeklyPdf ?? existing.attachWeeklyPdf,
      monthlyEnabled: input.monthlyEnabled ?? existing.monthlyEnabled,
      monthlyDayOfMonth,
      monthlyHour,
      attachMonthlyPdf: input.attachMonthlyPdf ?? existing.attachMonthlyPdf,
      updatedAt: now,
    })
    .where(eq(whatsappReportConfigs.workspaceOwnerId, workspaceOwnerId))
    .returning();

  await logEvent(
    { workspaceOwnerId, actorUserId },
    {
      eventType: "WHATSAPP_CONFIG_UPDATED",
      entityType: "whatsapp_report_config",
      entityId: workspaceOwnerId,
      category: "update",
      payload: {
        enabled: updated.enabled,
        baseUrl: updated.baseUrl,
        sessionId: updated.sessionId,
        recipientsCount: updated.recipients.length,
        weeklyEnabled: updated.weeklyEnabled,
        monthlyEnabled: updated.monthlyEnabled,
      },
    }
  );

  return toConfigDto(updated);
}

export async function listWhatsAppDispatchLogs(
  workspaceOwnerId: string,
  limit = 20
): Promise<WhatsAppDispatchLogDto[]> {
  await ensureWhatsAppTables();
  const rows = await db
    .select()
    .from(whatsappDispatchLogs)
    .where(eq(whatsappDispatchLogs.workspaceOwnerId, workspaceOwnerId))
    .orderBy(desc(whatsappDispatchLogs.createdAt))
    .limit(Math.min(50, Math.max(1, limit)));

  return rows.map((row) => ({
    id: row.id,
    triggerType: row.triggerType,
    reportMode: row.reportMode,
    periodKey: row.periodKey,
    recipients: Array.isArray(row.recipients) ? row.recipients : [],
    status: row.status,
    summaryText: row.summaryText,
    pdfAttached: row.pdfAttached,
    errorMessage: row.errorMessage ?? null,
    createdAt: row.createdAt,
  }));
}

function resolveRangeFromMode(mode: "mingguan" | "bulanan", periodValue: string) {
  if (mode === "mingguan") {
    const cleanDate = /^\d{4}-\d{2}-\d{2}$/.test(periodValue)
      ? periodValue
      : getJakartaNowParts().dateKey;
    const range = getJakartaWeekRange(cleanDate);
    const weekStartJakarta = getJakartaNowParts(new Date(range.start)).dateKey;
    const endMinusOneSec = new Date(new Date(range.end).getTime() - 1000);
    const label = `${formatJakartaDateLabel(range.start)} - ${formatJakartaDateLabel(endMinusOneSec)}`;
    return {
      periodValue: cleanDate,
      periodKey: weekStartJakarta,
      start: range.start,
      end: range.end,
      label,
    };
  }

  const monthMatch = /^(\d{4})-(\d{2})$/.exec(periodValue);
  const parts = getJakartaNowParts();
  const year = monthMatch ? Number(monthMatch[1]) : parts.year;
  const month = monthMatch ? Number(monthMatch[2]) : parts.month;
  const normalizedValue = `${year}-${String(month).padStart(2, "0")}`;
  const range = getPeriodRange(year, month);
  const label = new Intl.DateTimeFormat("id-ID", {
    timeZone: JAKARTA_TIME_ZONE,
    month: "long",
    year: "numeric",
  }).format(new Date(range.start));

  return {
    periodValue: normalizedValue,
    periodKey: normalizedValue,
    start: range.start,
    end: range.end,
    label,
  };
}

export async function buildWhatsAppReportMessage(
  workspaceOwnerId: string,
  mode: "mingguan" | "bulanan",
  periodValue: string
) {
  const resolved = resolveRangeFromMode(mode, periodValue);

  const [[profile], rollup, assetSummary, topProducts] = await Promise.all([
    db
      .select({
        storeName: storeProfiles.storeName,
        storeAddress: storeProfiles.storeAddress,
        profitSharePcmPct: storeProfiles.profitSharePcmPct,
        profitShareReservePct: storeProfiles.profitShareReservePct,
      })
      .from(storeProfiles)
      .where(eq(storeProfiles.userId, workspaceOwnerId))
      .limit(1),
    getReportRollupByMode(workspaceOwnerId, mode, resolved.periodValue),
    getAssetCapitalSummary(workspaceOwnerId),
    getTopProductsForPeriod(workspaceOwnerId, resolved.start, resolved.end, 3),
  ]);

  const storeName = profile?.storeName?.trim() || "TokoMu";
  const title =
    mode === "mingguan"
      ? `📊 *LAPORAN MINGGUAN - ${storeName.toUpperCase()}*`
      : `📑 *LAPORAN BULANAN - ${storeName.toUpperCase()}*`;

  const lines: string[] = [
    title,
    `Periode: *${resolved.label}*`,
    "",
    "💰 *Ringkasan Keuangan*",
    `• Omzet Penjualan: *${formatRupiah(rollup.revenue)}*`,
    `• HPP / Modal Terjual: ${formatRupiah(rollup.cogs)}`,
    `• Laba Kotor: ${formatRupiah(rollup.grossProfit)}`,
    `• Biaya Operasional: ${formatRupiah(rollup.expenseTotal)}`,
    `• Laba Bersih: *${formatRupiah(rollup.netProfit)}*`,
    "",
    "🧾 *Aktivitas Kasir & Aset*",
    `• Jumlah Transaksi: ${rollup.transactionCount} transaksi`,
    `• Rata-rata Belanja: ${formatRupiah(rollup.averageTicket)}`,
    `• Nilai Stok Saat Ini: ${formatRupiah(assetSummary.inventoryCapital)}`,
    `• Piutang Kasbon Aktif: ${formatRupiah(assetSummary.activeReceivables)}`,
  ];

  if (rollup.profitDistribution > 0) {
    lines.push(
      `• Bagi Hasil Investor / Akad: ${formatRupiah(rollup.profitDistribution)}`
    );
  }

  if (rollup.netProfit > 0) {
    const pcmPct = profile?.profitSharePcmPct ?? 30;
    const reservePct = profile?.profitShareReservePct ?? 20;
    const executorPct = Math.max(0, 100 - pcmPct - reservePct);
    const distributable = Math.max(0, rollup.netProfit);
    const pcmAmount = Math.round((distributable * pcmPct) / 100);
    const reserveAmount = Math.round((distributable * reservePct) / 100);
    const executorAmount = Math.max(0, distributable - pcmAmount - reserveAmount);
    lines.push(
      "",
      "🤝 *Alokasi Laba Bersih*",
      `• PCM (${pcmPct}%): ${formatRupiah(pcmAmount)}`,
      `• Kas Cadangan (${reservePct}%): ${formatRupiah(reserveAmount)}`,
      `• Toko / Pelaksana (${executorPct}%): ${formatRupiah(executorAmount)}`
    );
  }

  if (topProducts.length > 0) {
    lines.push("", "🏆 *Produk Terlaris*");
    topProducts.forEach((prod, index) => {
      lines.push(
        `${index + 1}. ${prod.name} (${prod.sold} pcs • ${formatRupiah(prod.revenue)})`
      );
    });
  }

  lines.push(
    "",
    `_Dikirim otomatis oleh sistem WarungOS ${storeName} via OpenWA_`
  );

  return {
    message: lines.join("\n"),
    periodKey: resolved.periodKey,
    periodValue: resolved.periodValue,
    periodLabel: resolved.label,
    rollup,
  };
}

export async function dispatchWhatsAppReport(params: {
  workspaceOwnerId: string;
  actorUserId: string;
  mode: "mingguan" | "bulanan";
  periodValue: string;
  triggerType: WhatsAppTriggerType;
  attachPdf?: boolean;
  overrideRecipients?: string[] | string;
}): Promise<WhatsAppDispatchLogDto> {
  const config = await getRawWhatsAppReportConfig(params.workspaceOwnerId);

  const targetRecipients = params.overrideRecipients
    ? parseWhatsAppRecipients(params.overrideRecipients)
    : Array.isArray(config.recipients)
      ? config.recipients
      : [];

  if (targetRecipients.length === 0) {
    throw new Error(
      "Daftar nomor tujuan WhatsApp masih kosong. Tambahkan minimal 1 nomor di Pengaturan > WhatsApp & Auto Laporan."
    );
  }

  const report = await buildWhatsAppReportMessage(
    params.workspaceOwnerId,
    params.mode,
    params.periodValue
  );

  const shouldAttachPdf =
    params.attachPdf ??
    (params.mode === "mingguan"
      ? config.attachWeeklyPdf
      : config.attachMonthlyPdf);

  let pdfPayload: { buffer: Buffer; filename: string } | null = null;
  const warnings: string[] = [];

  if (shouldAttachPdf) {
    try {
      const { buildProfitLossPdfBuffer } = await import(
        "@/lib/server/profit-loss-pdf-builder"
      );
      const pdfResult = await buildProfitLossPdfBuffer({
        workspaceOwnerId: params.workspaceOwnerId,
        periodValue: report.periodValue,
        mode: params.mode,
      });
      pdfPayload = {
        buffer: pdfResult.buffer,
        filename: pdfResult.filename,
      };
    } catch (error) {
      warnings.push(
        `PDF gagal dibuat (${error instanceof Error ? error.message : "unknown"})`
      );
    }
  }

  const connection = {
    baseUrl: config.baseUrl,
    apiKey: config.apiKey,
    sessionId: config.sessionId,
  };

  let textSuccessCount = 0;
  let pdfSuccessCount = 0;

  for (const chatId of targetRecipients) {
    try {
      await sendOpenWaText(connection, chatId, report.message);
      textSuccessCount += 1;
    } catch (error) {
      warnings.push(
        `${chatId} (teks): ${error instanceof Error ? error.message : "gagal kirim"}`
      );
      continue;
    }

    if (pdfPayload) {
      try {
        await sendOpenWaDocument(connection, chatId, {
          base64: pdfPayload.buffer.toString("base64"),
          filename: pdfPayload.filename,
          mimetype: "application/pdf",
          caption: `Lampiran PDF Laporan Keuangan ${params.mode === "mingguan" ? "Mingguan" : "Bulanan"} (${report.periodLabel})`,
        });
        pdfSuccessCount += 1;
      } catch (error) {
        warnings.push(
          `${chatId} (PDF): ${error instanceof Error ? error.message : "gagal kirim dokumen"}`
        );
      }
    }
  }

  const status =
    textSuccessCount === 0
      ? "failed"
      : warnings.length > 0
        ? "partial"
        : "sent";

  const errorMessage = warnings.length > 0 ? warnings.join(" | ") : null;
  const now = new Date().toISOString();
  const logId = `wad_${crypto.randomUUID().slice(0, 14)}`;

  const [createdLog] = await db
    .insert(whatsappDispatchLogs)
    .values({
      id: logId,
      workspaceOwnerId: params.workspaceOwnerId,
      triggerType: params.triggerType,
      reportMode: params.mode,
      periodKey: report.periodKey,
      recipients: targetRecipients,
      status,
      summaryText: report.message,
      pdfAttached: pdfSuccessCount > 0,
      errorMessage,
      createdAt: now,
    })
    .returning();

  const updateFields: Partial<typeof whatsappReportConfigs.$inferInsert> = {
    lastError: status === "sent" ? null : errorMessage,
    updatedAt: now,
  };

  if (status !== "failed") {
    if (params.mode === "mingguan" && params.triggerType === "auto_weekly") {
      updateFields.lastWeeklyPeriodSent = report.periodKey;
    } else if (
      params.mode === "bulanan" &&
      params.triggerType === "auto_monthly"
    ) {
      updateFields.lastMonthlyPeriodSent = report.periodKey;
    }
  }

  await db
    .update(whatsappReportConfigs)
    .set(updateFields)
    .where(eq(whatsappReportConfigs.workspaceOwnerId, params.workspaceOwnerId));

  await logEvent(
    { workspaceOwnerId: params.workspaceOwnerId, actorUserId: params.actorUserId },
    {
      eventType: "WHATSAPP_REPORT_SENT",
      entityType: "whatsapp_dispatch_log",
      entityId: logId,
      category: "system",
      payload: {
        mode: params.mode,
        periodKey: report.periodKey,
        triggerType: params.triggerType,
        status,
        recipientsCount: targetRecipients.length,
        pdfAttached: pdfSuccessCount > 0,
        errorMessage,
      },
    }
  ).catch(() => {});

  if (status === "failed") {
    throw new Error(errorMessage || "Gagal mengirim laporan ke WhatsApp.");
  }

  return {
    id: createdLog.id,
    triggerType: createdLog.triggerType,
    reportMode: createdLog.reportMode,
    periodKey: createdLog.periodKey,
    recipients: createdLog.recipients,
    status: createdLog.status,
    summaryText: createdLog.summaryText,
    pdfAttached: createdLog.pdfAttached,
    errorMessage: createdLog.errorMessage ?? null,
    createdAt: createdLog.createdAt,
  };
}

export async function sendWhatsAppTestMessage(
  workspaceOwnerId: string,
  actorUserId: string,
  overrideRecipient?: string
): Promise<WhatsAppDispatchLogDto> {
  const config = await getRawWhatsAppReportConfig(workspaceOwnerId);
  const [profile] = await db
    .select({ storeName: storeProfiles.storeName })
    .from(storeProfiles)
    .where(eq(storeProfiles.userId, workspaceOwnerId))
    .limit(1);

  const recipients = overrideRecipient?.trim()
    ? parseWhatsAppRecipients(overrideRecipient)
    : Array.isArray(config.recipients)
      ? config.recipients
      : [];

  if (recipients.length === 0) {
    throw new Error(
      "Isi minimal 1 nomor tujuan WhatsApp untuk mengirim pesan uji coba."
    );
  }

  const storeName = profile?.storeName?.trim() || "TokoMu";
  const parts = getJakartaNowParts();
  const text = [
    `✅ *Uji Koneksi OpenWA - ${storeName}*`,
    "",
    `Integrasi WhatsApp Gateway berhasil terhubung.`,
    `Session: \`${config.sessionId}\``,
    `Waktu (WIB): ${parts.dateKey} ${String(parts.hour).padStart(2, "0")}:${String(parts.minute).padStart(2, "0")}`,
    "",
    "Siap menerima laporan keuangan mingguan & bulanan secara otomatis.",
  ].join("\n");

  const warnings: string[] = [];
  let successCount = 0;

  for (const chatId of recipients) {
    try {
      await sendOpenWaText(
        {
          baseUrl: config.baseUrl,
          apiKey: config.apiKey,
          sessionId: config.sessionId,
        },
        chatId,
        text
      );
      successCount += 1;
    } catch (error) {
      warnings.push(
        `${chatId}: ${error instanceof Error ? error.message : "gagal kirim"}`
      );
    }
  }

  const status =
    successCount === 0 ? "failed" : warnings.length > 0 ? "partial" : "sent";
  const errorMessage = warnings.length > 0 ? warnings.join(" | ") : null;
  const now = new Date().toISOString();
  const logId = `wat_${crypto.randomUUID().slice(0, 14)}`;

  const [createdLog] = await db
    .insert(whatsappDispatchLogs)
    .values({
      id: logId,
      workspaceOwnerId,
      triggerType: "test",
      reportMode: "test",
      periodKey: parts.dateKey,
      recipients,
      status,
      summaryText: text,
      pdfAttached: false,
      errorMessage,
      createdAt: now,
    })
    .returning();

  await db
    .update(whatsappReportConfigs)
    .set({
      lastError: status === "sent" ? null : errorMessage,
      updatedAt: now,
    })
    .where(eq(whatsappReportConfigs.workspaceOwnerId, workspaceOwnerId));

  if (status === "failed") {
    throw new Error(errorMessage || "Pesan uji coba gagal dikirim.");
  }

  return {
    id: createdLog.id,
    triggerType: createdLog.triggerType,
    reportMode: createdLog.reportMode,
    periodKey: createdLog.periodKey,
    recipients: createdLog.recipients,
    status: createdLog.status,
    summaryText: createdLog.summaryText,
    pdfAttached: createdLog.pdfAttached,
    errorMessage: createdLog.errorMessage ?? null,
    createdAt: createdLog.createdAt,
  };
}

export async function processScheduledWhatsAppReports(now = new Date()) {
  if (schedulerRunning) {
    return { skipped: true, reason: "already_running", processed: 0, sent: [] as string[] };
  }
  schedulerRunning = true;

  const sent: string[] = [];
  const errors: string[] = [];
  let processed = 0;

  try {
    await ensureWhatsAppTables();
    const activeConfigs = await db
      .select()
      .from(whatsappReportConfigs)
      .where(eq(whatsappReportConfigs.enabled, true));

    const parts = getJakartaNowParts(now);

    for (const cfg of activeConfigs) {
      processed += 1;
      if (!cfg.recipients || cfg.recipients.length === 0) continue;

      const weeklyTargetDateKey = getScheduledWeeklyTargetDateKey(
        parts,
        cfg.weeklyDayOfWeek
      );
      const weeklyRange = resolveRangeFromMode("mingguan", weeklyTargetDateKey);
      const weeklyDue =
        cfg.weeklyEnabled &&
        parts.dayOfWeek === cfg.weeklyDayOfWeek &&
        parts.hour >= cfg.weeklyHour &&
        cfg.lastWeeklyPeriodSent !== weeklyRange.periodKey;

      const monthlyTargetPeriod = getScheduledMonthlyTargetPeriod(
        parts,
        cfg.monthlyDayOfMonth
      );
      const monthlyDue =
        cfg.monthlyEnabled &&
        parts.day >= cfg.monthlyDayOfMonth &&
        parts.hour >= cfg.monthlyHour &&
        cfg.lastMonthlyPeriodSent !== monthlyTargetPeriod;

      if (!weeklyDue && !monthlyDue) continue;

      try {
        const sessionStatus = await getOpenWaSessionStatus({
          baseUrl: cfg.baseUrl,
          apiKey: cfg.apiKey,
          sessionId: cfg.sessionId,
        });

        if (!sessionStatus.connected) {
          const msg = `Jadwal otomatis dilewati: Session OpenWA "${cfg.sessionId}" belum connected (${sessionStatus.status}).`;
          await db
            .update(whatsappReportConfigs)
            .set({ lastError: msg, updatedAt: new Date().toISOString() })
            .where(eq(whatsappReportConfigs.workspaceOwnerId, cfg.workspaceOwnerId));
          errors.push(`${cfg.workspaceOwnerId}: ${msg}`);
          continue;
        }
      } catch (error) {
        const msg = error instanceof Error ? error.message : "OpenWA tidak terjangkau";
        await db
          .update(whatsappReportConfigs)
          .set({ lastError: msg, updatedAt: new Date().toISOString() })
          .where(eq(whatsappReportConfigs.workspaceOwnerId, cfg.workspaceOwnerId));
        errors.push(`${cfg.workspaceOwnerId}: ${msg}`);
        continue;
      }

      if (weeklyDue) {
        try {
          await dispatchWhatsAppReport({
            workspaceOwnerId: cfg.workspaceOwnerId,
            actorUserId: cfg.workspaceOwnerId,
            mode: "mingguan",
            periodValue: weeklyTargetDateKey,
            triggerType: "auto_weekly",
            attachPdf: cfg.attachWeeklyPdf,
          });
          sent.push(`${cfg.workspaceOwnerId}:weekly:${weeklyRange.periodKey}`);
        } catch (error) {
          errors.push(
            `${cfg.workspaceOwnerId}:weekly: ${error instanceof Error ? error.message : "gagal"}`
          );
        }
      }

      if (monthlyDue) {
        try {
          await dispatchWhatsAppReport({
            workspaceOwnerId: cfg.workspaceOwnerId,
            actorUserId: cfg.workspaceOwnerId,
            mode: "bulanan",
            periodValue: monthlyTargetPeriod,
            triggerType: "auto_monthly",
            attachPdf: cfg.attachMonthlyPdf,
          });
          sent.push(`${cfg.workspaceOwnerId}:monthly:${monthlyTargetPeriod}`);
        } catch (error) {
          errors.push(
            `${cfg.workspaceOwnerId}:monthly: ${error instanceof Error ? error.message : "gagal"}`
          );
        }
      }
    }

    return { skipped: false, processed, sent, errors };
  } finally {
    schedulerRunning = false;
  }
}
