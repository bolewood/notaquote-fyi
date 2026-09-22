/**
 * The compare-cars table as plain data: build rows from the engine's
 * results, sort them, filter them, and write them as CSV. No React here, so
 * all of it is tested in compare-table.test.ts.
 */
import type { VehiclePick } from "./catalog"
import { carKey } from "./car-search"
import type { Estimate } from "./factor-engine"
import { rangeEnds, shownMonthly, shownYearly } from "./format"
import { vehicleMatchWords } from "./pricing"

/**
 * "own": each car priced for the driver on their own policy.
 * "added": a teen added to a parent's policy with each car; the main figure
 * is the extra the teen adds, and the range is the whole policy's.
 */
export type CompareMode = "own" | "added"

export type CompareRow = {
  key: string
  /** Position in the list the visitor built, from 0. */
  order: number
  car: VehiclePick
  /** "2024 Honda Civic" */
  name: string
  /** The version, e.g. "Civic 4Dr". */
  trim: string
  starred: boolean
  /** The yearly estimate (in "added" mode, the whole policy after adding the teen). */
  likely: number
  low: number
  high: number
  monthly: number
  /** In "added" mode: how much the teen adds a year. Otherwise null. */
  extra: number | null
  /** Short phrase for why this car sits where it does. */
  reason: string
  summary: string
  rangeNote: string
  /** The same reasons as short points, for a bulleted list. */
  rangePoints: string[]
  /** What we matched the car to, in the site's own words (for "Tell us" links). */
  vehicleShown: string
}

/** One engine result per car, in the same order as the cars. */
export type PricedCar = { estimate: Estimate; extra: number | null }

export function buildRows(
  priced: readonly PricedCar[],
  cars: readonly (VehiclePick & { starred: boolean })[],
  /** One reason per car, in the same order. */
  reasons: readonly string[],
): CompareRow[] {
  return priced.map((row, order) => {
    const car = cars[order]
    return {
      key: carKey(car),
      order,
      car: { year: car.year, make: car.make, model: car.model, trim: car.trim },
      name: `${car.year} ${car.make} ${car.model}`,
      trim: car.trim,
      starred: car.starred,
      likely: row.estimate.likely,
      low: row.estimate.low,
      high: row.estimate.high,
      monthly: row.estimate.monthly,
      extra: row.extra,
      reason: reasons[order] ?? "",
      summary: row.estimate.summary,
      rangeNote: row.estimate.rangeNote,
      rangePoints: row.estimate.rangePoints,
      vehicleShown: vehicleMatchWords(row.estimate.vehicle),
    }
  })
}

/** The number a row is judged by: the extra for the teen, or the yearly estimate. */
export function headlineAmount(row: Pick<CompareRow, "extra" | "likely">): number {
  return row.extra ?? row.likely
}

export const SORT_KEYS = ["order", "car", "yearly", "monthly", "policy", "range", "reason"] as const
export type SortKey = (typeof SORT_KEYS)[number]
export type SortDirection = "asc" | "desc"
export type SortState = { key: SortKey; direction: SortDirection }

export const DEFAULT_SORT: SortState = { key: "yearly", direction: "asc" }

function compareBy(key: SortKey, left: CompareRow, right: CompareRow): number {
  switch (key) {
    case "order":
      return left.order - right.order
    case "car":
      return left.name.localeCompare(right.name) || left.trim.localeCompare(right.trim)
    case "yearly":
    case "monthly":
      return headlineAmount(left) - headlineAmount(right) || left.likely - right.likely
    case "policy":
      return left.likely - right.likely
    case "range":
      return left.high - left.low - (right.high - right.low)
    case "reason":
      return left.reason.localeCompare(right.reason)
  }
}

/** Sort a copy. Ties keep the order the visitor added the cars in. */
export function sortRows(rows: readonly CompareRow[], sort: SortState): CompareRow[] {
  const sign = sort.direction === "asc" ? 1 : -1
  return [...rows].sort((left, right) => sign * compareBy(sort.key, left, right) || left.order - right.order)
}

/** Clicking a column: the same column flips direction; a new one starts ascending. */
export function nextSort(current: SortState, key: SortKey): SortState {
  if (current.key === key) return { key, direction: current.direction === "asc" ? "desc" : "asc" }
  return { key, direction: "asc" }
}

export type RowFilter = {
  /** Only rows at or under this many dollars a year (the extra for a teen, or the yearly estimate). */
  maxYearly: number | null
  starredOnly: boolean
}

export const NO_FILTER: RowFilter = { maxYearly: null, starredOnly: false }

export function filterRows(rows: readonly CompareRow[], filter: RowFilter): CompareRow[] {
  return rows.filter(
    (row) =>
      (filter.maxYearly === null || headlineAmount(row) <= filter.maxYearly) && (!filter.starredOnly || row.starred),
  )
}

/** "2,500" or "$2500" to 2500; empty or unreadable to null. */
export function parseMaxYearly(text: string): number | null {
  const cleaned = text.trim().replace(/[$,\s]/g, "")
  if (!/^\d{1,6}$/.test(cleaned)) return null
  const value = Number(cleaned)
  return value > 0 ? value : null
}

/** The lowest and highest dollars across rows, for drawing every range bar on one scale. */
export function scaleFor(rows: readonly CompareRow[]): { min: number; max: number } | null {
  if (rows.length === 0) return null
  const min = Math.min(...rows.map((row) => row.low))
  const max = Math.max(...rows.map((row) => row.high))
  return { min, max: max > min ? max : min + 1 }
}

// ---------------------------------------------------------------------------
// CSV

export const CSV_COLUMNS: Record<CompareMode, readonly string[]> = {
  own: [
    "Car",
    "Version",
    "Starred",
    "Yearly estimate ($)",
    "Monthly estimate ($)",
    "Range, low ($)",
    "Range, high ($)",
    "Why (compared with an average car)",
  ],
  added: [
    "Car",
    "Version",
    "Starred",
    "Extra a year for your teen ($)",
    "Extra a month for your teen ($)",
    "Whole policy a year, with your teen ($)",
    "Whole policy range, low ($)",
    "Whole policy range, high ($)",
    "Why (compared with an average car)",
  ],
}

/**
 * One CSV cell. Quotes when needed, and neutralizes text that a spreadsheet
 * would treat as a formula (a leading =, +, -, or @).
 */
export function csvCell(value: string | number | boolean): string {
  let text = typeof value === "boolean" ? (value ? "Yes" : "") : String(value)
  if (typeof value === "string" && /^[=+\-@\t\r]/.test(text)) text = `'${text}`
  return /[",\n\r]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text
}

export type CsvNotes = {
  /** Who and where, e.g. "16–18-year-old added to a parent's policy, Illinois suburbs, full coverage". */
  driver: string
  /** Where the numbers start from. */
  start: string
  /** The disclaimer, once. */
  disclaimer: string
  /** When the data was updated, in words, and the math version. */
  versions: string
}

/** Rounded the way the page shows them: yearly to $10, monthly to $5 (from the shown yearly), ranges to $50. */
function tens(amount: number): number {
  return shownYearly(amount)
}

function fives(yearly: number): number {
  return Math.max(5, shownMonthly(yearly))
}

/** "Pricier repairs, more at-fault claims" (the page's words, first letter up). */
export function reasonWords(reason: string): string {
  return reason.charAt(0).toUpperCase() + reason.slice(1)
}

/**
 * Who it's for and "not a quote" first, then one row per car in the order
 * given (sort them first), then where the numbers start and the data date.
 * Amounts are rounded the way the page shows them.
 */
export function toCsv(rows: readonly CompareRow[], notes: CsvNotes, mode: CompareMode = "own"): string {
  const lines = [
    [csvCell("Driver"), csvCell(notes.driver)].join(","),
    [csvCell("Please note"), csvCell(notes.disclaimer)].join(","),
    "",
    CSV_COLUMNS[mode].map(csvCell).join(","),
  ]
  for (const row of rows) {
    const range = rangeEnds(row.low, row.high)
    const cells =
      mode === "added"
        ? [
            row.name,
            row.trim,
            row.starred,
            row.extra === null ? "" : tens(row.extra),
            row.extra === null ? "" : fives(row.extra),
            tens(row.likely),
            range.low,
            range.high,
            reasonWords(row.reason),
          ]
        : [row.name, row.trim, row.starred, tens(row.likely), fives(row.likely), range.low, range.high, reasonWords(row.reason)]
    lines.push(cells.map(csvCell).join(","))
  }
  lines.push("")
  lines.push([csvCell("Starting point"), csvCell(notes.start)].join(","))
  lines.push([csvCell("Data"), csvCell(notes.versions)].join(","))
  lines.push([csvCell("Made with"), csvCell("NotAQuote.FYI, free and open source: notaquote.fyi")].join(","))
  // The byte-order mark tells Excel the file is UTF-8, so "16–18" and "→" read right.
  return `\uFEFF${lines.join("\r\n")}\r\n`
}

/** The main number as it's shown in the table: to the nearest $10. */
export function shownAmount(row: Pick<CompareRow, "extra" | "likely">): number {
  return shownYearly(headlineAmount(row))
}

/**
 * How much more each car costs than the cheapest one in view, worked out
 * from the numbers as shown (so "+$210" is exactly the gap between two
 * shown figures), and which car that is. The cheapest car gets 0.
 */
export function gapsToCheapest(rows: readonly CompareRow[]): { gaps: Map<string, number>; cheapest: CompareRow | null } {
  if (rows.length === 0) return { gaps: new Map(), cheapest: null }
  const cheapest = rows.reduce((best, row) => (headlineAmount(row) < headlineAmount(best) ? row : best))
  return {
    gaps: new Map(rows.map((row) => [row.key, shownAmount(row) - shownAmount(cheapest)])),
    cheapest,
  }
}

/**
 * One line that answers the question: the cheapest car in view against the
 * priciest, e.g. "For a 16–18-year-old in Illinois, a 2022 Subaru Crosstrek
 * costs about $350 a year less to add than a 2022 Kia Forte."
 */
export function compareAnswer(rows: readonly CompareRow[], mode: CompareMode, who: string): string | null {
  if (rows.length < 2) return null
  const sorted = [...rows].sort((left, right) => headlineAmount(left) - headlineAmount(right) || left.order - right.order)
  const low = sorted[0]
  const high = sorted[sorted.length - 1]
  const gap = shownAmount(high) - shownAmount(low)
  if (gap === 0) return `${who}, these cars cost about the same to ${mode === "added" ? "add" : "insure"}.`
  return `${who}, a ${low.name} costs about $${gap.toLocaleString("en-US")} a year less to ${mode === "added" ? "add" : "insure"} than a ${high.name}.`
}

export function csvFilename(today: Date = new Date()): string {
  const iso = today.toISOString().slice(0, 10)
  return `notaquote-car-comparison-${iso}.csv`
}
