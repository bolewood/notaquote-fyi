/**
 * How numbers read on the site. One place, so every screen rounds the same way:
 * - an estimate rounds to the nearest $10, a range to the nearest $50, and a
 *   monthly figure is the shown yearly figure ÷ 12, to the nearest $5 (so
 *   $630 a year reads as $55 a month, the same on every screen);
 * - a number the visitor typed stays exactly as they typed it;
 * - sentences say "$630 more a year"; only table cells use + and −.
 * These change how numbers look, never the math behind them.
 */

const MINUS = "−"

function roundTo(amount: number, step: number): number {
  return Math.round(amount / step) * step
}

/** "$1,720". Whole dollars with commas, no rounding. */
export function dollars(amount: number): string {
  return `$${Math.round(amount).toLocaleString("en-US")}`
}

/** An estimate, to the nearest $10: 1717 to "$1,720". */
export function estimateDollars(amount: number): string {
  return dollars(Math.max(10, roundTo(amount, 10)))
}

/** A yearly amount as it's shown: to the nearest $10. */
export function shownYearly(amount: number): number {
  return roundTo(amount, 10)
}

/** A monthly amount as it's shown: the shown yearly amount ÷ 12, to the nearest $5. */
export function shownMonthly(yearly: number): number {
  return roundTo(shownYearly(yearly) / 12, 5)
}

/** A monthly figure from a yearly one: 1717 to "$145", 630 to "$55". */
export function monthlyDollars(yearly: number): string {
  return dollars(Math.max(5, shownMonthly(yearly)))
}

/** The ends of a range, to the nearest $50, always at least $50 apart. */
export function rangeEnds(low: number, high: number): { low: number; high: number } {
  const roundedLow = Math.max(50, roundTo(low, 50))
  let roundedHigh = roundTo(high, 50)
  if (roundedHigh <= roundedLow) roundedHigh = roundedLow + 50
  return { low: roundedLow, high: roundedHigh }
}

/** "$1,250–$2,500" */
export function rangeDollars(low: number, high: number): string {
  const ends = rangeEnds(low, high)
  return `${dollars(ends.low)}–${dollars(ends.high)}`
}

/** "roughly $1,250–$2,500" */
export function rangeWords(low: number, high: number): string {
  return `roughly ${rangeDollars(low, high)}`
}

/** Two yearly figures this close read as "about the same": under $50, or under 3%. */
export function aboutTheSame(delta: number, base: number): boolean {
  return Math.abs(delta) < 50 || Math.abs(delta) < Math.abs(base) * 0.03
}

/** A yearly difference in a sentence: "$630 more a year", "$90 less a year", or "about the same". */
export function differenceWords(delta: number, per: "year" | "month" = "year"): string {
  const rounded = per === "year" ? shownYearly(delta) : Math.sign(delta) * shownMonthly(Math.abs(delta))
  if (rounded === 0) return "about the same"
  return `${dollars(Math.abs(rounded))} ${rounded > 0 ? "more" : "less"} a ${per}`
}

/** A difference in a table cell: "+$630", "−$90", or "$0". Rounded to $10. */
export function signedDollars(delta: number): string {
  const rounded = roundTo(delta, 10)
  if (rounded === 0) return "$0"
  return `${rounded > 0 ? "+" : MINUS}${dollars(Math.abs(rounded))}`
}

/** A percentage change: "+52%", "−8%", or "no change". */
export function percentWords(percent: number): string {
  if (percent === 0) return "no change"
  return percent > 0 ? `+${percent}%` : `${MINUS}${-percent}%`
}

/** A range of percentage changes: "−5% to +16%", "+57% to +81%". */
export function percentRangeWords(lowPercent: number, highPercent: number): string {
  const one = (value: number) => (value === 0 ? "0%" : percentWords(value))
  if (lowPercent === highPercent) return one(lowPercent)
  return `${one(lowPercent)} to ${one(highPercent)}`
}

/** Liability limits in dollars: "$100,000/$300,000/$100,000". */
export function limitsWords(perPerson: number, perCrash: number, property: number): string {
  return `${dollars(perPerson)}/${dollars(perCrash)}/${dollars(property)}`
}

const MONTHS = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"]

/** "2026-09-22" as "September 22, 2026". Anything else comes back unchanged. */
export function longDate(iso: string): string {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(iso)
  if (!match) return iso
  return `${MONTHS[Number(match[2]) - 1]} ${Number(match[3])}, ${match[1]}`
}
