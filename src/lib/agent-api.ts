/**
 * The read-only JSON API for AI assistants and other programs (/api/v1).
 *
 * Every dollar figure comes from the same engine and the same page helpers
 * the site uses (src/lib/pricing.ts, src/lib/factor-engine.ts,
 * src/lib/compare-table.ts), rounded the same way (src/lib/format.ts), so the
 * API and the page always agree. The handlers here are plain functions from
 * query parameters to { status, body }; the route files in src/app/api/v1
 * only wrap them in a Response.
 *
 * Privacy: the only inputs are a state, a few bands (age, coverage, and so
 * on), and car names. There is no field for what someone pays, a VIN, a ZIP
 * code, a name, or anything else personal, and a request that tries to send
 * one is turned away. Nothing is stored or logged by this code.
 */
import type { VehicleCatalog, VehiclePick } from "./catalog"
import { CATALOG_VERSION, DATA_BUNDLE_VERSION, DISCLAIMER, MANIFEST_VERSION, MODEL_VERSION, SITE_ORIGIN } from "./copy"
import {
  DEFAULT_SORT,
  buildRows,
  compareAnswer,
  gapsToCheapest,
  sortRows,
  type CompareMode,
  type CompareRow,
} from "./compare-table"
import { vehicleFacts } from "./catalog-class"
import { DEFAULT_SITUATION, type Situation } from "./situation"
import { FACTOR_BUNDLE, typicalStart, type Estimate, type StartingPoint } from "./factor-engine"
import { differenceWords, rangeEnds, shownMonthly, shownYearly } from "./format"
import {
  distinctReasons,
  driverOnlyEstimate,
  parentFor,
  priceCars,
  priceCarsTeenAdded,
  priceWhatIf,
  reasonParts,
  sourceLinks,
  startLine,
  vehicleReasonParts,
} from "./pricing"
import {
  AGE_BANDS,
  ageChange,
  COVERAGE_PACKAGES,
  DEDUCTIBLES,
  DEFAULT_SCENARIO,
  hasPhysicalDamage,
  INCIDENTS,
  isAgeBand,
  MILEAGE_BANDS,
  REGIONS,
  situationSentence,
  STATES,
  stateName,
  withTeenFlag,
  YEARS_LICENSED,
  type AgeBand,
  type Scenario,
  type StateCode,
} from "./scenario"
import { encodeSharePath } from "./share-link"
import { STATE_BASELINE_SOURCES, STATE_BASELINES_VERSION } from "./state-baselines"
import {
  claimsDataOf,
  DEFAULT_MODEL_YEAR,
  describeCar,
  expandPreset,
  isUnresolved,
  PRESET_NAMES,
  popularCars,
  resolveCarInput,
  searchCars,
  type ResolvedCar,
  type Unresolved,
} from "./agent-cars"
import { catalogYears } from "./catalog"
import { COMPARE_LIMIT } from "./compare-list"

export { SITE_ORIGIN }
export const API_VERSION = "v1"
export const API_BASE = "/api/v1"

/** The longest query string we read, in characters. */
export const QUERY_MAX = 3000
/** The longest single car name or search, in characters. */
export const CAR_TEXT_MAX = 120
export const SEARCH_LIMIT_MAX = 50

export const CACHE_CONTROL = "public, s-maxage=86400, stale-while-revalidate=604800"
export const ERROR_CACHE_CONTROL = "public, s-maxage=3600"

export type ApiResult = { status: number; body: unknown }

export const VERSIONS = {
  api: API_VERSION,
  model: MODEL_VERSION,
  factors: DATA_BUNDLE_VERSION,
  catalog: CATALOG_VERSION,
  stateBaselines: STATE_BASELINES_VERSION,
  sources: MANIFEST_VERSION,
} as const

export const HOW_TO_READ = [
  "These are planning estimates, not quotes. Only an insurer can give a real price.",
  "Show the range (low to high), not just the middle figure. Real quotes can land above or below it.",
  "Say where the numbers start: a typical price for the state, from NAIC, brought up to today.",
  "Figures are already rounded the way the site shows them: yearly to $10, monthly to $5 (the yearly figure divided by 12), and ranges to $50.",
  "Insurance cost is one input. Safety ratings, reliability, and fit matter too; this API doesn't cover them.",
] as const

// ---------------------------------------------------------------------------
// Errors

type ErrorCode =
  | "unknown_parameter"
  | "private_input_rejected"
  | "invalid_value"
  | "missing_parameter"
  | "duplicate_parameter"
  | "too_many_cars"
  | "car_not_found"
  | "request_too_long"
  | "not_found"

export class ApiError extends Error {
  constructor(
    public status: number,
    public code: ErrorCode,
    message: string,
    public hint: string,
    public extra: Record<string, unknown> = {},
  ) {
    super(message)
  }
}

export function errorBody(error: ApiError): ApiResult {
  return {
    status: error.status,
    body: {
      error: {
        status: error.status,
        code: error.code,
        message: error.message,
        hint: error.hint,
        ...error.extra,
        docs: `${SITE_ORIGIN}${API_BASE}`,
        guide: `${SITE_ORIGIN}/llms.txt`,
      },
    },
  }
}

function run(handler: () => ApiResult): ApiResult {
  try {
    return handler()
  } catch (error) {
    if (error instanceof ApiError) return errorBody(error)
    throw error
  }
}

// ---------------------------------------------------------------------------
// Parameters

type ParamSpec = {
  name: string
  /** Allowed values, when there is a fixed list. */
  values?: readonly string[]
  default?: string
  description: string
}

const onOff = ["0", "1"] as const

const DRIVER_PARAMS: readonly ParamSpec[] = [
  { name: "state", values: STATES.map((item) => item.code), default: DEFAULT_SCENARIO.state, description: "Two-letter state code, or DC. Full names like \"Illinois\" work too." },
  { name: "age", values: AGE_BANDS.map((band) => band.id), description: "The driver's age band. A single age like 16 or 45 is turned into its band. For 65+, send 65." },
  { name: "policy", values: ["added", "own"], description: "For a 16–18-year-old: \"added\" to a parent's policy (the usual case, and the default) or on their \"own\" policy. Only applies to age 16-18." },
  { name: "coverage", values: COVERAGE_PACKAGES.map((item) => item.id), default: DEFAULT_SCENARIO.coverage, description: "state-minimum: the state's legal minimum. standard: liability only, 100/300/100. full: liability plus collision and comprehensive. high: full with 250/500/250 limits." },
  { name: "deductible", values: DEDUCTIBLES.map(String), default: String(DEFAULT_SCENARIO.deductible), description: "What you pay yourself before collision or comprehensive pays. Only matters with full or high coverage." },
  { name: "region", values: REGIONS.map((item) => item.id), default: DEFAULT_SCENARIO.region, description: "Where the car is kept: city, suburbs, or small town or country." },
  { name: "years", values: YEARS_LICENSED.map((item) => item.id), description: "Years licensed. Only counts from age 26. For 10+, send 10. Default: under-1 for 16–18, 1-3 for 19–21, 4-9 for 22–25, otherwise 10+." },
  { name: "incidents", values: INCIDENTS.map((item) => item.id), default: DEFAULT_SCENARIO.incidents, description: "At-fault accidents in the last three years." },
  { name: "mileage", values: MILEAGE_BANDS.map((item) => item.id), default: DEFAULT_SCENARIO.mileage, description: "Miles driven a year." },
  { name: "student", values: onOff, default: "0", description: "Good-student discount (under 26)." },
  { name: "training", values: onOff, default: "0", description: "Driver-training discount (under 22)." },
  { name: "household", values: onOff, default: "0", description: "Bundled with home or renters insurance." },
  { name: "loan", values: onOff, default: "0", description: "The car has a loan or lease (only matters with full or high coverage)." },
]

function withDefaults(specs: readonly ParamSpec[], defaults: Record<string, string>): ParamSpec[] {
  return specs.map((spec) => (spec.name in defaults ? { ...spec, default: defaults[spec.name] } : spec))
}

export const CARS_PARAMS: readonly ParamSpec[] = [
  { name: "q", description: "What to search for: \"civic\", \"2022 honda civic\", \"model y\", \"f150\". Leave it out to get the site's popular lists." },
  { name: "year", default: String(DEFAULT_MODEL_YEAR), description: "Model year. A year inside q wins. Without either we use 2022, about the age of a typical first car (or the nearest year that has the car)." },
  { name: "limit", default: "10", description: `How many models to return, 1 to ${SEARCH_LIMIT_MAX}.` },
]

export const COMPARE_PARAMS: readonly ParamSpec[] = [
  { name: "cars", description: `Required. Up to ${COMPARE_LIMIT} cars, separated by commas: ids from /api/v1/cars (best), names like "2024 Tesla Model Y", or one of the site's lists: ${PRESET_NAMES.join(", ")} (for the model year in \`year\`). You can also repeat cars=.` },
  ...withDefaults(DRIVER_PARAMS, { age: "16-18" }),
  { name: "year", default: String(DEFAULT_MODEL_YEAR), description: "Model year for car names that don't include one." },
]

export const WHATIF_PARAMS: readonly ParamSpec[] = [
  ...withDefaults(DRIVER_PARAMS, { age: DEFAULT_SCENARIO.age }),
  { name: "car", default: "2020-toyota-camry", description: "The car you have now: an id or a name like \"2020 Toyota Camry\"." },
  { name: "to", description: "A car to switch to: an id or a name like \"2025 Tesla Model Y\"." },
  { name: "toState", values: STATES.map((item) => item.code), description: "Move to another state." },
  { name: "toRegion", values: REGIONS.map((item) => item.id), description: "Move to a city, the suburbs, or a small town." },
  { name: "toCoverage", values: COVERAGE_PACKAGES.map((item) => item.id), description: "Change coverage." },
  { name: "toDeductible", values: DEDUCTIBLES.map(String), description: "Change the deductible." },
  { name: "toAge", values: AGE_BANDS.map((band) => band.id), description: "Change the driver's age band. toAge=16-18 adds a new teen driver (see policy)." },
  { name: "toIncidents", values: INCIDENTS.map((item) => item.id), description: "Change the driving record." },
  { name: "toMileage", values: MILEAGE_BANDS.map((item) => item.id), description: "Change the miles driven." },
]

/**
 * Names we never accept, because they'd carry something personal. Checked
 * after lowercasing and dropping anything that isn't a letter or digit.
 */
const PRIVATE_NAMES = new Set([
  "premium", "anchor", "price", "pay", "paying", "currentpremium", "cost", "amount", "rate",
  "vin", "zip", "zipcode", "postal", "postalcode", "postcode", "address", "street", "city", "county", "lat", "lon", "lng", "latitude", "longitude", "location",
  "name", "firstname", "lastname", "fullname", "email", "phone", "tel", "dob", "birthdate", "birthday",
  "license", "licensenumber", "dl", "ssn", "policynumber", "plate", "licenseplate",
  "credit", "creditscore", "gender", "sex", "marital", "maritalstatus",
])

function canonical(name: string): string {
  return name.toLowerCase().replace(/[^a-z0-9]/g, "")
}

const PRIVATE_HINT =
  "Leave it out. This API only takes a state, a few bands (age, coverage, deductible, and so on), and car names. It never takes what you pay, a VIN, a ZIP code, a name, or anything else personal."

/** VIN, ZIP, email, phone, or a dollar amount inside a car name. */
function personalInText(value: string): string | null {
  const text = value.normalize("NFKC")
  if (/\$\s*\d/.test(text)) return "a dollar amount"
  if (/[^\s@]+@[^\s@]+\.[^\s@]+/.test(text)) return "an email address"
  if (/(?:\d[\s().-]*){10,}/.test(text.replace(/\b(19|20)\d\d\b/g, " "))) return "a phone number"
  for (const token of text.split(/[\s,|]+/)) {
    if (/^[A-HJ-NPR-Z0-9]{17}$/i.test(token) && (token.match(/\d/g) ?? []).length >= 3) return "a VIN"
    if (/^\d{5}(-\d{4})?$/.test(token)) return "a ZIP code"
  }
  return null
}

type Query = {
  get(name: string): string | undefined
  getAll(name: string): string[]
  has(name: string): boolean
}

/**
 * Check the query against the parameters an endpoint takes: nothing
 * personal, nothing unknown, nothing repeated (except `repeatable`), nothing
 * too long. Names match without regard to case, dashes, or underscores.
 */
export function readQuery(search: URLSearchParams, specs: readonly ParamSpec[], repeatable: readonly string[] = []): Query {
  if (search.toString().length > QUERY_MAX) {
    throw new ApiError(414, "request_too_long", "That request is too long.", `Keep the query under ${QUERY_MAX} characters. Compare at most ${COMPARE_LIMIT} cars at a time.`)
  }
  const byCanonical = new Map(specs.map((spec) => [canonical(spec.name), spec.name]))
  const values = new Map<string, string[]>()
  for (const [rawName, value] of search.entries()) {
    const key = canonical(rawName)
    if (PRIVATE_NAMES.has(key)) {
      throw new ApiError(400, "private_input_rejected", `We don't accept "${rawName}".`, PRIVATE_HINT, {
        validParameters: specs.map((spec) => spec.name),
      })
    }
    const name = byCanonical.get(key)
    if (!name) {
      throw new ApiError(400, "unknown_parameter", `Unknown parameter "${rawName}".`, `Use only these: ${specs.map((spec) => spec.name).join(", ")}.`, {
        validParameters: specs.map((spec) => spec.name),
      })
    }
    const list = values.get(name) ?? []
    list.push(value)
    values.set(name, list)
  }
  for (const [name, list] of values) {
    if (list.length > 1 && !repeatable.includes(name)) {
      throw new ApiError(400, "duplicate_parameter", `"${name}" appears ${list.length} times.`, `Send "${name}" once.`)
    }
  }
  return {
    get: (name) => values.get(name)?.[0],
    getAll: (name) => values.get(name) ?? [],
    has: (name) => values.has(name),
  }
}

function invalid(name: string, value: string, allowed: readonly string[], extraHint = ""): ApiError {
  return new ApiError(400, "invalid_value", `"${value}" isn't a valid ${name}.`, `Use one of: ${allowed.join(", ")}.${extraHint ? ` ${extraHint}` : ""}`, {
    parameter: name,
    allowedValues: allowed,
  })
}

const STATE_BY_NAME = new Map(STATES.map((item) => [canonical(item.name), item.code]))

function parseState(name: string, value: string): StateCode {
  const upper = value.trim().toUpperCase()
  const byCode = STATES.find((item) => item.code === upper)
  if (byCode) return byCode.code
  const byName = STATE_BY_NAME.get(canonical(value))
  if (byName) return byName
  throw invalid(name, value, STATES.map((item) => item.code), "Full names like \"Illinois\" work too.")
}

function parseAge(name: string, value: string): AgeBand {
  const text = value.trim().toLowerCase().replace(/\s+/g, "")
  if (isAgeBand(text)) return text
  if (/^65(\+|plus|-plus|andup|orolder)?$/.test(text)) return "65+"
  if (/^\d{1,3}$/.test(text)) {
    const age = Number(text)
    if (age >= 16 && age <= 120) {
      if (age <= 18) return "16-18"
      if (age <= 21) return "19-21"
      if (age <= 25) return "22-25"
      if (age <= 39) return "26-39"
      if (age <= 64) return "40-64"
      return "65+"
    }
  }
  throw invalid(name, value, AGE_BANDS.map((band) => band.id), "A single age from 16 up works too; for 65+, send 65.")
}

function parseChoice<T extends string>(name: string, value: string, allowed: readonly T[], aliases: Record<string, T> = {}): T {
  const text = value.trim().toLowerCase()
  const found = allowed.find((item) => item.toLowerCase() === text) ?? aliases[text]
  if (found) return found
  throw invalid(name, value, allowed)
}

function parseFlag(name: string, value: string): boolean {
  const text = value.trim().toLowerCase()
  if (["1", "true", "yes", "on"].includes(text)) return true
  if (["0", "false", "no", "off"].includes(text)) return false
  throw invalid(name, value, ["0", "1"])
}

function parseDeductible(name: string, value: string): Scenario["deductible"] {
  const amount = Number(value.trim().replace(/[$,]/g, ""))
  const found = DEDUCTIBLES.find((item) => item === amount)
  if (found) return found
  throw invalid(name, value, DEDUCTIBLES.map(String))
}

const YEARS_IDS = YEARS_LICENSED.map((item) => item.id)
const COVERAGE_IDS = COVERAGE_PACKAGES.map((item) => item.id)
const COVERAGE_ALIASES: Record<string, Scenario["coverage"]> = {
  liability: "standard",
  "liability-only": "standard",
  minimum: "state-minimum",
  "full-coverage": "full",
}

type Driver = { scenario: Scenario; policy: "added" | "own"; defaultsUsed: string[] }

/** The driver, place, and coverage, with the site's defaults for anything left out. */
function parseDriver(query: Query, base: Scenario, defaultAge: AgeBand): Driver {
  const defaultsUsed: string[] = []
  const read = <T>(name: string, parse: (value: string) => T, fallback: T): T => {
    const value = query.get(name)
    if (value === undefined || value.trim() === "") {
      defaultsUsed.push(name)
      return fallback
    }
    return parse(value)
  }
  const age = read("age", (value) => parseAge("age", value), defaultAge)
  const scenario: Scenario = {
    ...base,
    age,
    state: read("state", (value) => parseState("state", value), base.state),
    coverage: read("coverage", (value) => parseChoice("coverage", value, COVERAGE_IDS, COVERAGE_ALIASES), base.coverage),
    deductible: read("deductible", (value) => parseDeductible("deductible", value), base.deductible),
    region: read("region", (value) => parseChoice("region", value, REGIONS.map((item) => item.id), { city: "urban", suburbs: "suburban", suburb: "suburban", country: "rural", town: "rural" }), base.region),
    yearsLicensed: read(
      "years",
      (value) => parseChoice("years", value, YEARS_IDS, { "10": "10+", "10-plus": "10+", "10plus": "10+", "10 ": "10+", "0": "under-1" }),
      age === "16-18" ? "under-1" : age === "19-21" ? "1-3" : age === "22-25" ? "4-9" : "10+",
    ),
    incidents: read("incidents", (value) => parseChoice("incidents", value, INCIDENTS.map((item) => item.id), { none: "clean", "0": "clean", "1": "one", "2": "two-or-more" }), base.incidents),
    mileage: read("mileage", (value) => parseChoice("mileage", value, MILEAGE_BANDS.map((item) => item.id)), base.mileage),
    goodStudent: read("student", (value) => parseFlag("student", value), false),
    driverTraining: read("training", (value) => parseFlag("training", value), false),
    householdPolicy: read("household", (value) => parseFlag("household", value), false),
    loanLease: read("loan", (value) => parseFlag("loan", value), false),
  }
  const policyValue = query.get("policy")
  let policy: "added" | "own"
  if (policyValue === undefined || policyValue.trim() === "") {
    defaultsUsed.push("policy")
    policy = age === "16-18" ? "added" : "own"
  } else {
    policy = parseChoice("policy", policyValue, ["added", "own"] as const)
  }
  return { scenario: withTeenFlag(scenario), policy, defaultsUsed }
}

function checkCarText(name: string, value: string): string {
  const text = value.trim()
  if (text.length > CAR_TEXT_MAX) {
    throw new ApiError(400, "invalid_value", `"${name}" is too long.`, `Keep each car name under ${CAR_TEXT_MAX} characters.`, { parameter: name })
  }
  const personal = personalInText(text)
  if (personal) {
    throw new ApiError(400, "private_input_rejected", `"${name}" looks like it holds ${personal}.`, PRIVATE_HINT, { parameter: name })
  }
  return text
}

function parseYear(catalog: VehicleCatalog, name: string, value: string | undefined): number | null {
  if (value === undefined || value.trim() === "") return null
  const years = catalogYears(catalog)
  const year = Number(value.trim())
  if (!Number.isInteger(year) || !years.includes(year)) {
    throw new ApiError(400, "invalid_value", `"${value}" isn't a model year we have.`, `Use a model year from ${years.at(-1)} to ${years[0]}.`, { parameter: name })
  }
  return year
}

function carNotFound(problems: Unresolved[]): ApiError {
  return new ApiError(
    400,
    "car_not_found",
    problems.length === 1 ? `We couldn't find "${problems[0].input}".` : `We couldn't find ${problems.length} of those cars.`,
    "Look the car up with /api/v1/cars?q=<make and model> and send its id. A model year helps.",
    { unresolved: problems },
  )
}

function resolveOne(catalog: VehicleCatalog, name: string, value: string, defaultYear: number): ResolvedCar {
  const result = resolveCarInput(catalog, checkCarText(name, value), defaultYear)
  if (isUnresolved(result)) throw carNotFound([result])
  return result
}

// ---------------------------------------------------------------------------
// Shared response pieces

function yearlyFigures(estimate: Pick<Estimate, "likely" | "low" | "high">) {
  const range = rangeEnds(estimate.low, estimate.high)
  return {
    yearly: Math.max(10, shownYearly(estimate.likely)),
    monthly: Math.max(5, shownMonthly(estimate.likely)),
    range: { low: range.low, high: range.high },
  }
}

function money(amount: number): string {
  return `$${amount.toLocaleString("en-US")}`
}

function startingPointBody(start: StartingPoint) {
  return {
    kind: start.kind,
    yearly: shownYearly(start.annual),
    description: start.label ?? null,
    attribution: startLine(start),
  }
}

function sourcesFor(ids: Iterable<string>) {
  const all = new Set<string>(ids)
  for (const id of FACTOR_BUNDLE.typicalStart.sources) all.add(id)
  const links = sourceLinks([...all]).map((source) => ({ name: `${source.publisher}: ${source.title}`, url: source.url }))
  const naic = STATE_BASELINE_SOURCES.find((source) => source.id === "naic-auto-db-2022-2023")
  if (naic && !links.some((link) => link.url === naic.url)) links.push({ name: `${naic.publisher}: ${naic.name}`, url: naic.url })
  return links
}

function driverEcho(driver: Driver) {
  const scenario = driver.scenario
  return {
    state: scenario.state,
    stateName: stateName(scenario.state),
    age: scenario.age,
    policy: scenario.age === "16-18" ? driver.policy : "own",
    coverage: scenario.coverage,
    deductible: scenario.deductible,
    region: scenario.region,
    years: scenario.yearsLicensed,
    incidents: scenario.incidents,
    mileage: scenario.mileage,
    student: scenario.goodStudent ? 1 : 0,
    training: scenario.driverTraining ? 1 : 0,
    household: scenario.householdPolicy ? 1 : 0,
    loan: scenario.loanLease ? 1 : 0,
    description: situationSentence(scenario, driver.policy === "added", false),
    defaultsUsed: driver.defaultsUsed,
  }
}

function resolutionEcho(car: ResolvedCar) {
  return {
    input: car.input,
    resolvedAs: car.resolvedAs,
    confidence: car.confidence,
    ...(car.note ? { note: car.note } : {}),
    ...(car.alternatives.length > 0 ? { alternatives: car.alternatives } : {}),
  }
}

// ---------------------------------------------------------------------------
// GET /api/v1/cars

export function handleCars(catalog: VehicleCatalog, search: URLSearchParams): ApiResult {
  return run(() => {
    const query = readQuery(search, CARS_PARAMS)
    const rawQ = query.get("q")?.trim() ?? ""
    const q = rawQ ? checkCarText("q", rawQ) : ""
    const explicitYear = parseYear(catalog, "year", query.get("year"))
    const limitText = query.get("limit")
    const limit = limitText === undefined || limitText.trim() === "" ? 10 : Number(limitText)
    if (!Number.isInteger(limit) || limit < 1 || limit > SEARCH_LIMIT_MAX) {
      throw new ApiError(400, "invalid_value", `"${limitText}" isn't a valid limit.`, `Use a whole number from 1 to ${SEARCH_LIMIT_MAX}.`, { parameter: "limit" })
    }
    const years = catalogYears(catalog)
    const words = q.replace(/[-_/]+/g, " ").trim()
    const typedYear = (() => {
      const match = /(?:^|\s)((?:19[89]|20\d)\d)(?:\s|$)/.exec(words)
      return match ? Number(match[1]) : null
    })()
    if (typedYear !== null && !years.includes(typedYear)) {
      throw new ApiError(400, "invalid_value", `We don't have ${typedYear} models.`, `Use a model year from ${years.at(-1)} to ${years[0]}.`, { parameter: "q" })
    }
    const text = words.replace(/(?:^|\s)(?:19[89]|20\d)\d(?=\s|$)/g, " ").trim()
    let year = typedYear ?? explicitYear ?? DEFAULT_MODEL_YEAR

    if (!text) {
      return {
        status: 200,
        body: {
          query: { q: q || null, year, limit },
          popular: popularCars(catalog, year),
          next: "Pick cars and send their ids to /api/v1/compare?cars=<id>,<id>,...",
          yearsAvailable: { first: years.at(-1), last: years[0] },
          versions: VERSIONS,
        },
      }
    }

    let matches = searchCars(catalog, year, text, limit)
    let note: string | null = null
    if (matches.length === 0) {
      const withHits = years.filter((candidate) => candidate !== year && searchCars(catalog, candidate, text, 1).length > 0)
      if (withHits.length > 0 && typedYear === null && explicitYear === null) {
        const nearest = [...withHits].sort((left, right) => Math.abs(left - year) - Math.abs(right - year) || right - left)[0]
        note = `Nothing matches in ${year}, so these are ${nearest} models.`
        year = nearest
        matches = searchCars(catalog, year, text, limit)
      } else if (withHits.length > 0) {
        note = `Nothing matches in ${year}. Try one of these model years: ${withHits.slice(0, 8).join(", ")}.`
      } else {
        note = "Nothing in our catalog matches. Try the make and model, like \"honda civic\"."
      }
    }
    return {
      status: 200,
      body: {
        query: { q, year, limit },
        count: matches.length,
        matches,
        ...(note ? { note } : {}),
        next: "Send ids to /api/v1/compare?cars=<id>,<id>,... (up to 15).",
        versions: VERSIONS,
      },
    }
  })
}

// ---------------------------------------------------------------------------
// GET /api/v1/compare

export function handleCompare(catalog: VehicleCatalog, search: URLSearchParams): ApiResult {
  return run(() => {
    const query = readQuery(search, COMPARE_PARAMS, ["cars"])
    const base: Scenario = { ...DEFAULT_SCENARIO, age: "16-18", yearsLicensed: "under-1" }
    const driver = parseDriver(query, base, "16-18")
    if (driver.policy === "added" && driver.scenario.age !== "16-18" && query.has("policy")) {
      throw new ApiError(400, "invalid_value", "policy=added is for a 16–18-year-old.", "Use age=16-18 with policy=added, or leave policy out for older drivers (they're priced on their own policy).", { parameter: "policy" })
    }
    const defaultYear = parseYear(catalog, "year", query.get("year")) ?? DEFAULT_MODEL_YEAR

    const inputs = query
      .getAll("cars")
      .flatMap((value) => value.split(","))
      .map((value) => value.trim())
      .filter(Boolean)
      .flatMap((value) => expandPreset(catalog, value, defaultYear) ?? [value])
    if (inputs.length === 0) {
      throw new ApiError(400, "missing_parameter", "Add some cars to compare.", "Send cars=<id>,<id>,... with ids from /api/v1/cars, or names like \"2022 Honda Civic\".", { parameter: "cars" })
    }
    if (inputs.length > COMPARE_LIMIT) {
      throw new ApiError(400, "too_many_cars", `That's ${inputs.length} cars; the most is ${COMPARE_LIMIT}.`, `Send at most ${COMPARE_LIMIT} cars. Split a longer list into two requests with the same driver.`)
    }
    const found: ResolvedCar[] = []
    const problems: Unresolved[] = []
    for (const input of inputs) {
      const result = resolveCarInput(catalog, checkCarText("cars", input), defaultYear)
      if (isUnresolved(result)) problems.push(result)
      else found.push(result)
    }
    if (problems.length > 0) throw carNotFound(problems)
    const seen = new Set<string>()
    const duplicates: string[] = []
    const cars = found.filter((car) => {
      if (seen.has(car.id)) {
        duplicates.push(car.input)
        return false
      }
      seen.add(car.id)
      return true
    })

    // The same steps as the Compare page (src/components/compare-cars.tsx).
    const scenario = driver.scenario
    const mode: CompareMode = scenario.age === "16-18" && driver.policy === "added" ? "added" : "own"
    const situation: Situation = DEFAULT_SITUATION
    const parent = parentFor(scenario, situation)
    const start = mode === "added" ? typicalStart(parent, { teenOnParentPolicy: true }) : typicalStart(scenario)
    if (!start) throw new Error(`No typical price for ${scenario.state}`)
    const picks: VehiclePick[] = cars.map((car) => car.pick)
    const facts = picks.map((pick) => vehicleFacts(catalog, pick))
    const teen = mode === "added" ? priceCarsTeenAdded(start, parent, facts) : null
    const priced = teen
      ? teen.map((item) => ({ estimate: item.after, extra: item.increase }))
      : priceCars(start, scenario, facts).map((item) => ({ estimate: item.estimate, extra: null }))
    const reasons = distinctReasons(priced.map((item, index) => reasonParts(item.estimate, picks[index].year, scenario)))
    const rows = buildRows(priced, picks.map((pick) => ({ ...pick, starred: false })), reasons)
    const sorted = sortRows(rows, DEFAULT_SORT)
    const { gaps, cheapest } = gapsToCheapest(rows)
    const age = AGE_BANDS.find((band) => band.id === scenario.age)?.label ?? scenario.age
    const who = `For a ${age}-year-old in ${stateName(scenario.state)}${mode === "added" ? ", added to your policy" : ""}`
    const summary =
      compareAnswer(rows, mode, who) ??
      (rows.length === 1 ? oneCarSummary(rows[0], mode, who) : null)
    const driverNotes = driverOnlyEstimate(start, scenario, mode === "added" ? parent : null).rangePoints

    const results = sorted.map((row, rank) =>
      carResult(catalog, row, rank, {
        car: cars[row.order],
        estimate: priced[row.order].estimate,
        before: teen?.[row.order]?.before ?? null,
        gaps,
        cheapest,
        driverNotes,
        mode,
        driver: scenario,
      }),
    )

    const sourceIds = new Set<string>()
    for (const item of priced) for (const step of item.estimate.steps) for (const id of step.sources) sourceIds.add(id)

    const notes = [...driverNotes]
    if (duplicates.length > 0) notes.push(`We left out repeats: ${duplicates.join(", ")}.`)

    const sitePath = encodeSharePath({
      page: "/compare",
      scenario: { ...scenario, year: DEFAULT_SCENARIO.year, make: DEFAULT_SCENARIO.make, model: DEFAULT_SCENARIO.model, trim: DEFAULT_SCENARIO.trim },
      teenOnParentPolicy: driver.policy === "added",
      cars: picks.map((pick) => ({ ...pick, starred: false })),
    })

    return {
      status: 200,
      body: {
        summary,
        driver: driverEcho(driver),
        mode,
        rankedBy: mode === "added" ? "teenAdds.yearly (what adding the teen costs a year with each car)" : "yearly (the yearly estimate for each car)",
        startingPoint: startingPointBody(start),
        results,
        notes,
        howToRead: HOW_TO_READ,
        disclaimer: DISCLAIMER,
        sources: sourcesFor(sourceIds),
        siteUrl: `${SITE_ORIGIN}${sitePath}`,
        methodology: `${SITE_ORIGIN}/methodology`,
        versions: VERSIONS,
      },
    }
  })
}

function oneCarSummary(row: CompareRow, mode: CompareMode, who: string): string {
  if (mode === "added" && row.extra !== null) return `${who}, a ${row.name} adds about ${differenceWords(row.extra)}.`
  return `${who}, a ${row.name} costs about ${money(Math.max(10, shownYearly(row.likely)))} a year.`
}

type RowContext = {
  car: ResolvedCar
  estimate: Estimate
  /** In "added" mode, the household's policy before the teen. */
  before: Estimate | null
  gaps: Map<string, number>
  cheapest: CompareRow | null
  driverNotes: readonly string[]
  mode: CompareMode
  driver: Scenario
}

function carResult(catalog: VehicleCatalog, row: CompareRow, rank: number, context: RowContext) {
  const { car, estimate, before, gaps, cheapest, driverNotes, mode, driver } = context
  const summary = describeCar(catalog, row.car)
  const figures = yearlyFigures(row)
  const gap = gaps.get(row.key) ?? 0
  const base = {
    rank: rank + 1,
    ...summary,
    resolution: resolutionEcho(car),
  }
  const why = row.reason
  const whyVsAverageCar = vehicleReasonParts(estimate.vehicle, hasPhysicalDamage(driver.coverage), row.car.year)
  const gapToCheapest = {
    yearly: gap,
    words: !cheapest || cheapest.key === row.key ? "The cheapest here" : Math.round(gap / 10) === 0 ? `Same as the ${cheapest.car.model}` : `${money(gap)} more a year than the ${cheapest.name}`,
  }
  const rangeNotes = row.rangePoints.filter((point) => !driverNotes.includes(point))
  if (mode === "added" && row.extra !== null) {
    const extra = row.extra
    return {
      ...base,
      teenAdds: {
        yearly: shownYearly(extra),
        monthly: Math.max(5, shownMonthly(extra)),
        words: `about ${differenceWords(extra)} (about ${money(Math.max(5, shownMonthly(extra)))} a month)`,
      },
      wholePolicy: {
        ...figures,
        words: `about ${money(figures.yearly)} a year for the whole policy with your teen, roughly ${money(figures.range.low)}–${money(figures.range.high)}`,
        withoutTeen: before ? Math.max(10, shownYearly(before.likely)) : null,
      },
      gapToCheapest,
      why,
      whyVsAverageCar,
      rangeNotes,
      explanation: row.summary,
    }
  }
  return {
    ...base,
    ...figures,
    words: `about ${money(figures.yearly)} a year (about ${money(figures.monthly)} a month), roughly ${money(figures.range.low)}–${money(figures.range.high)}`,
    gapToCheapest,
    why,
    whyVsAverageCar,
    rangeNotes,
    explanation: row.summary,
  }
}

// ---------------------------------------------------------------------------
// GET /api/v1/whatif

export function handleWhatIf(catalog: VehicleCatalog, search: URLSearchParams): ApiResult {
  return run(() => {
    const query = readQuery(search, WHATIF_PARAMS)
    const driver = parseDriver(query, DEFAULT_SCENARIO, DEFAULT_SCENARIO.age)
    const nowCar = query.get("car")?.trim()
      ? resolveOne(catalog, "car", query.get("car")!, DEFAULT_MODEL_YEAR)
      : resolveOne(catalog, "car", "2020|Toyota|Camry|Camry", DEFAULT_MODEL_YEAR)
    if (!query.get("car")?.trim()) driver.defaultsUsed.push("car")
    const now: Scenario = withTeenFlag({ ...driver.scenario, ...nowCar.pick })

    let next: Scenario = { ...now }
    const changes: string[] = []
    let nextCar: ResolvedCar | null = null
    const to = query.get("to")
    if (to?.trim()) {
      nextCar = resolveOne(catalog, "to", to, DEFAULT_MODEL_YEAR)
      next = { ...next, ...nextCar.pick }
      changes.push("to")
    }
    const set = <K extends keyof Scenario>(name: string, key: K, parse: (value: string) => Scenario[K]) => {
      const value = query.get(name)
      if (value === undefined || value.trim() === "") return
      next = { ...next, [key]: parse(value) }
      changes.push(name)
    }
    set("toState", "state", (value) => parseState("toState", value))
    set("toRegion", "region", (value) => parseChoice("toRegion", value, REGIONS.map((item) => item.id), { city: "urban", suburbs: "suburban", country: "rural" }))
    set("toCoverage", "coverage", (value) => parseChoice("toCoverage", value, COVERAGE_IDS, COVERAGE_ALIASES))
    set("toDeductible", "deductible", (value) => parseDeductible("toDeductible", value))
    set("toIncidents", "incidents", (value) => parseChoice("toIncidents", value, INCIDENTS.map((item) => item.id), { none: "clean", "0": "clean", "1": "one", "2": "two-or-more" }))
    set("toMileage", "mileage", (value) => parseChoice("toMileage", value, MILEAGE_BANDS.map((item) => item.id)))
    const toAge = query.get("toAge")
    if (toAge?.trim()) {
      const age = parseAge("toAge", toAge)
      next = { ...next, ...ageChange(next, age) } as Scenario
      changes.push("toAge")
    }
    next = withTeenFlag(next)
    if (changes.length === 0) {
      throw new ApiError(400, "missing_parameter", "Tell us what to change.", "Add at least one of: to (a car), toState, toRegion, toCoverage, toDeductible, toAge, toIncidents, toMileage. To add a teen driver: toAge=16-18&policy=added.")
    }
    // "Now" is always the policyholder's own policy; a teen joins it only as a what-if.
    const policyGiven = query.has("policy")
    if (now.age === "16-18" && policyGiven && driver.policy === "added") {
      throw new ApiError(400, "invalid_value", "policy=added adds a teen to an adult's policy.", "Set age to the parent's age band (say 40-64) and add the teen with toAge=16-18&policy=added.", { parameter: "policy" })
    }
    const teenOnParentPolicy = now.age !== "16-18" && next.age === "16-18" && (!policyGiven || driver.policy === "added")

    const situation: Situation = { scenario: now, teenOnParentPolicy, premium: null }
    const nowFacts = vehicleFacts(catalog, now)
    const nextFacts = vehicleFacts(catalog, next)
    const result = priceWhatIf(situation, nowFacts, next, nextFacts, (nextCar ?? nowCar).trimConfidence)
    const start = typicalStart(now)
    if (!result || !start) throw new Error(`No typical price for ${now.state}`)

    const sourceIds = new Set<string>()
    for (const step of [...result.current.steps, ...result.next.steps]) for (const id of step.sources) sourceIds.add(id)
    const sitePath = encodeSharePath({ page: "/", scenario: now, teenOnParentPolicy: situation.teenOnParentPolicy, next })
    const nowFigures = yearlyFigures(result.current)
    const nextFigures = yearlyFigures(result.next)
    const separate = result.mode === "teen-own"
    const echo = driverEcho({ ...driver, policy: "own" })

    return {
      status: 200,
      body: {
        headline: result.headline,
        mode: result.mode,
        modeMeaning:
          result.mode === "teen-added"
            ? "Both figures are the whole household policy, before and after adding the teen."
            : result.mode === "teen-own"
              ? "The new driver gets a separate policy. `next` is their bill, on top of `now`, so there is no difference to add up."
              : "The same policy before and after the change.",
        driver: echo,
        now: {
          car: { ...describeCar(catalog, nowCar.pick), resolution: resolutionEcho(nowCar) },
          ...nowFigures,
          explanation: result.current.summary,
        },
        next: {
          car: nextCar ? { ...describeCar(catalog, nextCar.pick), resolution: resolutionEcho(nextCar) } : null,
          changed: changes,
          state: next.state,
          region: next.region,
          coverage: next.coverage,
          deductible: next.deductible,
          age: next.age,
          ...(next.age === "16-18" && now.age !== "16-18" ? { policy: teenOnParentPolicy ? "added" : "own" } : {}),
          incidents: next.incidents,
          mileage: next.mileage,
          ...nextFigures,
          explanation: result.next.summary,
        },
        difference: separate
          ? null
          : {
              yearly: result.deltaRounded,
              monthly: Math.sign(result.delta) * Math.max(0, shownMonthly(Math.abs(result.delta))),
              words: differenceWords(result.delta),
              parts: result.parts
                .filter((part) => Math.round(part.amount / 10) !== 0)
                .map((part) => ({ label: part.label, yearly: shownYearly(part.amount) })),
              partsNote: "Each part is worked out one change at a time, so the unrounded parts add up to the difference; rounded to $10, they can be off by a little.",
            },
        startingPoint: startingPointBody(start),
        claimsData: {
          now: claimsDataOf(result.current.vehicle.level),
          next: claimsDataOf(result.next.vehicle.level),
        },
        notes: result.next.rangePoints,
        howToRead: HOW_TO_READ,
        disclaimer: DISCLAIMER,
        sources: sourcesFor(sourceIds),
        siteUrl: `${SITE_ORIGIN}${sitePath}`,
        methodology: `${SITE_ORIGIN}/methodology`,
        versions: VERSIONS,
      },
    }
  })
}

// ---------------------------------------------------------------------------
// GET /api/v1 (the index)

export const EXAMPLES = {
  cars: [
    "/api/v1/cars",
    "/api/v1/cars?q=2022%20honda%20civic",
    "/api/v1/cars?q=model%20y&year=2024",
    "/api/v1/cars?q=f150",
  ],
  compare: [
    "/api/v1/compare?state=IL&age=16-18&policy=added&cars=2022-honda-civic-4dr,2022-toyota-corolla,2022-subaru-crosstrek-awd,2022-mazda-3-4-door-2wd,2022-hyundai-kona-awd",
    "/api/v1/compare?state=TX&age=16-18&policy=own&coverage=standard&cars=2022%20Honda%20Civic,2022%20Toyota%20Camry,2022%20Ford%20Mustang",
    "/api/v1/compare?state=CA&age=40-64&coverage=full&deductible=500&cars=2024%20Tesla%20Model%20Y,2024%20Toyota%20RAV4",
  ],
  whatif: [
    "/api/v1/whatif?state=IL&age=40-64&car=2020-toyota-camry&to=2025%20Tesla%20Model%20Y",
    "/api/v1/whatif?state=IL&age=40-64&car=2020-toyota-camry&toAge=16-18&policy=added",
    "/api/v1/whatif?state=IL&age=40-64&car=2020-toyota-camry&toState=CO",
    "/api/v1/whatif?state=OH&age=26-39&car=2021%20Honda%20CR-V&toDeductible=2000",
  ],
} as const

function paramDocs(specs: readonly ParamSpec[]) {
  return specs.map((spec) => ({
    name: spec.name,
    ...(spec.values ? { values: spec.values } : {}),
    ...(spec.default !== undefined ? { default: spec.default } : {}),
    description: spec.description,
  }))
}

export function apiIndex() {
  return {
    name: "NotAQuote.FYI API",
    description:
      "Free, read-only planning estimates of US car insurance: compare up to 15 cars for one driver, or see what one change (a car, a teen, a move, coverage) does to a typical bill. Same math as notaquote.fyi. Not a quote.",
    guide: `${SITE_ORIGIN}/llms.txt`,
    fullGuide: `${SITE_ORIGIN}/llms-full.txt`,
    methodology: `${SITE_ORIGIN}/methodology`,
    sourcesPage: `${SITE_ORIGIN}/sources`,
    site: SITE_ORIGIN,
    code: "https://github.com/bolewood/notaquote-fyi",
    endpoints: [
      {
        path: `${API_BASE}/cars`,
        method: "GET",
        purpose: "Find cars and their ids. With no q, returns the site's popular lists (first cars, SUVs, trucks and fun ones).",
        parameters: paramDocs(CARS_PARAMS),
        examples: EXAMPLES.cars.map((path) => `${SITE_ORIGIN}${path}`),
      },
      {
        path: `${API_BASE}/compare`,
        method: "GET",
        purpose:
          "Price up to 15 cars for one driver, cheapest first. For a 16–18-year-old added to a parent's policy (the default), each car shows what adding the teen costs a year (teenAdds) and the whole policy's range.",
        parameters: paramDocs(COMPARE_PARAMS),
        examples: EXAMPLES.compare.map((path) => `${SITE_ORIGIN}${path}`),
      },
      {
        path: `${API_BASE}/whatif`,
        method: "GET",
        purpose: "What one or more changes do to a typical yearly bill, piece by piece.",
        parameters: paramDocs(WHATIF_PARAMS),
        examples: EXAMPLES.whatif.map((path) => `${SITE_ORIGIN}${path}`),
      },
    ],
    privacy:
      "Inputs are a state, a few bands, and car names only. There is no way to send what you pay, a VIN, a ZIP code, a name, or anything personal, and requests that try are rejected. We don't store or log what you ask beyond the hosting platform's standard request logs.",
    errors: "Errors are JSON: { error: { status, code, message, hint } }. The hint says how to fix the request. Unknown parameters are rejected, with the valid ones listed.",
    caching: `Responses depend only on the inputs and the data versions, so they're cached for a day (Cache-Control: ${CACHE_CONTROL}); errors for an hour. CORS is open (Access-Control-Allow-Origin: *).`,
    rateLimits: "No key needed. Please keep it to about one request a second; repeat requests are served from cache.",
    howToRead: HOW_TO_READ,
    disclaimer: DISCLAIMER,
    licenses: {
      code: "MIT",
      data: "CC BY 4.0 (credit NotAQuote.FYI). Typical state prices: NAIC. Car claims results: HLDI. Third-party sources keep their own terms.",
      page: `${SITE_ORIGIN}/data-licenses`,
    },
    versions: VERSIONS,
  }
}

export function handleIndex(search: URLSearchParams): ApiResult {
  return run(() => {
    readQuery(search, [])
    return { status: 200, body: apiIndex() }
  })
}

export function handleNotFound(path: string): ApiResult {
  return errorBody(
    new ApiError(404, "not_found", `There's nothing at ${path}.`, `Start at ${API_BASE}: it lists every endpoint with examples. Endpoints: ${API_BASE}/cars, ${API_BASE}/compare, ${API_BASE}/whatif.`),
  )
}
