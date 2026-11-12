export interface OpenWaConnectionConfig {
  baseUrl: string;
  apiKey: string;
  sessionId: string;
}

export interface OpenWaSessionStatusResult {
  exists: boolean;
  sessionId: string;
  status: string;
  connected: boolean;
  phoneNumber: string | null;
  pushName: string | null;
  raw?: unknown;
}

export interface OpenWaQrResult {
  sessionId: string;
  status: string;
  qrCode: string | null;
  message?: string;
}

export interface OpenWaSendResult {
  success: boolean;
  chatId: string;
  messageId: string | null;
  raw?: unknown;
}

export function normalizeOpenWaBaseUrl(rawUrl: string): string {
  const trimmed = rawUrl.trim().replace(/\/+$/, "");
  if (!trimmed) {
    throw new Error("URL server OpenWA wajib diisi.");
  }
  let parsed: URL;
  try {
    parsed = new URL(trimmed);
  } catch {
    throw new Error("Format URL OpenWA tidak valid. Contoh: http://localhost:2785");
  }
  if (parsed.protocol !== "http:" && parsed.protocol !== "https:") {
    throw new Error("URL OpenWA harus menggunakan protokol http:// atau https://");
  }
  return trimmed;
}

/**
 * Normalizes a phone number or group identifier into an OpenWA chatId.
 * Examples:
 *  - "08123456789" -> "628123456789@c.us"
 *  - "+62 812-3456-789" -> "628123456789@c.us"
 *  - "628123456789@c.us" -> "628123456789@c.us"
 *  - "120363012345678@g.us" -> "120363012345678@g.us"
 */
export function normalizeWhatsAppChatId(raw: string): string {
  const trimmed = raw.trim();
  if (!trimmed) return "";

  const lower = trimmed.toLowerCase();
  if (lower.endsWith("@c.us") || lower.endsWith("@g.us") || lower.endsWith("@lid")) {
    const [prefix, suffix] = lower.split("@");
    const cleanPrefix = prefix.replace(/[^\d-]/g, "");
    if (!cleanPrefix) return "";
    return `${cleanPrefix}@${suffix}`;
  }

  let digits = trimmed.replace(/\D/g, "");
  if (!digits) return "";

  if (digits.startsWith("0")) {
    digits = `62${digits.slice(1)}`;
  } else if (digits.startsWith("8")) {
    digits = `62${digits}`;
  }

  if (digits.length < 8) {
    throw new Error(`Nomor WhatsApp tidak valid: "${trimmed}"`);
  }

  return `${digits}@c.us`;
}

export function parseWhatsAppRecipients(input: string[] | string): string[] {
  const rawItems = Array.isArray(input)
    ? input
    : input.split(/[\n,;]+/g);

  const normalized = rawItems
    .map((item) => normalizeWhatsAppChatId(item))
    .filter(Boolean);

  return Array.from(new Set(normalized));
}

function unwrapPayload(json: unknown): Record<string, unknown> {
  if (!json || typeof json !== "object") return {};
  const obj = json as Record<string, unknown>;
  if (obj.data && typeof obj.data === "object" && !Array.isArray(obj.data)) {
    return obj.data as Record<string, unknown>;
  }
  return obj;
}

async function openWaRequest(
  config: OpenWaConnectionConfig,
  path: string,
  init: RequestInit & { timeoutMs?: number } = {}
): Promise<{ status: number; ok: boolean; json: unknown; text: string }> {
  const baseUrl = normalizeOpenWaBaseUrl(config.baseUrl);
  const headers = new Headers(init.headers);
  headers.set("Accept", "application/json");
  if (init.body && !headers.has("Content-Type")) {
    headers.set("Content-Type", "application/json");
  }
  if (config.apiKey.trim()) {
    headers.set("X-API-Key", config.apiKey.trim());
  }

  let response: Response;
  try {
    response = await fetch(`${baseUrl}${path}`, {
      ...init,
      headers,
      signal: AbortSignal.timeout(init.timeoutMs ?? 15000),
      cache: "no-store",
    });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Koneksi ke server OpenWA gagal";
    throw new Error(`Tidak dapat terhubung ke OpenWA (${baseUrl}): ${message}`);
  }

  const text = await response.text();
  let json: unknown = null;
  if (text) {
    try {
      json = JSON.parse(text);
    } catch {
      json = null;
    }
  }

  return {
    status: response.status,
    ok: response.ok,
    json,
    text,
  };
}

function extractErrorMessage(json: unknown, fallbackText: string, status: number): string {
  if (json && typeof json === "object") {
    const obj = json as Record<string, unknown>;
    for (const key of ["error", "message", "detail"]) {
      const val = obj[key];
      if (typeof val === "string" && val.trim()) {
        return val.trim();
      }
    }
  }
  if (fallbackText.trim()) {
    return `${fallbackText.trim().slice(0, 200)} (HTTP ${status})`;
  }
  return `OpenWA mengembalikan HTTP ${status}`;
}

export async function getOpenWaSessionStatus(
  config: OpenWaConnectionConfig
): Promise<OpenWaSessionStatusResult> {
  const sessionId = config.sessionId.trim() || "tokomu-wa";
  const res = await openWaRequest(
    config,
    `/api/sessions/${encodeURIComponent(sessionId)}`,
    { method: "GET" }
  );

  if (res.status === 404) {
    return {
      exists: false,
      sessionId,
      status: "not_created",
      connected: false,
      phoneNumber: null,
      pushName: null,
      raw: res.json,
    };
  }

  if (!res.ok) {
    throw new Error(extractErrorMessage(res.json, res.text, res.status));
  }

  const data = unwrapPayload(res.json);
  const rawStatus =
    typeof data.status === "string"
      ? data.status
      : typeof data.state === "string"
        ? data.state
        : "unknown";
  const me =
    data.me && typeof data.me === "object"
      ? (data.me as Record<string, unknown>)
      : null;

  const phoneNumber =
    (typeof data.phoneNumber === "string" && data.phoneNumber) ||
    (typeof data.phone === "string" && data.phone) ||
    (me && typeof me.id === "string" ? me.id : null);

  const pushName =
    (typeof data.pushName === "string" && data.pushName) ||
    (typeof data.name === "string" && data.name) ||
    (me && typeof me.pushName === "string" ? me.pushName : null);

  const normalizedStatus = rawStatus.toLowerCase();
  const connected =
    normalizedStatus === "ready" ||
    normalizedStatus === "connected" ||
    normalizedStatus === "authenticated";

  return {
    exists: true,
    sessionId,
    status: rawStatus,
    connected,
    phoneNumber,
    pushName,
    raw: res.json,
  };
}

export async function startOpenWaSession(
  config: OpenWaConnectionConfig
): Promise<OpenWaSessionStatusResult> {
  const sessionId = config.sessionId.trim() || "tokomu-wa";

  let res = await openWaRequest(
    config,
    `/api/sessions/${encodeURIComponent(sessionId)}/start`,
    { method: "POST" }
  );

  if (res.status === 404) {
    const createRes = await openWaRequest(config, "/api/sessions", {
      method: "POST",
      body: JSON.stringify({ sessionId }),
    });
    if (!createRes.ok && createRes.status !== 409) {
      throw new Error(
        extractErrorMessage(createRes.json, createRes.text, createRes.status)
      );
    }

    res = await openWaRequest(
      config,
      `/api/sessions/${encodeURIComponent(sessionId)}/start`,
      { method: "POST" }
    );
  }

  if (!res.ok) {
    throw new Error(extractErrorMessage(res.json, res.text, res.status));
  }

  return getOpenWaSessionStatus(config);
}

export async function getOpenWaSessionQr(
  config: OpenWaConnectionConfig
): Promise<OpenWaQrResult> {
  const sessionId = config.sessionId.trim() || "tokomu-wa";
  const res = await openWaRequest(
    config,
    `/api/sessions/${encodeURIComponent(sessionId)}/qr`,
    { method: "GET" }
  );

  if (res.status === 404) {
    return {
      sessionId,
      status: "not_created",
      qrCode: null,
      message: "Session belum dibuat atau belum dijalankan.",
    };
  }

  if (!res.ok) {
    const statusInfo = await getOpenWaSessionStatus(config).catch(() => null);
    if (statusInfo?.connected) {
      return {
        sessionId,
        status: statusInfo.status,
        qrCode: null,
        message: "WhatsApp sudah terhubung.",
      };
    }
    throw new Error(extractErrorMessage(res.json, res.text, res.status));
  }

  const data = unwrapPayload(res.json);
  const qrCode =
    (typeof data.qrCode === "string" && data.qrCode) ||
    (typeof data.qr === "string" && data.qr) ||
    (typeof data.code === "string" && data.code) ||
    null;

  const status =
    typeof data.status === "string"
      ? data.status
      : qrCode
        ? "qr_ready"
        : "unknown";

  return {
    sessionId,
    status,
    qrCode,
    message: typeof data.message === "string" ? data.message : undefined,
  };
}

export async function sendOpenWaText(
  config: OpenWaConnectionConfig,
  rawChatId: string,
  text: string
): Promise<OpenWaSendResult> {
  const sessionId = config.sessionId.trim() || "tokomu-wa";
  const chatId = normalizeWhatsAppChatId(rawChatId);
  if (!chatId) {
    throw new Error("Nomor tujuan WhatsApp tidak boleh kosong.");
  }

  const res = await openWaRequest(
    config,
    `/api/sessions/${encodeURIComponent(sessionId)}/messages/send-text`,
    {
      method: "POST",
      body: JSON.stringify({ chatId, text }),
      timeoutMs: 25000,
    }
  );

  if (!res.ok) {
    throw new Error(extractErrorMessage(res.json, res.text, res.status));
  }

  const data = unwrapPayload(res.json);
  const messageId =
    (typeof data.messageId === "string" && data.messageId) ||
    (typeof data.id === "string" && data.id) ||
    null;

  return {
    success: true,
    chatId,
    messageId,
    raw: res.json,
  };
}

export async function sendOpenWaDocument(
  config: OpenWaConnectionConfig,
  rawChatId: string,
  doc: {
    base64: string;
    filename: string;
    mimetype: string;
    caption?: string;
  }
): Promise<OpenWaSendResult> {
  const sessionId = config.sessionId.trim() || "tokomu-wa";
  const chatId = normalizeWhatsAppChatId(rawChatId);
  if (!chatId) {
    throw new Error("Nomor tujuan WhatsApp tidak boleh kosong.");
  }

  const res = await openWaRequest(
    config,
    `/api/sessions/${encodeURIComponent(sessionId)}/messages/send-document`,
    {
      method: "POST",
      body: JSON.stringify({
        chatId,
        base64: doc.base64,
        filename: doc.filename,
        mimetype: doc.mimetype,
        caption: doc.caption ?? "",
      }),
      timeoutMs: 35000,
    }
  );

  if (!res.ok) {
    throw new Error(extractErrorMessage(res.json, res.text, res.status));
  }

  const data = unwrapPayload(res.json);
  const messageId =
    (typeof data.messageId === "string" && data.messageId) ||
    (typeof data.id === "string" && data.id) ||
    null;

  return {
    success: true,
    chatId,
    messageId,
    raw: res.json,
  };
}

