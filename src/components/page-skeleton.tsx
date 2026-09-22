/** A quiet placeholder while the page reads this browser's saved choices. */
export function PageSkeleton({ label }: { label: string }) {
  return (
    <div className="grid gap-5 pt-6 sm:pt-8" aria-busy="true" aria-label={label}>
      <div className="h-4 w-40 animate-pulse rounded bg-muted" />
      <div className="h-10 w-full max-w-xl animate-pulse rounded bg-muted" />
      <div className="h-5 w-full max-w-2xl animate-pulse rounded bg-muted" />
      <div className="grid gap-5 lg:grid-cols-[7fr_5fr]">
        <div className="card h-96 animate-pulse" />
        <div className="card h-96 animate-pulse" />
      </div>
    </div>
  )
}
