export default function DashboardLoading() {
  return (
    <div className="flex h-full w-full flex-col gap-4 animate-pulse p-2">
      {/* Header skeleton */}
      <div className="flex items-center justify-between">
        <div className="h-8 w-48 rounded-2xl bg-muted/60" />
        <div className="h-9 w-32 rounded-xl bg-muted/50" />
      </div>

      {/* Metric cards skeleton */}
      <div className="grid gap-4 grid-cols-2 md:grid-cols-4">
        {[1, 2, 3, 4].map((i) => (
          <div key={i} className="h-28 rounded-2xl border border-border/40 bg-card/60 p-4 space-y-3">
            <div className="h-4 w-24 rounded-lg bg-muted/60" />
            <div className="h-7 w-32 rounded-lg bg-muted/80" />
          </div>
        ))}
      </div>

      {/* Main content area skeleton */}
      <div className="grid flex-1 gap-4 lg:grid-cols-12">
        <div className="h-80 rounded-2xl border border-border/40 bg-card/50 lg:col-span-8 p-4 space-y-3">
          <div className="h-5 w-40 rounded-lg bg-muted/60" />
          <div className="h-full w-full rounded-xl bg-muted/30" />
        </div>
        <div className="h-80 rounded-2xl border border-border/40 bg-card/50 lg:col-span-4 p-4 space-y-3">
          <div className="h-5 w-32 rounded-lg bg-muted/60" />
          <div className="h-full w-full rounded-xl bg-muted/30" />
        </div>
      </div>
    </div>
  );
}
