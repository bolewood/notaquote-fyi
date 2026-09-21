import { formatDollars } from "@/lib/sample-range"

export function UncertaintyBar({
  low,
  likely,
  high,
  sample,
}: {
  low: number
  likely: number
  high: number
  sample: boolean
}) {
  const span = high - low
  const likelyPercent = span <= 0 ? 50 : ((likely - low) / span) * 100
  const label = sample
    ? `Sample modeled uncertainty from ${formatDollars(low)} low to ${formatDollars(high)} high, with the likely sample figure at ${formatDollars(likely)}. Baseline not cleared. Not the factor engine.`
    : `Modeled uncertainty from ${formatDollars(low)} low to ${formatDollars(high)} high, with the likely figure at ${formatDollars(likely)}. Anchored to an entered premium. The general baseline is not cleared.`

  return (
    <figure className="grid gap-1.5">
      <div className="relative h-6" role="img" aria-label={label}>
        <div
          className="absolute inset-x-0 top-1/2 h-2 -translate-y-1/2 rounded-full"
          style={{
            background:
              "linear-gradient(90deg, var(--range-low), var(--range-likely), var(--range-high))",
          }}
        />
        <span className="bg-range-low absolute top-1/2 left-0 h-5 w-1 -translate-y-1/2 rounded-full" />
        <span
          className="bg-range-likely absolute top-1/2 h-6 w-1.5 -translate-x-1/2 -translate-y-1/2 rounded-full"
          style={{ left: `${likelyPercent}%` }}
        />
        <span className="bg-range-high absolute top-1/2 right-0 h-5 w-1 -translate-y-1/2 rounded-full" />
      </div>
      <figcaption className="sr-only">{label}</figcaption>
    </figure>
  )
}
