import assert from "node:assert/strict"
import { readFileSync } from "node:fs"
import test from "node:test"
import {
  catalogFilterIsEmpty,
  catalogFilterYears,
  catalogMakes,
  catalogModels,
  filterMissCopy,
  isCatalogStale,
  isVehicleCatalog,
  rangeConfidenceCopy,
  type VehicleCatalog,
} from "./catalog"
import { CATALOG_DEFAULTS } from "./catalog-defaults"
import {
  CATALOG_REFRESH_AFTER,
  CATALOG_RETRIEVED_ON,
  CATALOG_TERMS,
  CATALOG_VERSION,
  CATALOG_YEAR_MAX,
  CATALOG_YEAR_MIN,
} from "./catalog-meta"
import { DISCLAIMER } from "./copy"

const VERBATIM_DISCLAIMER =
  "THIS IS NOT A QUOTE. NotAQuote.FYI is an independent educational estimate tool, not an insurance company, agency, broker, producer, or lead-generation service. Actual premiums are set by licensed insurers after underwriting and may vary materially."

const catalog = JSON.parse(
  readFileSync("public/catalog/vehicle-catalog.json", "utf8"),
) as VehicleCatalog

test("snapshot header matches the generated catalog meta", () => {
  assert.equal(isVehicleCatalog(catalog), true)
  assert.equal(catalog.version, CATALOG_VERSION)
  assert.equal(catalog.retrievedOn, CATALOG_RETRIEVED_ON)
  assert.equal(catalog.refreshAfter, CATALOG_REFRESH_AFTER)
  assert.equal(catalog.terms, CATALOG_TERMS)
  assert.equal(catalog.yearMin, CATALOG_YEAR_MIN)
  assert.equal(catalog.yearMax, CATALOG_YEAR_MAX)
  assert.equal(catalog.yearMin, 2006)
  assert.ok(catalog.yearMax >= 2026)
  assert.match(catalog.sources[0]?.url ?? "", /vpic\.nhtsa\.dot\.gov/)
  assert.match(catalog.sources[1]?.url ?? "", /fueleconomy\.gov/)
  assert.match(catalog.terms, /21 September 2026/)
  assert.equal(DISCLAIMER, VERBATIM_DISCLAIMER)
})

test("persona defaults and the named alternates resolve", () => {
  for (const preset of Object.values(CATALOG_DEFAULTS)) {
    const trims = catalog.vehicles[String(preset.year)]?.[preset.make]?.[preset.model]
    assert.ok(trims, `${preset.make} ${preset.model}`)
    const trim = trims?.find((item) => item.name === preset.trim)
    assert.equal(trim?.confidence, "high")
  }
  assert.ok(catalog.vehicles["2024"]?.Honda?.Civic?.some((trim) => trim.confidence === "high"))
  const ioniq = catalog.vehicles["2025"]?.Hyundai?.["Ioniq 5 N"]
  assert.equal(ioniq?.[0]?.name, "Ioniq 5 N")
  assert.equal(ioniq?.[0]?.confidence, "high")
})

test("a weak F-150 join is limited and an unresolved trim is not invented", () => {
  const trims = catalog.vehicles["2023"]?.Ford?.["F-150"] ?? []
  const lightning = trims.find((trim) => trim.name === "F-150 Lightning 4WD")
  assert.equal(lightning?.confidence, "limited")
  const unresolved = catalog.vehicles["2025"]?.Hyundai
  assert.ok(unresolved)
  const invented = JSON.stringify(catalog)
  assert.equal(invented.includes("NAIC"), false)
  assert.equal(invented.includes("$"), false)
  const combined = catalog.vehicles["2018"]?.Ford?.["F-150"]?.find(
    (trim) => trim.name === "F150 Pickup 4WD XL/XLT",
  )
  assert.equal(combined?.confidence, "limited")
  let sawUnresolved = false
  for (const makes of Object.values(catalog.vehicles)) {
    for (const models of Object.values(makes)) {
      for (const row of Object.values(models)) {
        for (const trim of row) {
          if (trim.confidence === "unresolved") {
            sawUnresolved = true
            assert.equal(trim.name, "Trim not resolved")
          }
        }
      }
    }
  }
  assert.equal(sawUnresolved, true)
})

test("local filter finds Civic without another network call", () => {
  const makes = catalogMakes(catalog, 2024, "civic")
  assert.deepEqual(makes, ["Honda"])
  assert.ok(catalogModels(catalog, 2024, "Honda", "civic").includes("Civic"))
  assert.equal(catalogFilterIsEmpty(catalog, 2024, "not-a-real-vehicle"), true)
  assert.equal(
    filterMissCopy(2024, catalogFilterYears(catalog, "not-a-real-vehicle")),
    "Nothing in this snapshot matches that filter.",
  )
})

test("a year-scoped miss names the other years instead of the whole snapshot", () => {
  assert.equal(catalogFilterIsEmpty(catalog, 2023, "Ioniq 5 N"), true)
  const years = catalogFilterYears(catalog, "Ioniq 5 N")
  assert.ok(years.includes(2025))
  assert.equal(years.includes(2023), false)
  const copy = filterMissCopy(2023, years)
  assert.match(copy, /Nothing in 2023 matches that filter/)
  assert.match(copy, /2025/)
  assert.equal(copy.includes("Nothing in this snapshot matches"), false)
})

test("commercial chassis cabs are not selectable", () => {
  const banned = [
    ["Ram", "2500"],
    ["Ram", "3500"],
    ["Ram", "4000"],
    ["Ram", "4500"],
    ["Ram", "5500"],
    ["Ford", "E-450"],
  ]
  for (const [make, model] of banned) {
    for (const makes of Object.values(catalog.vehicles)) {
      assert.equal(makes[make]?.[model], undefined, `${make} ${model}`)
    }
  }
  assert.ok(catalog.vehicles["2023"]?.Ram?.["1500"])
})

test("confidence copy stays on the sample label and drops when the trim is weak", () => {
  assert.match(
    rangeConfidenceCopy({
      catalogStatus: "ready",
      trimConfidence: "high",
      stale: false,
    }),
    /Baseline not cleared/,
  )
  assert.match(
    rangeConfidenceCopy({
      catalogStatus: "ready",
      trimConfidence: "limited",
      stale: false,
    }),
    /limited/,
  )
  assert.match(
    rangeConfidenceCopy({
      catalogStatus: "failed",
      trimConfidence: null,
      stale: false,
    }),
    /did not load/,
  )
  assert.match(
    rangeConfidenceCopy({
      catalogStatus: "loading",
      trimConfidence: null,
      stale: false,
    }),
    /loading/,
  )
  assert.equal(isCatalogStale(catalog, new Date("2026-09-21T00:00:00Z")), false)
  assert.equal(isCatalogStale(catalog, new Date("2027-03-20T00:00:00Z")), true)
})
