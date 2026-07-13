import { config } from "dotenv";
config({ path: ".env.local" });

const apiKey = process.env.GEMINI_API_KEY;
const baseUrl = process.env.GEMINI_BASE_URL || "https://api.iamhc.cn/v1";

async function testModel(modelName: string) {
  console.log(`Testing model: ${modelName}`);
  try {
    const response = await fetch(`${baseUrl.replace(/\/$/, "")}/chat/completions`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: modelName,
        messages: [{ role: "user", content: "hello" }],
        max_tokens: 10,
      }),
    });
    const text = await response.text();
    console.log(`[${response.status}] ${modelName}: ${text}`);
  } catch (error: any) {
    console.log(`[FAILED] ${modelName}: ${error.message}`);
  }
}

async function main() {
  await testModel("glm-4.7");
  await testModel("DeepSeek-V4-Flash");
  await testModel("DeepSeek-V4-Pro");
  await testModel("Kimi-K2.6");
}

main().catch(console.error);
