/**
 * The car pages (/cars/<slug>): which cars get one, their addresses, and
 * everything a page shows, worked out at build time from the same engine as
 * the rest of the site.
 *
 * Which cars: the site's popular lists plus data/car-pages.json. A car gets
 * a page only when the Highway Loss Data Institute has claims results for
 * that model (not just an average for its kind of car), so every page says
 * something about that car in particular. The page uses the newest model
 * year our claims data covers, and says which.
 *
 * Addresses: the make and model, lowercase, with dashes ("toyota-rav4").
 * No year, so an address survives the yearly data refresh. See the file's
 * "_readme".
 */
import { carListings, carSlug, type CarListing } from "./car-page-links"
import type { VehicleCatalog, VehiclePick } from "./catalog"
import { VEHICLE_CLASS_LABELS, vehicleFacts, type VehicleFacts } from "./catalog-class"
import { preferredTrim } from "./agent-cars"
import {
  estimate,
  FACTOR_BUNDLE,
  nationalTypicalStart,
  teenAddedToPolicy,
  typicalStart,
  vehicleRelativity,
  type Estimate,
  type StartingPoint,
  type TeenAdded,
  type VehicleRelativity,
} from "./factor-engine"
import { DEFAULT_SCENARIO, stateName, type Scenario, type StateCode } from "./scenario"

export { carListings, carSlug, type CarListing }

export const CLAIMS_YEARS = { first: FACTOR_BUNDLE.vehicle.yearMin, last: FACTOR_BUNDLE.vehicle.yearMax }

export type CarPage = CarListing & {
  pick: VehiclePick
  facts: VehicleFacts
  relativity: VehicleRelativity
  /** "2024 Toyota RAV4" */
  name: string
  /** "Toyota RAV4" */
  shortName: string
  classLabel: string | null
}

/**
 * The newest model year, within the years our claims data covers, that the
 * catalog lists and that has model-level claims results. Null when there's
 * none: no page.
 */
export function claimsYearPick(catalog: VehicleCatalog, make: string, model: string): { pick: VehiclePick; facts: VehicleFacts; relativity: VehicleRelativity } | null {
  for (let year = CLAIMS_YEARS.last; year >= CLAIMS_YEARS.first; year -= 1) {
    const trim = preferredTrim(catalog, year, make, model)
    if (!trim) continue
    const pick = { year, make, model, trim }
    const facts = vehicleFacts(catalog, pick)
    const relativity = vehicleRelativity(facts)
    if (relativity.level === "model" && !relativity.outsideYears) return { pick, facts, relativity }
  }
  return null
}

const PAGES = new WeakMap<VehicleCatalog, CarPage[]>()

/** The cars that get a page, in listing order. */
export function carPages(catalog: VehicleCatalog): CarPage[] {
  const cached = PAGES.get(catalog)
  if (cached) return cached
  const pages = carListings().flatMap((listing) => {
    const found = claimsYearPick(catalog, listing.make, listing.model)
    if (!found) return []
    return [
      {
        ...listing,
        ...found,
        name: `${found.pick.year} ${listing.make} ${listing.model}`,
        shortName: `${listing.make} ${listing.model}`,
        classLabel: found.facts.classId ? VEHICLE_CLASS_LABELS[found.facts.classId] : null,
      },
    ]
  })
  PAGES.set(catalog, pages)
  return pages
}

export function carPageBySlug(catalog: VehicleCatalog, slug: string): CarPage | null {
  return carPages(catalog).find((page) => page.slug === slug) ?? null
}

/** The page for a make and model, if there is one (for links from the What-if and Compare pages). */
export function carPageFor(catalog: VehicleCatalog, make: string, model: string): CarPage | null {
  return carPages(catalog).find((page) => page.make === make && page.model === model) ?? null
}

// ---------------------------------------------------------------------------
// What a page shows

/** Example states on every car page: one of the priciest, one near the middle, one of the cheapest. */
export const EXAMPLE_STATES: readonly StateCode[] = ["FL", "CA", "OH"]

/** The driver on a car page: a 40–64-year-old (we say 45), clean record, full coverage, suburbs. */
export function adultDriver(pick: VehiclePick, state: StateCode = DEFAULT_SCENARIO.state): Scenario {
  return { ...DEFAULT_SCENARIO, state, ...pick }
}

export type ClaimsWord = "much lower" | "lower" | "about average" | "higher" | "much higher"

/** HLDI results are relative to an average car (100). Words, not the figures themselves. */
export function claimsWord(value: number): ClaimsWord {
  if (value <= 80) return "much lower"
  if (value <= 92) return "lower"
  if (value < 108) return "about average"
  if (value < 120) return "higher"
  return "much higher"
}

function median(values: number[]): number | null {
  if (values.length === 0) return null
  const sorted = [...values].sort((left, right) => left - right)
  const middle = Math.floor(sorted.length / 2)
  return sorted.length % 2 === 1 ? sorted[middle] : (sorted[middle - 1] + sorted[middle]) / 2
}

export type ClaimsSummary = {
  /** Collision claims: fixing this car after a crash. */
  repairs: ClaimsWord | null
  /** Comprehensive claims: theft, weather, glass, and hitting an animal. */
  theftAndWeather: ClaimsWord | null
  /** Property-damage liability: damage this car's drivers do to others. */
  damageToOthers: ClaimsWord | null
  /** Bodily-injury liability: injuries this car's drivers cause. */
  injuriesToOthers: ClaimsWord | null
  /** The HLDI series we matched, like "Toyota RAV4 4dr". */
  series: string[]
}

export function claimsSummary(relativity: VehicleRelativity): ClaimsSummary {
  const word = (pick: (row: VehicleRelativity["rows"][number]) => number | null) => {
    const value = median(relativity.rows.flatMap((row) => {
      const found = pick(row)
      return found === null ? [] : [found]
    }))
    return value === null ? null : claimsWord(value)
  }
  return {
    repairs: word((row) => row.collision),
    theftAndWeather: word((row) => row.comprehensive),
    damageToOthers: word((row) => row.propertyDamage),
    injuriesToOthers: word((row) => row.bodilyInjury),
    series: relativity.rows.map((row) => row.series),
  }
}

/** A factor in hundredths as words against an average car: 190 as "90% more", 89 as "11% less". */
export function factorWords(hundredths: number): string {
  const percent = hundredths - 100
  if (Math.abs(percent) < 3) return "about the same"
  return percent > 0 ? `${percent}% more` : `${-percent}% less`
}

export type CarFigures = {
  page: CarPage
  start: StartingPoint
  /** A typical 45-year-old, national typical start, this car. */
  adult: Estimate
  /** The same driver with an average car of the same model year. */
  averageCar: Estimate
  states: { state: StateCode; name: string; estimate: Estimate }[]
  /** Adding a 16-year-old to that 45-year-old's policy, with this car. */
  teen: TeenAdded
  /** The same, with an average car of the same model year. */
  teenAverageCar: TeenAdded
  claims: ClaimsSummary
  /** Of all the car pages, where this car ranks for adding a teen (1 = least). */
  teenRank: { rank: number; of: number }
  similar: { cheaper: SimilarCar[]; pricier: SimilarCar[] }
}

export type SimilarCar = { slug: string; name: string; shortName: string; likely: number; low: number; high: number }

const FIGURES = new WeakMap<VehicleCatalog, Map<string, CarFigures>>()

function national(page: CarPage) {
  const driver = adultDriver(page.pick)
  const start = nationalTypicalStart(driver)
  const adult = estimate(start, driver, { vehicle: page.facts })
  const teen = teenAddedToPolicy(start, driver, { vehicle: page.facts })
  return { other: page, start, driver, adult, teen }
}

const NATIONAL = new WeakMap<VehicleCatalog, ReturnType<typeof national>[]>()

/** Every car page's national figures, worked out once per catalog. */
function nationalAll(catalog: VehicleCatalog): ReturnType<typeof national>[] {
  const cached = NATIONAL.get(catalog)
  if (cached) return cached
  const all = carPages(catalog).map(national)
  NATIONAL.set(catalog, all)
  return all
}

/** Everything one car page shows. Worked out once per build. */
export function carFigures(catalog: VehicleCatalog, slug: string): CarFigures | null {
  let byCatalog = FIGURES.get(catalog)
  if (!byCatalog) {
    byCatalog = new Map()
    FIGURES.set(catalog, byCatalog)
  }
  const cached = byCatalog.get(slug)
  if (cached) return cached
  const page = carPageBySlug(catalog, slug)
  if (!page) return null

  const all = nationalAll(catalog)
  const own = all.find((item) => item.other.slug === slug)!
  const averageDriver: Scenario = { ...own.driver }
  const averageCar = estimate(own.start, averageDriver, { vehicle: "average" })
  const teenAverageCar = teenAddedToPolicy(own.start, averageDriver, { vehicle: "average" })

  const states = EXAMPLE_STATES.map((state) => {
    const driver = adultDriver(page.pick, state)
    const start = typicalStart(driver)
    if (!start) throw new Error(`No typical price for ${state}`)
    return { state, name: stateName(state), estimate: estimate(start, driver, { vehicle: page.facts }) }
  })

  const byTeen = [...all].sort((left, right) => left.teen.increase - right.teen.increase || left.other.slug.localeCompare(right.other.slug))
  const teenRank = { rank: byTeen.findIndex((item) => item.other.slug === slug) + 1, of: byTeen.length }

  const sameClass = all
    .filter((item) => item.other.slug !== slug && page.facts.classId !== null && item.other.facts.classId === page.facts.classId)
    .map((item) => ({
      slug: item.other.slug,
      name: item.other.name,
      shortName: item.other.shortName,
      likely: item.adult.likely,
      low: item.adult.low,
      high: item.adult.high,
    }))
  const cheaper = sameClass
    .filter((item) => item.likely < own.adult.likely)
    .sort((left, right) => right.likely - left.likely)
    .slice(0, 3)
  const pricier = sameClass
    .filter((item) => item.likely >= own.adult.likely)
    .sort((left, right) => left.likely - right.likely)
    .slice(0, 3)

  const figures: CarFigures = {
    page,
    start: own.start,
    adult: own.adult,
    averageCar,
    states,
    teen: own.teen,
    teenAverageCar,
    claims: claimsSummary(page.relativity),
    teenRank,
    similar: { cheaper, pricier },
  }
  byCatalog.set(slug, figures)
  return figures
}
