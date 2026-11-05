import { dollars, estimateDollars, rangeDollars, signedDollars } from "@/lib/format"
import { AxisTicks } from "./axis"
import { linearScale, niceTicks, pct, type LinearScale } from "./scale"

export type RangeRow = {
  key: string
  name: string
  starred: boolean
  /** The figure plotted: the yearly estimate, or (teen added) the extra a year. */
  value: number
  /** The estimated range around it, when it has one of its own. */
  low: number | null
  high: number | null
}

const AXIS_H = 34

function valueWords(value: number, extra: boolean): string {
  return extra ? signedDollars(value) : `about ${estimateDollars(value)}`
}

function nameWords(row: RangeRow, lowest: boolean): string {
  return `${row.starred ? "★ " : ""}${row.name}${lowest ? " · Lowest estimate" : ""}`
}

function Mark({ row, scale, y, extra }: { row: RangeRow; scale: LinearScale; y: number; extra: boolean }) {
  return (
    <g>
      <line x1={pct(scale.range[0])} x2={pct(scale.range[1])} y1={y} y2={y} stroke="var(--chart-grid)" strokeWidth={6} strokeLinecap="round" />
      {row.low !== null && row.high !== null ? (
        <line
          x1={pct(scale(row.low))}
          x2={pct(scale(row.high))}
          y1={y}
          y2={y}
          stroke="var(--primary)"
          strokeOpacity={0.3}
          strokeWidth={6}
          strokeLinecap="round"
        />
      ) : null}
      <circle cx={pct(scale(row.value))} cy={y} r={5.5} fill={extra ? "var(--chart-up)" : "var(--primary)"} stroke="var(--card)" strokeWidth={2} />
    </g>
  )
}

/**
 * One row per car on a shared dollar axis: the estimated range as a band and
 * the central estimate as a dot, in the table's order. The table below stays
 * as the accessible version.
 */
export function RangeRowsChart({
  rows,
  lowestKey,
  extra,
  axisLabel,
}: {
  rows: readonly RangeRow[]
  lowestKey: string | null
  /** Teen added: the dots are the extra a year, with no range of their own. */
  extra: boolean
  axisLabel: string
}) {
  const values = rows.flatMap((row) => [row.value, row.low ?? row.value, row.high ?? row.value])
  // One car, or cars that all come out the same: pad the axis so it still has a sensible span.
  let lo = Math.min(...values)
  let hi = Math.max(...values)
  const least = Math.max(Math.abs(hi) * 0.1, 50)
  if (hi - lo < least) {
    const pad = (least - (hi - lo)) / 2
    lo = Math.max(0, lo - pad)
    hi = hi + pad
  }
  const { min, max, ticks } = niceTicks(lo, hi, 4)
  const tickWords = (value: number) => (extra ? signedDollars(value) : dollars(value))
  const title = `${axisLabel}: ${rows
    .map((row) => `${row.starred ? "starred, " : ""}${row.name}${row.key === lowestKey ? " (lowest estimate)" : ""} ${valueWords(row.value, extra)}${row.low !== null && row.high !== null ? `, range ${rangeDollars(row.low, row.high)}` : ""}`)
    .join("; ")}.`

  // Wider screens: names on the left, the bar in the middle, the figure on the right.
  const rowH = 24
  const wideScale = linearScale([min, max], [37, 85])
  const wideH = rows.length * rowH + AXIS_H
  // Phones: the name and figure on one line, the bar under it.
  const block = 36
  const narrowScale = linearScale([min, max], [1.5, 98.5])
  const narrowH = rows.length * block + AXIS_H

  return (
    <>
      <svg role="img" width="100%" height={wideH} className="hidden overflow-visible sm:block print:block" data-testid="range-rows-wide">
        <title>{title}</title>
        <AxisTicks scale={wideScale} ticks={ticks} top={0} bottom={wideH - AXIS_H + 2} labelY={wideH - 18} format={tickWords} />
        <text x={pct(85)} y={wideH - 3} textAnchor="end" fontSize={11} fill="var(--chart-axis)">
          {axisLabel}
        </text>
        {rows.map((row, index) => {
          const y = index * rowH + rowH / 2
          const lowest = row.key === lowestKey
          return (
            <g key={row.key}>
              <text x="0" y={y + 4} fontSize={12} fill="var(--foreground)" fontWeight={lowest ? 600 : 400}>
                {nameWords(row, lowest)}
              </text>
              <Mark row={row} scale={wideScale} y={y} extra={extra} />
              <text x="100%" y={y + 4} fontSize={12} textAnchor="end" fill="var(--foreground)" fontWeight={600}>
                {valueWords(row.value, extra)}
              </text>
            </g>
          )
        })}
      </svg>
      <svg role="img" width="100%" height={narrowH} className="block overflow-visible sm:hidden print:hidden" data-testid="range-rows-narrow">
        <title>{title}</title>
        <AxisTicks scale={narrowScale} ticks={ticks} top={0} bottom={narrowH - AXIS_H + 2} labelY={narrowH - 18} format={tickWords} />
        <text x="0" y={narrowH - 3} fontSize={11} fill="var(--chart-axis)">
          {axisLabel}
        </text>
        {rows.map((row, index) => {
          const y = index * block
          const lowest = row.key === lowestKey
          const name = nameWords(row, lowest)
          return (
            <g key={row.key}>
              <text x="0" y={y + 13} fontSize={12} fill="var(--foreground)" fontWeight={lowest ? 600 : 400}>
                {name.length > 38 ? `${name.slice(0, 37).trimEnd()}…` : name}
              </text>
              <text x="100%" y={y + 13} fontSize={12} textAnchor="end" fill="var(--foreground)" fontWeight={600}>
                {valueWords(row.value, extra)}
              </text>
              <Mark row={row} scale={narrowScale} y={y + 25} extra={extra} />
            </g>
          )
        })}
      </svg>
    </>
  )
}
