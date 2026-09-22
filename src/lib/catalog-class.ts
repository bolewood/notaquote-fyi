/**
 * Vehicle class and powertrain from the catalog's own government fields.
 *
 * The catalog build keeps two FuelEconomy.gov columns per trim:
 * - VClass, the EPA size class (for example "Standard Pickup Trucks 4WD"),
 *   stored as an index `c` into `catalog.vehicleClasses`.
 * - atvType, the EPA alternative-fuel type (EV, Hybrid, Plug-in Hybrid, ...),
 *   stored as one or more single-letter codes `p` (see POWERTRAIN_LEGEND).
 *
 * Classification reads those fields first. It only falls back when a trim has
 * none: first to the other trims of the same model and year, then to the same
 * model in the nearest other year, and last to whole words in the name.
 */
import { compactName, normalizeName } from "./catalog-match"
import type { CatalogTrim, VehicleCatalog } from "./catalog"

export const VEHICLE_CLASS_IDS = [
  "small-car",
  "midsize-car",
  "large-car",
  "two-seater",
  "small-suv",
  "large-suv",
  "suv",
  "small-pickup",
  "large-pickup",
  "minivan",
  "van",
  "special-purpose",
] as const
export type VehicleClassId = (typeof VEHICLE_CLASS_IDS)[number]

export const VEHICLE_CLASS_LABELS: Record<VehicleClassId, string> = {
  "small-car": "Small car",
  "midsize-car": "Midsize car",
  "large-car": "Large car",
  "two-seater": "Two-seater",
  "small-suv": "Small SUV",
  "large-suv": "Standard SUV",
  suv: "SUV",
  "small-pickup": "Small pickup",
  "large-pickup": "Full-size pickup",
  minivan: "Minivan",
  van: "Van",
  "special-purpose": "Special purpose vehicle",
}

export const POWERTRAINS = [
  "combustion",
  "hybrid",
  "plug-in-hybrid",
  "electric",
  "fuel-cell",
] as const
export type Powertrain = (typeof POWERTRAINS)[number]

/** Single-letter codes stored in the catalog snapshot, keyed by code. */
export const POWERTRAIN_LEGEND: Record<string, string> = {
  g: "Gasoline, diesel, flex-fuel, or natural gas (EPA atvType blank, FFV, Diesel, CNG, or Bifuel)",
  h: "Hybrid (EPA atvType Hybrid, which includes mild hybrids)",
  p: "Plug-in hybrid (EPA atvType Plug-in Hybrid)",
  e: "Electric (EPA atvType EV)",
  f: "Fuel cell (EPA atvType FCV or eFCV)",
}

const CODE_TO_POWERTRAIN: Record<string, Powertrain> = {
  g: "combustion",
  h: "hybrid",
  p: "plug-in-hybrid",
  e: "electric",
  f: "fuel-cell",
}

/** Map an EPA atvType value to a single-letter catalog code. */
export function powertrainCode(atvType: string): string {
  const value = atvType.trim().toLowerCase()
  if (value === "ev") return "e"
  if (value === "hybrid") return "h"
  if (value === "plug-in hybrid") return "p"
  if (value === "fcv" || value === "efcv") return "f"
  return "g"
}

/**
 * EPA VClass to a planning class. The mapping is by the EPA wording only:
 * size words (minicompact, subcompact, compact, midsize, large, small,
 * standard) and body words (cars, station wagons, sport utility, pickup,
 * minivan, van, special purpose). Drive (2WD or 4WD) is ignored.
 */
export function classFromEpa(vclass: string): VehicleClassId | null {
  const value = vclass.toLowerCase()
  if (value.includes("pickup")) return value.startsWith("small") ? "small-pickup" : "large-pickup"
  if (value.includes("sport utility")) {
    if (value.startsWith("small")) return "small-suv"
    if (value.startsWith("standard")) return "large-suv"
    return "suv"
  }
  if (value.includes("minivan")) return "minivan"
  if (value.startsWith("vans")) return "van"
  if (value.includes("special purpose")) return "special-purpose"
  if (value.includes("two seater")) return "two-seater"
  if (value.includes("station wagon")) {
    if (value.startsWith("small")) return "small-car"
    if (value.startsWith("midsize-large") || value.startsWith("large")) return "large-car"
    return "midsize-car"
  }
  if (value.includes("cars")) {
    if (value.startsWith("minicompact") || value.startsWith("subcompact") || value.startsWith("compact")) {
      return "small-car"
    }
    if (value.startsWith("midsize")) return "midsize-car"
    if (value.startsWith("large")) return "large-car"
  }
  return null
}

export type ClassSource =
  /** The trim's own EPA fields. */
  | "epa-trim"
  /** Every other trim of this model and year carries the same EPA class. */
  | "epa-model"
  /** The same model in the nearest year with EPA fields. */
  | "epa-other-year"
  /** Whole words in the name. Used only when the catalog has nothing. */
  | "name"
  | "unknown"

export type VehicleFacts = {
  year: number
  make: string
  model: string
  trim: string
  classId: VehicleClassId | null
  epaClass: string | null
  powertrain: Powertrain | null
  /** True when the trim's EPA rows disagree (for example gas and hybrid under one name). */
  powertrainMixed: boolean
  classSource: ClassSource
  powertrainSource: ClassSource
}

export type VehicleName = { year: number; make: string; model: string; trim: string }

/** The powertrain codes on a trim. A trim with an EPA class and no code is combustion-only. */
function trimCodes(trim: CatalogTrim | undefined): string | undefined {
  if (!trim) return undefined
  if (trim.p) return trim.p
  return trim.c !== undefined ? "g" : undefined
}

function powertrainFromCodes(
  codes: string | undefined,
  name = "",
): { value: Powertrain | null; mixed: boolean } {
  if (!codes) return { value: null, mixed: false }
  const unique = [...new Set(codes.split(""))].filter((code) => code in CODE_TO_POWERTRAIN)
  if (unique.length === 0) return { value: null, mixed: false }
  if (unique.length === 1) return { value: CODE_TO_POWERTRAIN[unique[0]], mixed: false }
  // One trim name with rows of two powertrains (for example the 2024 Honda
  // "CR-V FWD", sold as gas and as hybrid). Believe the name when it says
  // which one; otherwise assume the gas version, which is the plain name. The
  // result is flagged as mixed so the engine can widen the range.
  const named = powertrainFromName(name)
  if (named && unique.includes(POWERTRAIN_TO_CODE[named])) return { value: named, mixed: true }
  if (unique.includes("g")) return { value: "combustion", mixed: true }
  const order = ["e", "f", "p", "h"]
  const first = order.find((code) => unique.includes(code)) ?? unique[0]
  return { value: CODE_TO_POWERTRAIN[first], mixed: true }
}

const POWERTRAIN_TO_CODE: Record<Powertrain, string> = {
  combustion: "g",
  hybrid: "h",
  "plug-in-hybrid": "p",
  electric: "e",
  "fuel-cell": "f",
}

const NAME_POWERTRAIN: { pattern: RegExp; value: Powertrain }[] = [
  { pattern: /\b(plug in hybrid|phev|plug in)\b/, value: "plug-in-hybrid" },
  { pattern: /\b(hybrid|hev|mhev)\b/, value: "hybrid" },
  { pattern: /\b(ev|electric|lightning|e tron|etron)\b/, value: "electric" },
  { pattern: /\b(fuel cell|fcv)\b/, value: "fuel-cell" },
]

/** Whole-word powertrain hint from a name, for when the catalog has no EPA row. */
export function powertrainFromName(name: string): Powertrain | null {
  // Keep words in parentheses, e.g. "Prius Prime (PHEV)".
  const value = normalizeName(name.replace(/[()]/g, " "))
  for (const rule of NAME_POWERTRAIN) {
    if (rule.pattern.test(value)) return rule.value
  }
  return null
}

const NAME_CLASS: { pattern: RegExp; value: VehicleClassId }[] = [
  { pattern: /\b(pickup|crew cab|double cab|quad cab|regular cab|supercrew|supercab)\b/, value: "large-pickup" },
  { pattern: /\bminivan\b/, value: "minivan" },
]

function classFromName(name: string): VehicleClassId | null {
  const value = normalizeName(name)
  for (const rule of NAME_CLASS) {
    if (rule.pattern.test(value)) return rule.value
  }
  return null
}

function epaFromTrim(catalog: VehicleCatalog, trim: CatalogTrim | undefined): string | null {
  if (!trim || trim.c === undefined) return null
  return catalog.vehicleClasses?.[trim.c] ?? null
}

function modelTrims(catalog: VehicleCatalog, year: number, make: string, model: string): CatalogTrim[] {
  return catalog.vehicles[String(year)]?.[make]?.[model] ?? []
}

function agreedClass(catalog: VehicleCatalog, trims: CatalogTrim[]): string | null {
  const classes = new Set(
    trims.map((trim) => epaFromTrim(catalog, trim)).filter((value): value is string => value !== null),
  )
  const planning = new Set([...classes].map((value) => classFromEpa(value)))
  if (classes.size === 0 || planning.size !== 1) return null
  return [...classes].sort()[0]
}

function agreedPowertrain(trims: CatalogTrim[]): Powertrain | null {
  const values = new Set(
    trims.map((trim) => powertrainFromCodes(trimCodes(trim))).filter((item) => !item.mixed).map((item) => item.value),
  )
  values.delete(null)
  return values.size === 1 ? [...values][0] : null
}

/**
 * The class and powertrain for a vehicle pick. `catalog` may be null while the
 * snapshot is loading; the result then falls back to whole words in the name.
 */
export function vehicleFacts(catalog: VehicleCatalog | null, pick: VehicleName): VehicleFacts {
  const base: VehicleFacts = {
    year: pick.year,
    make: pick.make,
    model: pick.model,
    trim: pick.trim,
    classId: null,
    epaClass: null,
    powertrain: null,
    powertrainMixed: false,
    classSource: "unknown",
    powertrainSource: "unknown",
  }
  const fullName = `${pick.model} ${pick.trim}`

  if (catalog) {
    const trims = modelTrims(catalog, pick.year, pick.make, pick.model)
    const own = trims.find((trim) => trim.name === pick.trim)
    const ownClass = epaFromTrim(catalog, own)
    if (ownClass) {
      base.epaClass = ownClass
      base.classId = classFromEpa(ownClass)
      base.classSource = "epa-trim"
    }
    const ownPower = powertrainFromCodes(trimCodes(own), `${pick.model} ${pick.trim}`)
    if (ownPower.value) {
      base.powertrain = ownPower.value
      base.powertrainMixed = ownPower.mixed
      base.powertrainSource = "epa-trim"
    }

    if (base.classId === null) {
      const agreed = agreedClass(catalog, trims)
      if (agreed) {
        base.epaClass = agreed
        base.classId = classFromEpa(agreed)
        base.classSource = "epa-model"
      }
    }
    if (base.powertrain === null) {
      const hinted = powertrainFromName(fullName)
      const agreed = agreedPowertrain(trims)
      if (hinted) {
        base.powertrain = hinted
        base.powertrainSource = "name"
      } else if (agreed) {
        base.powertrain = agreed
        base.powertrainSource = "epa-model"
      }
    }

    if (base.classId === null || base.powertrain === null) {
      const years = Object.keys(catalog.vehicles)
        .map(Number)
        .filter((year) => year !== pick.year)
        .sort((left, right) => Math.abs(left - pick.year) - Math.abs(right - pick.year) || right - left)
      for (const year of years) {
        const other = modelTrims(catalog, year, pick.make, pick.model)
        if (other.length === 0) continue
        if (base.classId === null) {
          const agreed = agreedClass(catalog, other)
          if (agreed) {
            base.epaClass = agreed
            base.classId = classFromEpa(agreed)
            base.classSource = "epa-other-year"
          }
        }
        if (base.powertrain === null) {
          const agreed = agreedPowertrain(other)
          if (agreed) {
            base.powertrain = agreed
            base.powertrainSource = "epa-other-year"
          }
        }
        if (base.classId !== null && base.powertrain !== null) break
      }
    }
  }

  if (base.classId === null) {
    const named = classFromName(fullName)
    if (named) {
      base.classId = named
      base.classSource = "name"
    }
  }
  if (base.powertrain === null) {
    const named = powertrainFromName(fullName)
    if (named) {
      base.powertrain = named
      base.powertrainSource = "name"
    }
  }
  return base
}

/** Used by tests and the build to compare model names across sources. */
export function sameModelName(left: string, right: string): boolean {
  return compactName(left) === compactName(right)
}
