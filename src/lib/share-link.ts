/**
 * Share links. A link holds the inputs (driver, place, coverage, cars) and
 * the model and data versions, never a dollar result: whoever opens it gets
 * the numbers recalculated with today's engine. What someone pays now goes
 * into a link only when they tick the box for it, and never into a
 * compare-cars link.
 *
 * Everything goes after the "#" (the fragment), which browsers never send to
 * a server, so no server or CDN log ever sees it. The page reads it in the
 * browser and then removes it from the address bar. Older links that used
 * "?share=" are still read, and are removed from the address the same way.
 */
import { CATALOG_YEAR_MAX, CATALOG_YEAR_MIN } from "./catalog-meta"
import { DATA_BUNDLE_VERSION, MODEL_VERSION } from "./copy"
import {
  DEFAULT_SCENARIO,
  isAgeBand,
  isCoverageId,
  isDeductible,
  isIncidents,
  isMileageBand,
  isRegion,
  isStateCode,
  isYearsLicensed,
  type Scenario,
} from "./scenario"

/** Query keys that would freeze a computed dollar result. Encode never sets them. */
export const FROZEN_RESULT_KEYS = ["low", "likely", "high", "monthly", "result", "dollars", "yearly", "price"] as const

/** At most this many cars in a compare link. */
export const SHARE_CAR_LIMIT = 15

const TEXT_MAX = 200

export type SharePage = "/" | "/compare"

export type ShareCurrent = {
  modelVersion: string
  bundleVersion: string
}

export type SharedCar = { year: number; make: string; model: string; trim: string; starred: boolean }

export type ShareLinkOk = {
  status: "ok"
  /** Set when the What-if page handed its cars to Compare. */
  via: "whatif" | null
  scenario: Scenario
  teenOnParentPolicy: boolean
  /** What the sender pays now, only if they chose to include it. */
  anchorAmount: number | null
  /** The what-if scenario, for a What-if link that had one. */
  next: Scenario | null
  /** The car list, for a compare link. */
  cars: SharedCar[] | null
  linkedModel: string
  linkedBundle: string
  modelMismatch: boolean
  bundleMismatch: boolean
  ignoredFrozenDollars: boolean
}

export type ShareDecode = { status: "absent" } | { status: "invalid" } | ShareLinkOk

export function normalizeAnchor(value: unknown): number | null {
  const numeric = typeof value === "number" ? value : typeof value === "string" && value !== "" ? Number(value) : NaN
  if (!Number.isInteger(numeric) || numeric < 1 || numeric > 100_000) return null
  return numeric
}

function plainText(value: unknown, min: number, max: number): string | null {
  if (typeof value !== "string") return null
  if (value.length < min || value.length > max) return null
  if (/[\u0000-\u001F\u007F|]/.test(value)) return null
  return value
}

/** A year, make, model, and trim from untrusted input, or null. */
export function vehiclePickFromRecord(value: unknown): { year: number; make: string; model: string; trim: string } | null {
  if (!value || typeof value !== "object") return null
  const record = value as Record<string, unknown>
  if (typeof record.year !== "number" || !Number.isInteger(record.year)) return null
  if (record.year < CATALOG_YEAR_MIN || record.year > CATALOG_YEAR_MAX) return null
  const make = plainText(record.make, 1, TEXT_MAX)
  const model = plainText(record.model, 1, TEXT_MAX)
  const trim = plainText(record.trim ?? "", 0, TEXT_MAX)
  if (make === null || model === null || trim === null) return null
  return { year: record.year, make, model, trim }
}

export function scenarioFromRecord(value: unknown): Scenario | null {
  if (!value || typeof value !== "object") return null
  const record = value as Record<string, unknown>
  if (typeof record.age !== "string" || !isAgeBand(record.age)) return null
  if (typeof record.yearsLicensed !== "string" || !isYearsLicensed(record.yearsLicensed)) return null
  if (typeof record.incidents !== "string" || !isIncidents(record.incidents)) return null
  if (typeof record.mileage !== "string" || !isMileageBand(record.mileage)) return null
  if (typeof record.goodStudent !== "boolean") return null
  if (typeof record.driverTraining !== "boolean") return null
  if (typeof record.householdPolicy !== "boolean") return null
  if (typeof record.loanLease !== "boolean") return null
  if (typeof record.state !== "string" || !isStateCode(record.state)) return null
  if (typeof record.region !== "string" || !isRegion(record.region)) return null
  if (typeof record.coverage !== "string" || !isCoverageId(record.coverage)) return null
  if (typeof record.deductible !== "number" || !isDeductible(record.deductible)) return null
  const vehicle = vehiclePickFromRecord(record)
  if (!vehicle) return null

  return {
    age: record.age,
    yearsLicensed: record.yearsLicensed,
    incidents: record.incidents,
    mileage: record.mileage,
    // The engine reads the age band; this old field just follows it.
    teen: record.age === "16-18",
    goodStudent: record.goodStudent,
    driverTraining: record.driverTraining,
    householdPolicy: record.householdPolicy,
    loanLease: record.loanLease,
    state: record.state,
    region: record.region,
    coverage: record.coverage,
    deductible: record.deductible,
    ...vehicle,
  }
}

// ---------------------------------------------------------------------------
// Encode

const DRIVER_PARAMS = [
  ["age", "age"],
  ["years", "yearsLicensed"],
  ["incidents", "incidents"],
  ["mileage", "mileage"],
  ["student", "goodStudent"],
  ["training", "driverTraining"],
  ["household", "householdPolicy"],
  ["loan", "loanLease"],
  ["state", "state"],
  ["region", "region"],
  ["coverage", "coverage"],
  ["deductible", "deductible"],
] as const satisfies readonly (readonly [string, keyof Scenario])[]

function paramValue(value: Scenario[keyof Scenario]): string {
  if (typeof value === "boolean") return value ? "1" : "0"
  return String(value)
}

function carParam(car: { year: number; make: string; model: string; trim: string }): string {
  return [car.year, car.make, car.model, car.trim].join("|")
}

export type ShareInput = {
  page: SharePage
  scenario: Scenario
  teenOnParentPolicy: boolean
  /** What they pay now. Only used when includePremium is true, and never on /compare. */
  premium?: number | null
  includePremium?: boolean
  /** A what-if to open, for the What-if page. */
  next?: Scenario | null
  /** Cars to compare, for /compare. */
  cars?: readonly SharedCar[]
  modelVersion?: string
  bundleVersion?: string
  /** "whatif": the What-if page handing its cars to Compare, not a link from someone else. */
  via?: "whatif"
}

export function encodeSharePath(input: ShareInput): string {
  const scenario = scenarioFromRecord(input.scenario)
  if (!scenario) throw new Error("Share link could not encode this scenario")

  const params = new URLSearchParams()
  params.set("share", "1")
  params.set("mv", input.modelVersion ?? MODEL_VERSION)
  params.set("bv", input.bundleVersion ?? DATA_BUNDLE_VERSION)
  for (const [key, field] of DRIVER_PARAMS) params.set(key, paramValue(scenario[field]))
  params.set("policy", input.teenOnParentPolicy ? "added" : "own")
  if (input.via) params.set("via", input.via)

  if (input.page === "/compare") {
    const cars = (input.cars ?? []).slice(0, SHARE_CAR_LIMIT)
    const starred: number[] = []
    cars.forEach((car, index) => {
      const clean = vehiclePickFromRecord(car)
      if (!clean) throw new Error("Share link could not encode this car")
      params.append("c", carParam(clean))
      if (car.starred) starred.push(index)
    })
    if (starred.length > 0) params.set("star", starred.join("."))
  } else {
    params.set("year", String(scenario.year))
    params.set("make", scenario.make)
    params.set("car", scenario.model)
    params.set("trim", scenario.trim)
    const anchor = input.includePremium ? normalizeAnchor(input.premium ?? null) : null
    if (anchor !== null) params.set("anchor", String(anchor))
    const next = input.next ? scenarioFromRecord(input.next) : null
    if (next) {
      if (carParam(next) !== carParam(scenario)) params.set("to", carParam(next))
      for (const [key, field] of DRIVER_PARAMS) {
        if (next[field] !== scenario[field]) params.set(`w.${key}`, paramValue(next[field]))
      }
    }
  }

  for (const key of FROZEN_RESULT_KEYS) {
    if (params.has(key)) throw new Error(`Share link must not freeze ${key}`)
  }
  return `${input.page}#${params.toString()}`
}

/**
 * The share text in an address: the fragment if it's a share link, or (for
 * older links) the query string. `legacy` is true for the query-string kind.
 */
export function shareFromLocation(hash: string, search: string): { text: string; legacy: boolean } | null {
  const fragment = hash.startsWith("#") ? hash.slice(1) : hash
  if (new URLSearchParams(fragment).has("share")) return { text: fragment, legacy: false }
  const query = search.startsWith("?") ? search.slice(1) : search
  if (new URLSearchParams(query).has("share")) return { text: query, legacy: true }
  return null
}

// ---------------------------------------------------------------------------
// Decode

function flagValue(value: string | null): boolean | null {
  if (value === "1") return true
  if (value === "0") return false
  return null
}

function driverRecord(params: URLSearchParams, prefix = "", base?: Scenario): Record<string, unknown> {
  const read = (key: string) => (params.has(`${prefix}${key}`) ? params.get(`${prefix}${key}`) : base ? null : params.get(key))
  const record: Record<string, unknown> = {}
  for (const [key, field] of DRIVER_PARAMS) {
    const raw = read(key)
    if (raw === null && base) {
      record[field] = base[field]
      continue
    }
    if (field === "goodStudent" || field === "driverTraining" || field === "householdPolicy" || field === "loanLease") {
      record[field] = flagValue(raw)
    } else if (field === "deductible") {
      const amount = Number(raw)
      record[field] = Number.isInteger(amount) ? amount : Number.NaN
    } else {
      record[field] = raw
    }
  }
  return record
}

function carFromParam(value: string): { year: number; make: string; model: string; trim: string } | null {
  const parts = value.split("|")
  if (parts.length !== 4) return null
  const year = Number(parts[0])
  return vehiclePickFromRecord({ year: Number.isInteger(year) ? year : Number.NaN, make: parts[1], model: parts[2], trim: parts[3] })
}

export function decodeShareSearch(
  search: string,
  current: ShareCurrent = { modelVersion: MODEL_VERSION, bundleVersion: DATA_BUNDLE_VERSION },
): ShareDecode {
  const cut = search.search(/[?#]/)
  const query = cut === -1 ? search : search.slice(cut + 1)
  const params = new URLSearchParams(query)
  if (!params.has("share")) return { status: "absent" }
  if (params.get("share") !== "1") return { status: "invalid" }

  const linkedModel = params.get("mv")
  const linkedBundle = params.get("bv")
  if (!linkedModel || !linkedBundle) return { status: "invalid" }
  if (linkedModel.length > 40 || linkedBundle.length > 80) return { status: "invalid" }

  const policy = params.get("policy")
  if (policy !== null && policy !== "added" && policy !== "own") return { status: "invalid" }
  const teenOnParentPolicy = policy !== "own"

  const carParams = params.getAll("c")
  let cars: SharedCar[] | null = null
  if (carParams.length > 0) {
    if (carParams.length > SHARE_CAR_LIMIT) return { status: "invalid" }
    const starred = new Set(
      (params.get("star") ?? "")
        .split(".")
        .filter(Boolean)
        .map(Number),
    )
    cars = []
    for (const [index, raw] of carParams.entries()) {
      const car = carFromParam(raw)
      if (!car) return { status: "invalid" }
      cars.push({ ...car, starred: starred.has(index) })
    }
  }

  const year = Number(params.get("year"))
  const vehicle = params.has("make")
    ? {
        year: Number.isInteger(year) ? year : Number.NaN,
        make: params.get("make"),
        model: params.get("car"),
        trim: params.get("trim") ?? "",
      }
    : cars
      ? { year: DEFAULT_SCENARIO.year, make: DEFAULT_SCENARIO.make, model: DEFAULT_SCENARIO.model, trim: DEFAULT_SCENARIO.trim }
      : null
  if (!vehicle) return { status: "invalid" }
  const scenario = scenarioFromRecord({ ...driverRecord(params), ...vehicle })
  if (!scenario) return { status: "invalid" }

  let next: Scenario | null = null
  const hasWhatIf = params.has("to") || [...params.keys()].some((key) => key.startsWith("w."))
  if (hasWhatIf) {
    const to = params.get("to")
    const nextCar = to === null ? scenario : carFromParam(to)
    if (!nextCar) return { status: "invalid" }
    next = scenarioFromRecord({
      ...driverRecord(params, "w.", scenario),
      year: nextCar.year,
      make: nextCar.make,
      model: nextCar.model,
      trim: nextCar.trim,
    })
    if (!next) return { status: "invalid" }
  }

  let anchorAmount: number | null = null
  if (params.has("anchor")) {
    anchorAmount = normalizeAnchor(params.get("anchor"))
    if (anchorAmount === null) return { status: "invalid" }
  }

  return {
    status: "ok",
    via: params.get("via") === "whatif" ? "whatif" : null,
    scenario,
    teenOnParentPolicy,
    anchorAmount,
    next,
    cars,
    linkedModel,
    linkedBundle,
    modelMismatch: linkedModel !== current.modelVersion,
    bundleMismatch: linkedBundle !== current.bundleVersion,
    ignoredFrozenDollars: FROZEN_RESULT_KEYS.some((key) => params.has(key)),
  }
}

/** What to tell someone who opened a shared link, in plain words. */
export function shareArrivalNotes(
  link: ShareLinkOk,
  current: ShareCurrent = { modelVersion: MODEL_VERSION, bundleVersion: DATA_BUNDLE_VERSION },
): string[] {
  const notes = [
    "You opened a shared link. The link holds the choices, not the prices, so we worked out every number fresh.",
  ]
  if (link.modelMismatch) {
    notes.push(
      `This link was made with an older version of our math (${link.linkedModel}). These numbers use today's version (${current.modelVersion}), so they may differ from what the sender saw.`,
    )
  } else if (link.bundleMismatch) {
    notes.push("Our data has been updated since this link was made, so the numbers may differ a little from what the sender saw.")
  }
  if (link.ignoredFrozenDollars) {
    notes.push("The link had dollar amounts in it. We ignored them and worked the numbers out again.")
  }
  if (link.anchorAmount !== null) {
    notes.push("The sender included what they pay now, so we started from that.")
  }
  return notes
}

export const SHARE_INVALID_NOTE =
  "We couldn't read that shared link, so we opened the page with its usual starting point."
