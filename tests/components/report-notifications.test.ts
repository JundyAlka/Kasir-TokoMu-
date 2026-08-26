import { describe, expect, it } from "vitest";
import { getReportNotificationState, type ReportComparison } from "@/lib/report-notifications";

const snapshot: ReportComparison = {
  revenue: 7_665_000,
  cogs: 3_832_500,
  grossProfit: 3_832_500,
  expenseTotal: 65_300,
  netProfit: 3_767_200,
  profitDistribution: 0,
  transactionCount: 122,
};

describe("closed-report notifications", () => {
  it("marks a finalized snapshot stale when a later transaction changes its rollup", () => {
    expect(getReportNotificationState("final", snapshot, { ...snapshot, revenue: 7_690_500, transactionCount: 123 }))
      .toEqual({ snapshotOutdated: true, pcmOutdated: false });
  });

  it("moves the reminder to PCM after the snapshot is updated but PCM remains old", () => {
    expect(getReportNotificationState("final", { ...snapshot, financial: { ...snapshot, revenue: 7_665_000 - 1 } }, snapshot))
      .toEqual({ snapshotOutdated: false, pcmOutdated: true });
  });

  it("does not notify for a draft report", () => {
    expect(getReportNotificationState("draft", snapshot, { ...snapshot, revenue: 7_690_500 }))
      .toEqual({ snapshotOutdated: false, pcmOutdated: false });
  });
});
