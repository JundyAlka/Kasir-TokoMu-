export default function InventarisLoading() {
  return (
    <div className="space-y-4 animate-pulse">
      {/* 3 Stat Cards */}
      <section className="grid gap-4 md:grid-cols-3">
        {[1, 2, 3].map((i) => (
          <div key={i} className="h-28 rounded-3xl border border-border/40 bg-card/60 p-5 space-y-3">
            <div className="h-4 w-24 rounded-lg bg-muted/60" />
            <div className="h-7 w-32 rounded-lg bg-muted/80" />
            <div className="h-3 w-48 rounded-lg bg-muted/40" />
          </div>
        ))}
      </section>

      {/* Main Card */}
      <div className="rounded-3xl border border-border/60 bg-card/74 p-6 shadow-sm space-y-4">
        {/* Card Header */}
        <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
          <div className="space-y-2">
            <div className="h-7 w-48 rounded-xl bg-muted/70" />
            <div className="h-4 w-72 rounded-lg bg-muted/40" />
          </div>
          <div className="flex flex-wrap items-center gap-3">
            <div className="h-11 w-64 rounded-2xl bg-muted/50" />
            <div className="h-11 w-32 rounded-2xl bg-muted/50" />
            <div className="h-11 w-32 rounded-2xl bg-muted/50" />
          </div>
        </div>

        {/* Category Filter Pills */}
        <div className="flex items-center gap-2 pt-1 overflow-x-hidden">
          <div className="h-7 w-20 rounded-full bg-muted/60" />
          <div className="h-7 w-28 rounded-full bg-muted/50" />
          <div className="h-7 w-24 rounded-full bg-muted/40" />
          <div className="h-7 w-24 rounded-full bg-muted/40" />
          <div className="h-7 w-32 rounded-full bg-muted/40" />
        </div>

        {/* Table Skeleton */}
        <div className="mt-2 rounded-2xl border border-border/40 overflow-hidden">
          {/* Table Header */}
          <div className="h-10 bg-muted/30 border-b border-border/40 flex items-center px-4 gap-4">
            <div className="h-4 w-6 rounded bg-muted/50" />
            <div className="h-4 w-20 rounded bg-muted/50" />
            <div className="h-4 w-36 rounded bg-muted/50 flex-1" />
            <div className="h-4 w-20 rounded bg-muted/50" />
            <div className="h-4 w-20 rounded bg-muted/50" />
            <div className="h-4 w-20 rounded bg-muted/50" />
            <div className="h-4 w-16 rounded bg-muted/50" />
            <div className="h-4 w-12 rounded bg-muted/50" />
            <div className="h-4 w-28 rounded bg-muted/50" />
          </div>

          {/* Table Rows */}
          {[1, 2, 3, 4, 5, 6].map((i) => (
            <div key={i} className="h-14 border-b border-border/30 flex items-center px-4 gap-4">
              <div className="size-4 rounded bg-muted/50" />
              <div className="h-4 w-20 rounded bg-muted/50 font-mono" />
              <div className="space-y-1 flex-1">
                <div className="h-4 w-32 rounded bg-muted/60" />
                <div className="h-3 w-24 rounded bg-muted/30" />
              </div>
              <div className="h-4 w-20 rounded bg-muted/40" />
              <div className="h-4 w-16 rounded bg-muted/40" />
              <div className="h-4 w-16 rounded bg-muted/40" />
              <div className="h-5 w-10 rounded-full bg-muted/50" />
              <div className="h-4 w-8 rounded bg-muted/30" />
              <div className="h-7 w-28 rounded-full bg-muted/40 ml-auto" />
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
