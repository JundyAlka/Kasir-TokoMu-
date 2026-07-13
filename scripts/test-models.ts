import { createOpenAI } from "@ai-sdk/openai";
import { generateText } from "ai";
import { config } from "dotenv";
config({ path: ".env.local" });

const openai = createOpenAI({
  baseURL: process.env.GEMINI_BASE_URL || "https://api.iamhc.cn/v1",
  apiKey: process.env.GEMINI_API_KEY,
});

async function testModel(modelName: string) {
  console.log(`Testing model: ${modelName}`);
  try {
    const { text } = await generateText({
      model: openai(modelName),
      prompt: "Hello, just reply with 'OK' if you can read this.",
      maxTokens: 10,
    });
    console.log(`[SUCCESS] ${modelName}: ${text}`);
  } catch (error: any) {
    console.log(`[FAILED] ${modelName}: ${error.message}`);
  }
}

async function main() {
  await testModel("glm-4.7");
  await testModel("gpt-4o-mini");
  await testModel("gemini-1.5-flash");
  await testModel("gemini-1.5-pro");
  await testModel("gemini-pro");
}

main().catch(console.error);
