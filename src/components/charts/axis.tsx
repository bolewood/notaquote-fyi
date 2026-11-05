import { dollars } from "@/lib/format"
import { pct, type LinearScale } from "./scale"

/**
 * A dollar axis along the bottom (or top) of a chart: a faint grid line and a
 * label at each tick. Coordinates are percentages of the chart's width, so it
 * lines up with bars drawn on the same scale.
 */
export function AxisTicks({
  scale,
  ticks,
  top,
  bottom,
  labelY,
  format = dollars,
}: {
  scale: LinearScale
  ticks: readonly number[]
  /** Where grid lines start and end, in pixels. */
  top: number
  bottom: number
  /** Where the labels sit, in pixels. */
  labelY: number
  format?: (value: number) => string
}) {
  return (
    <g aria-hidden="true">
      {ticks.map((tick, index) => {
        const x = pct(scale(tick))
        const anchor = index === 0 ? "start" : index === ticks.length - 1 ? "end" : "middle"
        return (
          <g key={tick}>
            <line x1={x} x2={x} y1={top} y2={bottom} stroke="var(--chart-grid)" strokeWidth={1} />
            <text x={x} y={labelY} textAnchor={anchor} fontSize={11} fill="var(--chart-axis)">
              {format(tick)}
            </text>
          </g>
        )
      })}
    </g>
  )
}
