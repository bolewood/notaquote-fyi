/**
 * A small linear scale for hand-built SVG charts: dollars in, a position out
 * (by default 0–100, used as a percentage of the chart's width, so the chart
 * stretches to any width without measuring the page).
 */
export type LinearScale = {
  (value: number): number
  domain: readonly [number, number]
  range: readonly [number, number]
}

export function linearScale(domain: readonly [number, number], range: readonly [number, number] = [0, 100]): LinearScale {
  const [d0, d1] = domain
  const [r0, r1] = range
  const span = d1 - d0 || 1
  const scale = ((value: number) => r0 + ((value - d0) / span) * (r1 - r0)) as LinearScale
  scale.domain = domain
  scale.range = range
  return scale
}

/** A "nice" step near span ÷ count: 1, 2, 2.5 or 5 times a power of ten. */
export function niceStep(span: number, count: number): number {
  if (!(span > 0) || count < 1) return 1
  const raw = span / count
  const power = 10 ** Math.floor(Math.log10(raw))
  const fraction = raw / power
  const nice = fraction <= 1 ? 1 : fraction <= 2 ? 2 : fraction <= 2.5 ? 2.5 : fraction <= 5 ? 5 : 10
  return nice * power
}

/**
 * Round a domain out to nice ticks: niceTicks(0, 3420) gives 0–4,000 in
 * steps of 1,000. The ends always include min and max.
 */
export function niceTicks(min: number, max: number, count = 4): { min: number; max: number; ticks: number[] } {
  if (max < min) [min, max] = [max, min]
  if (max === min) max = min + 1
  const step = niceStep(max - min, count)
  const lo = Math.floor(min / step) * step
  const hi = Math.ceil(max / step) * step
  const ticks: number[] = []
  for (let value = lo; value <= hi + step / 1e6; value += step) ticks.push(Math.round(value * 1e6) / 1e6)
  return { min: lo, max: hi, ticks }
}

/** A percentage for an SVG coordinate: 12.3456 → "12.35%". */
export function pct(value: number): string {
  return `${Math.round(value * 100) / 100}%`
}
