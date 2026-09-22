import { formatDollars } from "@/lib/pricing"
import { cn } from "cn"

export { formatDollars }

/** "roughly $1,500–$2,300" */
export function rangeWords(low: number, high: number): string {
  return `roughly ${formatDollars(low)}–${formatDollars(high)}`
}

/**
 * A range drawn on a shared scale: a soft band from low to high and a dot at
 * the likely figure. Pass the same min and max to several bars to compare.
 */
export function RangeBar({
  low,
  likely,
  high,
  min,
  max,
  tone = "primary",
  className,
}: {
  low: number
  likely: number
  high: number
  min: number
  max: number
  tone?: "primary" | "sun" | "muted"
  className?: string
}) {
  const span = Math.max(1, max - min)
  const at = (value: number) => Math.min(100, Math.max(0, ((value - min) / span) * 100))
  const left = at(low)
  const right = at(high)
  const dot = at(likely)
  const band =
    tone === "sun" ? "bg-sun/35" : tone === "muted" ? "bg-muted-foreground/20" : "bg-primary/20"
  const mark = tone === "sun" ? "bg-sun-ink" : tone === "muted" ? "bg-muted-foreground" : "bg-primary"
  return (
    <div
      className={cn("relative h-3 w-full rounded-full bg-muted", className)}
      role="img"
      aria-label={`${rangeWords(low, high)}, most likely about ${formatDollars(likely)} a year`}
    >
      <span
        className={cn("absolute inset-y-0 rounded-full", band)}
        style={{ left: `${left}%`, width: `${Math.max(1.5, right - left)}%` }}
      />
      <span
        className={cn("absolute top-1/2 size-3.5 -translate-x-1/2 -translate-y-1/2 rounded-full ring-2 ring-card", mark)}
        style={{ left: `${dot}%` }}
      />
    </div>
  )
}

/** Which way a change goes, in words and color. The amount itself is in the headline. */
export function DeltaBadge({ amount, className }: { amount: number; className?: string }) {
  const tone =
    amount > 0 ? "bg-up-soft text-up" : amount < 0 ? "bg-down-soft text-down" : "bg-muted text-muted-foreground"
  const words = amount > 0 ? "Costs more" : amount < 0 ? "Costs less" : "About the same"
  return (
    <span className={cn("inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-sm font-semibold", tone, className)}>
      <span aria-hidden="true">{amount > 0 ? "↑" : amount < 0 ? "↓" : "="}</span>
      {words}
    </span>
  )
}
