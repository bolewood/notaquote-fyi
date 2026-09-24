import assert from "node:assert/strict"
import test from "node:test"
import { analyticsUrl } from "./analytics-url"

test("analytics keeps only the page's path", () => {
  assert.equal(analyticsUrl("https://notaquote.fyi/"), "https://notaquote.fyi/")
  assert.equal(analyticsUrl("https://notaquote.fyi/states/ohio"), "https://notaquote.fyi/states/ohio")
})

test("share-link choices after # or ? never reach analytics", () => {
  assert.equal(
    analyticsUrl("https://notaquote.fyi/compare#share=1&age=16-18&state=IL&anchor=1800"),
    "https://notaquote.fyi/compare",
  )
  assert.equal(analyticsUrl("https://notaquote.fyi/?share=1&anchor=2400&state=TX"), "https://notaquote.fyi/")
})

test("a malformed address is dropped rather than sent", () => {
  assert.equal(analyticsUrl("not a url"), null)
})
