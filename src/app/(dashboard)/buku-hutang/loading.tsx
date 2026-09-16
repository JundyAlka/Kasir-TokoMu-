export default function BukuHutangLoading() {
  return (
    <div className="flex h-full w-full flex-col gap-4 animate-pulse p-2">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="space-y-2">
          <div className="h-8 w-40 rounded-2xl bg-muted/60" />
          <div className="h-4 w-60 rounded-lg bg-muted/40" />
        </div>
        <div className="h-10 w-36 rounded-xl bg-muted/50" />
      </div>

      {/* Stat cards */}
      <div className="grid gap-4 grid-cols-2 md:grid-cols-3">
        {[1, 2, 3].map((i) => (
          <div key={i} className="h-24 rounded-2xl border border-border/40 bg-card/60 p-4 space-y-3">
            <div className="h-4 w-20 rounded-lg bg-muted/60" />
            <div className="h-6 w-28 rounded-lg bg-muted/80" />
          </div>
        ))}
      </div>

      {/* Filter tabs */}
      <div className="flex gap-2">
        {[1, 2, 3, 4].map((i) => (
          <div key={i} className="h-9 w-20 rounded-xl bg-muted/50" />
        ))}
      </div>

      {/* Debt list */}
      <div className="space-y-3 flex-1">
        {[1, 2, 3, 4, 5].map((i) => (
          <div key={i} className="h-20 rounded-2xl border border-border/40 bg-card/50 p-4 flex items-center justify-between">
            <div className="space-y-2">
              <div className="h-4 w-36 rounded-lg bg-muted/60" />
              <div className="h-3 w-24 rounded-lg bg-muted/40" />
            </div>
            <div className="h-6 w-24 rounded-lg bg-muted/70" />
          </div>
        ))}
      </div>
    </div>
  );
}
