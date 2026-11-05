import { HLDI_RATINGS, type HldiRating } from "@/lib/hldi"
import { cn } from "cn"

/** HLDI's five levels, plus a coverage HLDI doesn't publish for a model. */
export type ChipLevel = HldiRating | "Insufficient data"

export const CHIP_LEVELS: readonly ChipLevel[] = [...HLDI_RATINGS, "Insufficient data"]

/** Two strengths of better, a neutral average, two strengths of worse; not HLDI's own colors. */
const STYLE: Record<ChipLevel, { background: string; color: string; border: string }> = {
  "Substantially better than average": {
    background: "var(--hldi-better-strong)",
    color: "var(--hldi-better-strong-ink)",
    border: "1px solid var(--hldi-better-strong)",
  },
  "Better than average": { background: "var(--hldi-better)", color: "var(--hldi-better-ink)", border: "1px solid var(--hldi-better)" },
  Average: { background: "var(--hldi-average)", color: "var(--hldi-average-ink)", border: "1px solid var(--hldi-average)" },
  "Worse than average": { background: "var(--hldi-worse)", color: "var(--hldi-worse-ink)", border: "1px solid var(--hldi-worse)" },
  "Substantially worse than average": {
    background: "var(--hldi-worse-strong)",
    color: "var(--hldi-worse-strong-ink)",
    border: "1px solid var(--hldi-worse-strong)",
  },
  "Insufficient data": { background: "transparent", color: "var(--hldi-insufficient-ink)", border: "1px dashed var(--hldi-insufficient-ink)" },
}

/** A rating chip. The words are always inside it, so color is never the only signal. */
export function HldiChip({ level, className }: { level: ChipLevel; className?: string }) {
  return (
    <span
      className={cn("print-exact inline-flex items-center rounded-full px-2 py-0.5 text-xs leading-tight font-semibold whitespace-nowrap", className)}
      style={STYLE[level]}
      data-rating={level}
    >
      {level}
    </span>
  )
}

/** Once per page: what the chips mean. */
export function HldiLegend({ className }: { className?: string }) {
  return (
    <div className={cn("flex flex-wrap items-center gap-1.5 text-xs text-muted-foreground", className)} data-testid="hldi-legend">
      <span>HLDI&apos;s ratings, best to worst:</span>
      {CHIP_LEVELS.map((level) => (
        <HldiChip key={level} level={level} />
      ))}
    </div>
  )
}
