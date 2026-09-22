import assert from "node:assert/strict"
import { readFileSync } from "node:fs"
import test from "node:test"
import type { VehicleCatalog } from "./catalog"
import { vehicleFacts } from "./catalog-class"
import {
  buildRows,
  csvCell,
  csvFilename,
  DEFAULT_SORT,
  filterRows,
  headlineAmount,
  nextSort,
  parseMaxYearly,
  scaleFor,
  sortRows,
  toCsv,
  type CompareRow,
} from "./compare-table"
import { typicalStart } from "./factor-engine"
import { distinctReasons, priceCars, priceCarsTeenAdded, reasonParts } from "./pricing"
import { DEFAULT_SCENARIO, type Scenario } from "./scenario"

const catalog = JSON.parse(readFileSync("public/catalog/vehicle-catalog.json", "utf8")) as VehicleCatalog

const CARS = [
  { year: 2022, make: "Honda", model: "Civic", trim: "Civic 4Dr", starred: true },
  { year: 2022, make: "Toyota", model: "RAV4", trim: "RAV4", starred: false },
  { year: 2022, make: "Tesla", model: "Model Y", trim: "Model Y Long Range AWD", starred: true },
  { year: 2022, make: "Subaru", model: "Crosstrek", trim: "Crosstrek AWD", starred: false },
]

const TEEN: Scenario = { ...DEFAULT_SCENARIO, age: "16-18", yearsLicensed: "under-1", teen: true }

function ownRows(): CompareRow[] {
  const start = typicalStart(TEEN)
  assert.ok(start)
  const facts = CARS.map((car) => vehicleFacts(catalog, car))
  const priced = priceCars(start, TEEN, facts).map((row) => ({ estimate: row.estimate, extra: null }))
  const reasons = distinctReasons(priced.map((row, index) => reasonParts(row.estimate, CARS[index].year, TEEN)))
  return buildRows(priced, CARS, reasons)
}

function addedRows(): CompareRow[] {
  const parent: Scenario = { ...TEEN, age: "40-64", yearsLicensed: "10+", teen: false }
  const start = typicalStart(parent, { teenOnParentPolicy: true })
  assert.ok(start)
  const facts = CARS.map((car) => vehicleFacts(catalog, car))
  const priced = priceCarsTeenAdded(start, parent, facts).map((row) => ({ estimate: row.after, extra: row.increase }))
  const reasons = distinctReasons(priced.map((row, index) => reasonParts(row.estimate, CARS[index].year, TEEN)))
  return buildRows(priced, CARS, reasons)
}

test("rows carry the engine's numbers and words, in the order the cars were added", () => {
  const rows = ownRows()
  assert.deepEqual(
    rows.map((row) => row.name),
    ["2022 Honda Civic", "2022 Toyota RAV4", "2022 Tesla Model Y", "2022 Subaru Crosstrek"],
  )
  for (const row of rows) {
    assert.ok(row.low < row.likely && row.likely < row.high)
    assert.equal(row.extra, null)
    assert.match(row.summary, /We started from/)
    assert.ok(row.rangeNote.length > 0)
    assert.ok(row.reason.length > 0)
    assert.doesNotMatch(row.reason, /relativity|baseline|factor/i)
    assert.doesNotMatch(row.reason, /newer car/, "every car here is a 2022, so the shared age phrase is dropped")
  }
  assert.deepEqual(
    rows.map((row) => row.starred),
    [true, false, true, false],
  )
})

test("in teen-added mode the main number is what adding the teen costs", () => {
  const rows = addedRows()
  for (const row of rows) {
    assert.ok(row.extra !== null && row.extra > 0)
    assert.equal(headlineAmount(row), row.extra)
    assert.ok(row.likely > (row.extra ?? 0), "the whole policy is more than the extra")
  }
})

test("sorting: price by default, any column both ways, ties keep the added order", () => {
  const rows = ownRows()
  const cheapest = sortRows(rows, DEFAULT_SORT)
  for (let index = 1; index < cheapest.length; index += 1) {
    assert.ok(cheapest[index - 1].likely <= cheapest[index].likely)
  }
  const dearest = sortRows(rows, { key: "yearly", direction: "desc" })
  assert.deepEqual(
    dearest.map((row) => row.key),
    [...cheapest].reverse().map((row) => row.key),
  )
  const byName = sortRows(rows, { key: "car", direction: "asc" })
  assert.deepEqual(
    byName.map((row) => row.car.make),
    ["Honda", "Subaru", "Tesla", "Toyota"],
  )
  const same = rows.map((row) => ({ ...row, likely: 1000 }))
  assert.deepEqual(
    sortRows(same, DEFAULT_SORT).map((row) => row.order),
    [0, 1, 2, 3],
  )
  assert.deepEqual(rows.map((row) => row.order), [0, 1, 2, 3], "sorting doesn't change the input")

  const byPolicy = sortRows(addedRows(), { key: "policy", direction: "asc" })
  for (let index = 1; index < byPolicy.length; index += 1) {
    assert.ok(byPolicy[index - 1].likely <= byPolicy[index].likely, "the whole-policy column sorts by the whole policy")
  }
  const byRange = sortRows(addedRows(), { key: "range", direction: "asc" })
  for (let index = 1; index < byRange.length; index += 1) {
    const width = (row: CompareRow) => row.high - row.low
    assert.ok(width(byRange[index - 1]) <= width(byRange[index]))
  }

  assert.deepEqual(nextSort(DEFAULT_SORT, "yearly"), { key: "yearly", direction: "desc" })
  assert.deepEqual(nextSort(DEFAULT_SORT, "car"), { key: "car", direction: "asc" })

  const added = sortRows(addedRows(), DEFAULT_SORT)
  for (let index = 1; index < added.length; index += 1) {
    assert.ok((added[index - 1].extra ?? 0) <= (added[index].extra ?? 0))
  }
})

test("filtering by a yearly limit and by stars", () => {
  const rows = ownRows()
  const sorted = sortRows(rows, DEFAULT_SORT)
  const limit = sorted[1].likely
  const under = filterRows(rows, { maxYearly: limit, starredOnly: false })
  assert.ok(under.every((row) => row.likely <= limit))
  assert.equal(under.length, 2)
  assert.deepEqual(
    filterRows(rows, { maxYearly: null, starredOnly: true }).map((row) => row.car.model),
    ["Civic", "Model Y"],
  )
  assert.equal(filterRows(rows, { maxYearly: 1, starredOnly: false }).length, 0)

  assert.equal(parseMaxYearly("$2,500"), 2500)
  assert.equal(parseMaxYearly(" 3000 "), 3000)
  assert.equal(parseMaxYearly(""), null)
  assert.equal(parseMaxYearly("lots"), null)
  assert.equal(parseMaxYearly("0"), null)
})

test("every range bar shares one scale", () => {
  const rows = ownRows()
  const scale = scaleFor(rows)
  assert.ok(scale)
  assert.equal(scale?.min, Math.min(...rows.map((row) => row.low)))
  assert.equal(scale?.max, Math.max(...rows.map((row) => row.high)))
  assert.equal(scaleFor([]), null)
})

test("the CSV has one line per row in the shown order, then plain notes, and no formulas", () => {
  const rows = sortRows(ownRows(), DEFAULT_SORT)
  const notes = {
    driver: "A 16–18-year-old driver on their own policy in the Illinois suburbs with full coverage.",
    start: "Illinois's average full-coverage cost in 2023 was $1,257 (NAIC).",
    disclaimer: "This is an estimate to help you plan, not a quote.",
    versions: "Model 0.2.0",
  }
  const csv = toCsv(rows, notes)
  assert.equal(csv.charCodeAt(0), 0xfeff, "starts with a byte-order mark so Excel reads UTF-8")
  const lines = csv.slice(1).trimEnd().split("\r\n")
  assert.equal(lines[0], "Car,Version,Starred,Yearly estimate ($),Monthly ($),Low ($),High ($),Why")
  for (const [index, row] of rows.entries()) {
    assert.ok(lines[index + 1].startsWith(`${row.name},${row.trim},${row.starred ? "Yes" : ""},${row.likely},${row.monthly},${row.low},${row.high},`))
  }
  assert.equal(lines[rows.length + 1], "")
  assert.match(csv, /Starting point,"Illinois's average full-coverage cost in 2023 was \$1,257 \(NAIC\)\."/)
  assert.match(csv, /Please note,"This is an estimate to help you plan, not a quote\."/)
  assert.doesNotMatch(csv, /\bnull\b|undefined/)

  const added = toCsv(sortRows(addedRows(), DEFAULT_SORT), notes, "added")
  assert.match(added.slice(1).split("\r\n")[0], /^Car,Version,Starred,Extra a year for the teen \(\$\),"Whole policy a year, with the teen \(\$\)"/)

  assert.equal(csvCell("=HYPERLINK(1)"), "'=HYPERLINK(1)")
  assert.equal(csvCell("+1"), "'+1")
  assert.equal(csvCell('say "hi", ok'), '"say ""hi"", ok"')
  assert.equal(csvCell(1234), "1234")
  assert.equal(csvCell(true), "Yes")
  assert.equal(csvFilename(new Date("2026-09-22T12:00:00Z")), "notaquote-car-comparison-2026-09-22.csv")
})
