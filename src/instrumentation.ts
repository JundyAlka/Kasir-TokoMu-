export async function register() {
  if (process.env.NEXT_RUNTIME === "nodejs") {
    const { startWhatsAppReportScheduler } = await import(
      "@/lib/server/whatsapp-scheduler"
    );
    startWhatsAppReportScheduler();
  }
}

