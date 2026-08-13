import { afterEach, describe, expect, it, vi } from "vitest";
import { callGemini } from "@/lib/server/ai/gemini";

const ORIGINAL_ENV = { ...process.env };

afterEach(() => {
  process.env = { ...ORIGINAL_ENV };
  vi.unstubAllGlobals();
});

describe("Gemini authorization keys", () => {
  it("calls an OpenAI-compatible router with the configured DeepSeek model", async () => {
    process.env.GEMINI_API_KEY = "router-test-key";
    process.env.GEMINI_BASE_URL = "https://router.juan.web.id/v1";
    process.env.GEMINI_TEXT_MODEL = "deepseek-v4-flash";
    delete process.env.GEMINI_GOOGLE_API_KEYS;

    const fetchMock = vi.fn().mockResolvedValue(
      new Response(
        JSON.stringify({
          id: "chat_123",
          model: "deepseek-v4-flash",
          choices: [{ index: 0, finish_reason: "stop", message: { role: "assistant", content: "Siap." } }],
        }),
        { status: 200 },
      ),
    );
    vi.stubGlobal("fetch", fetchMock);

    await callGemini({ messages: [{ role: "user", content: "Halo" }] });

    expect(fetchMock).toHaveBeenCalledWith(
      "https://router.juan.web.id/v1/chat/completions",
      expect.objectContaining({
        headers: expect.objectContaining({ Authorization: "Bearer router-test-key" }),
      }),
    );
    expect(JSON.parse(fetchMock.mock.calls[0][1].body)).toEqual(
      expect.objectContaining({ model: "deepseek-v4-flash", messages: [{ role: "user", content: "Halo" }] }),
    );
  });

  it("accepts an SSE-wrapped JSON response from an OpenAI-compatible router", async () => {
    process.env.GEMINI_API_KEY = "router-test-key";
    process.env.GEMINI_BASE_URL = "https://router.juan.web.id/v1";
    process.env.GEMINI_TEXT_MODEL = "deepseek-v4-flash";
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(
        new Response('data: {"id":"chat_sse","model":"deepseek-v4-flash","choices":[{"index":0,"finish_reason":"stop","message":{"role":"assistant","content":"OK"}}]}\ndata: [DONE]\n', { status: 200 }),
      ),
    );

    const result = await callGemini({ messages: [{ role: "user", content: "Halo" }] });
    expect(result.choices[0]?.message.content).toBe("OK");
  });

  it("uses the Interactions API and maps text and function calls", async () => {
    process.env.GEMINI_API_KEY = "AQ.test-key";
    process.env.GEMINI_TEXT_MODEL = "gemini-3.6-flash";
    delete process.env.GEMINI_GOOGLE_API_KEYS;

    const fetchMock = vi.fn().mockResolvedValue(
      new Response(
        JSON.stringify({
          id: "int_123",
          model: "gemini-3.6-flash",
          steps: [
            {
              type: "model_output",
              content: [{ type: "text", text: "Stok aman." }],
            },
            {
              type: "function_call",
              id: "call_123",
              name: "get_stock_summary",
              arguments: { productId: "product-1" },
            },
          ],
        }),
        { status: 200 },
      ),
    );
    vi.stubGlobal("fetch", fetchMock);

    const result = await callGemini({
      messages: [
        { role: "system", content: "Jawab singkat dalam Bahasa Indonesia." },
        { role: "user", content: "Cek stok produk satu." },
      ],
      tools: [
        {
          type: "function",
          function: {
            name: "get_stock_summary",
            description: "Membaca stok.",
            parameters: { type: "object" },
          },
        },
      ],
    });

    expect(fetchMock).toHaveBeenCalledWith(
      "https://generativelanguage.googleapis.com/v1beta/interactions",
      expect.objectContaining({
        headers: expect.objectContaining({ "x-goog-api-key": "AQ.test-key" }),
      }),
    );
    expect(JSON.parse(fetchMock.mock.calls[0][1].body)).toEqual(
      expect.objectContaining({
        model: "gemini-3.6-flash",
        system_instruction: "Jawab singkat dalam Bahasa Indonesia.",
        input: "Cek stok produk satu.",
        tools: [
          {
            type: "function",
            name: "get_stock_summary",
            description: "Membaca stok.",
            parameters: { type: "object" },
          },
        ],
      }),
    );
    expect(result.choices[0]).toEqual({
      index: 0,
      finish_reason: "tool_calls",
      message: {
        role: "assistant",
        content: "Stok aman.",
        tool_calls: [
          {
            id: "call_123",
            type: "function",
            function: {
              name: "get_stock_summary",
              arguments: '{"productId":"product-1"}',
            },
          },
        ],
      },
    });
  });
});
