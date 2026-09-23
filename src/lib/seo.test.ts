/**
 * The search pages (states, cars, guides) and what search engines read:
 * addresses that never move, pages that each say something of their own,
 * numbers that match the rest of the site, and a sitemap and structured data
 * that line up with the pages that exist.
 */
import assert from "node:assert/strict"
import { readdirSync, statSync } from "node:fs"
import { join } from "node:path"
import test from "node:test"
import type { Metadata } from "next"
import { handleCompare } from "./agent-api"
import { SERVER_CATALOG as catalog } from "./agent-catalog"
import { carId } from "./agent-cars"
import { carMainText, carTitle, carDescription } from "./car-content"
import { carPagePath } from "./car-page-links"
import { carFigures, carListings, carPages, carSlug, claimsYearPick, CLAIMS_YEARS } from "./car-pages"
import { FACTOR_BUNDLE, nationalTypicalStart } from "./factor-engine"
import { shownYearly } from "./format"
import { GUIDES } from "./guides"
import { DEFAULT_SCENARIO, STATES } from "./scenario"
import { decodeShareSearch } from "./share-link"
import { breadcrumbJsonLd, homeJsonLd, jsonLdText, SITE_NAME, stateDatasetJsonLd } from "./site-meta"
import { sitemapEntries } from "./sitemap-entries"
import { countrywideBaseline } from "./state-baselines"
import { SAME_ORDER_NOTE, stateDescription, stateMainText, stateTitle } from "./state-content"
import { NEIGHBORS } from "./state-neighbors"
import { stateFigures, TEEN_TOP } from "./state-pages"
import { STATE_SLUGS, stateBySlug, statePath, stateSlug } from "./state-slugs"
import { liabilityShorthand } from "./state-rules"
import { generateStaticParams as stateParams } from "../app/states/[state]/page"
import { generateStaticParams as carParams } from "../app/cars/[slug]/page"

const SLUG = /^[a-z0-9]+(-[a-z0-9]+)*$/

// ---------------------------------------------------------------------------
// Addresses

test("state slugs are the state's name, lowercase with dashes, and never change", () => {
  assert.equal(STATE_SLUGS.length, 51)
  assert.equal(new Set(STATE_SLUGS.map((item) => item.slug)).size, 51)
  for (const item of STATE_SLUGS) {
    assert.match(item.slug, SLUG)
    assert.equal(stateBySlug(item.slug), item.code)
  }
  // Pinned: these addresses are live. Changing one breaks every link to it.
  assert.equal(stateSlug("OH"), "ohio")
  assert.equal(stateSlug("NY"), "new-york")
  assert.equal(stateSlug("DC"), "district-of-columbia")
  assert.equal(statePath("CA"), "/states/california")
  assert.equal(stateBySlug("OH"), null)
  assert.equal(stateBySlug("atlantis"), null)
})

test("car slugs are the make and model, without a year, and never change", () => {
  const listings = carListings()
  assert.equal(new Set(listings.map((item) => item.slug)).size, listings.length, "two cars share a slug")
  for (const item of listings) assert.match(item.slug, SLUG, item.slug)
  // Pinned: these addresses are live.
  assert.equal(carSlug("Toyota", "RAV4"), "toyota-rav4")
  assert.equal(carSlug("Tesla", "Model Y"), "tesla-model-y")
  assert.equal(carSlug("Ford", "F-150"), "ford-f-150")
  assert.equal(carSlug("Toyota", "RAV4 Prime (PHEV)"), "toyota-rav4-prime")
  assert.equal(carSlug("Mercedes-Benz", "C-Class"), "mercedes-benz-c-class")
  const slugs = new Set(listings.map((item) => item.slug))
  for (const slug of ["toyota-rav4", "tesla-model-y", "subaru-outback", "honda-civic", "ford-f-150", "honda-cr-v", "toyota-camry"]) {
    assert.ok(slugs.has(slug), `${slug} is missing`)
  }
})

test("every car on the site's popular lists and in data/car-pages.json gets a page", () => {
  if (!FACTOR_BUNDLE.vehicle.modelsEnabled) return
  const pages = new Set(carPages(catalog).map((page) => page.slug))
  const missing = carListings().filter((listing) => !pages.has(listing.slug))
  assert.deepEqual(
    missing.map((item) => `${item.make} ${item.model}`),
    [],
    "These have no model-level claims data in our claims years. Fix the name in data/car-pages.json, or remove the car.",
  )
  assert.ok(pages.size >= 90, `only ${pages.size} car pages`)
})

test("car pages exist only for cars with claims results for that exact model", () => {
  for (const page of carPages(catalog)) {
    assert.equal(page.relativity.level, "model", page.slug)
    assert.ok(page.relativity.rows.length > 0, page.slug)
    assert.equal(page.relativity.outsideYears, false, page.slug)
    assert.ok(page.pick.year >= CLAIMS_YEARS.first && page.pick.year <= CLAIMS_YEARS.last, page.slug)
    // The newest year the claims data supports.
    const newer = catalog.vehicles[String(page.pick.year + 1)]?.[page.make]?.[page.model]
    if (page.pick.year < CLAIMS_YEARS.last) assert.ok(!newer, `${page.slug} could use a newer year`)
    assert.ok(carId(catalog, page.pick))
  }
  // A model we only have a class average for gets no page.
  assert.equal(claimsYearPick(catalog, "Mitsubishi", "Mirage"), null)
  assert.equal(claimsYearPick(catalog, "Honda", "Prologue"), null)
})

test("the What-if and Compare pages link only to car pages that exist", () => {
  const pages = new Set(carPages(catalog).map((page) => `/cars/${page.slug}`))
  for (const listing of carListings()) {
    const path = carPagePath(listing.make, listing.model)
    if (path) assert.ok(pages.has(path), path)
  }
  assert.equal(carPagePath("Mitsubishi", "Mirage"), null)
  assert.equal(carPagePath("Tesla", "Model Y"), "/cars/tesla-model-y")
})

// ---------------------------------------------------------------------------
// State pages: what really differs, and what doesn't

const ALL_STATES = STATES.map((state) => stateFigures(catalog, state.code))

test("every state page renders with its own numbers and its own words", () => {
  assert.equal(ALL_STATES.length, 51)
  const texts = ALL_STATES.map(stateMainText)
  assert.equal(new Set(texts).size, 51, "two state pages have the same main text")
  for (const f of ALL_STATES) {
    const text = stateMainText(f)
    assert.ok(text.length > 1500, `${f.code} is thin`)
    assert.match(text, new RegExp(f.name.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")))
    assert.ok(f.baseline.annual > 0 && f.start.annual > f.baseline.annual, f.code)
    assert.ok(f.teen.added.increase > 0, f.code)
    assert.ok(f.rule, `${f.code} has no rule`)
    assert.ok(f.neighbors.length > 0, `${f.code} has nothing to compare with`)
  }
  // Leads, titles, and descriptions are each unique.
  for (const pick of [stateTitle, stateDescription]) {
    assert.equal(new Set(ALL_STATES.map(pick)).size, 51)
  }
})

test("typical prices, minimums, and teen costs really differ across states", () => {
  const prices = new Set(ALL_STATES.map((f) => f.baseline.annual))
  const minimums = new Set(ALL_STATES.map((f) => (f.rule ? liabilityShorthand(f.rule) : null)))
  const teen = new Set(ALL_STATES.map((f) => shownYearly(f.teen.added.increase)))
  const ranks = new Set(ALL_STATES.map((f) => f.rank.rank))
  assert.ok(prices.size >= 48, `only ${prices.size} different typical prices`)
  assert.ok(minimums.size >= 12, `only ${minimums.size} different minimums`)
  assert.ok(teen.size >= 30, `only ${teen.size} different teen costs`)
  assert.ok(ranks.size >= 48)
  // Florida costs more than Maine, and says so.
  const fl = stateFigures(catalog, "FL")
  const me = stateFigures(catalog, "ME")
  assert.ok(fl.teen.added.increase > me.teen.added.increase)
  assert.equal(fl.rank.rank, 1)
})

test("the cheapest cars for a teen come out in the same order in every state, and the page says so", () => {
  const order = (code: (typeof STATES)[number]["code"]) =>
    stateFigures(catalog, code).teenCars.map((item) => `${item.car.pick.make} ${item.car.pick.model}`).join(",")
  const first = order("OH")
  for (const state of STATES) assert.equal(order(state.code), first, state.code)
  assert.match(SAME_ORDER_NOTE, /same in every state, because our car data is national/)
  // Only the dollar level moves.
  const oh = stateFigures(catalog, "OH").teenCars[0].added.increase
  const fl = stateFigures(catalog, "FL").teenCars[0].added.increase
  assert.ok(fl > oh * 1.5)
})

test("the state page's teen cars match the Compare page and the API, to the dollar", () => {
  for (const code of ["OH", "CA", "TX", "NH"] as const) {
    const f = stateFigures(catalog, code)
    const top = f.teenCars.slice(0, TEEN_TOP)
    const ids = top.map((item) => carId(catalog, item.car.pick))
    const result = handleCompare(catalog, new URLSearchParams(`state=${code}&age=16-18&policy=added&cars=${ids.join(",")}`))
    assert.equal(result.status, 200)
    const body = result.body as { results: { id: string; teenAdds: { yearly: number } }[] }
    for (const item of top) {
      const row = body.results.find((candidate) => candidate.id === carId(catalog, item.car.pick))
      assert.ok(row, item.car.label)
      assert.equal(row.teenAdds.yearly, shownYearly(item.added.increase), `${code} ${item.car.label}`)
    }
    assert.deepEqual(
      body.results.map((row) => row.id),
      ids,
      `${code}: same order as the API`,
    )
  }
})

test("neighbors are symmetric, real, and moves use the What-if page's defaults", () => {
  for (const [code, list] of Object.entries(NEIGHBORS)) {
    assert.ok(!list.includes(code as never), `${code} borders itself`)
    for (const other of list) assert.ok(NEIGHBORS[other].includes(code as never), `${code} and ${other}`)
  }
  const oh = stateFigures(catalog, "OH")
  assert.deepEqual(
    oh.neighbors.map((row) => row.code),
    ["IN", "KY", "MI", "PA", "WV"],
  )
  const fromMichigan = oh.neighbors.find((row) => row.code === "MI")!
  assert.ok(fromMichigan.move.delta < 0, "Ohio costs less than Michigan")
  assert.equal(stateFigures(catalog, "AK").bordering, false)
})

test("state page buttons open the What-if and Compare pages filled in for that state", () => {
  const oh = stateFigures(catalog, "OH")
  const whatIf = decodeShareSearch(oh.whatIfHref)
  assert.equal(whatIf.status, "ok")
  if (whatIf.status !== "ok") return
  assert.equal(whatIf.via, "page")
  assert.equal(whatIf.scenario.state, "OH")
  assert.equal(whatIf.teenOnParentPolicy, true)
  assert.equal(whatIf.next?.age, "16-18")
  const compare = decodeShareSearch(oh.compareHref)
  assert.equal(compare.status, "ok")
  if (compare.status !== "ok") return
  assert.equal(compare.via, "page")
  assert.equal(compare.scenario.state, "OH")
  assert.equal(compare.scenario.age, "16-18")
  assert.equal(compare.teenOnParentPolicy, true)
  assert.deepEqual(
    compare.cars?.map((car) => car.model),
    oh.teenCars.slice(0, TEEN_TOP).map((item) => item.car.pick.model),
  )
  // Nothing in a link carries a dollar figure.
  assert.doesNotMatch(oh.whatIfHref + oh.compareHref, /anchor=|price=|yearly=/)
})

// ---------------------------------------------------------------------------
// Car pages

test("every car page has its own numbers and words, from the engine", () => {
  const pages = carPages(catalog)
  const texts = pages.map((page) => carMainText(carFigures(catalog, page.slug)!))
  assert.equal(new Set(texts).size, pages.length, "two car pages have the same main text")
  assert.equal(new Set(pages.map((page) => carTitle(carFigures(catalog, page.slug)!))).size, pages.length)
  assert.equal(new Set(pages.map((page) => carDescription(carFigures(catalog, page.slug)!))).size, pages.length)
  const outback = carFigures(catalog, "subaru-outback")!
  const modelY = carFigures(catalog, "tesla-model-y")!
  assert.ok(modelY.adult.likely > outback.adult.likely)
  assert.ok(modelY.teen.increase > outback.teen.increase)
  assert.ok(outback.adult.likely < outback.averageCar.likely, "the Outback costs less than an average car")
  assert.equal(outback.page.pick.year, CLAIMS_YEARS.last)
  for (const similar of [...outback.similar.cheaper, ...outback.similar.pricier]) {
    const other = carFigures(catalog, similar.slug)!
    assert.equal(other.page.facts.classId, outback.page.facts.classId)
  }
})

test("the national start is NAIC's countrywide figure, brought up to today like a state's", () => {
  const start = nationalTypicalStart(DEFAULT_SCENARIO)
  const national = countrywideBaseline()
  const trend = FACTOR_BUNDLE.typicalStart.trend
  assert.equal(start.untrendedAnnual, national.annual)
  assert.ok(Math.abs(start.annual - (national.annual * trend.latestValue) / trend.baseValue) <= 1)
  assert.equal(start.national, true)
  assert.match(start.attribution ?? "", /national average full-coverage cost in 2023 was \$1,439/)
})

// ---------------------------------------------------------------------------
// Sitemap, structured data, titles

test("the sitemap lists every generated page once, with a real date", () => {
  const entries = sitemapEntries(catalog)
  const urls = entries.map((entry) => entry.url)
  assert.equal(new Set(urls).size, urls.length, "a page is listed twice")
  for (const entry of entries) {
    assert.match(entry.lastModified, /^\d{4}-\d{2}-\d{2}$/)
    assert.ok(entry.url.startsWith("https://notaquote.fyi/"))
  }
  const listed = new Set(urls.map((url) => url.replace("https://notaquote.fyi", "")))
  for (const { state } of stateParams()) assert.ok(listed.has(`/states/${state}`), state)
  for (const { slug } of carParams()) assert.ok(listed.has(`/cars/${slug}`), slug)
  for (const guide of GUIDES) assert.ok(listed.has(guide.path), guide.path)
  assert.equal([...listed].filter((path) => path.startsWith("/states/")).length, stateParams().length)
  assert.equal([...listed].filter((path) => path.startsWith("/cars/")).length, carParams().length)
  // Every page file that isn't dynamic is in the sitemap.
  for (const path of staticPagePaths()) assert.ok(listed.has(path), `${path} is missing from the sitemap`)
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

test("structured data is valid JSON with the fields search engines need", () => {
  const home = JSON.parse(jsonLdText(homeJsonLd("A description"))) as Record<string, unknown>[]
  const site = home.find((item) => item["@type"] === "WebSite")!
  const app = home.find((item) => item["@type"] === "WebApplication")!
  assert.equal(site.name, SITE_NAME)
  assert.equal(site.url, "https://notaquote.fyi/")
  assert.equal(app.applicationCategory, "FinanceApplication")
  assert.deepEqual(app.offers, { "@type": "Offer", price: "0", priceCurrency: "USD" })

  const dataset = JSON.parse(jsonLdText(stateDatasetJsonLd())) as Record<string, any> // eslint-disable-line @typescript-eslint/no-explicit-any
  assert.equal(dataset["@context"], "https://schema.org")
  assert.equal(dataset["@type"], "Dataset")
  assert.ok(dataset.name && dataset.description.length > 50)
  assert.equal(dataset.license, "https://creativecommons.org/licenses/by/4.0/")
  assert.equal(dataset.creator.name, "Bolewood Group, LLC")
  assert.ok(dataset.isBasedOn.some((source: { url?: string }) => source.url?.includes("naic.org")))
  assert.ok(dataset.distribution.every((item: { contentUrl: string }) => item.contentUrl.endsWith(".json")))
  assert.match(dataset.dateModified, /^\d{4}-\d{2}-\d{2}$/)

  const crumbs = JSON.parse(jsonLdText(breadcrumbJsonLd([{ name: "Home", path: "/" }, { name: "Ohio", path: "/states/ohio" }])))
  assert.equal(crumbs.itemListElement[1].item, "https://notaquote.fyi/states/ohio")
  // "<" can't close the script tag.
  assert.doesNotMatch(jsonLdText({ name: "</script><script>alert(1)</script>" }), /</)
})

test("page titles are unique across the site", async () => {
  const pages = ["page", "compare/page", "methodology/page", "sources/page", "privacy/page", "disclaimer/page", "data-licenses/page", "corrections/page", "model-version/page", "states/page", "cars/page", "guides/page", "guides/adding-a-teen-driver/page", "guides/cheapest-cars-to-insure-for-teens/page"]
  const titles: string[] = []
  for (const page of pages) {
    const mod = (await import(`../app/${page}`)) as { metadata: Metadata }
    const title = mod.metadata.title
    const text = typeof title === "string" ? title : title && "absolute" in title ? title.absolute : null
    assert.ok(text, `${page} has no title`)
    assert.ok(mod.metadata.description, `${page} has no description`)
    assert.ok(mod.metadata.alternates?.canonical, `${page} has no canonical address`)
    titles.push(text)
  }
  for (const f of ALL_STATES) titles.push(stateTitle(f))
  for (const page of carPages(catalog)) titles.push(carTitle(carFigures(catalog, page.slug)!))
  assert.equal(new Set(titles).size, titles.length, "two pages share a title")
})
