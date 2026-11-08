import { dollars, estimateDollars, rangeDollars, rangeEnds, rangeWords } from "@/lib/format"
import { formatDollars } from "@/lib/pricing"
import { cn } from "cn"
import type { ReactNode } from "react"

export { formatDollars, rangeWords }

/**
 * A range drawn on a shared scale: a hairline track, a band from low to high
 * and a dot at the likely figure. Pass the same min and max to several bars to
 * compare. `labels` prints the band's ends under it; `marker` draws a labelled
 * tick above it (the state's typical price, say).
 */
export function RangeBar({
  low,
  likely,
  high,
  min,
  max,
  tone = "primary",
  labels = false,
  marker,
  className,
}: {
  low: number
  likely: number
  high: number
  min: number
  max: number
  tone?: "primary" | "sun" | "muted"
  labels?: boolean
  marker?: { value: number; label: ReactNode }
  className?: string
}) {
  const span = Math.max(1, max - min)
  const at = (value: number) => Math.min(100, Math.max(0, ((value - min) / span) * 100))
  const left = at(low)
  const right = at(high)
  const dot = at(likely)
  const band = tone === "sun" ? "bg-sun/55" : tone === "muted" ? "bg-band-muted" : "bg-primary/20"
  const mark = tone === "sun" ? "bg-sun-ink" : tone === "muted" ? "bg-muted-foreground" : "bg-primary"
  const ends = rangeEnds(low, high)
  // Too narrow for two labels: print the range once, centred on the band.
  const tight = right - left < 24
  const middle = Math.min(88, Math.max(12, (left + right) / 2))
  const markerAt = marker ? at(marker.value) : 0
  const markerShift = markerAt < 15 ? "" : markerAt > 85 ? "-translate-x-full" : "-translate-x-1/2"
  const label = "money absolute text-xs whitespace-nowrap text-muted-foreground"
  return (
    <div
      className={cn("print-exact relative w-full", marker && "pt-6", labels && "pb-5", className)}
      role="img"
      aria-label={`${rangeWords(low, high)}, most likely about ${estimateDollars(likely)} a year`}
    >
      {marker ? (
        <span className={cn(label, "top-0", markerShift)} style={{ left: `${markerAt}%` }}>
          {marker.label}
        </span>
      ) : null}
      <div className="relative h-3">
        <span className="absolute inset-x-0 top-1/2 h-px -translate-y-1/2 bg-input" />
        <span
          className={cn("absolute inset-y-0 rounded-full", band)}
          style={{ left: `${left}%`, width: `${Math.max(1.5, right - left)}%` }}
        />
        {marker ? (
          <span className="absolute -inset-y-1.5 w-[1.5px] -translate-x-1/2 bg-foreground/55" style={{ left: `${markerAt}%` }} />
        ) : null}
        <span
          className={cn("absolute top-1/2 size-3.5 -translate-x-1/2 -translate-y-1/2 rounded-full ring-2 ring-card", mark)}
          style={{ left: `${dot}%` }}
        />
      </div>
      {labels ? (
        tight ? (
          <span className={cn(label, "bottom-0 -translate-x-1/2")} style={{ left: `${middle}%` }}>
            {rangeDollars(low, high)}
          </span>
        ) : (
          <>
            <span className={cn(label, "bottom-0")} style={{ left: `${left}%` }}>
              {dollars(ends.low)}
            </span>
            <span className={cn(label, "bottom-0 -translate-x-full")} style={{ left: `${right}%` }}>
              {dollars(ends.high)}
            </span>
          </>
        )
      ) : null}
    </div>
  )
}
