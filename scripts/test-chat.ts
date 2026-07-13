import { runUserTurn } from "../src/lib/server/ai/chat";

async function testChat() {
  try {
    console.log("Running simulated user turn...");
    const result = await runUserTurn({
      userId: "seed-workspace",
      chatId: "chat_seed-workspace",
      userText: "Sisa stok semua produk?",
    });
    console.log("Chat turn completed successfully:", result);
  } catch (error) {
    console.error("Chat turn failed with error:", error);
  }
}

testChat();
