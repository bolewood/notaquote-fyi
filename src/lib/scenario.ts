export const AGE_BANDS = [
  { id: "16-18", label: "16–18" },
  { id: "19-21", label: "19–21" },
  { id: "22-25", label: "22–25" },
  { id: "26-39", label: "26–39" },
  { id: "40-64", label: "40–64" },
  { id: "65+", label: "65+" },
] as const

export const YEARS_LICENSED = [
  { id: "under-1", label: "Under 1" },
  { id: "1-3", label: "1–3" },
  { id: "4-9", label: "4–9" },
  { id: "10+", label: "10+" },
] as const

export const INCIDENTS = [
  { id: "clean", label: "Clean" },
  { id: "one", label: "One" },
  { id: "two-or-more", label: "Two or more" },
] as const

export const MILEAGE_BANDS = [
  { id: "under-7500", label: "Under 7,500" },
  { id: "7500-15000", label: "7,500–15,000" },
  { id: "over-15000", label: "Over 15,000" },
] as const

export const REGIONS = [
  { id: "urban", label: "Urban" },
  { id: "suburban", label: "Suburban" },
  { id: "rural", label: "Rural" },
] as const

export const COVERAGE_PACKAGES = [
  { id: "state-minimum", label: "State minimum" },
  { id: "standard", label: "Standard liability" },
  { id: "full", label: "Full coverage" },
  { id: "high", label: "High limits" },
] as const

export const DEDUCTIBLES = [500, 1000, 2000] as const

export const VEHICLES = [
  { id: "f150", label: "Ford F-150" },
  { id: "rav4", label: "Toyota RAV4" },
  { id: "model-y-lr", label: "Tesla Model Y Long Range" },
] as const

/** The three stand-ins, split into controls. Not a catalog snapshot. */
export const MAKES = [
  { id: "ford", label: "Ford" },
  { id: "toyota", label: "Toyota" },
  { id: "tesla", label: "Tesla" },
] as const

export const MODELS = [
  { id: "f-150", makeId: "ford", label: "F-150", vehicle: "f150" },
  { id: "rav4", makeId: "toyota", label: "RAV4", vehicle: "rav4" },
  { id: "model-y", makeId: "tesla", label: "Model Y", vehicle: "model-y-lr" },
] as const

export const TRIMS = [
  {
    id: "f150-trim-unavailable",
    modelId: "f-150",
    label: "Trim confidence unavailable",
    confidence: "unavailable",
  },
  {
    id: "rav4-trim-unavailable",
    modelId: "rav4",
    label: "Trim confidence unavailable",
    confidence: "unavailable",
  },
  {
    id: "model-y-long-range",
    modelId: "model-y",
    label: "Long Range",
    confidence: "unavailable",
  },
] as const

export const MODEL_YEARS = [
  2018, 2019, 2020, 2021, 2022, 2023, 2024, 2025, 2026,
] as const

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
export type VehicleId = (typeof VEHICLES)[number]["id"]
export type MakeId = (typeof MAKES)[number]["id"]
export type ModelId = (typeof MODELS)[number]["id"]
export type TrimId = (typeof TRIMS)[number]["id"]
export type ModelYear = (typeof MODEL_YEARS)[number]
export type StateCode = (typeof STATES)[number]["code"]
export type PersonaId = "molly" | "jayden" | "ava"

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
  vehicle: VehicleId
  year: ModelYear
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
  vehicle: "f150",
  year: 2023,
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
  vehicle: "rav4",
  year: 2023,
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
  vehicle: "model-y-lr",
  year: 2023,
}

export const PRESETS: Record<PersonaId, Scenario> = {
  molly: MOLLY,
  jayden: JAYDEN,
  ava: AVA,
}

export const PERSONA_DETAILS: Record<
  PersonaId,
  { name: string; summary: string }
> = {
  molly: {
    name: "Molly",
    summary: "40–64 · Illinois urban · F-150 · household policy",
  },
  jayden: {
    name: "Jayden",
    summary: "16–18 · teen · good student · driver training · RAV4",
  },
  ava: {
    name: "Ava",
    summary: "26–39 · California urban · Model Y · credit unreviewed",
  },
}

const STATE_NAMES = new Map(STATES.map((state) => [state.code, state.name]))

export function stateName(code: StateCode): string {
  return STATE_NAMES.get(code) ?? code
}

export function vehicleLabel(id: VehicleId): string {
  return VEHICLES.find((vehicle) => vehicle.id === id)?.label ?? id
}

export function vehicleParts(id: VehicleId): {
  makeId: MakeId
  modelId: ModelId
  trimId: TrimId
  makeLabel: string
  modelLabel: string
  trimLabel: string
  trimConfidence: "unavailable"
} {
  const model = MODELS.find((item) => item.vehicle === id) ?? MODELS[0]
  const make = MAKES.find((item) => item.id === model.makeId) ?? MAKES[0]
  const trim = TRIMS.find((item) => item.modelId === model.id) ?? TRIMS[0]
  return {
    makeId: make.id,
    modelId: model.id,
    trimId: trim.id,
    makeLabel: make.label,
    modelLabel: model.label,
    trimLabel: trim.label,
    trimConfidence: "unavailable",
  }
}

export function vehicleIdForMake(makeId: MakeId): VehicleId {
  return MODELS.find((model) => model.makeId === makeId)?.vehicle ?? "f150"
}

export function vehicleIdForModel(modelId: ModelId): VehicleId {
  return MODELS.find((model) => model.id === modelId)?.vehicle ?? "f150"
}

export function regionLabel(id: Region): string {
  return REGIONS.find((region) => region.id === id)?.label ?? id
}

export function hasPhysicalDamage(coverage: CoverageId): boolean {
  return coverage === "full" || coverage === "high"
}

export function coverageAssumption(coverage: CoverageId): string {
  switch (coverage) {
    case "state-minimum":
      return "State minimum. Assumption: this state’s required liability. Dollar minimums load with the sourced state-rules table, which is not in this version. No comprehensive or collision."
    case "standard":
      return "Standard liability. Assumption: 100/300/100. No comprehensive or collision."
    case "full":
      return "Full coverage. Assumption: 100/300/100, plus comprehensive and collision."
    case "high":
      return "High limits. Assumption: 250/500/250, plus comprehensive and collision."
  }
}

export function scenarioIdentity(
  scenario: Scenario,
  persona: PersonaId | null,
): string {
  const who =
    persona === null ? "Custom scenario" : PERSONA_DETAILS[persona].name
  const place =
    persona === "molly"
      ? "Illinois, urban stand-in for Springfield"
      : `${stateName(scenario.state)}, ${regionLabel(scenario.region).toLowerCase()}`
  const vehicle = `${scenario.year} ${vehicleLabel(scenario.vehicle)}`
  const coverage = coverageAssumption(scenario.coverage)
  const deductible = hasPhysicalDamage(scenario.coverage)
    ? `$${scenario.deductible.toLocaleString("en-US")} deductible`
    : "Deductible not applied"

  return `${who} · ${place} · ${vehicle} · ${coverage} · ${deductible}`
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

export function isVehicleId(value: string): value is VehicleId {
  return VEHICLES.some((vehicle) => vehicle.id === value)
}

export function isStateCode(value: string): value is StateCode {
  return STATE_NAMES.has(value as StateCode)
}

export function isModelYear(value: number): value is ModelYear {
  return (MODEL_YEARS as readonly number[]).includes(value)
}

export function isDeductible(value: number): value is Deductible {
  return (DEDUCTIBLES as readonly number[]).includes(value)
}
