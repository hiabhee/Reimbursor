export default function AppRouteLoading() {
  return (
    <div className="min-h-0 flex-1 overflow-auto px-4 py-5 sm:px-6" role="status" aria-label="Loading page">
      <div className="mx-auto max-w-[1600px] space-y-6">
        <div className="space-y-2">
          <div className="h-3 w-28 animate-pulse rounded bg-surface-high" />
          <div className="h-8 w-64 max-w-full animate-pulse rounded bg-surface-high" />
          <div className="h-4 w-80 max-w-full animate-pulse rounded bg-surface-high" />
        </div>
        <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
          {[1, 2, 3, 4].map((item) => (
            <div key={item} className="h-24 animate-pulse rounded-xl border border-border bg-card" />
          ))}
        </div>
        <div className="overflow-hidden rounded-xl border border-border bg-card">
          <div className="h-12 animate-pulse border-b border-border bg-surface-high" />
          {[1, 2, 3, 4, 5].map((item) => (
            <div key={item} className="flex h-14 items-center gap-4 border-b border-border px-4 last:border-0">
              <div className="h-8 w-8 animate-pulse rounded-full bg-surface-high" />
              <div className="h-3 w-1/4 animate-pulse rounded bg-surface-high" />
              <div className="h-3 w-1/3 animate-pulse rounded bg-surface-high" />
              <div className="ml-auto h-3 w-16 animate-pulse rounded bg-surface-high" />
            </div>
          ))}
        </div>
        <span className="sr-only">Loading page…</span>
      </div>
    </div>
  )
}
