/**
 * Step 3: coverage. Does every model year we show map to exactly one
 * generation, and does each generation have somewhere to find photos?
 *
 *   npm run photos:coverage
 *
 * Writes data/photos/coverage.json and docs/photo-coverage.md. Run it after
 * photos:generations, and read the "Needs attention" list.
 */
import { readFile, writeFile } from "node:fs/promises"
import { libraryCars } from "./cars"
import { GENERATIONS_FILE, type CarGenerations } from "./generations"
import { api, chunks, getJson } from "./http"
import { readSeries } from "./series"

type CategoryStats = { files: number; subcats: number; subcatFiles: number; northAmerica: string[]; facelift: string[] }

/** Subcategories whose photos we won't use: racing (not "Series" alone: BMW 3 Series), police, taxis, concepts, cutaways, other markets. ("International" stays: the US Corolla E140 is the international one.) */
export const SKIP_SUBCATEGORY =
  /in competition|racing|nascar|\barca\b|cup series|motorsport|rally|drift|number \d+ |police|taxi|concept|cutaway|prototype|interior|\b(?:china|japan|europe|asia|asia-pacific|india|australia|brazil|russia|korea|latin america|south africa|middle east|thailand|indonesia|taiwan|mexico)\b/i

/** File and subcategory counts for Commons categories, plus any North America subcategories. */
async function categoryStats(categories: readonly string[]): Promise<Map<string, CategoryStats>> {
  const out = new Map<string, CategoryStats>()
  for (const group of chunks([...new Set(categories)], 40)) {
    const body = await getJson<{ query: { pages: { title: string; missing?: boolean; categoryinfo?: { files: number; subcats: number } }[] } }>(
      api("commons.wikimedia.org", { action: "query", prop: "categoryinfo", titles: group.map((name) => `Category:${name}`).join("|") }),
    )
    for (const page of body.query.pages) {
      if (page.missing || !page.categoryinfo) continue
      out.set(page.title.replace(/^Category:/, ""), { files: page.categoryinfo.files, subcats: page.categoryinfo.subcats, subcatFiles: 0, northAmerica: [], facelift: [] })
    }
  }
  for (const [name, stats] of out) {
    if (stats.subcats === 0) continue
    const body = await getJson<{ query: { categorymembers: { title: string }[] } }>(
      api("commons.wikimedia.org", { action: "query", list: "categorymembers", cmtitle: `Category:${name}`, cmtype: "subcat", cmlimit: "200" }),
    )
    const subcats = body.query.categorymembers.map((member) => member.title.replace(/^Category:/, ""))
    stats.northAmerica = subcats.filter((title) => /north america|\bU\.?S\.?A?\b|united states|canada/i.test(title))
    // "Toyota Prius (XW50, facelift)": Commons sorts a restyle into its own subcategory.
    stats.facelift = subcats.filter((title) => /facelift|refresh|restyl/i.test(title) && !/pre-facelift/i.test(title))
    // Busy categories keep their photos one level down (by year, body style or market): count the usable ones.
    const usable = subcats.filter((title) => !SKIP_SUBCATEGORY.test(title) || /north america/i.test(title))
    for (const group of chunks(usable, 40)) {
      const info = await getJson<{ query: { pages: { categoryinfo?: { files: number } }[] } }>(
        api("commons.wikimedia.org", { action: "query", prop: "categoryinfo", titles: group.map((title) => `Category:${title}`).join("|") }),
      )
      stats.subcatFiles += info.query.pages.reduce((sum, page) => sum + (page.categoryinfo?.files ?? 0), 0)
    }
  }
  return out
}

/** Each car's generations, for the site (see src/lib/car-generations.ts). */
export const SITE_GENERATIONS_FILE = "data/photos/site-generations.json"

export type CarCoverage = {
  slug: string
  name: string
  /** Each catalog model year → the generation ids that claim it (exactly one is right). */
  years: Record<string, string[]>
  shownYears: number[]
  gaps: number[]
  /** Model years sold as both the old and the new generation. */
  splitYears: number[]
  overlaps: number[]
  issues: string[]
  /** Not wrong, but could change: predictions about recent or coming model years, unsure reviews. Check each fall. */
  recheck: string[]
  generations: {
    id: string
    label: string
    from: number
    to: number | null
    commons: string | null
    files: number | null
    /** Files one level down, in subcategories we'd use. */
    subcatFiles: number | null
    northAmerica: string[]
    /** Model years Wikipedia's text ties to a facelift (hints). */
    facelifts: number[]
    /** Commons subcategories for a facelifted version (evidence that a restyle looks different). */
    faceliftCategories: string[]
    shown: boolean
  }[]
}

async function main() {
  const all = JSON.parse(await readFile(GENERATIONS_FILE, "utf8")) as Record<string, CarGenerations>
  const series = await readSeries()
  const cars = libraryCars()
  const stats = await categoryStats(Object.values(all).flatMap((car) => car.generations.flatMap((g) => (g.commons ? [g.commons] : []))))
  const coverage: CarCoverage[] = []
  const thisYear = new Date().getFullYear()
  for (const car of cars) {
    const gens = all[car.slug]?.generations ?? []
    const notSold = new Set(series[car.slug]?.notSold?.years ?? [])
    const years: Record<string, string[]> = {}
    for (const year of car.years) years[year] = notSold.has(year) ? [] : gens.filter((g) => g.from <= year && year <= (g.to ?? 9999)).map((g) => g.id)
    const gaps = car.years.filter((year) => years[year].length === 0 && !notSold.has(year))
    // One model year shared at a boundary is usually real (both sold as that year): a split year, not an error.
    const isSplit = (year: number) => {
      const claimants = gens.filter((g) => years[year].includes(g.id))
      return claimants.length === 2 && claimants[0].to === year && claimants[1].from === year
    }
    const splitYears = car.years.filter((year) => years[year].length > 1 && isSplit(year))
    const overlaps = car.years.filter((year) => years[year].length > 1 && !isSplit(year))
    const issues = [...(all[car.slug]?.warnings ?? [])]
    if (!all[car.slug]) issues.push("not in generations.json")
    if (gaps.length) issues.push(`no generation for ${gaps.join(", ")}`)
    if (overlaps.length) issues.push(`two generations claim ${overlaps.join(", ")}`)
    for (const g of gens) {
      if (g.yearsSource === "production") issues.push(`${g.label}: years are production years`)
      if (g.yearsSource === "series.json" && !g.yearsNote && !series[car.slug]?.generations?.find((item) => item.label === g.label)?.source && g.source.article === all[car.slug]?.series.article)
        issues.push(`${g.label}: hand-entered years need a source`)
      if (!g.commons) issues.push(`${g.label}: no Commons category`)
      else if (all[car.slug] && g.yearsSource !== "series.json" && g.commons === all[car.slug].series.article.replace(/\s*\(.*\)$/, "") && gens.length > 1)
        issues.push(`${g.label}: Commons category "${g.commons}" is the whole model, not this generation`)
      else if (!stats.has(g.commons)) issues.push(`${g.label}: Commons category "${g.commons}" not found`)
    }
    const recheck: string[] = []
    const entry = series[car.slug]
    if (entry?.confidence) recheck.push(`${entry.confidence}-confidence review${entry.note ? `: ${entry.note}` : ""}`)
    const predicted = [...notSold].filter((year) => year > thisYear)
    if (predicted.length) recheck.push(`not sold in ${predicted.join(", ")} (a prediction when written)`)
    const phantom = car.shownYears.filter((year) => notSold.has(year))
    if (phantom.length) recheck.push(`the car page shows ${phantom.join(", ")}, which wasn't sold in the US (a site catalog question)`)
    // A generation that ended last model year with nothing after it: did the car really stop, or is the next year just missing?
    for (const g of gens)
      if (g.to === thisYear && !gens.some((other) => other.from === g.to || other.from === g.to! + 1))
        recheck.push(`${g.label} ends at ${g.to} with no generation after it: check whether a ${g.to + 1} exists`)
    coverage.push({
      slug: car.slug,
      name: car.name,
      years,
      shownYears: car.shownYears,
      gaps,
      splitYears,
      overlaps,
      issues,
      recheck,
      generations: gens.map((g) => ({
        id: g.id,
        label: g.label,
        from: g.from,
        to: g.to,
        commons: g.commons,
        files: g.commons ? (stats.get(g.commons)?.files ?? null) : null,
        subcatFiles: g.commons ? (stats.get(g.commons)?.subcatFiles ?? null) : null,
        northAmerica: g.commons ? (stats.get(g.commons)?.northAmerica ?? []) : [],
        facelifts: [...new Set(g.faceliftHints.map((hint) => hint.modelYear))].filter((year) => year > g.from && year <= (g.to ?? 9999)),
        faceliftCategories: g.commons ? (stats.get(g.commons)?.facelift ?? []) : [],
        shown: car.shownYears.some((year) => g.from <= year && year <= (g.to ?? 9999)),
      })),
    })
  }
  await writeFile("data/photos/coverage.json", `${JSON.stringify(coverage, null, 2)}\n`)
  // A small copy for the site: each car's generations and the catalog years each covers (not the years
  // the US didn't get), for the "by generation" section on car pages.
  const forSite = Object.fromEntries(
    coverage.map((car) => [
      car.slug,
      car.generations
        .map((g) => ({
          id: g.id,
          label: g.label,
          from: g.from,
          to: g.to,
          years: Object.entries(car.years)
            .filter(([, ids]) => ids.includes(g.id))
            .map(([year]) => Number(year)),
        }))
        .filter((g) => g.years.length > 0),
    ]),
  )
  await writeFile(SITE_GENERATIONS_FILE, `${JSON.stringify(forSite, null, 1)}\n`)

  // A readable summary.
  const clean = coverage.filter((car) => car.issues.length === 0)
  const gensAll = coverage.reduce((sum, car) => sum + car.generations.length, 0)
  const gensShown = coverage.reduce((sum, car) => sum + car.generations.filter((g) => g.shown).length, 0)
  const withFacelift = coverage.reduce((sum, car) => sum + car.generations.filter((g) => g.facelifts.length > 0 || g.faceliftCategories.length > 0).length, 0)
  const lines = [
    "# Photo library coverage",
    "",
    "Generated by `npm run photos:coverage` from data/photos/generations.json. Don't edit by hand.",
    "",
    `- Cars: ${coverage.length} (${clean.length} with no open issues)`,
    `- Generations covering every catalog year: ${gensAll}`,
    `- Generations covering the years the car pages show: ${gensShown}`,
    `- Model years sold as two generations (split years): ${coverage.reduce((sum, car) => sum + car.splitYears.length, 0)}`,
    `- Generations with a facelift hint (a mid-cycle restyle that may need its own photo): ${withFacelift}`,
    "",
    "## Needs attention",
    "",
    ...coverage.filter((car) => car.issues.length > 0).flatMap((car) => [`- **${car.slug}**`, ...car.issues.map((issue) => `  - ${issue}`)]),
    "",
    "## Recheck each fall",
    "",
    "Not errors: predictions about recent or coming model years, and reviews that weren't sure.",
    "",
    ...coverage.filter((car) => car.recheck.length > 0).flatMap((car) => [`- **${car.slug}**`, ...car.recheck.map((item) => `  - ${item}`)]),
    "",
    "## Every car",
    "",
    "| Car | Generations (US model years) | Commons files (+ usable subcategories) |",
    "| --- | --- | --- |",
    ...coverage.map(
      (car) =>
        `| ${car.slug} | ${car.generations.map((g) => `${g.label.replace(/\|/g, "/")} ${g.from}–${g.to ?? "present"}${g.facelifts.length || g.faceliftCategories.length ? ` (facelift${g.facelifts.length ? ` ${g.facelifts.join(", ")}?` : ""}${g.faceliftCategories.length ? " on Commons" : ""})` : ""}`).join("<br>") || "—"} | ${car.generations.map((g) => (g.files === null ? "—" : `${g.files}${g.subcatFiles ? ` (+${g.subcatFiles})` : ""}`)).join(" / ")} |`,
    ),
    "",
  ]
  await writeFile("docs/photo-coverage.md", lines.join("\n"))
  console.log(`${clean.length}/${coverage.length} cars clean; ${gensShown} generations to photograph for the car pages, ${gensAll} for every catalog year`)
}

if (import.meta.url === `file://${process.argv[1]}`) void main()
