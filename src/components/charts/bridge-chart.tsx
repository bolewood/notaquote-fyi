import { rangeDollars } from "@/lib/format"
import type { Bridge, BridgeRow, BridgeTone } from "@/lib/bridge"
import { AxisTicks } from "./axis"
import { ChartFigure } from "./figure"
import { linearScale, niceTicks, pct, type LinearScale } from "./scale"

const FILL: Record<BridgeTone, string> = {
  up: "var(--chart-up)",
  down: "var(--chart-down)",
  neutral: "var(--chart-neutral)",
  total: "var(--chart-neutral)",
}

const AXIS_H = 22

function title(bridge: Bridge): string {
  const first = bridge.rows[0]
  const last = bridge.rows.at(-1)!
  const steps = bridge.rows.filter((row) => row.kind === "step").map((row) => `${row.label} ${row.value}`)
  return `From ${first.value} where you started${steps.length ? `, ${steps.join(", ")},` : ""} to ${last.value} a year (estimated range ${rangeDollars(bridge.range.low, bridge.range.high)}).`
}

/** The thin line for the estimated range, with the dot at the central estimate, like the range bars elsewhere. */
function Whisker({ scale, bridge, y }: { scale: LinearScale; bridge: Bridge; y: number }) {
  const { low, likely, high } = bridge.range
  return (
    <g>
      <line x1={pct(scale(low))} x2={pct(scale(high))} y1={y} y2={y} stroke="var(--foreground)" strokeWidth={1.5} />
      <line x1={pct(scale(low))} x2={pct(scale(low))} y1={y - 5} y2={y + 5} stroke="var(--foreground)" strokeWidth={1.5} />
      <line x1={pct(scale(high))} x2={pct(scale(high))} y1={y - 5} y2={y + 5} stroke="var(--foreground)" strokeWidth={1.5} />
      <circle cx={pct(scale(likely))} cy={y} r={5.5} fill="var(--primary)" stroke="var(--card)" strokeWidth={2} />
    </g>
  )
}

function Bar({ row, scale, y, height }: { row: BridgeRow; scale: LinearScale; y: number; height: number }) {
  const left = scale(Math.min(row.from, row.to))
  const width = Math.max(0.6, Math.abs(scale(row.to) - scale(row.from)))
  return (
    <rect
      x={pct(left)}
      y={y}
      width={pct(width)}
      height={height}
      rx={2}
      fill={FILL[row.tone]}
      fillOpacity={row.tone === "total" ? 0.5 : 1}
    />
  )
}

/** Wider screens: labels in a column on the left, bars in the middle, figures on the right. */
function WideBridge({ bridge, rowH }: { bridge: Bridge; rowH: number }) {
  const { max, ticks } = niceTicks(0, bridge.max, 4)
  const scale = linearScale([0, max], [41, 83])
  const height = bridge.rows.length * rowH + AXIS_H
  const barH = Math.round(rowH * 0.55)
  return (
    <svg role="img" width="100%" height={height} className="block overflow-visible" data-testid="bridge-wide">
      <title>{title(bridge)}</title>
      <AxisTicks scale={scale} ticks={ticks} top={0} bottom={height - AXIS_H + 2} labelY={height - 6} />
      {bridge.rows.map((row, index) => {
        const y = index * rowH
        const mid = y + rowH / 2
        const next = bridge.rows[index + 1]
        return (
          <g key={`${row.kind}-${index}`}>
            <text x="0" y={mid + 4} fontSize={12} fill="var(--foreground)" fontWeight={row.kind === "step" ? 400 : 600}>
              {row.label.length > 40 ? `${row.label.slice(0, 39).trimEnd()}…` : row.label}
            </text>
            <Bar row={row} scale={scale} y={mid - barH / 2} height={barH} />
            {row.kind === "end" ? <Whisker scale={scale} bridge={bridge} y={mid} /> : null}
            {next && next.kind !== "end" ? (
              <line
                x1={pct(scale(row.to))}
                x2={pct(scale(row.to))}
                y1={mid + barH / 2}
                y2={mid + rowH - barH / 2}
                stroke="var(--chart-axis)"
                strokeDasharray="2 2"
                strokeWidth={1}
              />
            ) : null}
            <text x="100%" y={mid + 4} fontSize={12} textAnchor="end" fill="var(--foreground)" fontWeight={600}>
              {row.value}
            </text>
          </g>
        )
      })}
    </svg>
  )
}

/** Phones: each label sits above a full-width bar, so nothing scrolls sideways. */
function NarrowBridge({ bridge, compact }: { bridge: Bridge; compact: boolean }) {
  const { max, ticks } = niceTicks(0, bridge.max, 3)
  const scale = linearScale([0, max], [0, 100])
  const block = compact ? 34 : 40
  const barH = compact ? 10 : 12
  const height = bridge.rows.length * block + AXIS_H
  return (
    <svg role="img" width="100%" height={height} className="block overflow-visible" data-testid="bridge-narrow">
      <title>{title(bridge)}</title>
      <AxisTicks scale={scale} ticks={ticks} top={0} bottom={height - AXIS_H + 2} labelY={height - 6} />
      {bridge.rows.map((row, index) => {
        const y = index * block
        const label = row.label.length > 34 ? `${row.label.slice(0, 33).trimEnd()}…` : row.label
        const barY = y + 18
        return (
          <g key={`${row.kind}-${index}`}>
            <text x="0" y={y + 13} fontSize={12} fill="var(--foreground)" fontWeight={row.kind === "step" ? 400 : 600}>
              {label}
            </text>
            <text x="100%" y={y + 13} fontSize={12} textAnchor="end" fill="var(--foreground)" fontWeight={600}>
              {row.value}
            </text>
            <Bar row={row} scale={scale} y={barY} height={barH} />
            {row.kind === "end" ? <Whisker scale={scale} bridge={bridge} y={barY + barH / 2} /> : null}
          </g>
        )
      })}
    </svg>
  )
}

/**
 * The bridge from where you started to where you end up: one bar for the
 * start, one floating bar per piece (each starting where the last ended),
 * and one for the result with its estimated range. The list of pieces under
 * it stays as the accessible version.
 */
export function BridgeChart({ bridge, layout = "auto", className }: { bridge: Bridge; layout?: "auto" | "wide"; className?: string }) {
  const compact = bridge.rows.length >= 7
  return (
    <ChartFigure
      className={className}
      testId="bridge-chart"
      caption="Start at the top. Each bar begins where the one above it ends: a + piece adds to the bill, a − piece takes away. The last bar is where you end up; the thin line is its estimated range and the dot is our central estimate."
    >
      {layout === "wide" ? (
        <WideBridge bridge={bridge} rowH={compact ? 22 : 28} />
      ) : (
        <>
          {/* The label column needs the room the What-if card has from 1280px up; below that, labels sit above the bars. */}
          <div className="hidden xl:block">
            <WideBridge bridge={bridge} rowH={compact ? 22 : 28} />
          </div>
          <div className="xl:hidden">
            <NarrowBridge bridge={bridge} compact={compact} />
          </div>
        </>
      )}
    </ChartFigure>
  )
}
