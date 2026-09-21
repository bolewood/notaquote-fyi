import { CATALOG_YEAR_MAX, CATALOG_YEAR_MIN } from "./catalog-meta"
import { DATA_BUNDLE_VERSION, MODEL_VERSION } from "./copy"
import {
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
export const FROZEN_RESULT_KEYS = ["low", "likely", "high", "monthly", "result", "dollars"] as const

const TEXT_MAX = 200

export type ShareCurrent = {
  modelVersion: string
  bundleVersion: string
}

export type ShareLinkOk = {
  status: "ok"
  scenario: Scenario
  anchorAmount: number | null
  linkedModel: string
  linkedBundle: string
  modelMismatch: boolean
  bundleMismatch: boolean
  ignoredFrozenDollars: boolean
}

export type ShareDecode =
  | { status: "absent" }
  | { status: "invalid" }
  | ShareLinkOk

export function normalizeAnchor(value: unknown): number | null {
  const numeric = typeof value === "number" ? value : typeof value === "string" ? Number(value) : NaN
  if (!Number.isInteger(numeric) || numeric < 1 || numeric > 100_000) return null
  return numeric
}

export function scenarioFromRecord(value: unknown): Scenario | null {
  if (!value || typeof value !== "object") return null
  const record = value as Record<string, unknown>
  if (typeof record.age !== "string" || !isAgeBand(record.age)) return null
  if (typeof record.yearsLicensed !== "string" || !isYearsLicensed(record.yearsLicensed)) return null
  if (typeof record.incidents !== "string" || !isIncidents(record.incidents)) return null
  if (typeof record.mileage !== "string" || !isMileageBand(record.mileage)) return null
  if (typeof record.teen !== "boolean") return null
  if (typeof record.goodStudent !== "boolean") return null
  if (typeof record.driverTraining !== "boolean") return null
  if (typeof record.householdPolicy !== "boolean") return null
  if (typeof record.loanLease !== "boolean") return null
  if (typeof record.state !== "string" || !isStateCode(record.state)) return null
  if (typeof record.region !== "string" || !isRegion(record.region)) return null
  if (typeof record.coverage !== "string" || !isCoverageId(record.coverage)) return null
  if (typeof record.deductible !== "number" || !isDeductible(record.deductible)) return null
  if (typeof record.year !== "number" || !Number.isInteger(record.year)) return null
  if (record.year < CATALOG_YEAR_MIN || record.year > CATALOG_YEAR_MAX) return null
  const make = plainText(record.make, 1, TEXT_MAX)
  const model = plainText(record.model, 1, TEXT_MAX)
  const trim = plainText(record.trim, 0, TEXT_MAX)
  if (make === null || model === null || trim === null) return null

  return {
    age: record.age,
    yearsLicensed: record.yearsLicensed,
    incidents: record.incidents,
    mileage: record.mileage,
    teen: record.teen,
    goodStudent: record.goodStudent,
    driverTraining: record.driverTraining,
    householdPolicy: record.householdPolicy,
    loanLease: record.loanLease,
    state: record.state,
    region: record.region,
    coverage: record.coverage,
    deductible: record.deductible,
    year: record.year,
    make,
    model,
    trim,
  }
}

export function encodeSharePath(input: {
  scenario: Scenario
  anchorAmount: number | null
  baselineCleared: boolean
  modelVersion?: string
  bundleVersion?: string
}): string {
  const scenario = scenarioFromRecord(input.scenario)
  if (!scenario) throw new Error("Share link could not encode this scenario")

  const params = new URLSearchParams()
  params.set("share", "1")
  params.set("mv", input.modelVersion ?? MODEL_VERSION)
  params.set("bv", input.bundleVersion ?? DATA_BUNDLE_VERSION)
  params.set("age", scenario.age)
  params.set("years", scenario.yearsLicensed)
  params.set("incidents", scenario.incidents)
  params.set("mileage", scenario.mileage)
  params.set("teen", flag(scenario.teen))
  params.set("student", flag(scenario.goodStudent))
  params.set("training", flag(scenario.driverTraining))
  params.set("household", flag(scenario.householdPolicy))
  params.set("loan", flag(scenario.loanLease))
  params.set("state", scenario.state)
  params.set("region", scenario.region)
  params.set("coverage", scenario.coverage)
  params.set("deductible", String(scenario.deductible))
  params.set("year", String(scenario.year))
  params.set("make", scenario.make)
  params.set("car", scenario.model)
  params.set("trim", scenario.trim)

  const anchor = input.baselineCleared ? null : normalizeAnchor(input.anchorAmount)
  if (anchor !== null) params.set("anchor", String(anchor))

  for (const key of FROZEN_RESULT_KEYS) {
    if (params.has(key)) throw new Error(`Share link must not freeze ${key}`)
  }

  return `/?${params.toString()}`
}

export function decodeShareSearch(
  search: string,
  current: ShareCurrent = {
    modelVersion: MODEL_VERSION,
    bundleVersion: DATA_BUNDLE_VERSION,
  },
): ShareDecode {
  const query = search.includes("?") ? search.slice(search.indexOf("?") + 1) : search
  const params = new URLSearchParams(query)
  if (!params.has("share")) return { status: "absent" }
  if (params.get("share") !== "1") return { status: "invalid" }

  const linkedModel = params.get("mv")
  const linkedBundle = params.get("bv")
  if (!linkedModel || !linkedBundle) return { status: "invalid" }
  if (linkedModel.length > 40 || linkedBundle.length > 80) return { status: "invalid" }

  const deductible = Number(params.get("deductible"))
  const year = Number(params.get("year"))
  const scenario = scenarioFromRecord({
    age: params.get("age"),
    yearsLicensed: params.get("years"),
    incidents: params.get("incidents"),
    mileage: params.get("mileage"),
    teen: flagValue(params.get("teen")),
    goodStudent: flagValue(params.get("student")),
    driverTraining: flagValue(params.get("training")),
    householdPolicy: flagValue(params.get("household")),
    loanLease: flagValue(params.get("loan")),
    state: params.get("state"),
    region: params.get("region"),
    coverage: params.get("coverage"),
    deductible: Number.isInteger(deductible) ? deductible : Number.NaN,
    year: Number.isInteger(year) ? year : Number.NaN,
    make: params.get("make"),
    model: params.get("car"),
    trim: params.get("trim") ?? "",
  })
  if (!scenario) return { status: "invalid" }

  let anchorAmount: number | null = null
  if (params.has("anchor")) {
    anchorAmount = normalizeAnchor(params.get("anchor"))
    if (anchorAmount === null) return { status: "invalid" }
  }

  return {
    status: "ok",
    scenario,
    anchorAmount,
    linkedModel,
    linkedBundle,
    modelMismatch: linkedModel !== current.modelVersion,
    bundleMismatch: linkedBundle !== current.bundleVersion,
    ignoredFrozenDollars: FROZEN_RESULT_KEYS.some((key) => params.has(key)),
  }
}

export function shareArrivalNotes(link: ShareLinkOk, current: ShareCurrent = {
  modelVersion: MODEL_VERSION,
  bundleVersion: DATA_BUNDLE_VERSION,
}): string[] {
  const notes = [
    "Opened from a share link. This page read the inputs and the model and data-bundle versions from the address and recomputed. The address does not freeze a dollar result.",
  ]
  if (link.modelMismatch) {
    notes.push(
      `This link names model ${link.linkedModel}. This page is model ${current.modelVersion}. The dollars here were recomputed on model ${current.modelVersion}. They are not a saved result from model ${link.linkedModel}.`,
    )
  }
  if (link.bundleMismatch) {
    notes.push(
      `This link names data bundle ${link.linkedBundle}. This page uses data bundle ${current.bundleVersion}. The range was recomputed on the current bundle.`,
    )
  }
  if (link.ignoredFrozenDollars) {
    notes.push("This address included dollar figures. This page ignored them and recomputed.")
  }
  if (link.anchorAmount !== null) {
    notes.push(
      "The annual amount in the link is the visitor's anchor for this scenario. It is not a cleared baseline.",
    )
  }
  return notes
}

export const SHARE_INVALID_NOTE =
  "This address looks like a share link, and this page could not read it. Molly's labeled sample is open. Nothing was recomputed from that link."

function flag(value: boolean): string {
  return value ? "1" : "0"
}

function flagValue(value: string | null): boolean | null {
  if (value === "1") return true
  if (value === "0") return false
  return null
}

function plainText(value: unknown, min: number, max: number): string | null {
  if (typeof value !== "string") return null
  if (value.length < min || value.length > max) return null
  if (/[\u0000-\u001F\u007F]/.test(value)) return null
  return value
}
