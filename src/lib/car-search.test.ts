import assert from "node:assert/strict"
import { readFileSync } from "node:fs"
import test from "node:test"
import type { VehicleCatalog } from "./catalog"
import {
  defaultTrim,
  FIRST_CARS,
  parseCarQuery,
  POPULAR_SUVS,
  resolveCar,
  searchModels,
  TRUCKS_AND_FUN,
  WHAT_IF_CARS,
} from "./car-search"

const catalog = JSON.parse(readFileSync("public/catalog/vehicle-catalog.json", "utf8")) as VehicleCatalog

test("search understands how people type a car", () => {
  for (const query of ["model y", "tesla y", "Model Y", "modely"]) {
    const hits = searchModels(catalog, 2025, query)
    assert.equal(hits[0]?.model, "Model Y", query)
  }
  assert.equal(searchModels(catalog, 2024, "civic")[0]?.model, "Civic")
  assert.equal(searchModels(catalog, 2024, "crv")[0]?.model, "CR-V")
  assert.equal(searchModels(catalog, 2024, "cr-v")[0]?.model, "CR-V")
  assert.deepEqual(searchModels(catalog, 2024, "   "), [])
  assert.deepEqual(searchModels(catalog, 2024, "zzzz"), [])
  assert.ok(searchModels(catalog, 2024, "toyota", 5).length <= 5)
})

test("the default version is a plain, strongly matched trim", () => {
  const civic = catalog.vehicles["2024"].Honda.Civic
  assert.equal(defaultTrim(civic)?.confidence, "high")
  const rav4 = catalog.vehicles["2024"].Toyota.RAV4
  assert.doesNotMatch(defaultTrim(rav4)?.name ?? "", /hybrid|trd/i)
  assert.equal(defaultTrim([]), null)
})

test("every quick-add car and every What-if chip is in the catalog", () => {
  for (const car of WHAT_IF_CARS) {
    const pick = resolveCar(catalog, car.year, car)
    assert.ok(pick, `${car.year} ${car.make} ${car.model}`)
    if (car.trim) assert.equal(pick?.trim, car.trim)
  }
  for (const car of [...FIRST_CARS, ...POPULAR_SUVS, ...TRUCKS_AND_FUN]) {
    assert.ok(resolveCar(catalog, 2022, car), `2022 ${car.make} ${car.model}`)
  }
  assert.equal(FIRST_CARS.length, 15, "one tap fills a 15-car list")
})

test("a year typed into the search picks the model year", () => {
  assert.deepEqual(parseCarQuery("2015 civic"), { year: 2015, text: "civic" })
  assert.deepEqual(parseCarQuery("civic 2015"), { year: 2015, text: "civic" })
  assert.deepEqual(parseCarQuery("  model y  "), { year: null, text: "model y" })
  assert.deepEqual(parseCarQuery("f-150 3500"), { year: null, text: "f-150 3500" })
  const { year, text } = parseCarQuery("2015 civic")
  assert.equal(searchModels(catalog, year ?? 2024, text)[0]?.model, "Civic")
  assert.equal(resolveCar(catalog, 2025, { make: "Kia", model: "Forte" }), null, "a model the year doesn't list gives nothing")
})
