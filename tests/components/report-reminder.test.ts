import { describe, expect, it } from "vitest";
import { isReportReminderWindow } from "@/lib/report-reminder";

describe("isReportReminderWindow", () => {
  it("starts showing the update indicator on H-2 through the last day of a 31-day month", () => {
    expect(isReportReminderWindow(new Date(2026, 6, 28))).toBe(false);
    expect(isReportReminderWindow(new Date(2026, 6, 29))).toBe(true);
    expect(isReportReminderWindow(new Date(2026, 6, 30))).toBe(true);
    expect(isReportReminderWindow(new Date(2026, 6, 31))).toBe(true);
  });

  it("calculates the boundary correctly for February in a leap year", () => {
    expect(isReportReminderWindow(new Date(2028, 1, 26))).toBe(false);
    expect(isReportReminderWindow(new Date(2028, 1, 27))).toBe(true);
  });
});
