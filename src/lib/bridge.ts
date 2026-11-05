/**
 * The geometry of a "bridge" (waterfall) chart for a what-if: where you
 * started, each piece of the difference as a bar that starts where the one
 * before it ended, and where you end up. Drawn from the engine's exact,
 * unrounded figures, so the last piece always lands on the result; the
 * labels show the same rounded numbers as the list under the chart.
 */
import { dollars, estimateDollars, signedDollars } from "./format"
import type { ChangePart } from "./pricing"

export type BridgeTone = "up" | "down" | "neutral" | "total"

export type BridgeRow = {
  kind: "start" | "step" | "end"
  /** Short label for the chart: "Subaru Outback instead of Toyota Camry". */
  label: string
  /** The figure as shown in the list: "+$140", "about $1,680". */
  value: string
  /** Where the bar starts and ends, in exact dollars a year. */
  from: number
  to: number
  tone: BridgeTone
}

export type Bridge = {
  rows: BridgeRow[]
  /** The end row's estimated range, for the whisker. */
  range: { low: number; likely: number; high: number }
  /** The largest figure the chart has to show (for its axis). */
  max: number
  /** Start plus every piece, minus the result: 0 when the pieces add up exactly. */
  drift: number
}

/** "Subaru Outback instead of Toyota Camry: lower crash-repair losses" → "Subaru Outback instead of Toyota Camry". */
export function shortPartLabel(label: string): string {
  const colon = label.indexOf(": ")
  return colon > 0 ? label.slice(0, colon) : label
}

/**
 * One row for where you started, one per piece the list shows, and one for
 * where you end up. Pieces that round to $0 aren't drawn (the list hides
 * them too), but they still count toward where the next bar starts.
 * `neutral` pieces (coverage changes) are drawn in the neutral color, since
 * cheaper coverage isn't automatically good.
 */
export function bridgeRows(input: {
  start: { label: string; likely: number; ownNumber: boolean }
  parts: readonly ChangePart[]
  end: { label: string; likely: number; low: number; high: number }
  neutral?: (part: ChangePart) => boolean
}): Bridge {
  const rows: BridgeRow[] = [
    {
      kind: "start",
      label: input.start.label,
      value: input.start.ownNumber ? dollars(input.start.likely) : `about ${estimateDollars(input.start.likely)}`,
      from: 0,
      to: input.start.likely,
      tone: "total",
    },
  ]
  let running = input.start.likely
  let max = running
  for (const part of input.parts) {
    const from = running
    running += part.amount
    max = Math.max(max, running)
    if (Math.round(part.amount / 10) === 0) continue
    const tone: BridgeTone = input.neutral?.(part) ? "neutral" : part.amount > 0 ? "up" : "down"
    rows.push({ kind: "step", label: shortPartLabel(part.label), value: signedDollars(part.amount), from, to: running, tone })
  }
  rows.push({
    kind: "end",
    label: input.end.label,
    value: `about ${estimateDollars(input.end.likely)}`,
    from: 0,
    to: input.end.likely,
    tone: "total",
  })
  return {
    rows,
    range: { low: input.end.low, likely: input.end.likely, high: input.end.high },
    max: Math.max(max, input.end.high, input.end.likely),
    drift: running - input.end.likely,
  }
}
