/**
 * A typical yearly premium for each state, from a public, citable source.
 * It is a starting point for people who don't enter what they pay now. It
 * describes an average insured car in that state, not you.
 *
 * Data: data/state-baselines/state-baselines.json. How it was built:
 * data/state-baselines/README.md.
 */

import baselineFile from "../../data/state-baselines/state-baselines.json"

/** Show this wherever a figure from the file appears. */
export const STATE_BASELINE_ATTRIBUTION =
  "Source: NAIC, 2022/2023 Auto Insurance Database Report, 2023 data"

/** The 50 states and DC, in the calculator's order. */
export const BASELINE_STATE_CODES = [
  "AL", "AK", "AZ", "AR", "CA", "CO", "CT", "DE", "DC", "FL", "GA", "HI", "ID",
  "IL", "IN", "IA", "KS", "KY", "LA", "ME", "MD", "MA", "MI", "MN", "MS", "MO",
  "MT", "NE", "NV", "NH", "NJ", "NM", "NY", "NC", "ND", "OH", "OK", "OR", "PA",
  "RI", "SC", "SD", "TN", "TX", "UT", "VT", "VA", "WA", "WV", "WI", "WY",
] as const

export type BaselineCoverage = "full" | "liability"

export type BaselineSource = {
  id: string
  name: string
  publisher: string
  url: string
  checkedOn: string
  terms: string
}

type BaselineRow = {
  annual: number
  coverage: BaselineCoverage
  sourceId: string
  combinedAveragePremium: number
  liabilityAveragePremium: number
  averageExpenditure: number
}

export type StateBaseline = {
  state: string
  /** Whole dollars a year, rounded from the source's figure. */
  annual: number
  coverage: BaselineCoverage
  /** The same figure as printed in the source, to the cent. */
  exact: number
  /** Average yearly cost of liability coverage alone, as printed. */
  liabilityOnly: number
  /** What drivers spent on average per insured car, as printed. */
  averageExpenditure: number
  dataYear: number
  source: BaselineSource
}

type TrendPoint = { period: string; value: number }

type BaselineFile = {
  version: string
  checkedOn: string
  measure: string
  coverage: BaselineCoverage
  dataYear: number
  sources: BaselineSource[]
  trend: {
    sourceId: string
    applied: boolean
    dataYearAverage: TrendPoint
    latest: TrendPoint
  }
  countrywide: BaselineRow
  states: Record<string, BaselineRow>
}

const WHERE = "data/state-baselines/state-baselines.json"

function isPositive(value: unknown): value is number {
  return typeof value === "number" && Number.isFinite(value) && value > 0
}

function checkRow(label: string, row: BaselineRow | undefined, sourceIds: Set<string>): void {
  if (!row || typeof row !== "object") throw new Error(`${WHERE}: ${label} is missing`)
  for (const key of ["annual", "combinedAveragePremium", "liabilityAveragePremium", "averageExpenditure"] as const) {
    if (!isPositive(row[key])) {
      throw new Error(`${WHERE}: ${label} "${key}" must be a positive number, got ${JSON.stringify(row[key])}`)
    }
  }
  if (!Number.isInteger(row.annual)) throw new Error(`${WHERE}: ${label} "annual" must be whole dollars`)
  if (row.annual !== Math.round(row.combinedAveragePremium)) {
    throw new Error(
      `${WHERE}: ${label} "annual" is ${row.annual}, but "combinedAveragePremium" ${row.combinedAveragePremium} rounds to ${Math.round(row.combinedAveragePremium)}`,
    )
  }
  if (row.coverage !== "full" && row.coverage !== "liability") {
    throw new Error(`${WHERE}: ${label} "coverage" must be "full" or "liability"`)
  }
  if (!sourceIds.has(row.sourceId)) throw new Error(`${WHERE}: ${label} has unknown "sourceId" ${JSON.stringify(row.sourceId)}`)
}

/** Throws with a clear message if the file is malformed. Runs when this module loads. */
export function validateBaselineFile(data: BaselineFile): void {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(data.checkedOn)) throw new Error(`${WHERE}: "checkedOn" must be YYYY-MM-DD`)
  if (data.version !== `state-baselines-${data.checkedOn}`) {
    throw new Error(`${WHERE}: "version" must be "state-baselines-${data.checkedOn}" to match "checkedOn"`)
  }
  if (!Number.isInteger(data.dataYear)) throw new Error(`${WHERE}: "dataYear" must be a year`)
  const sourceIds = new Set<string>()
  for (const source of data.sources) {
    if (!source.id || !source.name || !/^https:\/\//.test(source.url) || !source.terms) {
      throw new Error(`${WHERE}: source ${JSON.stringify(source.id)} needs an id, name, https url, and terms`)
    }
    if (sourceIds.has(source.id)) throw new Error(`${WHERE}: source id ${source.id} appears twice`)
    sourceIds.add(source.id)
  }
  const codes = Object.keys(data.states)
  const expected = new Set<string>(BASELINE_STATE_CODES)
  const missing = BASELINE_STATE_CODES.filter((code) => !(code in data.states))
  const extra = codes.filter((code) => !expected.has(code))
  if (missing.length > 0) throw new Error(`${WHERE}: missing states ${missing.join(", ")}`)
  if (extra.length > 0) throw new Error(`${WHERE}: unknown state codes ${extra.join(", ")}`)
  for (const code of codes) checkRow(code, data.states[code], sourceIds)
  checkRow("countrywide", data.countrywide, sourceIds)
  if (!sourceIds.has(data.trend.sourceId)) throw new Error(`${WHERE}: trend "sourceId" is unknown`)
  if (!isPositive(data.trend.dataYearAverage.value) || !isPositive(data.trend.latest.value)) {
    throw new Error(`${WHERE}: trend values must be positive numbers`)
  }
}

const file = baselineFile as BaselineFile
validateBaselineFile(file)

export const STATE_BASELINES_VERSION: string = file.version

export const STATE_BASELINES_CHECKED_ON: string = file.checkedOn

/** Plain description of what the number measures. */
export const STATE_BASELINE_MEASURE: string = file.measure

export const STATE_BASELINE_DATA_YEAR: number = file.dataYear

export const STATE_BASELINE_SOURCES: readonly BaselineSource[] = file.sources

const SOURCES = new Map(file.sources.map((source) => [source.id, source]))

function toBaseline(state: string, row: BaselineRow): StateBaseline {
  return {
    state,
    annual: row.annual,
    coverage: row.coverage,
    exact: row.combinedAveragePremium,
    liabilityOnly: row.liabilityAveragePremium,
    averageExpenditure: row.averageExpenditure,
    dataYear: file.dataYear,
    source: SOURCES.get(row.sourceId)!,
  }
}

const BY_STATE = new Map(
  BASELINE_STATE_CODES.map((state) => [state as string, toBaseline(state, file.states[state])]),
)

/** The typical yearly premium for a state or DC, or null for an unknown code. */
export function stateBaseline(state: string): StateBaseline | null {
  return BY_STATE.get(state.toUpperCase()) ?? null
}

/** Every state and DC, in the calculator's order. */
export function allStateBaselines(): StateBaseline[] {
  return [...BY_STATE.values()]
}

/** The national figure from the same table. */
export function countrywideBaseline(): StateBaseline {
  return toBaseline("US", file.countrywide)
}

/**
 * Price-trend inputs (BLS CPI, motor vehicle insurance). The figures in this
 * file stay as NAIC printed them (`applied: false` here means this file isn't
 * trended); the factor engine uses latest / dataYearAverage to move a typical
 * start forward to today. It never adjusts a premium the visitor enters.
 */
export function baselineTrendInputs(): {
  series: BaselineSource
  dataYearAverage: TrendPoint
  latest: TrendPoint
  applied: false
} {
  return {
    series: SOURCES.get(file.trend.sourceId)!,
    dataYearAverage: file.trend.dataYearAverage,
    latest: file.trend.latest,
    applied: false,
  }
}
