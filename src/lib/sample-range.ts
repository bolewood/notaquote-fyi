import {
  hasPhysicalDamage,
  type CoverageId,
  type Scenario,
  type StateCode,
} from "./scenario"

/**
 * Illustrative sample arithmetic for sprint 1.
 * These weights are arbitrary display numbers so a reviewer can see controls
 * move a labeled sample. They are not insurance factors, relativities, or
 * published premiums.
 */

export const SAMPLE_BASE_ANNUAL = 2400

export const CREDIT_FACTOR = 1

export const AGE_WEIGHT = {
  "16-18": 2.4,
  "19-21": 1.8,
  "22-25": 1.32,
  "26-39": 1.1,
  "40-64": 1,
  "65+": 1.08,
} as const

export const YEARS_WEIGHT = {
  "under-1": 1.25,
  "1-3": 1.12,
  "4-9": 1,
  "10+": 0.94,
} as const

export const INCIDENT_WEIGHT = {
  clean: 1,
  one: 1.35,
  "two-or-more": 1.7,
} as const

export const MILEAGE_WEIGHT = {
  "under-7500": 0.92,
  "7500-15000": 1,
  "over-15000": 1.12,
} as const

export const FLAG_WEIGHT = {
  teen: 1.15,
  goodStudent: 0.9,
  driverTraining: 0.92,
  householdPolicy: 0.88,
  loanLease: 1.08,
} as const

export const PRESET_STATE_WEIGHT: Partial<Record<StateCode, number>> = {
  IL: 1,
  TX: 1.06,
  CA: 1.18,
}

export const OTHER_STATE_WEIGHT = 1

export const REGION_WEIGHT = {
  urban: 1.08,
  suburban: 1,
  rural: 0.94,
} as const

export const COVERAGE_WEIGHT: Record<CoverageId, number> = {
  "state-minimum": 0.55,
  standard: 0.72,
  full: 1,
  high: 1.28,
}

export const DEDUCTIBLE_WEIGHT = {
  500: 1.08,
  1000: 1,
  2000: 0.9,
} as const

export const VEHICLE_WEIGHT = {
  f150: 1.18,
  rav4: 1,
  "model-y-lr": 1.24,
} as const

export const YEAR_WEIGHT_RECENT = 1
export const YEAR_WEIGHT_MID = 0.96
export const YEAR_WEIGHT_OLDER = 0.92

export const SPREAD_BASE_LOW = 0.72
export const SPREAD_BASE_HIGH = 1.36
export const SPREAD_UNCLEARED_LOW = 0.08
export const SPREAD_UNCLEARED_HIGH = 0.16
export const SPREAD_NEW_DRIVER_LOW = 0.04
export const SPREAD_NEW_DRIVER_HIGH = 0.12
export const SPREAD_ONE_INCIDENT_HIGH = 0.04
export const SPREAD_REPEAT_INCIDENT_LOW = 0.04
export const SPREAD_REPEAT_INCIDENT_HIGH = 0.1
export const SPREAD_OTHER_STATE_HIGH = 0.06
export const SPREAD_STATE_MINIMUM_HIGH = 0.06
export const SPREAD_MODEL_Y_HIGH = 0.08

export type Anchor = {
  amount: number
  weight: number
}

export type SampleRange = {
  low: number
  likely: number
  high: number
  monthly: number
  weight: number
  anchored: boolean
}

export function stateDisplayWeight(state: StateCode): number {
  return PRESET_STATE_WEIGHT[state] ?? OTHER_STATE_WEIGHT
}

export function yearDisplayWeight(year: number): number {
  if (year >= 2022) return YEAR_WEIGHT_RECENT
  if (year >= 2019) return YEAR_WEIGHT_MID
  return YEAR_WEIGHT_OLDER
}

export function sampleWeight(scenario: Scenario): number {
  const deductibleWeight = hasPhysicalDamage(scenario.coverage)
    ? DEDUCTIBLE_WEIGHT[scenario.deductible]
    : 1

  return (
    AGE_WEIGHT[scenario.age] *
    YEARS_WEIGHT[scenario.yearsLicensed] *
    INCIDENT_WEIGHT[scenario.incidents] *
    MILEAGE_WEIGHT[scenario.mileage] *
    (scenario.teen ? FLAG_WEIGHT.teen : 1) *
    (scenario.goodStudent ? FLAG_WEIGHT.goodStudent : 1) *
    (scenario.driverTraining ? FLAG_WEIGHT.driverTraining : 1) *
    (scenario.householdPolicy ? FLAG_WEIGHT.householdPolicy : 1) *
    (scenario.loanLease ? FLAG_WEIGHT.loanLease : 1) *
    stateDisplayWeight(scenario.state) *
    REGION_WEIGHT[scenario.region] *
    COVERAGE_WEIGHT[scenario.coverage] *
    deductibleWeight *
    VEHICLE_WEIGHT[scenario.vehicle] *
    yearDisplayWeight(scenario.year) *
    CREDIT_FACTOR
  )
}

export function spreadRatios(scenario: Scenario): { low: number; high: number } {
  let low = SPREAD_BASE_LOW - SPREAD_UNCLEARED_LOW
  let high = SPREAD_BASE_HIGH + SPREAD_UNCLEARED_HIGH

  if (scenario.age === "16-18" || scenario.yearsLicensed === "under-1") {
    low -= SPREAD_NEW_DRIVER_LOW
    high += SPREAD_NEW_DRIVER_HIGH
  }

  if (scenario.incidents === "one") {
    high += SPREAD_ONE_INCIDENT_HIGH
  }

  if (scenario.incidents === "two-or-more") {
    low -= SPREAD_REPEAT_INCIDENT_LOW
    high += SPREAD_REPEAT_INCIDENT_HIGH
  }

  if (PRESET_STATE_WEIGHT[scenario.state] === undefined) {
    high += SPREAD_OTHER_STATE_HIGH
  }

  if (scenario.coverage === "state-minimum") {
    high += SPREAD_STATE_MINIMUM_HIGH
  }

  if (scenario.vehicle === "model-y-lr") {
    high += SPREAD_MODEL_Y_HIGH
  }

  return { low, high }
}

export function roundToTen(value: number): number {
  return Math.round(value / 10) * 10
}

export function buildSampleRange(
  scenario: Scenario,
  anchor: Anchor | null,
): SampleRange {
  const weight = sampleWeight(scenario)
  const ratios = spreadRatios(scenario)
  const anchoredAtEntry = anchor !== null && weight === anchor.weight
  const unrounded =
    anchor === null ? SAMPLE_BASE_ANNUAL * weight : anchor.amount * (weight / anchor.weight)
  const likely = anchoredAtEntry ? anchor.amount : roundToTen(unrounded)
  let low = roundToTen(likely * ratios.low)
  let high = roundToTen(likely * ratios.high)

  if (low >= likely) low = likely - 10
  if (high <= likely) high = likely + 10

  return {
    low,
    likely,
    high,
    monthly: Math.round(likely / 12),
    weight,
    anchored: anchor !== null,
  }
}

export function parseAnnualPremium(raw: string): number | null {
  const trimmed = raw.trim()
  if (trimmed === "") return null
  const cleaned = trimmed.replace(/[$,\s]/g, "")
  if (!/^\d+$/.test(cleaned)) return null
  const value = Number(cleaned)
  if (!Number.isInteger(value) || value < 1 || value > 100_000) return null
  return value
}

export function formatDollars(amount: number): string {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 0,
  }).format(amount)
}
