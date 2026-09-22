/**
 * A typical yearly premium for each state, from a public, citable source.
 * It is a starting point for people who don't enter what they pay now. It
 * describes an average insured car in that state, not you.
 *
 * Data: src/data/state-baselines.json. How it was built:
 * data/state-baselines/README.md.
 */

import baselineFile from "@/data/state-baselines.json"

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

const file = baselineFile as BaselineFile

export const STATE_BASELINES_VERSION: string = file.version

export const STATE_BASELINES_CHECKED_ON: string = file.checkedOn

/** Plain description of what the number measures. */
export const STATE_BASELINE_MEASURE: string = file.measure

export const STATE_BASELINE_DATA_YEAR: number = file.dataYear

export const STATE_BASELINE_SOURCES: readonly BaselineSource[] = file.sources

const SOURCES = new Map(file.sources.map((source) => [source.id, source]))

function toBaseline(state: string, row: BaselineRow): StateBaseline {
  const source = SOURCES.get(row.sourceId)
  if (!source) throw new Error(`state-baselines.json ${state}: unknown sourceId ${row.sourceId}`)
  return {
    state,
    annual: row.annual,
    coverage: row.coverage,
    exact: row.combinedAveragePremium,
    liabilityOnly: row.liabilityAveragePremium,
    averageExpenditure: row.averageExpenditure,
    dataYear: file.dataYear,
    source,
  }
}

const BY_STATE = new Map(
  Object.entries(file.states).map(([state, row]) => [state, toBaseline(state, row)]),
)

/** The typical yearly premium for a state or DC, or null for an unknown code. */
export function stateBaseline(state: string): StateBaseline | null {
  return BY_STATE.get(state.toUpperCase()) ?? null
}

/** Every state and DC, in the file's order. */
export function allStateBaselines(): StateBaseline[] {
  return [...BY_STATE.values()]
}

/** The national figure from the same table. */
export function countrywideBaseline(): StateBaseline {
  return toBaseline("US", file.countrywide)
}

/**
 * Optional price-trend inputs (BLS CPI, motor vehicle insurance). Recorded,
 * not applied anywhere. latest / dataYearAverage is a rough multiplier for
 * how much insurance prices moved since the data year.
 */
export function baselineTrendInputs(): {
  series: BaselineSource
  dataYearAverage: TrendPoint
  latest: TrendPoint
  applied: false
} {
  const series = SOURCES.get(file.trend.sourceId)
  if (!series) throw new Error("state-baselines.json: trend source missing")
  return {
    series,
    dataYearAverage: file.trend.dataYearAverage,
    latest: file.trend.latest,
    applied: false,
  }
}
