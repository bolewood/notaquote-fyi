import { formatDollars } from "@/lib/sample-range"

export function UncertaintyBar({
  low,
  likely,
  high,
}: {
  low: number
  likely: number
  high: number
}) {
  const span = high - low
  const likelyPercent = span <= 0 ? 50 : ((likely - low) / span) * 100
  const label = `Sample modeled uncertainty from ${formatDollars(low)} low to ${formatDollars(high)} high, with the likely sample figure at ${formatDollars(likely)}. Baseline not cleared.`

  return (
    <figure className="grid gap-1.5">
      <div className="relative h-5" role="img" aria-label={label}>
        <div className="absolute top-1/2 right-0 left-0 h-px -translate-y-1/2 bg-foreground/40" />
        <div className="absolute top-1/2 left-0 h-3 w-px -translate-y-1/2 bg-foreground" />
        <div className="absolute top-1/2 right-0 h-3 w-px -translate-y-1/2 bg-foreground" />
        <div
          className="bg-primary absolute top-1/2 h-5 w-0.5 -translate-x-1/2 -translate-y-1/2"
          style={{ left: `${likelyPercent}%` }}
        />
      </div>
      <div className="relative h-4 text-xs" aria-hidden="true">
        <span className="absolute left-0">Low</span>
        <span
          className="text-primary absolute -translate-x-1/2 font-medium"
          style={{ left: `${likelyPercent}%` }}
        >
          Likely
        </span>
        <span className="absolute right-0">High</span>
      </div>
      <figcaption className="sr-only">{label}</figcaption>
    </figure>
  )
}
