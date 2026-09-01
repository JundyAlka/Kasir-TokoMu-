export type ReportComparison = {
  revenue: number;
  cogs: number;
  grossProfit: number;
  expenseTotal: number;
  netProfit: number;
  profitDistribution: number;
  transactionCount: number;
};

type StoredReportData = Partial<ReportComparison> & {
  financial?: Partial<ReportComparison>;
};

const comparisonKeys = [
  "revenue",
  "cogs",
  "grossProfit",
  "expenseTotal",
  "netProfit",
  "profitDistribution",
  "transactionCount",
] as const;

function numeric(value: unknown) {
  return typeof value === "number" && Number.isFinite(value) ? value : null;
}

function differs(left: Partial<ReportComparison>, right: Partial<ReportComparison>) {
  return comparisonKeys.some((key) => {
    const before = numeric(left[key]);
    const after = numeric(right[key]);
    return before !== null && after !== null && before !== after;
  });
}

function incompleteOrDiffersFromSnapshot(snapshot: Partial<ReportComparison>, financial: Partial<ReportComparison>) {
  return comparisonKeys.some((key) => {
    const source = numeric(snapshot[key]);
    const target = numeric(financial[key]);
    if (source === null) return false;
    if (target === null) {
      if (key === "profitDistribution" && source === 0) return false;
      return true;
    }
    return source !== target;
  });
}

/**
 * A monthly snapshot is stale when the finalized values differ from the live
 * period rollup. PCM is stale only after that snapshot has been refreshed.
 */
export function getReportNotificationState(
  status: string,
  value: unknown,
  live: ReportComparison
) {
  if (status !== "final" || !value || typeof value !== "object") {
    return { snapshotOutdated: false, pcmOutdated: false };
  }

  const data = value as StoredReportData;
  const hasSnapshotMetrics = comparisonKeys.some((key) => numeric(data[key]) !== null);
  if (!hasSnapshotMetrics) return { snapshotOutdated: false, pcmOutdated: false };

  const snapshotOutdated = differs(data, live);
  const financial = data.financial;
  const pcmOutdated = !snapshotOutdated && (!financial || incompleteOrDiffersFromSnapshot(data, financial));
  return { snapshotOutdated, pcmOutdated };
}
