import { processScheduledWhatsAppReports } from "@/lib/server/whatsapp-report-service";

const INTERVAL_MS = 5 * 60 * 1000;
const INITIAL_DELAY_MS = 15 * 1000;

declare global {
  var __warungOsWaSchedulerTimer: ReturnType<typeof setInterval> | undefined;
  var __warungOsWaSchedulerInitialized: boolean | undefined;
}

export function startWhatsAppReportScheduler() {
  if (globalThis.__warungOsWaSchedulerInitialized) {
    return;
  }
  globalThis.__warungOsWaSchedulerInitialized = true;

  const initialTimer = setTimeout(() => {
    void processScheduledWhatsAppReports().catch((error) => {
      console.warn("[WhatsAppScheduler] Initial check failed:", error);
    });
  }, INITIAL_DELAY_MS);

  if (typeof initialTimer.unref === "function") {
    initialTimer.unref();
  }

  const intervalTimer = setInterval(() => {
    void processScheduledWhatsAppReports().catch((error) => {
      console.warn("[WhatsAppScheduler] Periodic check failed:", error);
    });
  }, INTERVAL_MS);

  if (typeof intervalTimer.unref === "function") {
    intervalTimer.unref();
  }

  globalThis.__warungOsWaSchedulerTimer = intervalTimer;
}

