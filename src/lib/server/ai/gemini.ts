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
  interactionId?: string;
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

function parseOpenAiResponse(text: string): GeminiResponse {
  const trimmed = text.trim();
  try {
    const parsed = JSON.parse(trimmed) as GeminiResponse;
    if (parsed.choices && parsed.choices[0]?.message) return parsed;
  } catch {
    // Continue to SSE stream parser
  }

  const events = trimmed
    .split(/\r?\n/)
    .filter((line) => line.startsWith("data:"))
    .map((line) => line.slice("data:".length).trim())
    .filter((line) => line && line !== "[DONE]");

  if (events.length === 0) throw new Error("Provider mengembalikan format respons yang tidak dikenali.");

  let id = "";
  let model = "";
  let content = "";
  const toolCallsMap = new Map<number, { id: string; type: "function"; function: { name: string; arguments: string } }>();
  let usage: GeminiResponse["usage"];

  for (const event of events) {
    try {
      const chunk = JSON.parse(event);
      if (chunk.id) id = chunk.id;
      if (chunk.model) model = chunk.model;
      if (chunk.usage) usage = chunk.usage;

      const choice = chunk.choices?.[0];
      if (!choice) continue;

      if (choice.delta?.content) {
        content += choice.delta.content;
      } else if (choice.message?.content) {
        content += choice.message.content;
      }

      const toolCalls = choice.delta?.tool_calls ?? choice.message?.tool_calls;
      if (toolCalls) {
        for (const tc of toolCalls) {
          const idx = tc.index ?? 0;
          if (!toolCallsMap.has(idx)) {
            toolCallsMap.set(idx, {
              id: tc.id ?? `call_${Math.random().toString(36).slice(2, 9)}`,
              type: "function",
              function: {
                name: tc.function?.name ?? "",
                arguments: tc.function?.arguments ?? "",
              },
            });
          } else {
            const existing = toolCallsMap.get(idx)!;
            if (tc.id) existing.id = tc.id;
            if (tc.function?.name) existing.function.name += tc.function.name;
            if (tc.function?.arguments) existing.function.arguments += tc.function.arguments;
          }
        }
      }
    } catch {
      // ignore individual malformed chunks
    }
  }

  const tool_calls = Array.from(toolCallsMap.values()).filter((tc) => tc.function.name);

  return {
    id: id || `chatcmpl_${Date.now()}`,
    model: model || "deepseek-v4-flash",
    choices: [
      {
        index: 0,
        finish_reason: "stop",
        message: {
          role: "assistant",
          content: content || null,
          tool_calls: tool_calls.length > 0 ? tool_calls : undefined,
        },
      },
    ],
    usage,
  };
}

const DEFAULT_BASE_URL = "https://generativelanguage.googleapis.com/v1beta/openai/";
const GOOGLE_DIRECT_BASE_URL = "https://generativelanguage.googleapis.com/v1beta/openai/";
const GOOGLE_INTERACTIONS_URL = "https://generativelanguage.googleapis.com/v1beta/interactions";
const DEFAULT_REQUEST_TIMEOUT_MS = 60_000;
const MIN_REQUEST_TIMEOUT_MS = 5_000;
const MAX_REQUEST_TIMEOUT_MS = 90_000;

function requestTimeoutMs() {
  const configured = Number(process.env.GEMINI_REQUEST_TIMEOUT_MS);
  if (!Number.isFinite(configured)) return DEFAULT_REQUEST_TIMEOUT_MS;
  return Math.min(MAX_REQUEST_TIMEOUT_MS, Math.max(MIN_REQUEST_TIMEOUT_MS, configured));
}

function isGoogleAuthKey(apiKey: string) {
  return apiKey.startsWith("AQ.");
}

type GeminiInteractionInputPart =
  | { type: "text"; text: string }
  | { type: "image"; mime_type: string; data: string };

function interactionInput(content: GeminiUserContent): string | GeminiInteractionInputPart[] {
  if (typeof content === "string") return content;

  return content.map((part) => {
    if (part.type === "text") return { type: "text", text: part.text };

    const imageMatch = /^data:([^;]+);base64,([\s\S]+)$/.exec(part.image_url.url);
    if (!imageMatch) {
      throw new Error("Gemini Auth API hanya menerima gambar data URL untuk OCR.");
    }
    return { type: "image", mime_type: imageMatch[1], data: imageMatch[2] };
  });
}

function mapInteractionResponse(payload: {
  id?: string;
  model?: string;
  steps?: Array<{
    type?: string;
    id?: string;
    name?: string;
    arguments?: unknown;
    content?: Array<{ type?: string; text?: string }>;
  }>;
}): GeminiResponse {
  const text = (payload.steps ?? [])
    .filter((step) => step.type === "model_output")
    .flatMap((step) => step.content ?? [])
    .filter((part) => part.type === "text")
    .map((part) => part.text ?? "")
    .join("\n");
  const toolCalls = (payload.steps ?? [])
    .filter((step) => step.type === "function_call" && step.id && step.name)
    .map((step) => ({
      id: step.id as string,
      type: "function" as const,
      function: {
        name: step.name as string,
        arguments: JSON.stringify(step.arguments ?? {}),
      },
    }));

  return {
    id: payload.id ?? "gemini-interaction",
    interactionId: payload.id,
    model: payload.model ?? "gemini-interactions",
    choices: [
      {
        index: 0,
        finish_reason: toolCalls.length > 0 ? "tool_calls" : "stop",
        message: {
          role: "assistant",
          content: text || null,
          ...(toolCalls.length > 0 ? { tool_calls: toolCalls } : {}),
        },
      },
    ],
  };
}

async function tryCallGeminiAuthKey(
  apiKey: string,
  model: string,
  input: {
    messages: GeminiMessage[];
    tools?: GeminiToolDef[];
    toolChoice?: "auto" | "none";
    temperature?: number;
    previousInteractionId?: string;
  },
): Promise<GeminiResponse | null> {
  const systemInstruction = input.messages
    .filter((message): message is Extract<GeminiMessage, { role: "system" }> => message.role === "system")
    .map((message) => message.content)
    .join("\n\n");
  const toolResults = input.messages.filter(
    (message): message is Extract<GeminiMessage, { role: "tool" }> => message.role === "tool",
  );
  const latestUser = [...input.messages]
    .reverse()
    .find((message): message is Extract<GeminiMessage, { role: "user" }> => message.role === "user");

  const body = input.previousInteractionId
    ? {
      model,
      previous_interaction_id: input.previousInteractionId,
      input: toolResults.map((message) => ({
        type: "function_result",
        name: message.name ?? "tool_result",
        call_id: message.tool_call_id,
        result: [{ type: "text", text: message.content }],
      })),
      tools: input.tools?.map((tool) => ({ type: tool.type, ...tool.function })),
    }
    : {
      model,
      ...(systemInstruction ? { system_instruction: systemInstruction } : {}),
      input: latestUser ? interactionInput(latestUser.content) : "",
      tools: input.tools?.map((tool) => ({ type: tool.type, ...tool.function })),
      generation_config: { temperature: input.temperature ?? 0.2 },
    };

  const response = await fetch(GOOGLE_INTERACTIONS_URL, {
    method: "POST",
    headers: { "Content-Type": "application/json", "x-goog-api-key": apiKey },
    body: JSON.stringify(body),
    signal: AbortSignal.timeout(requestTimeoutMs()),
  }).catch(() => null);

  if (!response) return null;
  if (response.ok) {
    return mapInteractionResponse((await response.json()) as Parameters<typeof mapInteractionResponse>[0]);
  }
  return null;
}


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
  const timeoutMs = requestTimeoutMs();
  let fetchError: any = null;
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
      stream: baseUrl.includes("router.juan.web.id") ? true : false,
    }),
    signal: AbortSignal.timeout(timeoutMs),
  }).catch((err) => {
    fetchError = err;
    return null;
  });

  if (!response) {
    const isTimeout = fetchError?.name === "TimeoutError" || fetchError?.code === "UND_ERR_CONNECT_TIMEOUT";
    console.error(
      `[tryCallGemini] ${isTimeout ? "TIMEOUT" : "Fetch failed"} for model ${model} at ${baseUrl} (limit=${timeoutMs}ms)`,
      fetchError?.message ?? fetchError,
    );
    return null;
  }
  if (response.ok) {
    return parseOpenAiResponse(await response.text());
  }

  const errorText = await response.text().catch(() => "Could not read error text");
  console.error(`[tryCallGemini] API error ${response.status} ${response.statusText} for model ${model} at ${baseUrl}: ${errorText}`);
  return null;
}

export async function callGemini(input: {
  messages: GeminiMessage[];
  tools?: GeminiToolDef[];
  toolChoice?: "auto" | "none";
  model?: string;
  temperature?: number;
  previousInteractionId?: string;
}): Promise<GeminiResponse> {
  const DEFAULT_GOOGLE_MODEL = "gemini-3.6-flash";
  const DEFAULT_ROUTER_MODEL = "deepseek-v4-flash";
  const BASE_URL = process.env.GEMINI_BASE_URL ?? DEFAULT_BASE_URL;

  const juanRouterKey = (process.env.JUAN_ROUTER_API_KEY ?? "").trim();
  const geminiApiKey = (process.env.GEMINI_API_KEY ?? "").trim();

  // Kumpulkan semua Google API Keys
  const rawGoogleKeys = [
    ...(geminiApiKey ? [geminiApiKey] : []),
    ...(process.env.GEMINI_GOOGLE_API_KEYS ?? "").split(",").map((k) => k.trim()),
  ].filter(Boolean);
  const GOOGLE_API_KEYS = Array.from(new Set(rawGoogleKeys));

  if (!juanRouterKey && GOOGLE_API_KEYS.length === 0) {
    throw new Error(
      "GEMINI_API_KEY atau JUAN_ROUTER_API_KEY belum diatur di environment."
    );
  }

  let lastError = "";

  // --- Step 1: Prioritaskan Google Auth Key (AQ....) yang aktif langsung ke Google Interactions API ---
  const googleAuthKeys = GOOGLE_API_KEYS.filter((k) => isGoogleAuthKey(k));
  if (googleAuthKeys.length > 0) {
    const googleModel = (input.model && !input.model.includes("deepseek")) ? input.model : DEFAULT_GOOGLE_MODEL;
    for (const key of googleAuthKeys) {
      console.log(`[callGemini] Trying Google Auth Key (${key.slice(0, 10)}...) with model ${googleModel}`);
      const result = await tryCallGeminiAuthKey(key, googleModel, input);
      if (result) return result;
      lastError = `Google Auth Key (${key.slice(0, 8)}) failed`;
    }
  }

  // --- Step 2: Coba Juan Router / Proxy jika dikonfigurasi ---
  const routerKey = juanRouterKey || (process.env.GEMINI_BASE_URL ? geminiApiKey : "");
  if (routerKey) {
    const routerModel = input.model ?? process.env.GEMINI_TEXT_MODEL ?? DEFAULT_ROUTER_MODEL;
    console.log(`[callGemini] Trying router model=${routerModel} baseUrl=${BASE_URL}`);
    const result = await tryCallGemini(BASE_URL, routerKey, routerModel, input);
    if (result) return result;
    lastError = `Juan Router (${routerModel}) failed`;
  }

  // --- Step 3: Coba Google Direct API Keys standar (AIza...) ---
  const standardGoogleKeys = GOOGLE_API_KEYS.filter((k) => !isGoogleAuthKey(k));
  if (standardGoogleKeys.length > 0) {
    const googleModel = (input.model && !input.model.includes("deepseek")) ? input.model : DEFAULT_GOOGLE_MODEL;
    for (const key of standardGoogleKeys) {
      console.log(`[callGemini] Trying Google Direct (${key.slice(0, 10)}...) with model ${googleModel}`);
      const result = await tryCallGemini(GOOGLE_DIRECT_BASE_URL, key, googleModel, input);
      if (result) return result;
      lastError = `Google Direct (${key.slice(0, 8)}) failed`;
    }
  }

  // --- Step 4: Fallback terakhir jika geminiApiKey belum dicoba ---
  if (geminiApiKey && !googleAuthKeys.includes(geminiApiKey) && !standardGoogleKeys.includes(geminiApiKey)) {
    const model = input.model ?? DEFAULT_GOOGLE_MODEL;
    const result = isGoogleAuthKey(geminiApiKey)
      ? await tryCallGeminiAuthKey(geminiApiKey, model, input)
      : await tryCallGemini(BASE_URL, geminiApiKey, model, input);
    if (result) return result;
    lastError = `Fallback Gemini API Key failed`;
  }

  console.error(`[callGemini] Semua penyedia AI gagal merespons. Terakhir: ${lastError}`);
  throw new Error("Semua penyedia AI gagal merespons. Coba lagi nanti.");
}
