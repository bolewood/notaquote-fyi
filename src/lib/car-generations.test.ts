import assert from "node:assert/strict"
import test from "node:test"
import { SERVER_CATALOG } from "./agent-catalog"
import { carGenerations, generationName } from "./car-generations"
import { carFigures, carPages, MODELS_ENABLED } from "./car-pages"

test("generations are named by ordinal and chassis code, or not at all", () => {
  assert.equal(generationName("Ford Escape (second generation)"), "Second generation")
  assert.equal(generationName("Second generation (T32; 2014)"), "Second generation (T32)")
  assert.equal(generationName("Audi Q5 (8R, first generation)"), "First generation (8R)")
  assert.equal(generationName("BMW X3 (E83)"), "E83")
  assert.equal(generationName("GMC Yukon (GMT900/GMT922)"), "GMT900/GMT922")
  assert.equal(generationName("Mazda CX-50"), null)
})

test("a generation's model years cost what the page's model-year table says", () => {
  if (!MODELS_ENABLED) return
  for (const page of carPages(SERVER_CATALOG)) {
    const f = carFigures(SERVER_CATALOG, page.slug)!
    const rows = new Map(carGenerations(SERVER_CATALOG, f).flatMap((g) => g.years.map((row) => [row.year, row] as const)))
    for (const year of f.years) {
      const row = rows.get(year.year)
      if (!row) continue
      assert.equal(row.adult, year.adult.likely, `${page.slug} ${year.year}: adult`)
      assert.equal(row.teen, year.teen.increase, `${page.slug} ${year.year}: teen`)
    }
  }
})

test("every generation is listed, priced or marked as having no HLDI results of its own", () => {
  if (!MODELS_ENABLED) return
  for (const page of carPages(SERVER_CATALOG)) {
    const generations = carGenerations(SERVER_CATALOG, carFigures(SERVER_CATALOG, page.slug)!)
    assert.ok(generations.length > 0, `${page.slug}: no generations`)
    for (const g of generations) {
      assert.ok(g.years.length + g.missing.length > 0, `${g.id}: no years`)
      assert.equal(g.adult === null, g.years.length === 0, `${g.id}: a price without priced years, or the reverse`)
    }
  }
})
