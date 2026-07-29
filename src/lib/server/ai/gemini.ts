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

const DEFAULT_BASE_URL = "https://generativelanguage.googleapis.com/v1beta/openai/";
const GOOGLE_DIRECT_BASE_URL = "https://generativelanguage.googleapis.com/v1beta/openai/";
const GOOGLE_INTERACTIONS_URL = "https://generativelanguage.googleapis.com/v1beta/interactions";

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
    signal: AbortSignal.timeout(60000),
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
    }),
    signal: AbortSignal.timeout(60000),
  }).catch((err) => {
    fetchError = err;
    return null;
  });

  if (!response) {
    console.error(`[tryCallGemini] Fetch failed for model ${model} at ${baseUrl}`, fetchError);
    return null;
  }
  if (response.ok) {
    return (await response.json()) as GeminiResponse;
  }

  const errorText = await response.text().catch(() => "Could not read error text");
  console.error(`[tryCallGemini] API returned error: ${response.status} ${response.statusText} for model ${model} at ${baseUrl}`);
  console.error(`[tryCallGemini] Error body: ${errorText}`);
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
  const DEFAULT_MODEL = process.env.GEMINI_TEXT_MODEL ?? "gemini-3.6-flash";
  const FALLBACK_TEXT_MODEL = process.env.GEMINI_FALLBACK_TEXT_MODEL ?? "gemini-3.6-flash";
  const FALLBACK_TEXT_MODEL_PINNED = process.env.GEMINI_FALLBACK_TEXT_MODEL_PINNED ?? "gemini-3.6-flash";
  const BASE_URL = process.env.GEMINI_BASE_URL ?? DEFAULT_BASE_URL;

  const proxyKey = process.env.GEMINI_API_KEY;
  const GOOGLE_API_KEYS = (process.env.GEMINI_GOOGLE_API_KEYS ?? "")
    .split(",")
    .map((k) => k.trim())
    .filter(Boolean);

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
      const result = isGoogleAuthKey(proxyKey)
        ? await tryCallGeminiAuthKey(proxyKey, model, input)
        : await tryCallGemini(BASE_URL, proxyKey, model, input);
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
        const result = isGoogleAuthKey(googleKey)
          ? await tryCallGeminiAuthKey(googleKey, model, input)
          : await tryCallGemini(GOOGLE_DIRECT_BASE_URL, googleKey, model, input);
        if (result) return result;
      }
    }
  }

  throw new Error("Semua penyedia AI gagal merespons. Coba lagi nanti.");
}
