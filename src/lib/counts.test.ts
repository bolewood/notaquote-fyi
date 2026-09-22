import assert from "node:assert/strict"
import test from "node:test"
import { readFileSync } from "node:fs"
import {
  acceptCountPayload,
  COUNT_KINDS,
  COUNTS_STORAGE_KEY,
  countPayload,
  countPayloadReconstructsDollars,
  emptyLedger,
  readLedger,
  recordCount,
  recordMountedCount,
  sanitizeLedger,
  type CountStorage,
} from "./counts"

function memoryStorage(): CountStorage & { data: Map<string, string> } {
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

test("a count payload is only a kind", () => {
  for (const kind of COUNT_KINDS) {
    const payload = countPayload(kind)
    assert.deepEqual(payload, { kind })
    assert.deepEqual(Object.keys(payload), ["kind"])
    assert.equal(acceptCountPayload(payload)?.kind, kind)
    assert.equal(countPayloadReconstructsDollars(payload), false)
  }
  assert.deepEqual(
    [...COUNT_KINDS],
    [
      "calculator_session",
      "starter_click",
      "what_if",
      "adjustment",
      "compare_session",
      "compare_add",
      "csv_download",
      "share_link_copy",
      "print",
      "trust_page_view",
    ],
  )
})

test("a payload with dollars, a VIN, a premium, or extra fields is refused", () => {
  const rejected = [
    null,
    "calculator_session",
    [],
    {},
    { kind: "calculator_session", premium: 1800 },
    { kind: "calculator_session", vin: "1FTFW1E50MFC12345" },
    { kind: "calculator_session", amount: 1800 },
    { kind: "calculator_session", low: 1, likely: 2, high: 3 },
    { kind: "compare_add", car: "2022 Honda Civic" },
    { kind: "adjustment", anchor: 900 },
    { kind: "nope" },
    { kind: "calculator_session", name: "Molly" },
    { kind: "calculator_session", email: "a@b.com" },
  ]
  for (const value of rejected) {
    assert.equal(acceptCountPayload(value), null)
    assert.equal(countPayloadReconstructsDollars(value), true)
  }
})

test("the stored tally is one counter per kind and drops anything else", () => {
  const storage = memoryStorage()
  assert.equal(recordCount("calculator_session", storage)?.calculator_session, 1)
  assert.equal(recordCount("starter_click", storage)?.starter_click, 1)
  assert.equal(recordCount("starter_click", storage)?.starter_click, 2)
  assert.equal(recordCount("what_if", storage)?.what_if, 1)
  assert.equal(recordCount("adjustment", storage)?.adjustment, 1)
  assert.equal(recordCount("compare_add", storage)?.compare_add, 1)
  assert.equal(recordCount("csv_download", storage)?.csv_download, 1)
  assert.equal(recordCount("share_link_copy", storage)?.share_link_copy, 1)
  assert.equal(recordCount("print", storage)?.print, 1)
  assert.equal(recordCount("trust_page_view", storage)?.trust_page_view, 1)

  const raw = storage.data.get(COUNTS_STORAGE_KEY) ?? ""
  const stored = JSON.parse(raw) as Record<string, unknown>
  assert.deepEqual(Object.keys(stored).sort(), [...COUNT_KINDS].sort())
  assert.equal(raw.includes("premium"), false)
  assert.equal(raw.includes("vin"), false)
  assert.equal(raw.includes("1800"), false)
  assert.equal(raw.includes("anchor"), false)
  assert.equal(raw.includes("scenario"), false)
  assert.equal(raw.includes("low"), false)
  assert.equal(raw.includes("likely"), false)
  assert.equal(raw.includes("high"), false)

  storage.setItem(
    COUNTS_STORAGE_KEY,
    JSON.stringify({
      ...emptyLedger(),
      calculator_session: 4,
      premium: 2200,
      vin: "SECRET",
      low: 10,
      likely: 20,
      high: 30,
    }),
  )
  const cleaned = readLedger(storage)
  assert.equal(cleaned?.calculator_session, 4)
  assert.equal(JSON.stringify(cleaned).includes("premium"), false)
  assert.equal(JSON.stringify(cleaned).includes("SECRET"), false)
  assert.deepEqual(sanitizeLedger({ adjustment: 1.5, what_if: -1, starter_click: 3, persona_click: 9 }), {
    ...emptyLedger(),
    starter_click: 3,
  })
})

test("a mounted count in the same turn is recorded once", () => {
  const storage = memoryStorage()
  assert.equal(recordMountedCount("trust_page_view", storage)?.trust_page_view, 1)
  assert.equal(recordMountedCount("trust_page_view", storage)?.trust_page_view, 1)
})

test("the pages record known kinds only, as literals, and never touch storage themselves", () => {
  const files = [
    "src/components/calculator.tsx",
    "src/components/compare-cars.tsx",
    "src/components/share-box.tsx",
  ]
  const seen = new Set<string>()
  for (const file of files) {
    const source = readFileSync(file, "utf8")
    for (const match of source.matchAll(/record(?:Mounted)?Count\(\s*"([^"]+)"\s*\)/g)) seen.add(match[1])
    assert.equal(/record(?:Mounted)?Count\(\s*[^)"\s]/.test(source), false, `${file} passes something other than a kind`)
    for (const token of ["localStorage", "sessionStorage", "document.cookie", "gtag", "plausible", "analytics", "console."]) {
      assert.equal(source.includes(token), false, `${file} contains ${token}`)
    }
  }
  for (const kind of seen) assert.ok((COUNT_KINDS as readonly string[]).includes(kind), kind)
  for (const kind of ["calculator_session", "what_if", "starter_click", "compare_session", "compare_add", "csv_download", "share_link_copy", "print"]) {
    assert.ok(seen.has(kind), `${kind} is recorded somewhere`)
  }
})
