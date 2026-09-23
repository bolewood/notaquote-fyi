/**
 * The search pages (states, cars, guides) and what search engines read:
 * addresses that never move, pages that each say something of their own,
 * numbers that match the rest of the site, and a sitemap, social images, and
 * structured data that line up with the pages that exist.
 */
import assert from "node:assert/strict"
import { readdirSync, statSync } from "node:fs"
import { join } from "node:path"
import test from "node:test"
import type { Metadata } from "next"
import slugFile from "./seo-slugs.json"
import { handleCompare } from "./agent-api"
import { SERVER_CATALOG as catalog } from "./agent-catalog"
import { carId } from "./agent-cars"
import { renderToStaticMarkup } from "react-dom/server"
import { becauseWords, carContent, carMainText, noindexCarSlugs, vsAverageWords } from "./car-content"
import { maskDollars, visibleText } from "./rendered-text"
import { uniqueness } from "./uniqueness"
import { carPagePath, MODELS_ENABLED } from "./car-page-links"
import { carFigures, carListings, carPages, carSlug, claimsYearPick, CLAIMS_YEARS } from "./car-pages"
import { FACTOR_BUNDLE, nationalTypicalStart } from "./factor-engine"
import { shownYearly } from "./format"
import { GUIDES, teenCarsLead } from "./guides"
import { DEFAULT_SCENARIO, STATES } from "./scenario"
import { decodeShareSearch } from "./share-link"
import { breadcrumbJsonLd, DESCRIPTION_MAX, homeJsonLd, jsonLdText, SITE_NAME, stateDatasetsJsonLd, TITLE_MAX } from "./site-meta"
import { sitemapEntries } from "./sitemap-entries"
import { countrywideBaseline } from "./state-baselines"
import {
  leadText,
  liabilityOnlyText,
  minimumWords,
  moveWords,
  SAME_ORDER_NOTE,
  stateDescription,
  stateMainText,
  stateTitle,
  teenCarsSummary,
  tiedAtTop,
} from "./state-content"
import { NEIGHBORS } from "./state-neighbors"
import { stateFigures, TEEN_TOP } from "./state-pages"
import { STATE_SLUGS, stateBySlug, statePath, stateSlug } from "./state-slugs"
import { liabilityShorthand, stateRule } from "./state-rules"
import { generateMetadata as stateMetadata, generateStaticParams as stateParams } from "../app/states/[state]/page"
import CarPage, { generateMetadata as carMetadata, generateStaticParams as carParams } from "../app/cars/[slug]/page"

const SLUG = /^[a-z0-9]+(-[a-z0-9]+)*$/

// ---------------------------------------------------------------------------
// Addresses

test("state slugs are the state's name, lowercase with dashes, and never change", () => {
  assert.equal(STATE_SLUGS.length, 51)
  for (const item of STATE_SLUGS) {
    assert.match(item.slug, SLUG)
    assert.equal(stateBySlug(item.slug), item.code)
  }
  assert.deepEqual(
    STATE_SLUGS.map((item) => item.slug),
    slugFile.states,
    "A state slug changed. Live links would break; see src/lib/seo-slugs.json.",
  )
  assert.equal(stateSlug("DC"), "district-of-columbia")
  assert.equal(statePath("CA"), "/states/california")
  assert.equal(stateBySlug("OH"), null)
  assert.equal(stateBySlug("Ohio"), null)
})

test("car slugs match the pinned list: none changes or disappears by accident", () => {
  const listings = carListings()
  const slugs = listings.map((item) => item.slug)
  assert.equal(new Set(slugs).size, slugs.length, "two cars share a slug")
  for (const slug of slugs) assert.match(slug, SLUG, slug)
  const pinned = new Set(slugFile.cars)
  const retired = new Set(slugFile.retired)
  const gone = [...pinned].filter((slug) => !slugs.includes(slug) && !retired.has(slug))
  assert.deepEqual(gone, [], "These live slugs disappeared. Keep them with \"slug\" in data/car-pages.json, or retire them with a redirect (docs/DATA-REFRESH.md).")
  const added = slugs.filter((slug) => !pinned.has(slug))
  assert.deepEqual(added, [], "New car slugs: add them to src/lib/seo-slugs.json in the same change.")
  assert.equal(carSlug("Toyota", "RAV4 Prime (PHEV)"), "toyota-rav4-prime")
  assert.equal(carSlug("Ford", "F-150"), "ford-f-150")
})

test("every listed car gets a page when the per-model claims data is on", () => {
  if (!MODELS_ENABLED) {
    assert.equal(carPages(catalog).length, 0)
    return
  }
  const pages = new Set(carPages(catalog).map((page) => page.slug))
  const missing = carListings().filter((listing) => !pages.has(listing.slug))
  assert.deepEqual(
    missing.map((item) => `${item.make} ${item.model}`),
    [],
    "These have no model-level claims data. Fix the name in data/car-pages.json, or retire the car (docs/DATA-REFRESH.md, step 7).",
  )
})

test("car pages exist only for cars with claims results for that exact model", () => {
  for (const page of carPages(catalog)) {
    assert.equal(page.relativity.level, "model", page.slug)
    assert.equal(page.relativity.outsideYears, false, page.slug)
    assert.ok(page.pick.year >= CLAIMS_YEARS.first && page.pick.year <= CLAIMS_YEARS.last, page.slug)
    const newer = catalog.vehicles[String(page.pick.year + 1)]?.[page.make]?.[page.model]
    if (page.pick.year < CLAIMS_YEARS.last) assert.ok(!newer, `${page.slug} could use a newer year`)
    assert.ok(carId(catalog, page.pick))
  }
  assert.equal(claimsYearPick(catalog, "Mitsubishi", "Mirage"), null)
  assert.equal(claimsYearPick(catalog, "Honda", "Prologue"), null)
  assert.equal(carPagePath("Mitsubishi", "Mirage"), null)
})

// ---------------------------------------------------------------------------
// State pages

const ALL_STATES = STATES.map((state) => stateFigures(catalog, state.code))

test("every state page has its own numbers and words", () => {
  const texts = ALL_STATES.map(stateMainText)
  assert.equal(new Set(texts).size, 51, "two state pages have the same main text")
  for (const f of ALL_STATES) {
    assert.ok(stateMainText(f).length > 1200, `${f.code} is thin`)
    assert.ok(f.start.annual > f.baseline.annual && f.teen.added.increase > 0 && f.rule && f.neighbors.length > 0, f.code)
  }
  for (const pick of [stateTitle, stateDescription, leadText]) assert.equal(new Set(ALL_STATES.map(pick)).size, 51)
  const prices = new Set(ALL_STATES.map((f) => f.baseline.annual))
  const minimums = new Set(ALL_STATES.map((f) => (f.rule ? liabilityShorthand(f.rule) : null)))
  const teen = new Set(ALL_STATES.map((f) => shownYearly(f.teen.added.increase)))
  assert.ok(prices.size >= 48 && minimums.size >= 12 && teen.size >= 30)
})

test("ranks read naturally at both ends, and snippets leave the attribution to the page", () => {
  const highest = ALL_STATES.find((f) => f.liabilityRank.rank === 1)!
  assert.match(liabilityOnlyText(highest), /, the highest of the 50 states and DC/)
  const lowest = ALL_STATES.find((f) => f.liabilityRank.rank === f.liabilityRank.of)!
  assert.match(liabilityOnlyText(lowest), /, the lowest of the 50 states and DC/)
  for (const f of ALL_STATES) {
    assert.doesNotMatch(liabilityOnlyText(f), /\bthe 1st\b/, f.code)
    assert.doesNotMatch(stateDescription(f), /NAIC/, f.code)
  }
})

test("minimums read in full words where there's no injury-liability minimum", () => {
  const fl = stateRule("FL")!
  assert.equal(minimumWords(fl), "the law asks for $10,000 of personal injury protection and $10,000 of property damage liability")
  assert.doesNotMatch(stateDescription(stateFigures(catalog, "FL")), /on the page/)
  assert.match(minimumWords(stateRule("NH")!), /^insurance itself is optional/)
  assert.match(minimumWords(stateRule("NH")!, "cell"), /^Optional/)
  for (const f of ALL_STATES) assert.doesNotMatch(minimumWords(f.rule, "cell"), /See the page/, f.code)
})

test("the cheapest cars for a teen come out in the same order in every state", () => {
  const order = (code: (typeof STATES)[number]["code"]) =>
    stateFigures(catalog, code).teenCars.map((item) => `${item.car.pick.make} ${item.car.pick.model}`).join(",")
  for (const state of STATES) assert.equal(order(state.code), order("OH"), state.code)
  assert.match(SAME_ORDER_NOTE, /same in every state, because our car data is national/)
})

test("the state page's teen cars match the Compare page and the API, to the dollar", () => {
  for (const code of ["OH", "CA", "TX", "NH"] as const) {
    const top = stateFigures(catalog, code).teenCars.slice(0, TEEN_TOP)
    const ids = top.map((item) => carId(catalog, item.car.pick))
    const result = handleCompare(catalog, new URLSearchParams(`state=${code}&age=16-18&policy=added&cars=${ids.join(",")}`))
    const body = result.body as { results: { id: string; teenAdds: { yearly: number } }[] }
    for (const item of top) {
      const row = body.results.find((candidate) => candidate.id === carId(catalog, item.car.pick))!
      assert.equal(row.teenAdds.yearly, shownYearly(item.added.increase), `${code} ${item.car.label}`)
    }
  }
})

test("neighbors are symmetric, and small moves read as about the same", () => {
  for (const [code, list] of Object.entries(NEIGHBORS)) {
    for (const other of list) assert.ok(NEIGHBORS[other].includes(code as never), `${code} and ${other}`)
  }
  assert.equal(moveWords(10, 2000), "About the same")
  assert.equal(moveWords(-40, 2000), "About the same")
  assert.equal(moveWords(-230, 2000), "About $230 less a year")
  const fromIndiana = stateFigures(catalog, "OH").neighbors.find((row) => row.code === "IN")!
  assert.equal(moveWords(fromIndiana.move.delta, fromIndiana.move.current.likely), "About the same")
})

test("state page buttons: the visitor's own car in that state, and the cheapest cars for a teen there", () => {
  const oh = stateFigures(catalog, "OH")
  const whatIf = decodeShareSearch(oh.whatIfHref)
  assert.ok(whatIf.status === "ok" && whatIf.via === "state" && whatIf.scenario.state === "OH" && whatIf.next?.age === "16-18")
  const compare = decodeShareSearch(oh.compareHref)
  assert.ok(compare.status === "ok" && compare.via === "page" && compare.scenario.age === "16-18" && compare.teenOnParentPolicy)
  assert.deepEqual(
    compare.status === "ok" ? compare.cars?.map((car) => car.model) : [],
    oh.teenCars.slice(0, TEEN_TOP).map((item) => item.car.pick.model),
  )
  assert.doesNotMatch(oh.whatIfHref + oh.compareHref, /anchor=|price=|yearly=/)
})

// ---------------------------------------------------------------------------
// Car pages

/**
 * Regression floor for how much of each rendered car page is its own, with
 * every dollar amount masked so numbers alone can't carry a page. Measured on
 * the page's rendered text (the article: breadcrumbs, headings, tables, links,
 * and the disclaimer). Set just under the values when this was written
 * (median 20.8%, lowest page 15.7%, highest overlap 0.618); if a wording change
 * trips it, make the page more its own rather than lowering the floor.
 */
export const RENDERED_CAR_FLOOR = { median: 0.2, page: 0.15, jaccard: 0.63 } as const

test("rendered car pages stay their own, with dollar amounts masked", async () => {
  if (!MODELS_ENABLED) return
  const pages: { id: string; text: string }[] = []
  for (const { slug } of carParams()) {
    const element = await CarPage({ params: Promise.resolve({ slug }) } as never)
    pages.push({ id: slug, text: maskDollars(visibleText(renderToStaticMarkup(element))) })
  }
  const report = uniqueness(pages)
  const lowest = [...report.pages].sort((left, right) => left.unique - right.unique)[0]
  console.log(`rendered car pages, dollars masked: median ${(report.medianUnique * 100).toFixed(1)}%, lowest ${lowest.id} ${(lowest.unique * 100).toFixed(1)}%, max overlap ${report.maxJaccard.toFixed(3)}`)
  assert.ok(report.medianUnique >= RENDERED_CAR_FLOOR.median, `median ${report.medianUnique.toFixed(3)}`)
  for (const page of report.pages) {
    assert.ok(page.unique >= RENDERED_CAR_FLOOR.page, `${page.id}: ${page.unique.toFixed(3)} of its five-word runs are its own`)
    assert.ok(page.maxJaccard <= RENDERED_CAR_FLOOR.jaccard, `${page.id} vs ${page.closest}: overlap ${page.maxJaccard.toFixed(3)}`)
  }
  // The text measured is the page's own words, not its markup or structured data.
  assert.doesNotMatch(pages[0].text, /<|schema\.org|\$\d/)
})

test("noindex is a deliberate choice per car, never automatic", async () => {
  const flagged = noindexCarSlugs(catalog)
  for (const page of carPages(catalog)) assert.equal(flagged.has(page.slug), page.noindex, page.slug)
  if (!MODELS_ENABLED) return
  // The RAV4 Prime was noindexed automatically once; it's indexed now.
  assert.equal(flagged.has("toyota-rav4-prime"), false)
  const metadata = await carMetadata({ params: Promise.resolve({ slug: "toyota-rav4-prime" }) } as never)
  assert.equal(metadata.robots, undefined)
})

test("a car's lead never contradicts its own numbers", () => {
  for (const page of carPages(catalog)) {
    const f = carFigures(catalog, page.slug)!
    const vs = vsAverageWords(f)
    const because = becauseWords(f)
    if (!vs.startsWith("about the same")) {
      assert.doesNotMatch(because, /close to an average|even out/, `${page.slug}: "${vs}" but "${because}"`)
      const up = vs.includes("more than")
      if (because.startsWith("because of")) assert.match(because, up ? /pricier|more at-fault/ : /cheaper|fewer/, page.slug)
    }
    assert.doesNotMatch(carMainText(f), /\$\d+ (more|less) than an average \d{4} car: its claims/, page.slug)
  }
})

test("car pages: model years, versions, and similar cars from the same segment", () => {
  if (!MODELS_ENABLED) return
  const rav4 = carFigures(catalog, "toyota-rav4")!
  assert.ok(rav4.years.length >= 3, "a used RAV4 table")
  assert.ok(rav4.years[0].adult.likely > rav4.years.at(-1)!.adult.likely, "older is cheaper")
  const similar = [...rav4.similar.cheaper, ...rav4.similar.pricier].map((car) => car.slug)
  for (const slug of similar) assert.equal(carFigures(catalog, slug)!.page.segment, rav4.page.segment, slug)
  assert.ok(!similar.includes("volkswagen-atlas") && !similar.includes("kia-telluride"))
  const content = carContent(rav4)
  assert.doesNotMatch(content.title, /\d{4}/, "no year in the title")
  assert.match(content.lead, /2024/, "the year is in the body")
})

test("the national start is NAIC's countrywide figure, brought up to today like a state's", () => {
  const start = nationalTypicalStart(DEFAULT_SCENARIO)
  const trend = FACTOR_BUNDLE.typicalStart.trend
  assert.equal(start.untrendedAnnual, countrywideBaseline().annual)
  assert.ok(Math.abs(start.annual - (countrywideBaseline().annual * trend.latestValue) / trend.baseValue) <= 1)
})

test("the teen guide answers from the numbers, and never names one winner in a tie", () => {
  const lead = teenCarsLead(catalog)
  if (MODELS_ENABLED) {
    assert.match(lead, /^Of 33 popular first cars, SUVs, and trucks, the 2022 Subaru /)
    assert.doesNotMatch(lead, /without claims results/)
  } else {
    assert.match(lead, /tie for the least/)
  }
})

test("state pages name cars that round to the same price, and only blame missing claims data when it's missing", () => {
  let tiedPages = 0
  for (const f of ALL_STATES) {
    const summary = teenCarsSummary(f)
    if (MODELS_ENABLED) assert.doesNotMatch(summary, /Without claims results/, f.code)
    if (tiedAtTop(f.teenCars) >= 2) {
      tiedPages += 1
      if (MODELS_ENABLED) assert.match(summary, /come out the same, the least of the 33/, f.code)
    }
  }
  if (MODELS_ENABLED) assert.ok(tiedPages > 0, "some states round the cheapest cars to the same $10")
})

// ---------------------------------------------------------------------------
// Sitemap, social images, structured data, titles

test("the sitemap lists every indexable page once, with a real date", () => {
  const entries = sitemapEntries(catalog)
  const urls = entries.map((entry) => entry.url.replace("https://notaquote.fyi", ""))
  assert.equal(new Set(urls).size, urls.length, "a page is listed twice")
  for (const entry of entries) assert.match(entry.lastModified, /^\d{4}-\d{2}-\d{2}$/)
  const listed = new Set(urls)
  for (const { state } of stateParams()) assert.ok(listed.has(`/states/${state}`), state)
  const noindex = noindexCarSlugs(catalog)
  for (const { slug } of carParams()) assert.equal(listed.has(`/cars/${slug}`), !noindex.has(slug), slug)
  for (const guide of GUIDES) assert.ok(listed.has(guide.path), guide.path)
  assert.equal(listed.has("/cars"), carPages(catalog).length > 0)
  assert.ok(!listed.has("/llms.txt") && !listed.has("/llms-full.txt"))
  for (const path of staticPagePaths()) {
    if (path === "/cars" && carPages(catalog).length === 0) continue
    assert.ok(listed.has(path), `${path} is missing from the sitemap`)
  }
})

/** "/sources" for src/app/sources/page.tsx; dynamic segments are skipped. */
function staticPagePaths(dir = join(process.cwd(), "src/app"), prefix = ""): string[] {
  const paths: string[] = []
  for (const name of readdirSync(dir)) {
    const full = join(dir, name)
    if (statSync(full).isDirectory()) {
      if (name.startsWith("[") || name.startsWith("(") || name === "api") continue
      paths.push(...staticPagePaths(full, `${prefix}/${name}`))
    } else if (name === "page.tsx") {
      paths.push(prefix || "/")
    }
  }
  return paths
}

/** The title a browser tab and search result show: the layout adds " · NotAQuote.FYI" unless the title is absolute. */
function fullTitle(metadata: Metadata): string {
  const title = metadata.title
  if (typeof title === "string") return `${title} · ${SITE_NAME}`
  if (title && "absolute" in title && title.absolute) return title.absolute
  throw new Error("no title")
}

const STATIC_PAGES = [
  "page",
  "compare/page",
  "methodology/page",
  "sources/page",
  "privacy/page",
  "disclaimer/page",
  "data-licenses/page",
  "corrections/page",
  "model-version/page",
  "states/page",
  "cars/page",
  "guides/page",
  "guides/adding-a-teen-driver/page",
  "guides/cheapest-cars-to-insure-for-teens/page",
]

async function everyPageMetadata(): Promise<{ path: string; metadata: Metadata }[]> {
  const all: { path: string; metadata: Metadata }[] = []
  for (const page of STATIC_PAGES) {
    const mod = (await import(`../app/${page}`)) as { metadata: Metadata }
    all.push({ path: page, metadata: mod.metadata })
  }
  for (const { state } of stateParams()) all.push({ path: state, metadata: await stateMetadata({ params: Promise.resolve({ state }) } as never) })
  for (const { slug } of carParams()) all.push({ path: slug, metadata: await carMetadata({ params: Promise.resolve({ slug }) } as never) })
  return all
}

test("every page has a unique title of at most 60 characters and a description of at most 155", async () => {
  const pages = await everyPageMetadata()
  const titles = pages.map((page) => fullTitle(page.metadata))
  assert.equal(new Set(titles).size, titles.length, "two pages share a title")
  for (const [index, page] of pages.entries()) {
    assert.ok(titles[index].length <= TITLE_MAX, `${page.path}: "${titles[index]}" is ${titles[index].length} characters`)
    const description = String(page.metadata.description ?? "")
    assert.ok(description.length > 50 && description.length <= DESCRIPTION_MAX, `${page.path}: description is ${description.length} characters`)
    assert.ok(page.metadata.alternates?.canonical, `${page.path} has no canonical address`)
  }
  assert.equal(fullTitle(pages.find((page) => page.path === "ohio")!.metadata), "Ohio car insurance: cost and state minimums · NotAQuote.FYI")
  assert.equal(fullTitle(pages.find((page) => page.path === "district-of-columbia")!.metadata), "DC car insurance: cost and state minimums · NotAQuote.FYI")
})

test("state and car pages use their own social image, not the site's", async () => {
  // A page-level image would override the route's opengraph-image file, so these set none.
  const ohio = await stateMetadata({ params: Promise.resolve({ state: "ohio" }) } as never)
  assert.equal(ohio.openGraph && "images" in ohio.openGraph ? ohio.openGraph.images : undefined, undefined)
  assert.equal(ohio.twitter && "images" in ohio.twitter ? ohio.twitter.images : undefined, undefined)
  if (MODELS_ENABLED) {
    const rav4 = await carMetadata({ params: Promise.resolve({ slug: "toyota-rav4" }) } as never)
    assert.equal(rav4.openGraph && "images" in rav4.openGraph ? rav4.openGraph.images : undefined, undefined)
  }
  for (const page of ["page", "compare/page"]) {
    const mod = (await import(`../app/${page}`)) as { metadata: Metadata }
    assert.equal(mod.metadata.openGraph && "images" in mod.metadata.openGraph ? mod.metadata.openGraph.images : undefined, undefined, page)
  }
  // Pages without their own file name the site's image, since their openGraph replaces the parent's.
  const privacy = (await import("../app/privacy/page")) as { metadata: Metadata }
  assert.ok(privacy.metadata.openGraph && "images" in privacy.metadata.openGraph && privacy.metadata.openGraph.images)
})

test("structured data is valid JSON, and credits NAIC's figures to NAIC", () => {
  const home = JSON.parse(jsonLdText(homeJsonLd("A description"))) as Record<string, unknown>[]
  assert.equal(home.find((item) => item["@type"] === "WebSite")!.name, SITE_NAME)
  assert.equal(home.find((item) => item["@type"] === "WebApplication")!.applicationCategory, "FinanceApplication")

  const [rules, prices] = JSON.parse(jsonLdText(stateDatasetsJsonLd())) as Record<string, any>[] // eslint-disable-line @typescript-eslint/no-explicit-any
  assert.equal(rules["@type"], "Dataset")
  assert.equal(rules.license, "https://creativecommons.org/licenses/by/4.0/")
  assert.equal(rules.creator.name, "Bolewood Group, LLC")
  assert.equal(prices["@type"], "Dataset")
  assert.equal(prices.license, undefined, "we don't license NAIC's figures")
  assert.equal(prices.creator, undefined, "we didn't create NAIC's figures")
  assert.ok(prices.isBasedOn.some((source: { url?: string }) => source.url?.includes("naic.org")))
  for (const item of [rules, prices]) {
    assert.ok(item.name && item.description.length > 50 && item.distribution[0].contentUrl.endsWith(".json"))
    assert.match(item.dateModified, /^\d{4}-\d{2}-\d{2}$/)
  }
  const crumbs = JSON.parse(jsonLdText(breadcrumbJsonLd([{ name: "Home", path: "/" }, { name: "Ohio", path: "/states/ohio" }])))
  assert.equal(crumbs.itemListElement[1].item, "https://notaquote.fyi/states/ohio")
  assert.doesNotMatch(jsonLdText({ name: "</script><script>alert(1)</script>" }), /</)
})
