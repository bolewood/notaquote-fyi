import assert from "node:assert/strict"
import { readFileSync } from "node:fs"
import path from "node:path"
import test from "node:test"
import { createElement, createRef } from "react"
import { renderToStaticMarkup } from "react-dom/server"
import { NextFourYears } from "../components/next-four-years"
import { PrintSummary, WhatIfResult } from "../components/calculator"
import TeenCostGuide from "../app/guides/adding-a-teen-driver/page"
import type { VehicleCatalog } from "./catalog"
import { vehicleFacts } from "./catalog-class"
import { parseCsv } from "./factor-derivation"
import { FACTOR_BUNDLE } from "./factor-engine"
import { TEEN_YEAR_AGES, type FactorBundle } from "./factor-types"
import { priceWhatIf } from "./pricing"
import { calculatorAskContexts } from "./ask-your-insurer"
import { PLAIN_LANGUAGE_BANNED, visibleText } from "./rendered-text"
import { starter, stateName, type Scenario, type StateCode } from "./scenario"
import { DEFAULT_SITUATION, type Situation } from "./situation"
import { typicalTeenCost } from "./teen-cars"
import {
  addedToPolicyYears,
  fourYearWords,
  FOUR_YEAR_AGES,
  ownPolicyYears,
  teenFourYears,
  teenYearMethodRows,
  TEEN_YEARS_METHOD_PATH,
  type TeenFourYears,
  yearName,
} from "./teen-years"
import { rangeDollars } from "./format"

const SOURCES = "data/factors/sources"
const committed = JSON.parse(readFileSync("src/data/model-factors.json", "utf8")) as FactorBundle
const catalog = JSON.parse(readFileSync("public/catalog/vehicle-catalog.json", "utf8")) as VehicleCatalog

function csv(name: string): Record<string, string>[] {
  return parseCsv(readFileSync(path.join(SOURCES, name), "utf8"))
}

/** A plain median, written separately from the derivation on purpose. */
function median(values: number[]): number {
  const sorted = [...values].sort((a, b) => a - b)
  const mid = sorted.length >> 1
  return sorted.length % 2 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2
}

/** Oklahoma, same company, city, and sex: one scenario ÷ another. */
function okRatios(top: string, bottom: string): number[] {
  const rows = csv("ok-2026-premiums.csv")
  const carrier = (name: string) => name.replace("EQU+27:95ITY", "EQUITY")
  const price = new Map(rows.map((row) => [`${carrier(row.carrier)}|${row.territory}|${row.profile_id}`, Number(row.annual_premium)]))
  const out: number[] = []
  for (const row of rows) {
    const match = new RegExp(`^ok-2026-${top}-(male|female)$`).exec(row.profile_id)
    if (!match) continue
    const other = price.get(`${carrier(row.carrier)}|${row.territory}|ok-2026-${bottom}-${match[1]}`)
    if (other) out.push(Number(row.annual_premium) / other)
  }
  return out
}

// ---------------------------------------------------------------------------
// The single ages, from the CSVs

test("golden: age 16 is Oklahoma's 16 ÷ 21 times its 21 ÷ 55, recomputed by hand", () => {
  const ab = okRatios("A", "B")
  const bd = okRatios("B", "D")
  assert.equal(ab.length, 200)
  assert.equal(bd.length, 200)
  const own = committed.teenYears.own
  assert.equal(own["16"].value, Math.round(median(ab) * median(bd) * 100))
  assert.equal(own["16"].basis, "indicative", "rough: the 16-year-old also drives less, to school")
  assert.match(own["16"].derivation, /drives to school, under 7,500 miles/)
  // The top of the range reaches the direct 16 ÷ 55 comparison's upper quarter.
  const ad = okRatios("A", "D").sort((a, b) => a - b)
  assert.ok(own["16"].high >= Math.round(ad[Math.floor(ad.length * 0.75) - 1] * 100))
})

test("golden: age 18 is the 16–18 cell, and 17, 19, 20 are filled in on a multiplying scale", () => {
  const own = committed.teenYears.own
  const band = committed.groups["driver-age"].cells
  assert.deepEqual({ ...own["18"], label: "", derivation: "" }, { ...band["16-18"], label: "", derivation: "" })
  assert.equal(own["17"].value, Math.round(Math.sqrt(own["16"].value * own["18"].value)))
  assert.equal(own["19"].value, Math.round(own["18"].value ** (2 / 3) * band["19-21"].value ** (1 / 3)))
  assert.equal(own["20"].value, Math.round(own["18"].value ** (1 / 3) * band["19-21"].value ** (2 / 3)))
  for (const age of ["17", "19", "20"] as const) {
    assert.equal(own[age].basis, "indicative")
    assert.match(own[age].derivation, /^Filled in between the published ages, not published itself\./)
  }
})

test("the teen-added years are our estimate, and say so", () => {
  const added = committed.teenYears.added
  assert.equal(added["16"].value, 100)
  assert.equal(added["16"].basis, "indicative")
  for (const age of ["17", "18", "19", "20"] as const) {
    const cell = added[age]
    assert.equal(cell.basis, "assumed")
    assert.equal(cell.value, Math.round((100 * committed.teenYears.own[age].value) / committed.teenYears.own["16"].value))
    assert.match(cell.derivation, /Our estimate/)
    assert.match(cell.derivation, /help wanted/)
    assert.match(cell.derivation, /years licensed, not age/)
    assert.ok(cell.low < cell.value && cell.value < cell.high, "an assumed cell widens the range")
  }
})

test("year factors go down (or stay level) from 16 to 20, for both kinds", () => {
  for (const kind of ["own", "added"] as const) {
    const values = TEEN_YEAR_AGES.map((age) => committed.teenYears[kind][age].value)
    for (let index = 1; index < values.length; index += 1) {
      assert.ok(values[index] <= values[index - 1], `${kind}: ${values.join(", ")}`)
    }
  }
  // Age 20 sits above the 19–21 band's age-21 point, and 16 above the 16–18 band.
  assert.ok(committed.teenYears.own["20"].value >= committed.groups["driver-age"].cells["19-21"].value)
  assert.ok(committed.teenYears.own["16"].value > committed.groups["driver-age"].cells["16-18"].value)
})

// ---------------------------------------------------------------------------
// Existing estimates are unchanged

test("existing prices are unchanged: age bands and typical teen costs, as before this view", () => {
  const ages = Object.fromEntries(Object.entries(FACTOR_BUNDLE.groups["driver-age"].cells).map(([key, cell]) => [key, [cell.value, cell.low, cell.high]]))
  assert.deepEqual(ages, {
    "16-18": [287, 257, 381],
    "16-18-added": [166, 143, 195],
    "19-21": [192, 169, 206],
    "22-25": [130, 120, 149],
    "26-39": [111, 106, 120],
    "40-64": [100, 100, 100],
    "65+": [105, 95, 116],
  })
  // Recorded from main before the four-year view was added.
  const before: Record<string, { added: number[]; increase: number; own: number[] }> = {
    national: { added: [2108, 2830, 3748], increase: 1125, own: [3727, 4893, 6980] },
    TX: { added: [2530, 3396, 4497], increase: 1350, own: [4473, 5872, 8376] },
    OK: { added: [1941, 2605, 3450], increase: 1036, own: [3430, 4503, 6424] },
    IL: { added: [1842, 2472, 3274], increase: 983, own: [3255, 4273, 6095] },
    CA: { added: [2078, 2789, 3693], increase: 1109, own: [3673, 4822, 6879] },
  }
  for (const [key, want] of Object.entries(before)) {
    const cost = typicalTeenCost(key === "national" ? { kind: "national" } : { kind: "state", state: key as StateCode })
    assert.deepEqual([cost.added.after.low, cost.added.after.likely, cost.added.after.high], want.added, key)
    assert.equal(cost.added.increase, want.increase, key)
    assert.deepEqual([cost.own.low, cost.own.likely, cost.own.high], want.own, key)
  }
})

// ---------------------------------------------------------------------------
// The four years

function rowsAddUp(years: TeenFourYears) {
  const sum = (pick: (row: TeenFourYears["rows"][number]) => number) => years.rows.reduce((total, row) => total + pick(row), 0)
  assert.equal(years.total.likely, sum((row) => row.likely))
  assert.equal(years.total.low, sum((row) => row.low))
  assert.equal(years.total.high, sum((row) => row.high))
  assert.deepEqual(
    years.rows.map((row) => row.age),
    [...FOUR_YEAR_AGES],
  )
  for (const row of years.rows) assert.ok(row.low < row.likely && row.likely < row.high, `${years.kind} ${row.age}`)
}

test("own policy: year 3 (age 18) is today's estimate exactly, year 1 is higher, and the total adds up", () => {
  for (const state of ["TX", "OK", "IL"] as const) {
    const today = typicalTeenCost({ kind: "state", state }).own
    const years = ownPolicyYears(today, state)
    rowsAddUp(years)
    const [y1, y2, y3, y4] = years.rows
    assert.deepEqual([y3.low, y3.likely, y3.high], [today.low, today.likely, today.high])
    assert.ok(y1.likely > y2.likely && y2.likely > y3.likely && y3.likely > y4.likely)
    assert.equal(y1.versusToday, Math.round((100 * y1.likely) / today.likely))
    assert.equal(y3.versusToday, 100)
  }
})

test("added to a parent's policy: year 1 is today's increase, and the increase shrinks", () => {
  for (const state of ["TX", "OK", "IL"] as const) {
    const added = typicalTeenCost({ kind: "state", state }).added
    const years = addedToPolicyYears(added, state)
    rowsAddUp(years)
    assert.equal(years.rows[0].likely, added.increase)
    for (let index = 1; index < 4; index += 1) assert.ok(years.rows[index].likely < years.rows[index - 1].likely)
  }
})

test("the range widens with assumed years", () => {
  const years = addedToPolicyYears(typicalTeenCost({ kind: "state", state: "TX" }).added, "TX")
  const width = (row: TeenFourYears["rows"][number]) => (row.high - row.low) / row.likely
  const [first, ...later] = years.rows
  for (const row of later) {
    assert.equal(row.basis, "assumed")
    assert.ok(width(row) > width(first), `age ${row.age}: ${width(row)} vs ${width(first)}`)
  }
})

test("each year carries its own basis label and links to the method", () => {
  const own = ownPolicyYears(typicalTeenCost({ kind: "state", state: "OK" }).own, "OK")
  assert.deepEqual(
    own.rows.map((row) => row.basisWords),
    ["Worked out from public data", "Worked out from public data", "From published prices", "Worked out from public data"],
  )
  const added = addedToPolicyYears(typicalTeenCost({ kind: "state", state: "TX" }).added, "TX")
  assert.deepEqual(
    added.rows.map((row) => row.basisWords),
    ["Worked out from public data in California (Texas may differ)", "Our best guess", "Our best guess", "Our best guess"],
  )
  const html = renderToStaticMarkup(createElement(NextFourYears, { years: own, open: true }))
  // Every year links twice (under the year on phones, in its own column on wider screens), plus the method line.
  assert.equal(html.split(`href="${TEEN_YEARS_METHOD_PATH}"`).length - 1, 2 * own.rows.length + 1)
  assert.equal(teenYearMethodRows().length, 5)
})

// ---------------------------------------------------------------------------
// The calculator and the guide

function result(state: StateCode, onParentPolicy: boolean) {
  const situation: Situation = { ...DEFAULT_SITUATION, teenOnParentPolicy: onParentPolicy, scenario: { ...DEFAULT_SITUATION.scenario, state } }
  const now = situation.scenario
  const next: Scenario = { ...now, ...starter("adding-teen").change(now) }
  const priced = priceWhatIf(situation, vehicleFacts(catalog, now), next, vehicleFacts(catalog, next))
  assert.ok(priced)
  return { priced, now, next }
}

test("the calculator shows the four years only for a new 16-year-old", () => {
  const added = result("TX", true)
  const addedYears = teenFourYears(added.priced, added.now, added.next)
  assert.equal(addedYears?.kind, "added")
  assert.equal(addedYears?.rows[0].likely, added.priced.teenAdded?.increase)
  const own = result("OK", false)
  assert.equal(teenFourYears(own.priced, own.now, own.next)?.kind, "own")
  const other = { ...DEFAULT_SITUATION.scenario, incidents: "one" as const }
  const plain = priceWhatIf(DEFAULT_SITUATION, vehicleFacts(catalog, DEFAULT_SITUATION.scenario), other, vehicleFacts(catalog, other))
  assert.ok(plain)
  assert.equal(teenFourYears(plain, DEFAULT_SITUATION.scenario, other), null)
})

test("plain language: the four-year words, the rendered view, and the guide section", () => {
  for (const kind of ["own", "added"] as const) {
    for (const words of Object.values(fourYearWords(kind))) assert.doesNotMatch(words, PLAIN_LANGUAGE_BANNED, words)
  }
  const years = ownPolicyYears(typicalTeenCost({ kind: "state", state: "OK" }).own, "OK")
  const text = visibleText(renderToStaticMarkup(createElement(NextFourYears, { years, open: true })))
  assert.doesNotMatch(text, PLAIN_LANGUAGE_BANNED)
  assert.match(text, /This is the most expensive stretch, and it gets better\./)
  assert.match(text, /An accident or a ticket resets much of that drop\./)
  assert.doesNotMatch(text, /\bguarantee|promise|you will pay\b/i)
  const guide = renderToStaticMarkup(createElement(TeenCostGuide))
  const section = visibleText(guide.slice(guide.indexOf('id="next-four-years"'), guide.indexOf('id="what-changes-it"')))
  assert.match(section, /The next four years on your policy/)
  assert.match(section, /The next four years on their own policy/)
  assert.doesNotMatch(section, PLAIN_LANGUAGE_BANNED)
})

test("privacy: the view stores nothing and its component reads no storage", () => {
  const source = readFileSync("src/components/next-four-years.tsx", "utf8") + readFileSync("src/lib/teen-years.ts", "utf8")
  assert.doesNotMatch(source, /localStorage|sessionStorage|useStored|fetch\(|navigator\./)
})

/** The calculator's what-if result, rendered the way calculator.tsx renders it, four years included. */
function renderCalculator(situation: Situation, next: Scenario): string {
  const now = situation.scenario
  const priced = priceWhatIf(situation, vehicleFacts(catalog, now), next, vehicleFacts(catalog, next))
  assert.ok(priced)
  return renderToStaticMarkup(
    createElement(WhatIfResult, {
      headingRef: createRef<HTMLHeadingElement>(),
      mode: priced.mode,
      parts: priced.parts,
      compareHref: "/compare",
      headline: priced.headline,
      changesLabel: null,
      delta: priced.delta,
      current: priced.current,
      next: priced.next,
      startKind: "typical",
      sender: false,
      plural: false,
      state: stateName(next.state),
      stateCode: next.state,
      chips: [],
      onUndo: () => {},
      onReset: () => {},
      onKeep: () => {},
      neutral: false,
      tradeOff: null,
      moveNote: null,
      vehicleChanged: false,
      nextCarName: "",
      carPage: null,
      carPageName: "",
      versionPicker: null,
      ask: calculatorAskContexts(now, next, priced).print,
      fourYears: teenFourYears(priced, now, next),
    }),
  )
}

test("the calculator's teen result shows the four years collapsed, before the checklist; other results don't", () => {
  const situation: Situation = { ...DEFAULT_SITUATION, teenOnParentPolicy: true, scenario: { ...DEFAULT_SITUATION.scenario, state: "TX" } }
  const teen = renderCalculator(situation, { ...situation.scenario, ...starter("adding-teen").change(situation.scenario) })
  assert.match(teen, /data-testid="next-four-years"/)
  assert.doesNotMatch(teen, /<details[^>]*\sopen[^>]*data-testid="next-four-years"/)
  assert.ok(teen.indexOf('data-testid="next-four-years"') < teen.indexOf('data-testid="ask-your-insurer"'))
  assert.match(visibleText(teen), /The next four years on your policy/)
  const plain = renderCalculator(situation, { ...situation.scenario, incidents: "one" })
  assert.doesNotMatch(plain, /data-testid="next-four-years"/)
})

// ---------------------------------------------------------------------------
// Year 1 follows the engine for the household as entered

function addedResult(situation: Situation, teen: Partial<Scenario> = {}) {
  const now = situation.scenario
  const next: Scenario = { ...now, ...starter("adding-teen").change(now), ...teen }
  const priced = priceWhatIf(situation, vehicleFacts(catalog, now), next, vehicleFacts(catalog, next))
  assert.ok(priced?.teenAdded)
  const years = teenFourYears(priced, now, next)
  assert.ok(years)
  return { added: priced.teenAdded, years, now, next, priced }
}

const ADDED: Situation = { ...DEFAULT_SITUATION, teenOnParentPolicy: true, scenario: { ...DEFAULT_SITUATION.scenario, state: "TX" } }
const BOTH_DISCOUNTS = { goodStudent: true, driverTraining: true }

test("a discounted teen: year 1 is the engine's after minus before, discounts and all", () => {
  const plain = addedResult(ADDED)
  const discounted = addedResult(ADDED, BOTH_DISCOUNTS)
  const first = discounted.years.rows[0]
  assert.equal(first.likely, discounted.added.after.likely - discounted.added.before.likely)
  assert.ok(first.likely < plain.years.rows[0].likely, "the discounts lower the increase")
  assert.ok(first.low > 0 && first.low < first.likely && first.likely < first.high)
  // Later years keep their share of this year 1.
  assert.deepEqual(
    discounted.years.rows.map((row) => row.likely),
    discounted.years.rows.map((row) => Math.floor((2 * first.likely * row.versusToday + 100) / 200)),
  )
})

test("your own premium, unchanged: year 1's edges are the engine's after edges minus your premium", () => {
  const situation: Situation = { ...ADDED, premium: 2000 }
  const { added, years } = addedResult(situation, BOTH_DISCOUNTS)
  assert.equal(added.before.likely, 2000)
  const first = years.rows[0]
  assert.deepEqual([first.low, first.likely, first.high], [added.after.low - 2000, added.after.likely - 2000, added.after.high - 2000])
})

test("a parent who isn't 40–64: year 1 follows the engine, and the shared range isn't counted twice", () => {
  const situation: Situation = { ...ADDED, scenario: { ...ADDED.scenario, age: "26-39", yearsLicensed: "10+" } }
  const { added, years } = addedResult(situation)
  const first = years.rows[0]
  assert.equal(first.likely, added.after.likely - added.before.likely)
  // Narrower than treating before and after as unrelated, and never below zero.
  assert.ok(first.low > Math.max(0, added.after.low - added.before.high))
  assert.ok(first.high < added.after.high - added.before.low)
  assert.ok(added.shared.down > 0 && added.shared.down <= added.before.spread.down)
})

// ---------------------------------------------------------------------------
// Print and phones

test("the printed summary carries the four years: each year, its range, the total, and the basis", () => {
  const { years, priced, now } = addedResult(ADDED)
  const html = renderToStaticMarkup(
    createElement(PrintSummary, {
      situation: ADDED,
      nowEstimate: priced.current,
      ownNumber: false,
      result: { headline: priced.headline, next: priced.next, parts: priced.parts },
      bridge: null,
      changes: ["Teen added (16–18)"],
      ask: calculatorAskContexts(now, { ...now, age: "16-18" }, priced).print,
      fourYears: years,
    }),
  )
  assert.match(html, /data-testid="next-four-years-print"/)
  const text = visibleText(html)
  for (const row of years.rows) {
    assert.ok(text.includes(yearName(row)), yearName(row))
    assert.ok(text.includes(rangeDollars(row.low, row.high)), `${yearName(row)} range`)
    assert.ok(text.includes(row.basisWords), `${yearName(row)} basis`)
  }
  assert.ok(text.includes("All four years"))
  assert.ok(text.includes(rangeDollars(years.total.low, years.total.high)))
  assert.doesNotMatch(text, PLAIN_LANGUAGE_BANNED)
  assert.ok(html.indexOf("next-four-years-print") < html.indexOf("Questions to ask"), "before the checklist")
})

test("phones see every range: each year's and the total's, under the figure", () => {
  for (const years of [addedResult(ADDED).years, ownPolicyYears(typicalTeenCost({ kind: "state", state: "OK" }).own, "OK")]) {
    const html = renderToStaticMarkup(createElement(NextFourYears, { years, open: true }))
    const narrow = [...html.matchAll(/<span class="[^"]*sm:hidden[^"]*" data-testid="next-four-years-range-narrow">([^<]*)<\/span>/g)].map((match) => match[1])
    assert.deepEqual(narrow, [...years.rows.map((row) => rangeDollars(row.low, row.high)), rangeDollars(years.total.low, years.total.high)])
  }
})
