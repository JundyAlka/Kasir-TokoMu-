export default function AuditLogLoading() {
  return (
    <div className="flex h-full w-full flex-col gap-4 animate-pulse p-2">
      {/* Header */}
      <div className="space-y-2">
        <div className="h-7 w-32 rounded-2xl bg-muted/60" />
        <div className="h-4 w-64 rounded-lg bg-muted/40" />
      </div>

      {/* Filter bar */}
      <div className="flex gap-3">
        <div className="h-10 w-64 rounded-xl bg-muted/50" />
        <div className="h-10 w-36 rounded-xl bg-muted/50" />
      </div>

      {/* Table */}
      <div className="rounded-2xl border border-border/40 bg-card/50 overflow-hidden">
        {/* Table header */}
        <div className="flex gap-4 border-b border-border/40 p-3">
          {[1, 2, 3, 4, 5].map((i) => (
            <div key={i} className="h-4 w-20 rounded-lg bg-muted/60 flex-1" />
          ))}
        </div>
        {/* Table rows */}
        {[1, 2, 3, 4, 5, 6, 7, 8].map((i) => (
          <div key={i} className="flex gap-4 border-b border-border/20 p-3">
            {[1, 2, 3, 4, 5].map((j) => (
              <div key={j} className="h-4 w-full rounded-lg bg-muted/35 flex-1" />
            ))}
          </div>
        ))}
      </div>
    </div>
  );
}
