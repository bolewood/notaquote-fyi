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

type CategoryStats = { files: number; subcats: number; northAmerica: string[]; facelift: string[] }

/** File and subcategory counts for Commons categories, plus any North America subcategories. */
async function categoryStats(categories: readonly string[]): Promise<Map<string, CategoryStats>> {
  const out = new Map<string, CategoryStats>()
  for (const group of chunks([...new Set(categories)], 40)) {
    const body = await getJson<{ query: { pages: { title: string; missing?: boolean; categoryinfo?: { files: number; subcats: number } }[] } }>(
      api("commons.wikimedia.org", { action: "query", prop: "categoryinfo", titles: group.map((name) => `Category:${name}`).join("|") }),
    )
    for (const page of body.query.pages) {
      if (page.missing || !page.categoryinfo) continue
      out.set(page.title.replace(/^Category:/, ""), { files: page.categoryinfo.files, subcats: page.categoryinfo.subcats, northAmerica: [], facelift: [] })
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
  }
  return out
}

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
  generations: {
    id: string
    label: string
    from: number
    to: number | null
    commons: string | null
    files: number | null
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
      else if (all[car.slug] && g.commons === all[car.slug].series.article.replace(/\s*\(.*\)$/, "") && gens.length > 1)
        issues.push(`${g.label}: Commons category "${g.commons}" is the whole model, not this generation`)
      else if (!stats.has(g.commons)) issues.push(`${g.label}: Commons category "${g.commons}" not found`)
    }
    coverage.push({
      slug: car.slug,
      name: car.name,
      years,
      shownYears: car.shownYears,
      gaps,
      splitYears,
      overlaps,
      issues,
      generations: gens.map((g) => ({
        id: g.id,
        label: g.label,
        from: g.from,
        to: g.to,
        commons: g.commons,
        files: g.commons ? (stats.get(g.commons)?.files ?? null) : null,
        northAmerica: g.commons ? (stats.get(g.commons)?.northAmerica ?? []) : [],
        facelifts: [...new Set(g.faceliftHints.map((hint) => hint.modelYear))].filter((year) => year > g.from && year <= (g.to ?? 9999)),
        faceliftCategories: g.commons ? (stats.get(g.commons)?.facelift ?? []) : [],
        shown: car.shownYears.some((year) => g.from <= year && year <= (g.to ?? 9999)),
      })),
    })
  }
  await writeFile("data/photos/coverage.json", `${JSON.stringify(coverage, null, 2)}\n`)

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
    "## Every car",
    "",
    "| Car | Generations (US model years) | Commons files |",
    "| --- | --- | --- |",
    ...coverage.map(
      (car) =>
        `| ${car.slug} | ${car.generations.map((g) => `${g.label.replace(/\|/g, "/")} ${g.from}–${g.to ?? "present"}${g.facelifts.length || g.faceliftCategories.length ? ` (facelift${g.facelifts.length ? ` ${g.facelifts.join(", ")}?` : ""}${g.faceliftCategories.length ? " on Commons" : ""})` : ""}`).join("<br>") || "—"} | ${car.generations.map((g) => (g.files === null ? "—" : String(g.files))).join(" / ")} |`,
    ),
    "",
  ]
  await writeFile("docs/photo-coverage.md", lines.join("\n"))
  console.log(`${clean.length}/${coverage.length} cars clean; ${gensShown} generations to photograph for the car pages, ${gensAll} for every catalog year`)
}

if (import.meta.url === `file://${process.argv[1]}`) void main()
