export type GeminiImageContent = {
  type: "image_url";
  image_url: { url: string };
};

export type GeminiTextContent = {
  type: "text";
  text: string;
};

export type GeminiUserContent =
  | string
  | Array<GeminiTextContent | GeminiImageContent>;

export type GeminiMessage =
  | { role: "system"; content: string }
  | { role: "user"; content: GeminiUserContent }
  | {
      role: "assistant";
      content: string | null;
      tool_calls?: Array<{
        id: string;
        type: "function";
        function: { name: string; arguments: string };
      }>;
    }
  | { role: "tool"; tool_call_id: string; content: string; name?: string };

export type GeminiToolDef = {
  type: "function";
  function: {
    name: string;
    description: string;
    parameters: Record<string, unknown>;
  };
};

export type GeminiChoice = {
  index: number;
  finish_reason: string;
  message: {
    role: "assistant";
    content: string | null;
    tool_calls?: Array<{
      id: string;
      type: "function";
      function: { name: string; arguments: string };
    }>;
  };
};

export type GeminiResponse = {
  id: string;
  model: string;
  choices: GeminiChoice[];
  usage?: { prompt_tokens: number; completion_tokens: number; total_tokens: number };
};

function geminiErrorMessage(text: string) {
  try {
    const parsed = JSON.parse(text) as
      | { error?: { message?: string; status?: string } }
      | { error?: string; detail?: string }
      | Array<{ error?: { message?: string; status?: string } }>;
    const error = Array.isArray(parsed) ? parsed[0]?.error : parsed.error;
    if (typeof error === "string") {
      const detail = !Array.isArray(parsed) && "detail" in parsed ? parsed.detail : undefined;
      return detail ? `${error}: ${detail}` : error;
    }
    const status = error?.status ? `${error.status}: ` : "";
    if (error?.message) {
      return `${status}${error.message}`;
    }
  } catch {
    // Keep the original body if Gemini returns a non-JSON error.
  }

  return text;
}

const DEFAULT_MODEL =
  process.env.GEMINI_TEXT_MODEL ??
  "gemini-2.5-flash";
const FALLBACK_TEXT_MODEL =
  process.env.GEMINI_FALLBACK_TEXT_MODEL ??
  "gemini-2.0-flash-lite";
const FALLBACK_TEXT_MODEL_PINNED =
  process.env.GEMINI_FALLBACK_TEXT_MODEL_PINNED ??
  "gemini-2.0-flash-lite-001";
const DEFAULT_BASE_URL =
  process.env.GEMINI_BASE_URL ?? "https://generativelanguage.googleapis.com/v1beta/openai/";
const GOOGLE_DIRECT_BASE_URL = "https://generativelanguage.googleapis.com/v1beta/openai/";
const IS_PROXY = !!process.env.GEMINI_BASE_URL &&
  (process.env.GEMINI_BASE_URL.includes("iamhc.cn") || process.env.GEMINI_BASE_URL.includes("hcnsec.cn"));

// Multiple Google API keys for fallback (comma-separated)
const GOOGLE_API_KEYS = (process.env.GEMINI_GOOGLE_API_KEYS ?? "")
  .split(",")
  .map((k) => k.trim())
  .filter(Boolean);

async function tryCallGemini(
  baseUrl: string,
  apiKey: string,
  model: string,
  input: {
    messages: GeminiMessage[];
    tools?: GeminiToolDef[];
    toolChoice?: "auto" | "none";
    temperature?: number;
  },
): Promise<GeminiResponse | null> {
  const response = await fetch(`${baseUrl.replace(/\/$/, "")}/chat/completions`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model,
      messages: input.messages,
      tools: input.tools,
      tool_choice: input.tools ? input.toolChoice ?? "auto" : undefined,
      temperature: input.temperature ?? 0.2,
    }),
    signal: AbortSignal.timeout(20000),
  }).catch(() => null);

  if (!response) return null;
  if (response.ok) {
    return (await response.json()) as GeminiResponse;
  }
  return null;
}

export async function callGemini(input: {
  messages: GeminiMessage[];
  tools?: GeminiToolDef[];
  toolChoice?: "auto" | "none";
  model?: string;
  temperature?: number;
}): Promise<GeminiResponse> {
  const proxyKey = process.env.GEMINI_API_KEY;
  if (!proxyKey && GOOGLE_API_KEYS.length === 0) {
    throw new Error(
      "GEMINI_API_KEY belum diatur di environment. Tambahkan API key server-side untuk mengaktifkan TokoMu AI."
    );
  }

  const models = input.model
    ? [input.model]
    : Array.from(new Set([DEFAULT_MODEL, FALLBACK_TEXT_MODEL, FALLBACK_TEXT_MODEL_PINNED]));

  // --- Step 1: Try proxy (if configured) ---
  if (proxyKey) {
    for (const model of models) {
      const result = await tryCallGemini(DEFAULT_BASE_URL, proxyKey, model, input);
      if (result) return result;
    }
  }

  // --- Step 2: Fallback to Google direct with multiple keys ---
  if (GOOGLE_API_KEYS.length > 0) {
    // Pick a random starting index so keys get distributed evenly
    const startIndex = Math.floor(Math.random() * GOOGLE_API_KEYS.length);
    for (let i = 0; i < GOOGLE_API_KEYS.length; i++) {
      const keyIndex = (startIndex + i) % GOOGLE_API_KEYS.length;
      const googleKey = GOOGLE_API_KEYS[keyIndex];
      // Only try primary model for Google direct (to be fast)
      const googleModels = input.model ? [input.model] : [DEFAULT_MODEL, FALLBACK_TEXT_MODEL];
      for (const model of googleModels) {
        const result = await tryCallGemini(GOOGLE_DIRECT_BASE_URL, googleKey, model, input);
        if (result) return result;
      }
    }
  }

  throw new Error("Semua penyedia AI gagal merespons. Coba lagi nanti.");
}
