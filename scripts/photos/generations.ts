/**
 * Step 2: each car's generations and their US model years, from English
 * Wikipedia, with each generation's Commons category.
 *
 *   npm run photos:generations            # every car
 *   npm run photos:generations -- <slug>  # just those cars
 *
 * Writes data/photos/generations.json (generated: don't edit by hand). To fix
 * a car, set "generations" or "exclude" on its entry in
 * data/photos/series.json and run this again.
 */
import { readFile, writeFile } from "node:fs/promises"
import { selectCars, type LibraryCar } from "./cars"
import { api, chunks, getJson } from "./http"
import { readSeries, type SeriesEntry } from "./series"
import {
  commonsCategory,
  faceliftHints,
  fetchArticles,
  infoboxes,
  infoboxField,
  mainLinks,
  parseYears,
  sections,
  type Article,
} from "./wiki"

export const GENERATIONS_FILE = "data/photos/generations.json"

export type Generation = {
  /** Stable id within the car: "toyota-camry/toyota-camry-xv70". */
  id: string
  /** "Toyota Camry (XV70)", or the section heading for a generation without its own article. */
  label: string
  /** US model years; `to` is null for "present". */
  from: number
  to: number | null
  /** Where the years came from: an infobox's model_years (US), its production years (check them), or series.json. */
  yearsSource: "model_years" | "production" | "series.json"
  yearsNote: string | null
  /** The Wikipedia article (and section) the years come from, at a fixed revision. */
  source: { article: string; section: string | null; revision: number }
  wikidata: string | null
  /** The Commons category for the generation, if Wikipedia or Wikidata names one. */
  commons: string | null
  /** Sentences that mention a facelift with a model year: hints to confirm, not facts. */
  faceliftHints: { modelYear: number; evidence: string }[]
}

export type CarGenerations = {
  slug: string
  name: string
  series: { article: string; revision: number }
  generations: Generation[]
  warnings: string[]
}

function slugify(text: string): string {
  return text
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
}

/** The infobox with US model years: one marked North America first, then any with model years, then the first. */
function bestInfobox(wikitext: string): string | undefined {
  const boxes = infoboxes(wikitext)
  const withYears = boxes.filter((box) => parseYears(infoboxField(box, "model_years")))
  return (
    withYears.find((box) => /north america|united states|\bU\.?S\.?\b/i.test(`${infoboxField(box, "model_years")} ${infoboxField(box, "name") ?? ""}`)) ??
    withYears[0] ??
    boxes[0]
  )
}

/** Generations sold elsewhere, not in the US: left out unless the heading also says North America. */
const NON_US = /\b(japan|japanese|europe|european|china|chinese|india|indian|australia|australian|asia|asian|latin america|brazil|russia|korea|south africa)\b/i

function yearsFrom(infobox: string): { years: ReturnType<typeof parseYears>; source: "model_years" | "production" } | null {
  const model = parseYears(infoboxField(infobox, "model_years"))
  if (model) return { years: model, source: "model_years" }
  const production = parseYears(infoboxField(infobox, "production"))
  return production ? { years: production, source: "production" } : null
}

type Candidate = { label: string; article: Article; section: string | null; infobox: string }

/** Generations named in a series article: section infoboxes and {{Main}} generation articles. */
async function findCandidates(series: Article, entry: SeriesEntry): Promise<{ candidates: Candidate[]; warnings: string[] }> {
  const warnings: string[] = []
  const exclude = (entry.exclude ?? []).map((pattern) => new RegExp(pattern, "i"))
  const excluded = (text: string) => exclude.some((pattern) => pattern.test(text))
  const prefix = `${series.title} (`
  const found: { label: string; mainTitle: string | null; section: string; infobox: string | null }[] = []
  // A subsection counts only when its parent section found nothing: generations
  // sometimes sit one level down (Corolla E170), but variants do too (EL, Max, Hybrid).
  let parentFound = false
  for (const section of sections(series.wikitext)) {
    if (section.heading === "(lead)") continue
    if (section.level === 2) parentFound = false
    else if (parentFound) continue
    if (excluded(section.heading) || (NON_US.test(section.heading) && !/north america/i.test(section.heading))) continue
    const own = infoboxes(section.body).find((box) => /model[_ ]years|production/.test(box)) ?? null
    const main =
      mainLinks(section.body).find(
        (title) => !title.includes("#") && title.startsWith(prefix) && !excluded(title) && !(NON_US.test(title) && !/north america/i.test(title)),
      ) ?? null
    if (own || main) {
      found.push({ label: section.heading, mainTitle: main, section: section.heading, infobox: own })
      if (section.level === 2) parentFound = true
    }
  }
  const mains = await fetchArticles(found.flatMap((item) => (item.mainTitle ? [item.mainTitle] : [])))
  const candidates: Candidate[] = []
  const seen = new Set<string>()
  for (const item of found) {
    const main = item.mainTitle ? mains.get(item.mainTitle) : undefined
    const mainBox = main ? bestInfobox(main.wikitext) : undefined
    if (main && mainBox && yearsFrom(mainBox)) {
      if (seen.has(main.title)) continue
      seen.add(main.title)
      candidates.push({ label: main.title, article: main, section: null, infobox: mainBox })
    } else if (item.infobox && yearsFrom(item.infobox)) {
      candidates.push({ label: item.section, article: series, section: item.section, infobox: item.infobox })
    } else if (item.mainTitle && !main) {
      warnings.push(`"${item.mainTitle}" is linked but has no article`)
    }
  }
  if (candidates.length === 0) {
    // One generation so far: the series article's own infobox.
    const box = infoboxes(series.wikitext)[0]
    if (box && yearsFrom(box)) candidates.push({ label: series.title, article: series, section: null, infobox: box })
  }
  return { candidates, warnings }
}

/** Commons categories for Wikidata items (P373), in one batch per 50. */
async function commonsFromWikidata(ids: readonly string[]): Promise<Map<string, string>> {
  const out = new Map<string, string>()
  for (const group of chunks([...new Set(ids)], 50)) {
    const body = await getJson<{ entities: Record<string, { claims?: { P373?: { mainsnak: { datavalue?: { value: string } } }[] } }> }>(
      api("www.wikidata.org", { action: "wbgetentities", ids: group.join("|"), props: "claims" }),
    )
    for (const [id, entity] of Object.entries(body.entities)) {
      const value = entity.claims?.P373?.[0]?.mainsnak.datavalue?.value
      if (value) out.set(id, value)
    }
  }
  return out
}

export async function carGenerations(car: LibraryCar, entry: SeriesEntry): Promise<CarGenerations> {
  const articles = await fetchArticles([entry.wikipedia, ...(entry.generations ?? []).flatMap((item) => (item.article ? [item.article] : []))])
  const series = articles.get(entry.wikipedia)
  if (!series) throw new Error(`${car.slug}: no Wikipedia article "${entry.wikipedia}"`)
  const warnings: string[] = []
  const first = car.years[0]
  const last = car.years.at(-1)!
  let generations: Generation[] = []

  if (entry.generations) {
    // Set by hand in series.json: the years are the entry's own, sourced to its article.
    for (const item of entry.generations) {
      const article = (item.article && articles.get(item.article)) || series
      generations.push({
        id: `${car.slug}/${slugify(item.label)}`,
        label: item.label,
        from: item.from,
        to: item.to,
        yearsSource: "series.json",
        yearsNote: item.note ?? null,
        source: { article: article.title, section: item.section ?? null, revision: article.revision },
        wikidata: article === series ? null : article.wikidata,
        commons: item.commons ?? commonsCategory(article.wikitext),
        faceliftHints: article === series ? [] : faceliftHints(article.wikitext),
      })
    }
  } else {
    const { candidates, warnings: found } = await findCandidates(series, entry)
    warnings.push(...found)
    for (const candidate of candidates) {
      const years = yearsFrom(candidate.infobox)!
      generations.push({
        id: `${car.slug}/${slugify(candidate.label)}`,
        label: candidate.label,
        from: years.years!.from,
        to: years.years!.to,
        yearsSource: years.source,
        yearsNote: years.years!.note,
        source: { article: candidate.article.title, section: candidate.section, revision: candidate.article.revision },
        wikidata: candidate.section ? null : candidate.article.wikidata,
        commons: candidate.section ? null : commonsCategory(candidate.article.wikitext),
        faceliftHints: candidate.section ? [] : faceliftHints(candidate.article.wikitext),
      })
    }
  }
  if (!entry.generations) {
    // Same years twice (a variant's own article): keep the first.
    generations = generations.filter((g, index) => generations.findIndex((other) => other.from === g.from && other.to === g.to) === index)
    // A range that spans two or more of the others is the whole nameplate, not a generation.
    const umbrellas = generations.filter(
      (g) => generations.filter((other) => other !== g && other.from >= g.from && (other.to ?? 9999) <= (g.to ?? 9999)).length >= 2,
    )
    for (const g of umbrellas) warnings.push(`${g.label} (${g.from}–${g.to ?? "present"}) spans other generations; left out`)
    generations = generations.filter((g) => !umbrellas.includes(g))
  }
  // Only the generations the catalog's years touch.
  generations = generations
    .filter((generation) => (generation.to ?? 9999) >= first && generation.from <= last)
    .sort((left, right) => left.from - right.from)
  for (const g of generations) if (g.yearsSource === "production") warnings.push(`${g.label}: only production years in the infobox; check the US model years`)
  if (generations.length === 0) warnings.push("no generations found: set them in series.json")
  return { slug: car.slug, name: car.name, series: { article: series.title, revision: series.revision }, generations, warnings }
}

const ORDINALS = ["first", "second", "third", "fourth", "fifth", "sixth", "seventh", "eighth", "ninth", "tenth", "eleventh", "twelfth", "thirteenth", "fourteenth", "fifteenth"]

/**
 * Commons category names to try for a generation without one: the chassis
 * codes in its label ("Toyota RAV4 (XA40)"), its ordinal ("Chevrolet
 * Equinox (third generation)"), and the article title itself.
 */
function categoryGuesses(series: string, g: Generation): string[] {
  const guesses = new Set<string>()
  const base = series.replace(/\s*\(.*\)$/, "")
  const inner = /\(([^)]*)\)/.exec(g.label)?.[1] ?? ""
  for (const code of inner.split(/[;,/]/).map((part) => part.trim()).filter((part) => /^[A-Z0-9][A-Z0-9-]{1,7}$/.test(part) && !/^(19|20)\d\d$/.test(part))) {
    guesses.add(`${base} (${code})`)
  }
  const ordinal = ORDINALS.find((word) => new RegExp(`^${word} generation`, "i").test(g.label) || g.label.toLowerCase().includes(`(${word} generation)`))
  if (ordinal) guesses.add(`${base} (${ordinal} generation)`)
  if (!g.source.section) guesses.add(g.source.article)
  return [...guesses]
}

/** Which of these Commons categories exist. */
async function existingCategories(names: readonly string[]): Promise<Set<string>> {
  const found = new Set<string>()
  for (const group of chunks([...new Set(names)], 40)) {
    const body = await getJson<{ query: { pages: { title: string; missing?: boolean }[]; normalized?: { from: string; to: string }[] } }>(
      api("commons.wikimedia.org", { action: "query", titles: group.map((name) => `Category:${name}`).join("|") }),
    )
    for (const page of body.query.pages) if (!page.missing) found.add(page.title.replace(/^Category:/, ""))
  }
  return found
}

/** Commons categories whose names start with the model's name. */
async function searchCategories(base: string): Promise<string[]> {
  const body = await getJson<{ query?: { allpages: { title: string }[] } }>(
    api("commons.wikimedia.org", { action: "query", list: "allpages", apnamespace: "14", apprefix: base, aplimit: "500" }),
  )
  return (body.query?.allpages ?? []).map((page) => page.title.replace(/^Category:/, ""))
}

/** The category for one generation, by its chassis code, ordinal, or first model year in parentheses. */
function matchCategory(base: string, g: Generation, categories: readonly string[]): string | null {
  const inner = /\(([^)]*)\)/.exec(g.label)?.[1] ?? ""
  const codes = inner.split(/[;,/]/).map((part) => part.trim()).filter((part) => /^[A-Z0-9][A-Z0-9-]{1,7}$/.test(part) && !/^(19|20)\d\d$/.test(part))
  const ordinal = ORDINALS.find((word) => g.label.toLowerCase().startsWith(word) || g.label.toLowerCase().includes(`(${word} generation)`))
  const exact = (suffix: string) => categories.find((name) => name.toLowerCase() === `${base} (${suffix})`.toLowerCase())
  for (const code of codes) {
    const hit = exact(code) ?? categories.find((name) => name.startsWith(`${base} (`) && name.includes(code) && !/\b(in|by|at|of)\b/.test(name.slice(base.length)))
    if (hit) return hit
  }
  if (ordinal) {
    const hit = exact(`${ordinal} generation`) ?? categories.find((name) => name.toLowerCase().startsWith(`${base} (${ordinal} generation`.toLowerCase()))
    if (hit) return hit
  }
  return exact(String(g.from)) ?? null
}

async function main() {
  const cars = selectCars(process.argv.slice(2))
  const series = await readSeries()
  let existing: Record<string, CarGenerations> = {}
  try {
    existing = JSON.parse(await readFile(GENERATIONS_FILE, "utf8"))
  } catch {
    // first run
  }
  const results: CarGenerations[] = []
  for (const car of cars) {
    const entry = series[car.slug]
    if (!entry) {
      console.log(`  ${car.slug}: not in series.json; run photos:series first`)
      continue
    }
    try {
      const result = await carGenerations(car, entry)
      results.push(result)
      console.log(`  ${car.slug}: ${result.generations.map((g) => `${g.from}–${g.to ?? "now"}`).join(", ") || "none"}${result.warnings.length ? `  (${result.warnings.length} warning${result.warnings.length > 1 ? "s" : ""})` : ""}`)
    } catch (error) {
      console.log(`  ${car.slug}: ${(error as Error).message}`)
    }
  }
  // Fill in Commons categories from Wikidata where the article didn't name one.
  const missing = results.flatMap((car) => car.generations.filter((g) => !g.commons && g.wikidata).map((g) => g.wikidata!))
  const fromWikidata = await commonsFromWikidata(missing)
  for (const car of results) for (const g of car.generations) if (!g.commons && g.wikidata) g.commons = fromWikidata.get(g.wikidata) ?? null
  // A generation article that names the whole model's category ("Toyota Prius") hasn't told us the generation's: look further.
  for (const car of results) {
    const whole = car.series.article.replace(/\s*\(.*\)$/, "")
    if (car.generations.length > 1) for (const g of car.generations) if (g.commons === whole) g.commons = null
  }
  // Still none: try the usual Commons names, and keep the first that exists.
  const guesses = results.flatMap((car) => car.generations.filter((g) => !g.commons).map((g) => ({ g, names: categoryGuesses(car.series.article, g) })))
  const existing2 = await existingCategories(guesses.flatMap((item) => item.names))
  for (const { g, names } of guesses) g.commons = names.find((name) => existing2.has(name)) ?? null
  // Last try: search Commons categories for the model, and take one that names this generation's code, ordinal or years.
  for (const car of results) {
    const left = car.generations.filter((g) => !g.commons)
    if (left.length === 0) continue
    const base = car.series.article.replace(/\s*\(.*\)$/, "")
    const found = await searchCategories(base)
    for (const g of left) g.commons = matchCategory(base, g, found)
  }
  for (const car of results) existing[car.slug] = car
  const sorted = Object.fromEntries(Object.entries(existing).sort(([a], [b]) => a.localeCompare(b)))
  await writeFile(GENERATIONS_FILE, `${JSON.stringify(sorted, null, 2)}\n`)
  console.log(`${Object.keys(sorted).length} cars in ${GENERATIONS_FILE}`)
}

if (import.meta.url === `file://${process.argv[1]}`) void main()
