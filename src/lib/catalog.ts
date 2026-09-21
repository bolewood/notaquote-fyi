import {
  includesQuery,
  type TrimConfidence,
} from "./catalog-match"

export type { TrimConfidence } from "@/lib/catalog-match"
export { UNRESOLVED_TRIM_NAME } from "@/lib/catalog-match"

export type CatalogTrim = {
  name: string
  confidence: TrimConfidence
}

export type CatalogSource = {
  name: string
  url: string
  retrievedOn: string
  note: string
}

export type VehicleCatalog = {
  version: string
  retrievedOn: string
  refreshAfter: string
  yearMin: number
  yearMax: number
  terms: string
  sources: CatalogSource[]
  vehicles: Record<string, Record<string, Record<string, CatalogTrim[]>>>
}

export type VehiclePick = {
  year: number
  make: string
  model: string
  trim: string
}

export type CatalogStatus = "loading" | "failed" | "ready"

const MONTHS = [
  "January",
  "February",
  "March",
  "April",
  "May",
  "June",
  "July",
  "August",
  "September",
  "October",
  "November",
  "December",
]

export function formatCatalogDate(iso: string): string {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(iso)
  if (!match) return iso
  const month = MONTHS[Number(match[2]) - 1]
  if (!month) return iso
  return `${Number(match[3])} ${month} ${match[1]}`
}

export function isVehicleCatalog(value: unknown): value is VehicleCatalog {
  if (!value || typeof value !== "object") return false
  const record = value as Partial<VehicleCatalog>
  if (typeof record.version !== "string" || !record.version.startsWith("catalog-")) {
    return false
  }
  if (typeof record.retrievedOn !== "string" || typeof record.refreshAfter !== "string") {
    return false
  }
  if (typeof record.terms !== "string" || record.terms.length < 40) return false
  if (!Array.isArray(record.sources) || record.sources.length < 2) return false
  if (!record.vehicles || typeof record.vehicles !== "object") return false
  return true
}

export function isCatalogStale(
  catalog: { refreshAfter: string },
  now: Date,
): boolean {
  const refresh = new Date(`${catalog.refreshAfter}T00:00:00Z`)
  if (Number.isNaN(refresh.getTime())) return false
  return now.getTime() >= refresh.getTime()
}

export function catalogYears(catalog: VehicleCatalog): number[] {
  return Object.keys(catalog.vehicles)
    .map(Number)
    .filter((year) => Number.isInteger(year))
    .sort((left, right) => right - left)
}

export function modelsFor(
  catalog: VehicleCatalog,
  year: number,
  make: string,
): Record<string, CatalogTrim[]> {
  return catalog.vehicles[String(year)]?.[make] ?? {}
}

export function catalogMakes(
  catalog: VehicleCatalog,
  year: number,
  query: string,
): string[] {
  const bucket = catalog.vehicles[String(year)] ?? {}
  return Object.keys(bucket)
    .filter((make) => {
      if (!query.trim()) return true
      if (includesQuery(make, query)) return true
      const models = bucket[make] ?? {}
      return Object.entries(models).some(([model, trims]) => {
        if (includesQuery(model, query)) return true
        return trims.some((trim) => includesQuery(trim.name, query))
      })
    })
    .sort((left, right) => left.localeCompare(right))
}

export function catalogModels(
  catalog: VehicleCatalog,
  year: number,
  make: string,
  query: string,
): string[] {
  const models = modelsFor(catalog, year, make)
  const makeHit = Boolean(query.trim()) && includesQuery(make, query)
  return Object.keys(models)
    .filter((model) => {
      if (!query.trim() || makeHit) return true
      if (includesQuery(model, query)) return true
      return models[model]?.some((trim) => includesQuery(trim.name, query)) ?? false
    })
    .sort((left, right) => left.localeCompare(right))
}

export function catalogTrims(
  catalog: VehicleCatalog,
  year: number,
  make: string,
  model: string,
  query: string,
): CatalogTrim[] {
  const trims = modelsFor(catalog, year, make)[model] ?? []
  const broad =
    !query.trim() || includesQuery(make, query) || includesQuery(model, query)
  const visible = broad
    ? trims
    : trims.filter((trim) => includesQuery(trim.name, query))
  return visible.length > 0 ? visible : trims
}

export function catalogFilterIsEmpty(
  catalog: VehicleCatalog,
  year: number,
  query: string,
): boolean {
  return query.trim().length > 0 && catalogMakes(catalog, year, query).length === 0
}

export function catalogFilterYears(catalog: VehicleCatalog, query: string): number[] {
  if (!query.trim()) return []
  return catalogYears(catalog).filter((year) => catalogMakes(catalog, year, query).length > 0)
}

export function filterMissCopy(year: number, otherYears: number[]): string {
  const listed = [...otherYears].filter((item) => item !== year).sort((left, right) => left - right)
  if (listed.length === 0) return "Nothing in this snapshot matches that filter."
  if (listed.length > 4) {
    return `Nothing in ${year} matches that filter. It is in this snapshot for other model years.`
  }
  return `Nothing in ${year} matches that filter. It is in this snapshot for ${formatYearList(listed)}.`
}

function formatYearList(years: number[]): string {
  if (years.length === 1) return String(years[0])
  if (years.length === 2) return `${years[0]} and ${years[1]}`
  return `${years.slice(0, -1).join(", ")}, and ${years.at(-1)}`
}

export function trimRecord(
  catalog: VehicleCatalog,
  pick: VehiclePick,
): CatalogTrim | null {
  const trims = modelsFor(catalog, pick.year, pick.make)[pick.model] ?? []
  return trims.find((trim) => trim.name === pick.trim) ?? null
}

export function coercePick(catalog: VehicleCatalog, pick: VehiclePick): VehiclePick {
  const years = catalogYears(catalog)
  const year = years.includes(pick.year) ? pick.year : (years.at(-1) ?? pick.year)
  const makes = Object.keys(catalog.vehicles[String(year)] ?? {}).sort((a, b) =>
    a.localeCompare(b),
  )
  const make = makes.includes(pick.make) ? pick.make : (makes[0] ?? pick.make)
  const models = Object.keys(modelsFor(catalog, year, make)).sort((a, b) =>
    a.localeCompare(b),
  )
  const model = models.includes(pick.model) ? pick.model : (models[0] ?? pick.model)
  const trims = modelsFor(catalog, year, make)[model] ?? []
  const trim = trims.some((item) => item.name === pick.trim)
    ? pick.trim
    : (trims[0]?.name ?? pick.trim)
  return { year, make, model, trim }
}

export function samePick(left: VehiclePick, right: VehiclePick): boolean {
  return (
    left.year === right.year &&
    left.make === right.make &&
    left.model === right.model &&
    left.trim === right.trim
  )
}

export function rangeConfidenceCopy(input: {
  catalogStatus: CatalogStatus
  trimConfidence: TrimConfidence | null
  stale: boolean
}): string {
  const base = "Low. Sample display. Baseline not cleared."
  if (input.catalogStatus === "loading") {
    return `${base} The vehicle catalog is loading.`
  }
  if (input.catalogStatus === "failed") {
    return `${base} The vehicle catalog did not load.`
  }
  const staleNote = input.stale ? " This snapshot is past its refresh date." : ""
  if (input.trimConfidence === "high") {
    return `${base} Trim match is strong.${staleNote}`
  }
  if (input.trimConfidence === "limited") {
    return `${base} Trim match is limited, so confidence stays low.${staleNote}`
  }
  if (input.trimConfidence === "unresolved") {
    return `${base} Trim is not resolved, so confidence stays low.${staleNote}`
  }
  return `${base} Trim confidence is not available yet.${staleNote}`
}

export function trimConfidenceCopy(
  confidence: TrimConfidence,
  version: string,
  retrievedOn: string,
): string {
  const cited = `Snapshot ${version}, retrieved ${formatCatalogDate(retrievedOn)}.`
  if (confidence === "high") {
    return `Trim confidence: strong. ${cited}`
  }
  if (confidence === "limited") {
    return `Trim confidence: limited. The NHTSA and FuelEconomy match is weak. ${cited}`
  }
  return `Trim confidence: unresolved. No trim was added for this model. ${cited}`
}
