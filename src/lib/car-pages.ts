/**
 * The car pages (/cars/<slug>): which cars get one, their addresses, and
 * everything a page shows, worked out at build time from the same engine as
 * the rest of the site.
 *
 * Which cars: the site's popular lists plus data/car-pages.json. A car gets
 * a page only when the Highway Loss Data Institute has claims results for
 * that model (not just an average for its kind of car), so every page says
 * something about that car in particular. The page leads with the newest
 * model year our claims data covers, and says which.
 *
 * Addresses: the make and model, lowercase, with dashes ("toyota-rav4").
 * No year, so an address survives the yearly data refresh. See the file's
 * "_readme".
 */
import { carListings, carSlug, MODELS_ENABLED, type CarListing } from "./car-page-links"
import type { VehicleCatalog, VehiclePick } from "./catalog"
import { UNRESOLVED_TRIM_NAME } from "./catalog"
import { VEHICLE_CLASS_LABELS, vehicleFacts, type VehicleFacts } from "./catalog-class"
import { preferredTrim, yearSpans, yearsWithModel } from "./agent-cars"
import {
  estimate,
  FACTOR_BUNDLE,
  nationalTypicalStart,
  teenAddedToPolicy,
  vehicleAgeKey,
  vehicleRelativity,
  type Estimate,
  type StartingPoint,
  type TeenAdded,
  type VehicleRelativity,
} from "./factor-engine"
import { aboutTheSame } from "./format"
import { DEFAULT_SCENARIO, type Scenario, type StateCode } from "./scenario"

export { carListings, carSlug, MODELS_ENABLED, type CarListing }

export const CLAIMS_YEARS = { first: FACTOR_BUNDLE.vehicle.yearMin, last: FACTOR_BUNDLE.vehicle.yearMax }

export type CarPage = CarListing & {
  pick: VehiclePick
  facts: VehicleFacts
  relativity: VehicleRelativity
  /** "Toyota Prius Prime": the make and model without the catalog's notes in parentheses. */
  shortName: string
  /** "2024 Toyota Prius Prime" */
  name: string
  classLabel: string | null
  /** HLDI's size class, like "SUVs / Small" or "Luxury SUVs / Midsize": what "similar" means. */
  segment: string
}

/** "Prius Prime (PHEV)" as "Prius Prime". */
export function displayModel(model: string): string {
  return model.replace(/\s*\([^)]*\)/g, "").trim()
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

/** The cars that get a page, in listing order. None when the per-model claims data is off. */
export function carPages(catalog: VehicleCatalog): CarPage[] {
  if (!MODELS_ENABLED) return []
  const cached = PAGES.get(catalog)
  if (cached) return cached
  const pages = carListings().flatMap((listing) => {
    const found = claimsYearPick(catalog, listing.make, listing.model)
    if (!found) return []
    const shortName = `${listing.make} ${displayModel(listing.model)}`
    return [
      {
        ...listing,
        ...found,
        shortName,
        name: `${found.pick.year} ${shortName}`,
        classLabel: found.facts.classId ? VEHICLE_CLASS_LABELS[found.facts.classId] : null,
        segment: found.relativity.rows[0]?.hldiClass ?? "",
      },
    ]
  })
  PAGES.set(catalog, pages)
  return pages
}

export function carPageBySlug(catalog: VehicleCatalog, slug: string): CarPage | null {
  return carPages(catalog).find((page) => page.slug === slug) ?? null
}

/** The page for a make and model, if there is one. */
export function carPageFor(catalog: VehicleCatalog, make: string, model: string): CarPage | null {
  return carPages(catalog).find((page) => page.make === make && page.model === model) ?? null
}

// ---------------------------------------------------------------------------
// What a page shows

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
    const value = median(
      relativity.rows.flatMap((row) => {
        const found = pick(row)
        return found === null ? [] : [found]
      }),
    )
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

export { aboutTheSame }

/** A full-coverage bill in two parts: what pays for damage you cause others, and what fixes your own car. */
export type BillParts = { liability: number; ownCar: number }

function billParts(start: StartingPoint, driver: Scenario, vehicle: VehicleFacts | "average"): BillParts {
  const full = estimate(start, driver, { vehicle }).likely
  // Liability only at the same 100/300/100 limits: the part that doesn't fix your own car.
  const liability = estimate(start, { ...driver, coverage: "standard" }, { vehicle }).likely
  return { liability, ownCar: full - liability }
}

export type YearRow = {
  year: number
  /** "0–3 years old" */
  ageWords: string
  trim: string
  adult: Estimate
  /** The same driver with liability only (100/300/100): no coverage for the car itself. */
  liabilityOnly: Estimate
  teen: TeenAdded
  /** A 16-year-old alone on their own policy with this car. */
  teenOwn: Estimate
  /** The claims results come from a later model year than this one. */
  claimsFromLater: boolean
}

export type TrimRow = { trim: string; likely: number }

export type SimilarCar = { slug: string; name: string; shortName: string; likely: number; low: number; high: number }

export type CarFigures = {
  page: CarPage
  start: StartingPoint
  /** A typical 45-year-old, national typical start, this car. */
  adult: Estimate
  /** The same driver with an average car of the same model year. */
  averageCar: Estimate
  /** The two parts of the bill, this car and an average car of the same year. */
  parts: { car: BillParts; average: BillParts }
  /** Adding a 16-year-old to that 45-year-old's policy, with this car. */
  teen: TeenAdded
  /** The same, with an average car of the same model year. */
  teenAverageCar: TeenAdded
  claims: ClaimsSummary
  /** One model year per age band the catalog lists, newest first. */
  years: YearRow[]
  /** Every model year the catalog lists this model for, like "2006–2027". */
  yearsListed: string
  /** Every version the catalog lists for the page's model year, cheapest first. */
  trims: TrimRow[]
  /** Of all the car pages, where this car ranks for adding a teen (1 = least). */
  teenRank: { rank: number; of: number }
  /** The same car for drivers of other ages, on their own policy, nationally. */
  otherDrivers: { ages: string; estimate: Estimate }[]
  /** Where the car ranks by price among its similar cars (1 = least), including itself. */
  groupRank: { rank: number; of: number }
  similar: { cheaper: SimilarCar[]; pricier: SimilarCar[]; basis: "segment" | "class" }
}

const AGE_WORDS: Record<string, string> = {
  "0-3": "0–3 years old",
  "4-7": "4–7 years old",
  "8-12": "8–12 years old",
  "13-plus": "13 or more years old",
}

/** A version name as shown: the model name when the catalog couldn't name one. */
export function trimName(trim: string, model: string): string {
  return trim === UNRESOLVED_TRIM_NAME ? displayModel(model) : trim
}

function teenAlone(driver: Scenario): Scenario {
  return { ...driver, age: "16-18", yearsLicensed: "under-1", teen: true }
}

/** One row per age band: the newest year in each band that the catalog lists for this model. */
function yearRows(catalog: VehicleCatalog, page: CarPage, start: StartingPoint): YearRow[] {
  const listed = yearsWithModel(catalog, page.make, page.model).filter((year) => year <= page.pick.year)
  const rows: YearRow[] = []
  const seen = new Set<string>()
  for (const year of listed) {
    const band = vehicleAgeKey(year)
    if (seen.has(band)) continue
    const trim = preferredTrim(catalog, year, page.make, page.model)
    if (!trim) continue
    const pick = { year, make: page.make, model: page.model, trim }
    const facts = vehicleFacts(catalog, pick)
    const relativity = vehicleRelativity(facts)
    if (relativity.level !== "model") continue
    seen.add(band)
    const driver = adultDriver(pick)
    rows.push({
      year,
      ageWords: AGE_WORDS[band] ?? band,
      trim: trimName(trim, page.model),
      adult: estimate(start, driver, { vehicle: facts }),
      liabilityOnly: estimate(start, { ...driver, coverage: "standard" }, { vehicle: facts }),
      teen: teenAddedToPolicy(start, driver, { vehicle: facts }),
      teenOwn: estimate(nationalTypicalStart(teenAlone(driver)), teenAlone(driver), { vehicle: facts }),
      claimsFromLater: year < CLAIMS_YEARS.first,
    })
  }
  return rows
}

/** Every version of the model in the page's year, priced for the same driver, cheapest first. */
function trimRows(catalog: VehicleCatalog, page: CarPage, start: StartingPoint): TrimRow[] {
  const trims = catalog.vehicles[String(page.pick.year)]?.[page.make]?.[page.model] ?? []
  return trims
    .map((trim) => {
      const pick = { ...page.pick, trim: trim.name }
      const facts = vehicleFacts(catalog, pick)
      return { trim: trimName(trim.name, page.model), likely: estimate(start, adultDriver(pick), { vehicle: facts }).likely }
    })
    .sort((left, right) => left.likely - right.likely || left.trim.localeCompare(right.trim))
}

/** Other drivers a page shows the car for, each with the usual years licensed at that age. */
const OTHER_DRIVERS: { ages: string; age: Scenario["age"]; years: Scenario["yearsLicensed"] }[] = [
  { ages: "22–25", age: "22-25", years: "4-9" },
  { ages: "26–39", age: "26-39", years: "10+" },
  { ages: "65 and older", age: "65+", years: "10+" },
]

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
  const averageCar = estimate(own.start, own.driver, { vehicle: "average" })
  const teenAverageCar = teenAddedToPolicy(own.start, own.driver, { vehicle: "average" })

  const byTeen = [...all].sort((left, right) => left.teen.increase - right.teen.increase || left.other.slug.localeCompare(right.other.slug))
  const teenRank = { rank: byTeen.findIndex((item) => item.other.slug === slug) + 1, of: byTeen.length }

  // Similar cars: the same HLDI size class (small SUVs with small SUVs, luxury with luxury), else the same EPA class.
  const others = all.filter((item) => item.other.slug !== slug)
  const segment = others.filter((item) => page.segment !== "" && item.other.segment === page.segment)
  const basis: "segment" | "class" = segment.length >= 3 ? "segment" : "class"
  const pool = (basis === "segment" ? segment : others.filter((item) => page.facts.classId !== null && item.other.facts.classId === page.facts.classId)).map(
    (item) => ({
      slug: item.other.slug,
      name: item.other.name,
      shortName: item.other.shortName,
      likely: item.adult.likely,
      low: item.adult.low,
      high: item.adult.high,
    }),
  )
  const groupRank = { rank: pool.filter((item) => item.likely < own.adult.likely).length + 1, of: pool.length + 1 }
  const cheaper = pool
    .filter((item) => item.likely < own.adult.likely)
    .sort((left, right) => right.likely - left.likely)
    .slice(0, 4)
  const pricier = pool
    .filter((item) => item.likely >= own.adult.likely)
    .sort((left, right) => left.likely - right.likely)
    .slice(0, 4)

  const figures: CarFigures = {
    page,
    start: own.start,
    adult: own.adult,
    averageCar,
    parts: { car: billParts(own.start, own.driver, page.facts), average: billParts(own.start, own.driver, "average") },
    teen: own.teen,
    teenAverageCar,
    claims: claimsSummary(page.relativity),
    years: yearRows(catalog, page, own.start),
    yearsListed: yearSpans(yearsWithModel(catalog, page.make, page.model)),
    trims: trimRows(catalog, page, own.start),
    teenRank,
    otherDrivers: OTHER_DRIVERS.map((driver) => {
      const scenario: Scenario = { ...own.driver, age: driver.age, yearsLicensed: driver.years }
      return { ages: driver.ages, estimate: estimate(nationalTypicalStart(scenario), scenario, { vehicle: page.facts }) }
    }),
    groupRank,
    similar: { cheaper, pricier, basis },
  }
  byCatalog.set(slug, figures)
  return figures
}
