import assert from "node:assert/strict"
import test from "node:test"
import { FACTOR_BUNDLE } from "./factor-engine"
import { HELP_WANTED, helpWantedUrl } from "./help-wanted"

test("five open numbers, each with a hint and a prefilled issue that keeps its fields", () => {
  assert.equal(HELP_WANTED.length, 5)
  for (const item of HELP_WANTED) {
    assert.ok(item.hint.length > 20)
    const url = new URL(helpWantedUrl(item))
    assert.equal(url.searchParams.get("template"), "1-number.yml")
    assert.equal(url.searchParams.get("factor"), item.factor, "the safety filter must not drop the factor name")
    assert.ok(url.searchParams.get("shown"))
  }
})

test("four open numbers are our best guesses and the fifth rests on one state's prices, as the page says", () => {
  const cell = (group: string, key: string) => FACTOR_BUNDLE.groups[group].cells[key]
  assert.equal(cell("deductible", "2000").basis, "assumed")
  assert.equal(cell("vehicle-age", "8-12").basis, "assumed")
  assert.equal(cell("good-student", "yes").basis, "assumed")
  assert.equal(cell("driver-age", "16-18-added").basis, "indicative")
  assert.deepEqual(cell("driver-age", "16-18-added").sources, ["ca-2026"])
  assert.equal(cell("driving-record", "two-or-more").basis, "assumed")
})
