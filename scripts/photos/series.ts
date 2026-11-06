/**
 * Step 1: which Wikipedia article and Wikidata item describe each car.
 *
 *   npm run photos:series            # resolve any car without an entry
 *   npm run photos:series -- <slug>  # just that car
 *
 * Writes data/photos/series.json. Existing entries are never overwritten, so
 * hand fixes stay; delete an entry to resolve it again. Check new entries:
 * a shared name (Trailblazer, Pacifica, Ranger) can resolve to the wrong
 * vehicle, which "eras" in the entry then fixes.
 */
import { readFile, writeFile } from "node:fs/promises"
import { api, chunks, getJson } from "./http"
import { selectCars } from "./cars"

export const SERIES_FILE = "data/photos/series.json"

export type SeriesEntry = {
  /** English Wikipedia article for the model (the whole nameplate). */
  wikipedia: string
  /** Wikidata item for the model series. */
  wikidata: string | null
  /** How the entry was made: "auto" (check it) or "checked" (a person or a review confirmed it). */
  status: "auto" | "checked"
  note?: string
  /** Section headings or article titles (regular expressions) that aren't this car, like "Electric" or "Raptor". */
  exclude?: string[]
  /**
   * Set by hand when Wikipedia can't be read automatically, or when one name
   * covers different vehicles over the years (a Trailblazer is an SUV in
   * 2006–09 and a small crossover from 2021). Each needs a source article.
   */
  generations?: {
    label: string
    from: number
    to: number | null
    article?: string
    section?: string
    commons?: string
    note?: string
    /** Where the years come from, when it isn't the article's infobox: a quote or URL. */
    source?: string
  }[]
  /**
   * Model years the catalog lists that weren't sold in the US under this
   * name (a skipped year, a listing ahead of launch). Coverage leaves them
   * out, with the reason.
   */
  notSold?: { years: number[]; note: string; source?: string }
}

export async function readSeries(): Promise<Record<string, SeriesEntry>> {
  try {
    return JSON.parse(await readFile(SERIES_FILE, "utf8"))
  } catch {
    return {}
  }
}

/** "Toyota Prius Prime (PHEV)" → "Toyota Prius Prime"; "BMW 330i" → "BMW 3 Series". */
function titleGuess(make: string, model: string): string {
  const plain = model.replace(/\s*\([^)]*\)/g, "").trim()
  if (make === "BMW" && /^3\d\di$/.test(plain)) return "BMW 3 Series"
  if (make === "Ram" && plain === "1500") return "Ram pickup"
  if (make === "Mercedes-Benz") return `Mercedes-Benz ${plain.replace(/-Class$/, "-Class")}`
  return `${make} ${plain}`
}

type QueryPage = { title: string; missing?: boolean; pageprops?: { wikibase_item?: string; disambiguation?: string }; description?: string }

async function main() {
  const cars = selectCars(process.argv.slice(2))
  const series = await readSeries()
  const todo = cars.filter((car) => !series[car.slug])
  const guesses = new Map(todo.map((car) => [car.slug, titleGuess(car.make, car.model)]))
  for (const group of chunks([...new Set(guesses.values())], 40)) {
    const body = await getJson<{ query: { pages: QueryPage[]; redirects?: { from: string; to: string }[]; normalized?: { from: string; to: string }[] } }>(
      api("en.wikipedia.org", { action: "query", titles: group.join("|"), redirects: "1", prop: "pageprops|description" }),
    )
    const resolve = (title: string) => {
      let current = body.query.normalized?.find((item) => item.from === title)?.to ?? title
      const redirect = body.query.redirects?.find((item) => item.from === current)
      if (redirect) current = redirect.to
      return body.query.pages.find((page) => page.title === current)
    }
    for (const [slug, guess] of guesses) {
      if (!group.includes(guess)) continue
      const page = resolve(guess)
      if (!page || page.missing) {
        console.log(`  ${slug}: no article "${guess}"; add it by hand`)
        continue
      }
      series[slug] = {
        wikipedia: page.title,
        wikidata: page.pageprops?.wikibase_item ?? null,
        status: "auto",
        ...(page.pageprops?.disambiguation !== undefined ? { note: "disambiguation page: fix by hand" } : {}),
      }
      console.log(`  ${slug}: ${page.title} (${page.pageprops?.wikibase_item ?? "no Wikidata item"})${page.title !== guess ? ` ← ${guess}` : ""}`)
    }
  }
  const sorted = Object.fromEntries(Object.entries(series).sort(([a], [b]) => a.localeCompare(b)))
  await writeFile(SERIES_FILE, `${JSON.stringify(sorted, null, 2)}\n`)
  console.log(`${Object.keys(sorted).length} cars in ${SERIES_FILE}`)
}

if (import.meta.url === `file://${process.argv[1]}`) void main()
