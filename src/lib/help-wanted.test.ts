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

test("the open numbers really are still our best guess (or rough) in the data", () => {
  const cell = (group: string, key: string) => FACTOR_BUNDLE.groups[group].cells[key]
  assert.equal(cell("deductible", "2000").basis, "assumed")
  assert.equal(cell("vehicle-age", "8-12").basis, "assumed")
  assert.equal(cell("good-student", "yes").basis, "assumed")
  assert.notEqual(cell("driver-age", "16-18-added").basis, "sourced")
  assert.equal(cell("driving-record", "two-or-more").basis, "assumed")
})
