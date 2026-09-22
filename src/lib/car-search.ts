/**
 * Finding cars in the catalog quickly: a search box that understands
 * "model y" or "tesla y", a sensible default version (trim) for each model,
 * and short lists of popular cars for one-click adding.
 */
import { normalizeName } from "./catalog-match"
import type { CatalogTrim, VehicleCatalog, VehiclePick } from "./catalog"

export type ModelHit = {
  year: number
  make: string
  model: string
  trims: CatalogTrim[]
}

export type QuickCar = { make: string; model: string; trim?: string }

/** Popular first cars for a new driver, roughly in the order parents ask about them. */
export const FIRST_CARS: readonly QuickCar[] = [
  { make: "Honda", model: "Civic", trim: "Civic 4Dr" },
  { make: "Toyota", model: "Corolla", trim: "Corolla" },
  { make: "Toyota", model: "Camry" },
  { make: "Honda", model: "Accord", trim: "Accord" },
  { make: "Mazda", model: "3", trim: "3 4-Door 2WD" },
  { make: "Subaru", model: "Impreza" },
  { make: "Hyundai", model: "Elantra", trim: "Elantra" },
  { make: "Kia", model: "Forte", trim: "Forte" },
  { make: "Toyota", model: "Prius", trim: "Prius" },
  { make: "Nissan", model: "Sentra", trim: "Sentra" },
  { make: "Volkswagen", model: "Jetta", trim: "Jetta" },
  { make: "Kia", model: "Soul", trim: "Soul" },
  { make: "Subaru", model: "Crosstrek" },
  { make: "Honda", model: "HR-V" },
  { make: "Hyundai", model: "Kona" },
]

export const POPULAR_SUVS: readonly QuickCar[] = [
  { make: "Toyota", model: "RAV4", trim: "RAV4" },
  { make: "Honda", model: "CR-V" },
  { make: "Subaru", model: "Forester" },
  { make: "Subaru", model: "Outback" },
  { make: "Mazda", model: "CX-5" },
  { make: "Hyundai", model: "Tucson" },
  { make: "Kia", model: "Sportage" },
  { make: "Chevrolet", model: "Equinox" },
  { make: "Ford", model: "Escape" },
  { make: "Nissan", model: "Rogue" },
  { make: "Toyota", model: "Highlander" },
  { make: "Tesla", model: "Model Y", trim: "Model Y Long Range AWD" },
]

export const TRUCKS_AND_FUN: readonly QuickCar[] = [
  { make: "Ford", model: "F-150" },
  { make: "Toyota", model: "Tacoma" },
  { make: "Jeep", model: "Wrangler" },
  { make: "Ford", model: "Mustang", trim: "Mustang" },
  { make: "Tesla", model: "Model 3", trim: "Model 3 Long Range AWD" },
  { make: "Hyundai", model: "Ioniq 5" },
]

/** The cars offered on the What-if page, one click each. */
export const WHAT_IF_CARS: readonly (QuickCar & { year: number })[] = [
  { year: 2025, make: "Tesla", model: "Model Y", trim: "Model Y Long Range AWD" },
  { year: 2025, make: "Honda", model: "Civic", trim: "Civic 4Dr" },
  { year: 2025, make: "Toyota", model: "RAV4", trim: "RAV4" },
  { year: 2025, make: "Ford", model: "F-150", trim: "F150 Pickup 2WD" },
  { year: 2025, make: "Toyota", model: "Camry" },
  { year: 2025, make: "Subaru", model: "Outback", trim: "Outback AWD" },
  { year: 2025, make: "Hyundai", model: "Ioniq 5" },
  { year: 2025, make: "Ford", model: "Mustang", trim: "Mustang" },
]

const SPECIAL_WORDS = /\b(hybrid|hev|phev|plug in|electric|ev|4xe|performance|dark horse|rubicon|trd|wilderness|lightning|zr2|raptor)\b/

/**
 * The version we pick when someone chooses a model without a trim: a
 * strong catalog match with a plain name (not a hybrid or a special edition,
 * unless that's all there is), shortest name first.
 */
export function defaultTrim(trims: readonly CatalogTrim[]): CatalogTrim | null {
  if (trims.length === 0) return null
  const score = (trim: CatalogTrim) =>
    (trim.confidence === "high" ? 0 : trim.confidence === "limited" ? 2 : 4) +
    (SPECIAL_WORDS.test(normalizeName(trim.name)) ? 1 : 0)
  return [...trims].sort((left, right) => score(left) - score(right) || left.name.length - right.name.length || left.name.localeCompare(right.name))[0]
}

export function modelTrims(catalog: VehicleCatalog, year: number, make: string, model: string): CatalogTrim[] {
  return catalog.vehicles[String(year)]?.[make]?.[model] ?? []
}

/** A full pick for a model in a year, or null when the catalog doesn't list it. */
export function resolveCar(catalog: VehicleCatalog, year: number, car: QuickCar): VehiclePick | null {
  const trims = modelTrims(catalog, year, car.make, car.model)
  if (trims.length === 0) return null
  const named = car.trim ? trims.find((trim) => trim.name === car.trim) : undefined
  const chosen = named ?? defaultTrim(trims)
  if (!chosen) return null
  return { year, make: car.make, model: car.model, trim: chosen.name }
}

/**
 * Split a typed search into a model year and the rest: "2015 civic" gives
 * 2015 and "civic". Only a whole four-digit word from 1980 to 2099 counts.
 */
export function parseCarQuery(query: string): { year: number | null; text: string } {
  const words = query.trim().split(/\s+/).filter(Boolean)
  const index = words.findIndex((word) => /^(19[89]\d|20\d\d)$/.test(word))
  if (index === -1) return { year: null, text: words.join(" ") }
  const year = Number(words[index])
  return { year, text: [...words.slice(0, index), ...words.slice(index + 1)].join(" ") }
}

/**
 * Models in one model year whose make and model contain every word typed.
 * "model y", "tesla y", "crv", and "cr-v" all work. Best matches first.
 */
export function searchModels(catalog: VehicleCatalog, year: number, query: string, limit = 20): ModelHit[] {
  const words = normalizeName(query).split(" ").filter(Boolean)
  if (words.length === 0) return []
  const bucket = catalog.vehicles[String(year)] ?? {}
  const hits: { hit: ModelHit; score: number }[] = []
  for (const [make, models] of Object.entries(bucket)) {
    for (const [model, trims] of Object.entries(models)) {
      const makeWords = normalizeName(make)
      const modelWords = normalizeName(model)
      const full = `${makeWords} ${modelWords}`
      const squeezed = full.replace(/ /g, "")
      const matches = words.every((word) => full.includes(word) || squeezed.includes(word))
      if (!matches) continue
      const typed = words.join(" ")
      let score = 3
      if (modelWords === typed || full === typed || `${makeWords} ${modelWords}`.endsWith(typed)) score = 0
      else if (modelWords.startsWith(words[0]) || makeWords.startsWith(words[0])) score = 1
      else if (full.split(" ").some((part) => part.startsWith(words[0]))) score = 2
      hits.push({ hit: { year, make, model, trims }, score })
    }
  }
  return hits
    .sort(
      (left, right) =>
        left.score - right.score ||
        left.hit.model.length - right.hit.model.length ||
        `${left.hit.make} ${left.hit.model}`.localeCompare(`${right.hit.make} ${right.hit.model}`),
    )
    .slice(0, limit)
    .map((item) => item.hit)
}

export function carKey(pick: VehiclePick): string {
  return `${pick.year}|${pick.make}|${pick.model}|${pick.trim}`
}

export function carName(pick: Pick<VehiclePick, "year" | "make" | "model">): string {
  return `${pick.year} ${pick.make} ${pick.model}`
}
