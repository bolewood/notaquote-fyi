import { CATALOG_DEFAULTS } from "./catalog-defaults"
import { stateMinimumAssumption } from "./state-rules"

export const AGE_BANDS = [
  { id: "16-18", label: "16–18" },
  { id: "19-21", label: "19–21" },
  { id: "22-25", label: "22–25" },
  { id: "26-39", label: "26–39" },
  { id: "40-64", label: "40–64" },
  { id: "65+", label: "65+" },
] as const

export const YEARS_LICENSED = [
  { id: "under-1", label: "Under a year" },
  { id: "1-3", label: "1–3 years" },
  { id: "4-9", label: "4–9 years" },
  { id: "10+", label: "10 years or more" },
] as const

export const INCIDENTS = [
  { id: "clean", label: "No at-fault accidents" },
  { id: "one", label: "One at-fault accident" },
  { id: "two-or-more", label: "Two or more at-fault accidents" },
] as const

export const MILEAGE_BANDS = [
  { id: "under-7500", label: "Under 7,500 miles a year" },
  { id: "7500-15000", label: "7,500–15,000 miles a year" },
  { id: "over-15000", label: "Over 15,000 miles a year" },
] as const

export const REGIONS = [
  { id: "urban", label: "City" },
  { id: "suburban", label: "Suburbs" },
  { id: "rural", label: "Small town or country" },
] as const

export const COVERAGE_PACKAGES = [
  { id: "state-minimum", label: "State minimum" },
  { id: "standard", label: "Liability only" },
  { id: "full", label: "Full coverage" },
  { id: "high", label: "Full coverage, higher limits" },
] as const

export const DEDUCTIBLES = [500, 1000, 2000] as const

export const STATES = [
  { code: "AL", name: "Alabama" },
  { code: "AK", name: "Alaska" },
  { code: "AZ", name: "Arizona" },
  { code: "AR", name: "Arkansas" },
  { code: "CA", name: "California" },
  { code: "CO", name: "Colorado" },
  { code: "CT", name: "Connecticut" },
  { code: "DE", name: "Delaware" },
  { code: "DC", name: "District of Columbia" },
  { code: "FL", name: "Florida" },
  { code: "GA", name: "Georgia" },
  { code: "HI", name: "Hawaii" },
  { code: "ID", name: "Idaho" },
  { code: "IL", name: "Illinois" },
  { code: "IN", name: "Indiana" },
  { code: "IA", name: "Iowa" },
  { code: "KS", name: "Kansas" },
  { code: "KY", name: "Kentucky" },
  { code: "LA", name: "Louisiana" },
  { code: "ME", name: "Maine" },
  { code: "MD", name: "Maryland" },
  { code: "MA", name: "Massachusetts" },
  { code: "MI", name: "Michigan" },
  { code: "MN", name: "Minnesota" },
  { code: "MS", name: "Mississippi" },
  { code: "MO", name: "Missouri" },
  { code: "MT", name: "Montana" },
  { code: "NE", name: "Nebraska" },
  { code: "NV", name: "Nevada" },
  { code: "NH", name: "New Hampshire" },
  { code: "NJ", name: "New Jersey" },
  { code: "NM", name: "New Mexico" },
  { code: "NY", name: "New York" },
  { code: "NC", name: "North Carolina" },
  { code: "ND", name: "North Dakota" },
  { code: "OH", name: "Ohio" },
  { code: "OK", name: "Oklahoma" },
  { code: "OR", name: "Oregon" },
  { code: "PA", name: "Pennsylvania" },
  { code: "RI", name: "Rhode Island" },
  { code: "SC", name: "South Carolina" },
  { code: "SD", name: "South Dakota" },
  { code: "TN", name: "Tennessee" },
  { code: "TX", name: "Texas" },
  { code: "UT", name: "Utah" },
  { code: "VT", name: "Vermont" },
  { code: "VA", name: "Virginia" },
  { code: "WA", name: "Washington" },
  { code: "WV", name: "West Virginia" },
  { code: "WI", name: "Wisconsin" },
  { code: "WY", name: "Wyoming" },
] as const

export type AgeBand = (typeof AGE_BANDS)[number]["id"]
export type YearsLicensed = (typeof YEARS_LICENSED)[number]["id"]
export type Incidents = (typeof INCIDENTS)[number]["id"]
export type MileageBand = (typeof MILEAGE_BANDS)[number]["id"]
export type Region = (typeof REGIONS)[number]["id"]
export type CoverageId = (typeof COVERAGE_PACKAGES)[number]["id"]
export type Deductible = (typeof DEDUCTIBLES)[number]
export type StateCode = (typeof STATES)[number]["code"]

export type Scenario = {
  age: AgeBand
  yearsLicensed: YearsLicensed
  incidents: Incidents
  mileage: MileageBand
  teen: boolean
  goodStudent: boolean
  driverTraining: boolean
  householdPolicy: boolean
  loanLease: boolean
  state: StateCode
  region: Region
  coverage: CoverageId
  deductible: Deductible
  year: number
  make: string
  model: string
  trim: string
}

export const MOLLY: Scenario = {
  age: "40-64",
  yearsLicensed: "10+",
  incidents: "clean",
  mileage: "7500-15000",
  teen: false,
  goodStudent: false,
  driverTraining: false,
  householdPolicy: true,
  loanLease: false,
  state: "IL",
  region: "urban",
  coverage: "full",
  deductible: 1000,
  year: CATALOG_DEFAULTS.molly.year,
  make: CATALOG_DEFAULTS.molly.make,
  model: CATALOG_DEFAULTS.molly.model,
  trim: CATALOG_DEFAULTS.molly.trim,
}

export const JAYDEN: Scenario = {
  age: "16-18",
  yearsLicensed: "under-1",
  incidents: "clean",
  mileage: "7500-15000",
  teen: true,
  goodStudent: true,
  driverTraining: true,
  householdPolicy: true,
  loanLease: false,
  state: "TX",
  region: "suburban",
  coverage: "full",
  deductible: 1000,
  year: CATALOG_DEFAULTS.jayden.year,
  make: CATALOG_DEFAULTS.jayden.make,
  model: CATALOG_DEFAULTS.jayden.model,
  trim: CATALOG_DEFAULTS.jayden.trim,
}

export const AVA: Scenario = {
  age: "26-39",
  yearsLicensed: "4-9",
  incidents: "clean",
  mileage: "7500-15000",
  teen: false,
  goodStudent: false,
  driverTraining: false,
  householdPolicy: false,
  loanLease: false,
  state: "CA",
  region: "urban",
  coverage: "full",
  deductible: 1000,
  year: CATALOG_DEFAULTS.ava.year,
  make: CATALOG_DEFAULTS.ava.make,
  model: CATALOG_DEFAULTS.ava.model,
  trim: CATALOG_DEFAULTS.ava.trim,
}

/**
 * Test fixtures used by the engine's tests and the worked example script.
 * The page doesn't show these names; it offers the starting stories below.
 */
export const PRESETS = {
  molly: MOLLY,
  jayden: JAYDEN,
  ava: AVA,
} as const

const STATE_NAMES = new Map(STATES.map((state) => [state.code, state.name]))

export function stateName(code: StateCode): string {
  return STATE_NAMES.get(code) ?? code
}

export function vehicleLabel(scenario: Pick<Scenario, "year" | "make" | "model" | "trim">): string {
  const name = `${scenario.year} ${scenario.make} ${scenario.model}`
  if (!scenario.trim || scenario.trim === scenario.model) return name
  return `${name}, ${scenario.trim}`
}

/** "2025 Tesla Model Y", without the trim. */
export function shortVehicleLabel(scenario: Pick<Scenario, "year" | "make" | "model">): string {
  return `${scenario.year} ${scenario.make} ${scenario.model}`
}

export function regionLabel(id: Region): string {
  return REGIONS.find((region) => region.id === id)?.label ?? id
}

export function coverageLabel(id: CoverageId): string {
  return COVERAGE_PACKAGES.find((item) => item.id === id)?.label ?? id
}

export function hasPhysicalDamage(coverage: CoverageId): boolean {
  return coverage === "full" || coverage === "high"
}

/** One plain sentence about what a coverage choice includes. */
export function coverageAssumption(coverage: CoverageId, state: StateCode): string {
  switch (coverage) {
    case "state-minimum":
      return stateMinimumAssumption(state)
    case "standard":
      return "Liability only: pays for damage and injuries you cause to others, up to 100/300/100. It doesn't pay to fix your own car."
    case "full":
      return "Full coverage: liability up to 100/300/100, plus collision and comprehensive, which pay to fix or replace your own car."
    case "high":
      return "Full coverage with higher liability limits (250/500/250), plus collision and comprehensive."
  }
}

/** Keep the old `teen` field in step with the age band. The engine ignores it. */
export function withTeenFlag(scenario: Scenario): Scenario {
  const teen = scenario.age === "16-18"
  return scenario.teen === teen ? scenario : { ...scenario, teen }
}

/** "in the Illinois suburbs", "in a city in Texas", "in small-town or rural Ohio" */
export function placeWords(state: StateCode, region: Region): string {
  const name = stateName(state)
  if (region === "urban") return `in a city in ${name}`
  if (region === "suburban") return `in the ${name} suburbs`
  return `in small-town or rural ${name}`
}

/** One sentence about the situation: who, where, what car, what coverage. */
export function situationSentence(scenario: Scenario, teenOnParentPolicy: boolean, withCar = true): string {
  const age = AGE_BANDS.find((band) => band.id === scenario.age)?.label ?? scenario.age
  const who =
    scenario.age === "16-18"
      ? `A ${age}-year-old driver ${teenOnParentPolicy ? "added to a parent's policy" : "on their own policy"}`
      : `A ${age}-year-old driver`
  const car = withCar ? `, a ${shortVehicleLabel(scenario)},` : ""
  const coverage = coverageLabel(scenario.coverage).toLowerCase()
  return `${who} ${placeWords(scenario.state, scenario.region)}${car} with ${coverage}.`
}

// ---------------------------------------------------------------------------
// Common questions, one click each. Each one changes something about the
// visitor's own situation, so it works whatever they've set up.

export type StarterId = "adding-teen" | "thinking-ev" | "moving" | "higher-deductible"

export type StarterTab = "car" | "driver" | "move" | "coverage"

export type Starter = {
  id: StarterId
  /** Short, in the visitor's own words. */
  title: string
  /** One line of story. */
  story: string
  /** Which part of the What-if card it opens. */
  tab: StarterTab
  /** What changes, given the situation now. */
  change: (now: Scenario) => Partial<Scenario>
  /** For a teen starter: price them as added to the parent's policy. */
  teenOnParentPolicy?: boolean
}

const PARENT: Scenario = {
  age: "40-64",
  yearsLicensed: "10+",
  incidents: "clean",
  mileage: "7500-15000",
  teen: false,
  goodStudent: false,
  driverTraining: false,
  householdPolicy: false,
  loanLease: false,
  state: "IL",
  region: "suburban",
  coverage: "full",
  deductible: 1000,
  year: 2020,
  make: "Toyota",
  model: "Camry",
  trim: "Camry",
}

/** What the page opens on before the visitor changes anything. */
export const DEFAULT_SCENARIO: Scenario = PARENT

export const STARTERS: readonly Starter[] = [
  {
    id: "adding-teen",
    title: "Adding our 16-year-old",
    story: "They just got their license. What does adding them to our policy do to the bill?",
    tab: "driver",
    change: () => ({ age: "16-18", yearsLicensed: "under-1", teen: true }),
    teenOnParentPolicy: true,
  },
  {
    id: "thinking-ev",
    title: "Thinking about an electric car",
    story: "What if we traded our car for a Tesla Model Y?",
    tab: "car",
    change: () => ({ year: 2025, make: "Tesla", model: "Model Y", trim: "Model Y Long Range AWD" }),
  },
  {
    id: "moving",
    title: "Moving to another state",
    story: "Would insurance cost more or less if we moved to Colorado?",
    tab: "move",
    change: (now) => ({ state: now.state === "CO" ? "TX" : "CO" }),
  },
  {
    id: "higher-deductible",
    title: "Raising the deductible",
    story: "Would a $2,000 deductible save enough to be worth it?",
    tab: "coverage",
    change: (now) => ({ deductible: now.deductible === 2000 ? 1000 : 2000, coverage: hasPhysicalDamage(now.coverage) ? now.coverage : "full" }),
  },
]

export function starter(id: StarterId): Starter {
  const found = STARTERS.find((item) => item.id === id)
  if (!found) throw new Error(`Unknown starter ${id}`)
  return found
}

export function isAgeBand(value: string): value is AgeBand {
  return AGE_BANDS.some((band) => band.id === value)
}

export function isYearsLicensed(value: string): value is YearsLicensed {
  return YEARS_LICENSED.some((band) => band.id === value)
}

export function isIncidents(value: string): value is Incidents {
  return INCIDENTS.some((band) => band.id === value)
}

export function isMileageBand(value: string): value is MileageBand {
  return MILEAGE_BANDS.some((band) => band.id === value)
}

export function isRegion(value: string): value is Region {
  return REGIONS.some((region) => region.id === value)
}

export function isCoverageId(value: string): value is CoverageId {
  return COVERAGE_PACKAGES.some((item) => item.id === value)
}

export function isStateCode(value: string): value is StateCode {
  return STATE_NAMES.has(value as StateCode)
}

export function isDeductible(value: number): value is Deductible {
  return (DEDUCTIBLES as readonly number[]).includes(value)
}
