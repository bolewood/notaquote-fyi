/**
 * Cars for the agent API (/api/v1): stable ids, loose-name resolution, and
 * short descriptions. Everything reads the same catalog and the same search
 * the site uses (src/lib/car-search.ts), so "2022 honda civic", "model y", and
 * "f150" find the same cars an agent's human would find on the page.
 *
 * An id is a slug of the model year, make, model, and version (trim), with
 * the model's name left out of the version when it repeats it:
 *   2022 / Honda / Civic / "Civic 4Dr"  ->  "2022-honda-civic-4dr"
 *   2022 / Toyota / Corolla / "Corolla" ->  "2022-toyota-corolla"
 * Ids are stable for a catalog version. In the rare case two versions give
 * the same slug, the later one (in catalog order) gets "-2", "-3", and so on.
 */
import {
  defaultTrim,
  FIRST_CARS,
  parseCarQuery,
  POPULAR_SUVS,
  resolveCar,
  searchModels,
  STARTER_MIX,
  TRUCKS_AND_FUN,
  type ModelHit,
  type QuickCar,
} from "./car-search"
import { catalogYears, trimRecord, type CatalogTrim, type VehicleCatalog, type VehiclePick } from "./catalog"
import { VEHICLE_CLASS_LABELS, vehicleFacts, type VehicleFacts } from "./catalog-class"
import { compactName, normalizeName, type TrimConfidence } from "./catalog-match"
import { vehicleRelativity } from "./factor-engine"

/** Model year used for a car name that doesn't give one: the site's own default for a first car. */
export const DEFAULT_MODEL_YEAR = 2022

export function slugPart(value: string): string {
  return normalizeName(value).replace(/ /g, "-")
}

function baseSlug(pick: VehiclePick): string {
  const model = slugPart(pick.model)
  const trim = slugPart(pick.trim)
  const rest = trim === model ? "" : trim.startsWith(`${model}-`) ? trim.slice(model.length + 1) : trim
  return [String(pick.year), slugPart(pick.make), model, rest].filter(Boolean).join("-")
}

function pickKey(pick: VehiclePick): string {
  return `${pick.year}|${pick.make}|${pick.model}|${pick.trim}`
}

type CarIndex = { byId: Map<string, VehiclePick>; idByKey: Map<string, string> }

const INDEXES = new WeakMap<VehicleCatalog, CarIndex>()

/** Every car in the catalog by id, built once per catalog. */
export function carIndex(catalog: VehicleCatalog): CarIndex {
  const cached = INDEXES.get(catalog)
  if (cached) return cached
  const byId = new Map<string, VehiclePick>()
  const idByKey = new Map<string, string>()
  const years = Object.keys(catalog.vehicles).sort()
  for (const year of years) {
    const makes = catalog.vehicles[year]
    for (const make of Object.keys(makes).sort()) {
      for (const model of Object.keys(makes[make]).sort()) {
        for (const trim of makes[make][model]) {
          const pick = { year: Number(year), make, model, trim: trim.name }
          const base = baseSlug(pick)
          let id = base
          for (let suffix = 2; byId.has(id); suffix += 1) id = `${base}-${suffix}`
          byId.set(id, pick)
          idByKey.set(pickKey(pick), id)
        }
      }
    }
  }
  const index = { byId, idByKey }
  INDEXES.set(catalog, index)
  return index
}

export function carId(catalog: VehicleCatalog, pick: VehiclePick): string {
  const id = carIndex(catalog).idByKey.get(pickKey(pick))
  if (!id) throw new Error(`Not in the catalog: ${pickKey(pick)}`)
  return id
}

export type ClaimsData = "model" | "class-average" | "unknown"

export type CarSummary = {
  id: string
  /** "2022 Honda Civic" */
  name: string
  year: number
  make: string
  model: string
  /** The version, as the government sources print it. */
  trim: string
  /** The kind of car, from the EPA size class: "Small SUV", "Midsize car", and so on. */
  vehicleClass: string | null
  powertrain: VehicleFacts["powertrain"]
  /** "model": HLDI insurance-claims results for this model. "class-average": the average for its kind of car. "unknown": an average car. */
  claimsData: ClaimsData
}

export function claimsDataOf(level: string): ClaimsData {
  return level === "model" ? "model" : level === "class" ? "class-average" : "unknown"
}

export function describeCar(catalog: VehicleCatalog, pick: VehiclePick): CarSummary {
  const facts = vehicleFacts(catalog, pick)
  return {
    id: carId(catalog, pick),
    name: `${pick.year} ${pick.make} ${pick.model}`,
    year: pick.year,
    make: pick.make,
    model: pick.model,
    trim: pick.trim,
    vehicleClass: facts.classId ? VEHICLE_CLASS_LABELS[facts.classId] : null,
    powertrain: facts.powertrain,
    claimsData: claimsDataOf(vehicleRelativity(facts).level),
  }
}

const QUICK_LISTS: readonly QuickCar[][] = [[...FIRST_CARS], [...POPULAR_SUVS], [...TRUCKS_AND_FUN]]

/** The version the site's one-tap lists pick for a model, or its usual default. */
export function siteDefaultTrim(catalog: VehicleCatalog, year: number, make: string, model: string): string | null {
  const quick = QUICK_LISTS.flat().find((car) => car.make === make && car.model === model)
  const pick = resolveCar(catalog, year, quick ?? { make, model })
  return pick?.trim ?? null
}

/** Years in the catalog that list this make and model, newest first. */
export function yearsWithModel(catalog: VehicleCatalog, make: string, model: string): number[] {
  return catalogYears(catalog).filter((year) => (catalog.vehicles[String(year)]?.[make]?.[model]?.length ?? 0) > 0)
}

// ---------------------------------------------------------------------------
// Resolving what an agent typed

export type Confidence = "exact" | "high" | "medium"

export type ResolvedCar = {
  input: string
  pick: VehiclePick
  id: string
  /** "2022 Honda Civic (Civic 4Dr)": what we priced. */
  resolvedAs: string
  /** exact: an id. high: one clear match. medium: we had to choose (see `note`). */
  confidence: Confidence
  /** The catalog's own confidence in the version name (the site uses it to widen a what-if's range). */
  trimConfidence: TrimConfidence | null
  yearAssumed: boolean
  note: string | null
  /** Other close matches, when we had to choose. */
  alternatives: string[]
}

export type Unresolved = { input: string; message: string; suggestions: string[] }

function typedExact(hit: ModelHit, typed: string): boolean {
  const want = compactName(typed)
  if (!want) return false
  const model = compactName(hit.model)
  const full = compactName(`${hit.make} ${hit.model}`)
  return model === want || full === want || full.endsWith(want)
}

/** True when the model's name starts with what was typed after the make: "mini cooper" and "Cooper Convertible". */
function typedStart(hit: ModelHit, typed: string): boolean {
  const make = compactName(hit.make)
  let want = compactName(typed)
  if (want.startsWith(make)) want = want.slice(make.length)
  return want.length > 0 && compactName(hit.model).startsWith(want)
}

/**
 * Models matching `text` in one year: exact names first, then models whose
 * name starts with what was typed, then the rest, each in the site's search
 * order.
 */
function modelHits(catalog: VehicleCatalog, year: number, text: string): ModelHit[] {
  const hits = searchModels(catalog, year, text, 25)
  const tier = (hit: ModelHit) => (typedExact(hit, text) ? 0 : typedStart(hit, text) ? 1 : 2)
  return hits.map((hit, order) => ({ hit, order })).sort((left, right) => tier(left.hit) - tier(right.hit) || left.order - right.order).map((item) => item.hit)
}

function trimsMatching(trims: readonly CatalogTrim[], words: string[]): CatalogTrim[] {
  if (words.length === 0) return []
  return trims.filter((trim) => {
    const name = normalizeName(trim.name)
    const squeezed = name.replace(/ /g, "")
    return words.every((word) => name.split(" ").includes(word) || squeezed.includes(word))
  })
}

function nameOf(pick: VehiclePick): string {
  const base = `${pick.year} ${pick.make} ${pick.model}`
  return pick.trim && pick.trim !== pick.model ? `${base} (${pick.trim})` : base
}

function resolved(
  catalog: VehicleCatalog,
  input: string,
  pick: VehiclePick,
  confidence: Confidence,
  extra: { yearAssumed?: boolean; note?: string | null; alternatives?: string[] } = {},
): ResolvedCar {
  return {
    input,
    pick,
    id: carId(catalog, pick),
    resolvedAs: nameOf(pick),
    confidence,
    trimConfidence: trimRecord(catalog, pick)?.confidence ?? null,
    yearAssumed: extra.yearAssumed ?? false,
    note: extra.note ?? null,
    alternatives: extra.alternatives ?? [],
  }
}

/** Find the model for a typed name in one year: the longest leading run of words that names a model. */
function findModel(
  catalog: VehicleCatalog,
  year: number,
  words: string[],
): { hits: ModelHit[]; used: string; rest: string[] } | null {
  for (let count = words.length; count >= 1; count -= 1) {
    const used = words.slice(0, count).join(" ")
    const hits = modelHits(catalog, year, used)
    if (hits.length > 0) return { hits, used, rest: words.slice(count) }
  }
  return null
}

/**
 * Turn an id or a loose name ("2024 Tesla Model Y", "f150", "2022 civic
 * 4dr") into a car in the catalog. A name without a model year uses
 * `defaultYear`, or the nearest year that lists the car.
 */
export function resolveCarInput(
  catalog: VehicleCatalog,
  raw: string,
  defaultYear: number = DEFAULT_MODEL_YEAR,
): ResolvedCar | Unresolved {
  const input = raw.trim()
  const index = carIndex(catalog)
  const byId = index.byId.get(input.toLowerCase())
  if (byId) return resolved(catalog, input, byId, "exact")

  // The site's share-link form: "2022|Honda|Civic|Civic 4Dr".
  if (input.includes("|")) {
    const [year, make, model, trim] = input.split("|").map((part) => part.trim())
    const pick = { year: Number(year), make: make ?? "", model: model ?? "", trim: trim ?? "" }
    if (index.idByKey.has(pickKey(pick))) return resolved(catalog, input, pick, "exact")
    const fallback = `${year ?? ""} ${make ?? ""} ${model ?? ""} ${trim ?? ""}`
    return resolveCarInput(catalog, fallback.replace(/\s+/g, " "), defaultYear)
  }

  // A slug that isn't an id (say, a made-up one): read it as words.
  const parsed = parseCarQuery(input.replace(/[-_/]+/g, " "))
  const words = normalizeName(parsed.text).split(" ").filter(Boolean)
  if (words.length === 0) {
    return { input, message: "That's only a model year. Add a make and model, like \"2022 Honda Civic\".", suggestions: [] }
  }
  const years = catalogYears(catalog)
  const yearAssumed = parsed.year === null
  let year = parsed.year ?? defaultYear
  if (!years.includes(year)) {
    return {
      input,
      message: `We have model years ${years.at(-1)}–${years[0]}, not ${year}.`,
      suggestions: [],
    }
  }

  let found = findModel(catalog, year, words)
  let note: string | null = null
  if (!found && yearAssumed) {
    // No year given and the default year doesn't have it: use the nearest year that does.
    const nearest = [...years].sort((left, right) => Math.abs(left - defaultYear) - Math.abs(right - defaultYear) || right - left)
    for (const candidate of nearest) {
      const hit = findModel(catalog, candidate, words)
      if (hit) {
        found = hit
        year = candidate
        break
      }
    }
  }
  if (!found) {
    const elsewhere = years.filter((candidate) => candidate !== year && findModel(catalog, candidate, words) !== null)
    return {
      input,
      message: elsewhere.length > 0
        ? `No ${year} model matches "${parsed.text}". It's listed for ${elsewhere.slice(0, 6).join(", ")}${elsewhere.length > 6 ? ", and more" : ""}.`
        : `No car in our catalog matches "${parsed.text}". Try the make and model, like "Honda Civic", or search with /api/v1/cars?q=...`,
      suggestions: elsewhere.length > 0
        ? (() => {
            const other = findModel(catalog, elsewhere[0], words)!
            const trim = siteDefaultTrim(catalog, elsewhere[0], other.hits[0].make, other.hits[0].model)
            return trim ? [carId(catalog, { year: elsewhere[0], make: other.hits[0].make, model: other.hits[0].model, trim })] : []
          })()
        : [],
    }
  }

  const hit = found.hits[0]
  const exactHits = found.hits.filter((candidate) => typedExact(candidate, found.used))
  const clearModel = found.hits.length === 1 || (exactHits.length === 1 && exactHits[0] === hit)
  const alternatives = found.hits
    .filter((candidate) => candidate !== hit)
    .slice(0, 4)
    .flatMap((candidate) => {
      const trim = siteDefaultTrim(catalog, year, candidate.make, candidate.model)
      return trim ? [carId(catalog, { year, make: candidate.make, model: candidate.model, trim })] : []
    })

  let trimName: string | null = null
  let trimNote: string | null = null
  if (found.rest.length > 0) {
    const matching = trimsMatching(hit.trims, found.rest)
    if (matching.length > 0) trimName = defaultTrim(matching)?.name ?? null
    else trimNote = `We couldn't find a ${hit.model} version matching "${found.rest.join(" ")}", so we used the usual one.`
  }
  trimName ??= siteDefaultTrim(catalog, year, hit.make, hit.model)
  if (!trimName) return { input, message: `No versions are listed for the ${year} ${hit.make} ${hit.model}.`, suggestions: [] }

  const notes: string[] = []
  if (yearAssumed) notes.push(`No model year given, so we used ${year}.`)
  if (!clearModel) notes.push(`"${found.used}" matches more than one model; we picked the ${hit.make} ${hit.model}.`)
  if (trimNote) notes.push(trimNote)
  note = notes.length > 0 ? notes.join(" ") : null
  const confidence: Confidence = clearModel && !yearAssumed && !trimNote ? "high" : "medium"
  return resolved(catalog, input, { year, make: hit.make, model: hit.model, trim: trimName }, confidence, {
    yearAssumed,
    note,
    alternatives: clearModel ? [] : alternatives,
  })
}

export function isUnresolved(value: ResolvedCar | Unresolved): value is Unresolved {
  return !("pick" in value)
}

// ---------------------------------------------------------------------------
// Search and popular lists

/** [2027, 2026, 2025, 2020] as "2020, 2025–2027". */
export function yearSpans(years: readonly number[]): string {
  const sorted = [...years].sort((left, right) => left - right)
  const spans: string[] = []
  for (let index = 0; index < sorted.length; ) {
    let end = index
    while (end + 1 < sorted.length && sorted[end + 1] === sorted[end] + 1) end += 1
    spans.push(end === index ? String(sorted[index]) : `${sorted[index]}–${sorted[end]}`)
    index = end + 1
  }
  return spans.join(", ")
}

export type SearchMatch = CarSummary & {
  /** The model years the catalog lists this make and model for, like "2006–2027" or "2016–2019, 2022–2027". */
  yearsAvailable: string
  /** The other versions of this model in this year. The main entry is the one the site picks by default. */
  otherTrims: { id: string; trim: string; vehicleClass: string | null; powertrain: VehicleFacts["powertrain"] }[]
}

export function searchCars(catalog: VehicleCatalog, year: number, text: string, limit: number): SearchMatch[] {
  const hits = modelHits(catalog, year, text).slice(0, limit)
  return hits.flatMap((hit) => {
    const main = siteDefaultTrim(catalog, year, hit.make, hit.model)
    if (!main) return []
    const summary = describeCar(catalog, { year, make: hit.make, model: hit.model, trim: main })
    const otherTrims = hit.trims
      .filter((trim) => trim.name !== main)
      .map((trim) => {
        const pick = { year, make: hit.make, model: hit.model, trim: trim.name }
        const facts = vehicleFacts(catalog, pick)
        return {
          id: carId(catalog, pick),
          trim: trim.name,
          vehicleClass: facts.classId ? VEHICLE_CLASS_LABELS[facts.classId] : null,
          powertrain: facts.powertrain,
        }
      })
    return [{ ...summary, yearsAvailable: yearSpans(yearsWithModel(catalog, hit.make, hit.model)), otherTrims }]
  })
}

export const POPULAR_GROUPS = [
  { id: "firstCars", preset: "popular:first-cars", label: "Popular first cars", cars: FIRST_CARS },
  { id: "suvs", preset: "popular:suvs", label: "Popular SUVs", cars: POPULAR_SUVS },
  { id: "trucksAndFun", preset: "popular:trucks-and-fun", label: "Trucks and fun ones", cars: TRUCKS_AND_FUN },
  { id: "starterMix", preset: "popular:starter-mix", label: "A starter mix: everyday cars, a sporty one, an electric one, a Jeep, and a pickup", cars: STARTER_MIX },
] as const

export const PRESET_NAMES: readonly string[] = POPULAR_GROUPS.map((group) => group.preset)

/** A preset like "popular:first-cars" as car ids for one model year, or null when it isn't a preset. */
export function expandPreset(catalog: VehicleCatalog, token: string, year: number): string[] | null {
  const group = POPULAR_GROUPS.find((item) => item.preset === token.trim().toLowerCase())
  if (!group) return null
  return group.cars.flatMap((car) => {
    const pick = resolveCar(catalog, year, car)
    return pick ? [carId(catalog, pick)] : []
  })
}

export function popularCars(
  catalog: VehicleCatalog,
  year: number,
): Record<string, { label: string; preset: string; cars: CarSummary[] }> {
  return Object.fromEntries(
    POPULAR_GROUPS.map((group) => [
      group.id,
      {
        label: group.label,
        preset: group.preset,
        cars: group.cars.flatMap((car) => {
          const pick = resolveCar(catalog, year, car)
          return pick ? [describeCar(catalog, pick)] : []
        }),
      },
    ]),
  )
}
