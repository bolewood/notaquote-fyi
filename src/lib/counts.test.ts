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
      "persona_click",
      "adjustment",
      "save",
      "share_link_copy",
      "worksheet_print",
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
    { kind: "save", scenario: { state: "IL" } },
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

test("the stored tally is seven counters and drops anything else", () => {
  const storage = memoryStorage()
  assert.equal(recordCount("calculator_session", storage)?.calculator_session, 1)
  assert.equal(recordCount("persona_click", storage)?.persona_click, 1)
  assert.equal(recordCount("persona_click", storage)?.persona_click, 2)
  assert.equal(recordCount("adjustment", storage)?.adjustment, 1)
  assert.equal(recordCount("save", storage)?.save, 1)
  assert.equal(recordCount("share_link_copy", storage)?.share_link_copy, 1)
  assert.equal(recordCount("worksheet_print", storage)?.worksheet_print, 1)
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
  assert.deepEqual(sanitizeLedger({ adjustment: 1.5, save: -1, persona_click: 3 }), {
    ...emptyLedger(),
    persona_click: 3,
  })
})

test("a mounted count in the same turn is recorded once", () => {
  const storage = memoryStorage()
  assert.equal(recordMountedCount("trust_page_view", storage)?.trust_page_view, 1)
  assert.equal(recordMountedCount("trust_page_view", storage)?.trust_page_view, 1)
})

test("the calculator records kinds only, and does not touch storage itself", () => {
  const calculator = readFileSync("src/components/calculator.tsx", "utf8")
  const calls = [...calculator.matchAll(/record(?:Mounted)?Count\(\s*"([^"]+)"\s*\)/g)].map(
    (match) => match[1],
  )
  assert.deepEqual(calls.sort(), [
    "adjustment",
    "adjustment",
    "adjustment",
    "adjustment",
    "adjustment",
    "calculator_session",
    "persona_click",
    "save",
    "share_link_copy",
    "worksheet_print",
  ])
  assert.equal(/record(?:Mounted)?Count\(\s*[^)"\s]/.test(calculator), false)
  for (const token of ["localStorage", "sessionStorage", "document.cookie", "gtag", "plausible", "analytics", "console."]) {
    assert.equal(calculator.includes(token), false, token)
  }
})
