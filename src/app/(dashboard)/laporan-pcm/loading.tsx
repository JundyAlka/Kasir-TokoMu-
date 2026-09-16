export default function LaporanPcmLoading() {
  return (
    <div className="flex h-full w-full flex-col gap-4 animate-pulse p-2">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="space-y-2">
          <div className="h-8 w-44 rounded-2xl bg-muted/60" />
          <div className="h-4 w-64 rounded-lg bg-muted/40" />
        </div>
        <div className="flex gap-2">
          <div className="h-10 w-36 rounded-xl bg-muted/50" />
          <div className="h-10 w-28 rounded-xl bg-primary/25" />
        </div>
      </div>

      {/* Period selector */}
      <div className="h-10 w-48 rounded-xl bg-muted/50" />

      {/* Report content */}
      <div className="rounded-2xl border border-border/40 bg-card/50 p-6 space-y-4">
        <div className="h-6 w-48 rounded-lg bg-muted/60" />
        <div className="grid gap-4 grid-cols-2 md:grid-cols-3">
          {[1, 2, 3, 4, 5, 6].map((i) => (
            <div key={i} className="h-20 rounded-xl border border-border/30 bg-muted/20 p-3 space-y-2">
              <div className="h-3 w-20 rounded bg-muted/50" />
              <div className="h-5 w-28 rounded bg-muted/70" />
            </div>
          ))}
        </div>
      </div>

      {/* Table section */}
      <div className="rounded-2xl border border-border/40 bg-card/50 p-4 space-y-3">
        <div className="h-5 w-36 rounded-lg bg-muted/60" />
        <div className="space-y-2">
          {[1, 2, 3, 4].map((i) => (
            <div key={i} className="h-10 w-full rounded-lg bg-muted/30" />
          ))}
        </div>
      </div>
    </div>
  );
}
