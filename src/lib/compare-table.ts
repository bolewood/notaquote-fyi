/**
 * The compare-cars table as plain data: build rows from the engine's
 * results, sort them, filter them, and write them as CSV. No React here, so
 * all of it is tested in compare-table.test.ts.
 */
import type { VehiclePick } from "./catalog"
import { carKey } from "./car-search"
import type { Estimate } from "./factor-engine"
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
  /** What we matched the car to, in the site's own words (for "Tell us" links). */
  vehicleShown: string
}

/** One engine result per car, in the same order as the cars. */
export type PricedCar = { estimate: Estimate; extra: number | null }

export function buildRows(
  priced: readonly PricedCar[],
  cars: readonly (VehiclePick & { starred: boolean })[],
  reason: (estimate: Estimate, car: VehiclePick) => string,
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
      reason: reason(row.estimate, car),
      summary: row.estimate.summary,
      rangeNote: row.estimate.rangeNote,
      vehicleShown: vehicleMatchWords(row.estimate.vehicle),
    }
  })
}

/** The number a row is judged by: the extra for the teen, or the yearly estimate. */
export function headlineAmount(row: Pick<CompareRow, "extra" | "likely">): number {
  return row.extra ?? row.likely
}

export const SORT_KEYS = ["order", "car", "yearly", "monthly", "range", "reason"] as const
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
  own: ["Car", "Version", "Starred", "Yearly estimate ($)", "Monthly ($)", "Low ($)", "High ($)", "Why"],
  added: [
    "Car",
    "Version",
    "Starred",
    "Extra a year for the teen ($)",
    "Whole policy a year, with the teen ($)",
    "Whole policy a month ($)",
    "Whole policy low ($)",
    "Whole policy high ($)",
    "Why",
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
  /** Model and data versions. */
  versions: string
}

/** Rows in the order given (sort them first), then a few notes at the bottom. */
export function toCsv(rows: readonly CompareRow[], notes: CsvNotes, mode: CompareMode = "own"): string {
  const lines = [CSV_COLUMNS[mode].map(csvCell).join(",")]
  for (const row of rows) {
    const cells =
      mode === "added"
        ? [row.name, row.trim, row.starred, row.extra ?? "", row.likely, row.monthly, row.low, row.high, row.reason]
        : [row.name, row.trim, row.starred, row.likely, row.monthly, row.low, row.high, row.reason]
    lines.push(cells.map(csvCell).join(","))
  }
  lines.push("")
  lines.push([csvCell("Driver"), csvCell(notes.driver)].join(","))
  lines.push([csvCell("Starting point"), csvCell(notes.start)].join(","))
  lines.push([csvCell("Please note"), csvCell(notes.disclaimer)].join(","))
  lines.push([csvCell("Versions"), csvCell(notes.versions)].join(","))
  return `${lines.join("\r\n")}\r\n`
}

export function csvFilename(today: Date = new Date()): string {
  const iso = today.toISOString().slice(0, 10)
  return `notaquote-car-comparison-${iso}.csv`
}
