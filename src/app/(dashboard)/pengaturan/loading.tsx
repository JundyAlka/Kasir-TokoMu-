export default function PengaturanLoading() {
  return (
    <div className="flex h-full w-full flex-col gap-4 animate-pulse p-2">
      {/* Header */}
      <div className="space-y-2">
        <div className="h-8 w-40 rounded-2xl bg-muted/60" />
        <div className="h-4 w-56 rounded-lg bg-muted/40" />
      </div>

      {/* Tabs */}
      <div className="flex gap-2">
        {[1, 2, 3].map((i) => (
          <div key={i} className="h-10 w-28 rounded-xl bg-muted/50" />
        ))}
      </div>

      {/* Settings cards */}
      <div className="space-y-4">
        {[1, 2, 3].map((i) => (
          <div key={i} className="rounded-2xl border border-border/40 bg-card/50 p-5 space-y-4">
            <div className="flex items-center justify-between">
              <div className="space-y-1.5">
                <div className="h-5 w-36 rounded-lg bg-muted/60" />
                <div className="h-3 w-52 rounded-lg bg-muted/40" />
              </div>
            </div>
            <div className="grid gap-3 grid-cols-1 md:grid-cols-2">
              <div className="h-10 w-full rounded-xl bg-muted/40" />
              <div className="h-10 w-full rounded-xl bg-muted/40" />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
