/**
 * Which cars have a page at /cars/<slug>, without the engine. The site's
 * popular lists always get a page; data/car-pages.json adds the rest. A page
 * is only built when HLDI has claims results for the model
 * (src/lib/car-pages.ts), and a test checks every car listed here gets one.
 *
 * The What-if and Compare pages load this module only when they need a link
 * (see useCarPagePath), so it doesn't add to their first download.
 */
import carPagesFile from "../../data/car-pages.json"
import factorBundle from "@/data/model-factors.json"
import { FIRST_CARS, POPULAR_SUVS, TRUCKS_AND_FUN, type QuickCar } from "./car-search"
import { normalizeName } from "./catalog-match"

type ListedCar = { make: string; model: string; why?: string; slug?: string; noindex?: boolean }

type CarPagesFile = { _readme: string; cars: ListedCar[] }

const FILE = carPagesFile as CarPagesFile

/** False when the per-model claims data is switched off: then no car gets a page. */
export const MODELS_ENABLED: boolean = factorBundle.vehicle.modelsEnabled

/** "Toyota" + "RAV4" as "toyota-rav4". Words in parentheses drop out. */
export function carSlug(make: string, model: string): string {
  return normalizeName(`${make} ${model}`).replace(/ /g, "-")
}

export type CarListing = {
  make: string
  model: string
  slug: string
  why: string
  /** Kept for visitors but out of search results and the sitemap, by choice ("noindex": true in the file). */
  noindex: boolean
}

const PRESET_WHY: [readonly QuickCar[], string][] = [
  [FIRST_CARS, "on the site's list of popular first cars"],
  [POPULAR_SUVS, "on the site's list of popular SUVs"],
  [TRUCKS_AND_FUN, "on the site's list of trucks and fun ones"],
]

const key = (make: string, model: string) => `${make}|${model}`

/** Slug overrides and noindex flags from the file, for any car, including ones on the popular lists. */
const OVERRIDES = new Map(FILE.cars.filter((car) => car.slug).map((car) => [key(car.make, car.model), car.slug!]))
const NOINDEX = new Set(FILE.cars.filter((car) => car.noindex === true).map((car) => key(car.make, car.model)))

/** Every car we'd like a page for, presets first, each make and model once. */
export function carListings(): CarListing[] {
  const seen = new Set<string>()
  const listings: CarListing[] = []
  const add = (make: string, model: string, why: string) => {
    if (seen.has(key(make, model))) return
    seen.add(key(make, model))
    listings.push({ make, model, why, slug: OVERRIDES.get(key(make, model)) ?? carSlug(make, model), noindex: NOINDEX.has(key(make, model)) })
  }
  for (const [cars, why] of PRESET_WHY) for (const car of cars) add(car.make, car.model, why)
  for (const car of FILE.cars) add(car.make, car.model, car.why ?? "")
  return listings
}

const SLUGS = new Map(carListings().map((listing) => [key(listing.make, listing.model), listing.slug]))

/** The page for a make and model, if it has one. */
export function carPagePath(make: string, model: string): string | null {
  if (!MODELS_ENABLED) return null
  const slug = SLUGS.get(key(make, model))
  return slug ? `/cars/${slug}` : null
}
