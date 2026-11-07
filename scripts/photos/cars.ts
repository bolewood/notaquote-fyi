/** The cars the photo library covers: every car page, with the model years the catalog lists for it. */
import { SERVER_CATALOG } from "../../src/lib/agent-catalog"
import { yearsWithModel } from "../../src/lib/agent-cars"
import { carFigures, carPages, displayModel } from "../../src/lib/car-pages"

export type LibraryCar = {
  slug: string
  make: string
  /** The catalog's model name, like "Prius Prime (PHEV)". */
  model: string
  /** "Toyota Prius Prime" */
  name: string
  /** Every model year the catalog lists. */
  years: number[]
  /** The model years the car page shows (its headline year and the used-year rows). */
  shownYears: number[]
}

export function libraryCars(): LibraryCar[] {
  return carPages(SERVER_CATALOG).map((page) => {
    const figures = carFigures(SERVER_CATALOG, page.slug)!
    return {
      slug: page.slug,
      make: page.make,
      model: page.model,
      name: `${page.make} ${displayModel(page.model)}`,
      years: [...yearsWithModel(SERVER_CATALOG, page.make, page.model)].sort((a, b) => a - b),
      shownYears: [...new Set([page.pick.year, ...figures.years.map((row) => row.year)])].sort((a, b) => a - b),
    }
  })
}

/** Pick cars by slug from the command line (none = all). */
export function selectCars(args: readonly string[]): LibraryCar[] {
  const all = libraryCars()
  const wanted = args.filter((arg) => !arg.startsWith("--"))
  if (wanted.length === 0) return all
  const unknown = wanted.filter((slug) => !all.some((car) => car.slug === slug))
  if (unknown.length > 0) throw new Error(`No car page for: ${unknown.join(", ")}`)
  return all.filter((car) => wanted.includes(car.slug))
}
