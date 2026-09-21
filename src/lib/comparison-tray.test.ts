import assert from "node:assert/strict"
import test from "node:test"
import {
  COMPARISON_STORAGE_KEY,
  readComparisons,
  rememberComparison,
  writeComparisons,
  type SavedComparison,
} from "./comparison-tray"
import { JAYDEN, MOLLY } from "./scenario"

function memoryStorage() {
  const data = new Map<string, string>()
  return {
    data,
    getItem(key: string) {
      return data.has(key) ? data.get(key)! : null
    },
    setItem(key: string, value: string) {
      data.set(key, value)
    },
  }
}

test("saving Molly and then Jayden keeps both after a new read", () => {
  const storage = memoryStorage()
  let items: SavedComparison[] = []
  items = rememberComparison(items, {
    scenario: MOLLY,
    anchorAmount: null,
    id: "molly-1",
    now: "2026-09-21T12:00:00.000Z",
  })
  items = rememberComparison(items, {
    scenario: JAYDEN,
    anchorAmount: 1800,
    id: "jayden-1",
    now: "2026-09-21T12:01:00.000Z",
  })
  writeComparisons(storage, items)

  const again = readComparisons(storage)
  assert.equal(again.length, 2)
  assert.equal(again[0].label, "Jayden")
  assert.equal(again[0].anchorAmount, 1800)
  assert.deepEqual(again[0].scenario, JAYDEN)
  assert.equal(again[1].label, "Molly")
  assert.equal(again[1].anchorAmount, null)
  assert.deepEqual(again[1].scenario, MOLLY)

  const stored = storage.data.get(COMPARISON_STORAGE_KEY) ?? ""
  assert.equal(stored.includes("\"low\""), false)
  assert.equal(stored.includes("\"likely\""), false)
  assert.equal(stored.includes("\"high\""), false)
  assert.equal(stored.includes("\"monthly\""), false)
  assert.match(stored, /"anchorAmount":1800/)
  assert.doesNotMatch(stored, /\$1,800|1620|2530/)
})

test("a repeated save replaces the same scenario and an empty premium is not a zero anchor", () => {
  let items = rememberComparison([], {
    scenario: MOLLY,
    anchorAmount: null,
    id: "first",
    now: "2026-09-21T12:00:00.000Z",
  })
  items = rememberComparison(items, {
    scenario: MOLLY,
    anchorAmount: null,
    id: "second",
    now: "2026-09-21T12:05:00.000Z",
  })
  assert.equal(items.length, 1)
  assert.equal(items[0].id, "second")

  const zero = rememberComparison([], {
    scenario: MOLLY,
    anchorAmount: 0,
    id: "zero",
  })
  assert.equal(zero[0].anchorAmount, null)
})

test("a stored dollar field is dropped on read", () => {
  const storage = memoryStorage()
  storage.setItem(
    COMPARISON_STORAGE_KEY,
    JSON.stringify({
      version: 1,
      items: [
        {
          id: "molly-1",
          label: "Molly",
          savedAt: "2026-09-21T12:00:00.000Z",
          scenario: MOLLY,
          anchorAmount: null,
          low: 1620,
          likely: 2530,
          high: 3850,
        },
      ],
    }),
  )
  const items = readComparisons(storage)
  assert.equal(items.length, 1)
  assert.equal("low" in items[0], false)
  assert.equal("likely" in items[0], false)
  assert.equal(items[0].anchorAmount, null)
})
