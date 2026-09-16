export default function InvestorLoading() {
  return (
    <div className="flex h-full w-full flex-col gap-4 animate-pulse p-2">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="space-y-2">
          <div className="h-8 w-32 rounded-2xl bg-muted/60" />
          <div className="h-4 w-56 rounded-lg bg-muted/40" />
        </div>
        <div className="flex gap-2">
          <div className="h-10 w-32 rounded-xl bg-muted/50" />
          <div className="h-10 w-28 rounded-xl bg-primary/25" />
        </div>
      </div>

      {/* Filter bar */}
      <div className="flex gap-2">
        {[1, 2, 3].map((i) => (
          <div key={i} className="h-9 w-24 rounded-xl bg-muted/50" />
        ))}
      </div>

      {/* Investor cards grid */}
      <div className="grid gap-4 grid-cols-1 md:grid-cols-2 xl:grid-cols-3">
        {[1, 2, 3, 4, 5, 6].map((i) => (
          <div key={i} className="h-40 rounded-2xl border border-border/40 bg-card/50 p-4 space-y-3">
            <div className="flex items-center gap-3">
              <div className="size-10 rounded-full bg-muted/60" />
              <div className="space-y-1.5 flex-1">
                <div className="h-4 w-32 rounded-lg bg-muted/70" />
                <div className="h-3 w-20 rounded-lg bg-muted/40" />
              </div>
            </div>
            <div className="h-px bg-border/40" />
            <div className="grid grid-cols-2 gap-2">
              <div className="h-4 w-full rounded-lg bg-muted/50" />
              <div className="h-4 w-full rounded-lg bg-muted/50" />
            </div>
            <div className="h-5 w-24 rounded-full bg-muted/40" />
          </div>
        ))}
      </div>
    </div>
  );
}
