export default function KasirLoading() {
  return (
    <div className="grid h-full w-full gap-4 overflow-hidden animate-pulse p-1 grid-cols-[minmax(0,1fr)_minmax(320px,380px)]">
      {/* Product Column Skeleton */}
      <div className="flex flex-col gap-4 rounded-[26px] border border-border/60 bg-card/70 p-4">
        <div className="flex items-center justify-between border-b border-border/40 pb-4">
          <div className="space-y-2">
            <div className="h-7 w-40 rounded-xl bg-muted/70" />
            <div className="h-4 w-64 rounded-lg bg-muted/40" />
          </div>
          <div className="h-10 w-60 rounded-2xl bg-muted/60" />
        </div>

        {/* Product Cards Grid */}
        <div className="grid flex-1 gap-3.5 grid-cols-2 md:grid-cols-3 xl:grid-cols-4">
          {[1, 2, 3, 4, 5, 6, 7, 8].map((i) => (
            <div
              key={i}
              className="flex min-h-[190px] flex-col justify-between rounded-[22px] border border-border/50 bg-card/60 p-3"
            >
              <div className="flex items-center justify-between">
                <div className="size-8 rounded-xl bg-muted/60" />
                <div className="h-5 w-14 rounded-full bg-muted/50" />
              </div>
              <div className="space-y-2 my-auto">
                <div className="h-4 w-4/5 rounded-lg bg-muted/70" />
                <div className="h-3 w-1/2 rounded-lg bg-muted/40" />
              </div>
              <div className="flex items-center justify-between pt-2 border-t border-border/30">
                <div className="h-5 w-20 rounded-lg bg-muted/80" />
                <div className="size-7 rounded-full bg-primary/25" />
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Cart Column Skeleton */}
      <div className="flex flex-col gap-4 rounded-[26px] border border-border/60 bg-card/70 p-4">
        <div className="h-6 w-32 rounded-xl bg-muted/70" />
        <div className="flex-1 rounded-2xl border border-dashed border-border/40 bg-muted/20" />
        <div className="space-y-3 border-t border-border/40 pt-4">
          <div className="flex justify-between">
            <div className="h-4 w-20 rounded-lg bg-muted/50" />
            <div className="h-6 w-28 rounded-lg bg-muted/80" />
          </div>
          <div className="h-12 w-full rounded-2xl bg-primary/30" />
        </div>
      </div>
    </div>
  );
}
