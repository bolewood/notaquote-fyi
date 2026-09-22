import { estimateDollars, rangeWords } from "@/lib/format"
import { formatDollars } from "@/lib/pricing"
import { cn } from "cn"

export { formatDollars, rangeWords }

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
      className={cn("print-exact relative h-3 w-full rounded-full bg-muted", className)}
      role="img"
      aria-label={`${rangeWords(low, high)}, most likely about ${estimateDollars(likely)} a year`}
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
