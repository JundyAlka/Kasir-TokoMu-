export type OpenRouterImageContent = {
  type: "image_url";
  image_url: { url: string };
};

export type OpenRouterTextContent = {
  type: "text";
  text: string;
};

export type OpenRouterUserContent =
  | string
  | Array<OpenRouterTextContent | OpenRouterImageContent>;

export type OpenRouterMessage =
  | { role: "system"; content: string }
  | { role: "user"; content: OpenRouterUserContent }
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

export type OpenRouterToolDef = {
  type: "function";
  function: {
    name: string;
    description: string;
    parameters: Record<string, unknown>;
  };
};

export type OpenRouterChoice = {
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

export type OpenRouterResponse = {
  id: string;
  model: string;
  choices: OpenRouterChoice[];
  usage?: { prompt_tokens: number; completion_tokens: number; total_tokens: number };
};

const DEFAULT_MODEL =
  process.env.AI_GATEWAY_MODEL ??
  process.env.OPENROUTER_MODEL ??
  "openai/gpt-4o-mini";
const DEFAULT_BASE_URL =
  process.env.AI_GATEWAY_BASE_URL ??
  process.env.OPENROUTER_BASE_URL ??
  "https://openrouter.ai/api/v1";

export async function callOpenRouter(input: {
  messages: OpenRouterMessage[];
  tools?: OpenRouterToolDef[];
  toolChoice?: "auto" | "none";
  model?: string;
  temperature?: number;
}): Promise<OpenRouterResponse> {
  const apiKey = process.env.AI_GATEWAY_API_KEY ?? process.env.OPENROUTER_API_KEY;
  if (!apiKey) {
    throw new Error(
      "AI_GATEWAY_API_KEY belum diatur di environment. Tambahkan server-side API key untuk mengaktifkan TokoMu AI."
    );
  }

  const response = await fetch(`${DEFAULT_BASE_URL.replace(/\/$/, "")}/chat/completions`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey}`,
      "HTTP-Referer": process.env.AI_GATEWAY_REFERER ?? process.env.OPENROUTER_REFERER ?? "https://tokomu.local",
      "X-Title": process.env.AI_GATEWAY_TITLE ?? "TokoMu",
    },
    body: JSON.stringify({
      model: input.model ?? DEFAULT_MODEL,
      messages: input.messages,
      tools: input.tools,
      tool_choice: input.tools ? input.toolChoice ?? "auto" : undefined,
      temperature: input.temperature ?? 0.2,
    }),
  });

  if (!response.ok) {
    const text = await response.text().catch(() => response.statusText);
    throw new Error(`AI Gateway ${response.status}: ${text}`);
  }

  return (await response.json()) as OpenRouterResponse;
}
