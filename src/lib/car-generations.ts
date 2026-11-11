/**
 * A car page's "by generation" section: each US generation the catalog covers, with its model years,
 * its photo, and what each model year costs to insure for the page's example driver. Generations and
 * their US model years come from the photo library (data/photos/site-generations.json, built by
 * `npm run photos:coverage` from Wikipedia, with sources); prices come from the same engine as the rest
 * of the page, one model year at a time, from HLDI's results for that year.
 */
import siteGenerations from "../../data/photos/site-generations.json"
import { preferredTrim } from "./agent-cars"
import type { VehicleCatalog } from "./catalog"
import { vehicleFacts } from "./catalog-class"
import { PHOTOS, type CarPhoto, type PhotoLibrary } from "./car-photos"
import { adultDriver, type CarFigures } from "./car-pages"
import { estimate, teenAddedToPolicy, vehicleRelativity } from "./factor-engine"

type SiteGeneration = {
  id: string
  label: string
  from: number
  to: number | null
  years: number[]
}

const GENERATIONS = siteGenerations as Record<string, SiteGeneration[]>

const ORDINALS = [
  "first",
  "second",
  "third",
  "fourth",
  "fifth",
  "sixth",
  "seventh",
  "eighth",
  "ninth",
  "tenth",
  "eleventh",
  "twelfth",
  "thirteenth",
  "fourteenth",
  "fifteenth",
]

/**
 * A generation's name as the page shows it. "Ford Escape (second generation)" → "Second generation";
 * "Second generation (T32; 2014)" → "Second generation (T32)"; "BMW X3 (E83)" → "E83". Null when the
 * label names neither (a model with one generation), so the page names it by its years.
 */
export function generationName(label: string): string | null {
  const ordinal = ORDINALS.find((word) => new RegExp(`\\b${word} generation\\b`, "i").test(label))
  const inside = /\(([^)]*)\)/.exec(label)?.[1] ?? ""
  // A chassis code: capitals and digits ("T32", "XV50", "GMT900/GMT922", "8R", "BK"), not a year.
  const code = inside
    .split(/[,;]/)
    .map((part) => part.trim())
    .find((part) => /^[A-Z0-9][A-Z0-9/-]{1,13}$/.test(part) && /[A-Z]/.test(part) && !/^\d{4}$/.test(part))
  if (ordinal) return `${ordinal.charAt(0).toUpperCase()}${ordinal.slice(1)} generation${code ? ` (${code})` : ""}`
  return code ?? null
}

export type GenerationYear = {
  year: number
  /** The page's example driver (a 45-year-old, full coverage, national typical price). */
  adult: number
  /** Adding a 16-year-old to that driver's policy. */
  teen: number
  /** HLDI has no results for this model year yet: priced from its newest results for the model. */
  borrowed: boolean
}

export type CarGeneration = {
  id: string
  /** "Second generation (T32)", or null to name it by its years. */
  name: string | null
  /** The generation's US model years: from, and to (null while it's still sold). */
  from: number
  to: number | null
  /** The model years priced here: the ones the catalog lists, not the ones the US didn't get. */
  years: GenerationYear[]
  /** Catalog years HLDI has no results of its own for (only its size class's): listed, not priced. */
  missing: number[]
  /** The first model year the catalog lists for this generation (later than `from` when the catalog starts later). */
  firstListed: number
  /** Null when no year has HLDI results of its own. */
  adult: { low: number; high: number } | null
  teen: { low: number; high: number } | null
  photo: CarPhoto | null
}

/** The photo the library picked for this generation: the one for its newest shown year. */
function generationPhoto(slug: string, id: string, library: PhotoLibrary): CarPhoto | null {
  const entries = Object.entries(library[slug] ?? {})
    .filter(([, photo]) => photo?.generation === id)
    .sort(([a], [b]) => Number(b) - Number(a))
  return entries[0]?.[1] ?? null
}

/** The page's generations, oldest first, each priced year by year. Empty when the library has none. */
// Every generation the catalog lists is returned, even one HLDI has no results of its own for (no prices).
export function carGenerations(catalog: VehicleCatalog, f: CarFigures, library: PhotoLibrary = PHOTOS): CarGeneration[] {
  const { page } = f
  return (GENERATIONS[page.slug] ?? []).map((generation) => {
    const missing: number[] = []
    const years = generation.years.flatMap((year): GenerationYear[] => {
      const trim = preferredTrim(catalog, year, page.make, page.model)
      if (!trim) return []
      const pick = { year, make: page.make, model: page.model, trim }
      const facts = vehicleFacts(catalog, pick)
      const relativity = vehicleRelativity(facts)
      // Only years HLDI rates this model itself; a size-class figure isn't this car, so say so instead.
      if (relativity.level !== "model") {
        missing.push(year)
        return []
      }
      const driver = adultDriver(pick)
      return [
        {
          year,
          adult: estimate(f.start, driver, { vehicle: facts }).likely,
          teen: teenAddedToPolicy(f.start, driver, { vehicle: facts }).increase,
          borrowed: relativity.outsideYears,
        },
      ]
    })
    const span = (values: number[]) => (values.length ? { low: Math.min(...values), high: Math.max(...values) } : null)
    return {
      id: generation.id,
      name: generationName(generation.label),
      from: generation.from,
      to: generation.to,
      years,
      missing,
      firstListed: generation.years[0],
      adult: span(years.map((row) => row.adult)),
      teen: span(years.map((row) => row.teen)),
      photo: generationPhoto(page.slug, generation.id, library),
    }
  })
}
