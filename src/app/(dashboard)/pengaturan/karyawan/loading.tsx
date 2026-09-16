export default function KaryawanLoading() {
  return (
    <div className="flex h-full w-full flex-col gap-4 animate-pulse p-2">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="space-y-2">
          <div className="h-8 w-44 rounded-2xl bg-muted/60" />
          <div className="h-4 w-56 rounded-lg bg-muted/40" />
        </div>
        <div className="h-10 w-36 rounded-xl bg-primary/25" />
      </div>

      {/* User list */}
      <div className="space-y-3">
        {[1, 2, 3, 4].map((i) => (
          <div key={i} className="rounded-2xl border border-border/40 bg-card/50 p-4 flex items-center gap-4">
            <div className="size-10 rounded-full bg-muted/60" />
            <div className="flex-1 space-y-2">
              <div className="h-4 w-36 rounded-lg bg-muted/60" />
              <div className="h-3 w-48 rounded-lg bg-muted/40" />
            </div>
            <div className="h-6 w-20 rounded-full bg-muted/50" />
            <div className="flex gap-2">
              <div className="h-8 w-8 rounded-lg bg-muted/40" />
              <div className="h-8 w-8 rounded-lg bg-muted/40" />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
