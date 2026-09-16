export default function BagiHasilLoading() {
  return (
    <div className="flex h-full w-full flex-col gap-4 animate-pulse p-2">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="space-y-2">
          <div className="h-8 w-36 rounded-2xl bg-muted/60" />
          <div className="h-4 w-60 rounded-lg bg-muted/40" />
        </div>
        <div className="h-10 w-36 rounded-xl bg-muted/50" />
      </div>

      {/* Period selector */}
      <div className="flex items-center gap-3">
        <div className="h-10 w-40 rounded-xl bg-muted/50" />
        <div className="h-10 w-32 rounded-xl bg-primary/25" />
      </div>

      {/* Payout table */}
      <div className="rounded-2xl border border-border/40 bg-card/50 overflow-hidden">
        {/* Table header */}
        <div className="flex gap-4 border-b border-border/40 p-4">
          {[1, 2, 3, 4].map((i) => (
            <div key={i} className="h-4 w-24 rounded-lg bg-muted/60 flex-1" />
          ))}
        </div>
        {/* Table rows */}
        {[1, 2, 3, 4, 5].map((i) => (
          <div key={i} className="flex gap-4 border-b border-border/20 p-4">
            {[1, 2, 3, 4].map((j) => (
              <div key={j} className="h-4 w-full rounded-lg bg-muted/40 flex-1" />
            ))}
          </div>
        ))}
      </div>
    </div>
  );
}
