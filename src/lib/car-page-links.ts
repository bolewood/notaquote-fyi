/**
 * Which cars have a page at /cars/<slug>, without the engine, so the What-if
 * and Compare pages can link to them from the browser. The site's popular
 * lists always get a page; data/car-pages.json adds the rest. A page is only
 * built when HLDI has claims results for the model (src/lib/car-pages.ts),
 * and a test checks every car listed here gets one.
 */
import carPagesFile from "../../data/car-pages.json"
import factorBundle from "@/data/model-factors.json"
import { FIRST_CARS, POPULAR_SUVS, TRUCKS_AND_FUN, type QuickCar } from "./car-search"
import { normalizeName } from "./catalog-match"

type ListedCar = { make: string; model: string; why: string; slug?: string }

type CarPagesFile = { _readme: string; cars: ListedCar[] }

const FILE = carPagesFile as CarPagesFile

/** "Toyota" + "RAV4" as "toyota-rav4". Words in parentheses drop out. */
export function carSlug(make: string, model: string): string {
  return normalizeName(`${make} ${model}`).replace(/ /g, "-")
}

export type CarListing = { make: string; model: string; slug: string; why: string }

const PRESET_WHY: [readonly QuickCar[], string][] = [
  [FIRST_CARS, "on the site's list of popular first cars"],
  [POPULAR_SUVS, "on the site's list of popular SUVs"],
  [TRUCKS_AND_FUN, "on the site's list of trucks and fun ones"],
]

/** Every car we'd like a page for, presets first, each make and model once. */
export function carListings(): CarListing[] {
  const seen = new Set<string>()
  const listings: CarListing[] = []
  const add = (make: string, model: string, why: string, slug?: string) => {
    const key = `${make}|${model}`
    if (seen.has(key)) return
    seen.add(key)
    listings.push({ make, model, why, slug: slug ?? carSlug(make, model) })
  }
  for (const [cars, why] of PRESET_WHY) for (const car of cars) add(car.make, car.model, why)
  for (const car of FILE.cars) add(car.make, car.model, car.why, car.slug)
  return listings
}

const SLUGS = new Map(carListings().map((listing) => [`${listing.make}|${listing.model}`, listing.slug]))

/**
 * The page for a make and model, if it has one. Off when the per-model
 * claims data is switched off (then no car gets a page).
 */
export function carPagePath(make: string, model: string): string | null {
  if (!factorBundle.vehicle.modelsEnabled) return null
  const slug = SLUGS.get(`${make}|${model}`)
  return slug ? `/cars/${slug}` : null
}
