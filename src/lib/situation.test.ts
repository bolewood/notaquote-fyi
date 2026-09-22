import assert from "node:assert/strict"
import test from "node:test"
import { ageChange, DEFAULT_SCENARIO } from "./scenario"
import {
  adoptSharedSituation,
  DEFAULT_SITUATION,
  premiumStatus,
  normalizePremium,
  parsePremium,
  readSituation,
  SITUATION_STORAGE_KEY,
  situationSnapshot,
  writeSituation,
} from "./situation"

function memoryStorage() {
  const data = new Map<string, string>()
  return {
    data,
    getItem: (key: string) => data.get(key) ?? null,
    setItem: (key: string, value: string) => void data.set(key, value),
  }
}

test("what people type for a premium becomes whole dollars a year", () => {
  assert.equal(parsePremium("1800"), 1800)
  assert.equal(parsePremium("$1,800"), 1800)
  assert.equal(parsePremium(" 1,812.50 "), 1813)
  assert.equal(parsePremium("150", "month"), 1800)
  assert.equal(parsePremium("900", "six-months"), 1800)
  assert.equal(parsePremium(""), null)
  assert.equal(parsePremium("0"), null)
  assert.equal(parsePremium("-20"), null)
  assert.equal(parsePremium("about 1800"), null)
  assert.equal(parsePremium("100001"), null)
  assert.equal(parsePremium("9000", "month"), null, "over $100,000 a year")
  assert.equal(normalizePremium(1.5), null)
  assert.equal(normalizePremium("1800"), 1800)
})

test("the situation survives a reload in this browser, and junk reads as nothing", () => {
  const storage = memoryStorage()
  const situation = { scenario: { ...DEFAULT_SCENARIO, age: "16-18" as const }, teenOnParentPolicy: false, premium: 2400 }
  writeSituation(storage, situation)
  const again = readSituation(storage)
  assert.equal(again?.premium, 2400)
  assert.equal(again?.teenOnParentPolicy, false)
  assert.equal(again?.scenario.teen, true, "the old teen field follows the age")

  storage.setItem(SITUATION_STORAGE_KEY, "{")
  assert.equal(readSituation(storage), null)
  storage.setItem(SITUATION_STORAGE_KEY, JSON.stringify({ version: 1, situation: { ...DEFAULT_SITUATION, premium: -5 } }))
  assert.equal(readSituation(storage), null)
})

test("only known fields are stored: never an estimate", () => {
  const raw = situationSnapshot({ ...DEFAULT_SITUATION, likely: 2000, low: 1 } as typeof DEFAULT_SITUATION)
  assert.doesNotMatch(raw, /likely|"low"/)
})

test("a shared situation never brings the sender's premium into your saved choices", () => {
  const shared = { ...DEFAULT_SITUATION, premium: 2600 }
  assert.equal(adoptSharedSituation(shared, null).premium, null)
  assert.equal(adoptSharedSituation(shared, { ...DEFAULT_SITUATION, premium: 1500 }).premium, 1500)
  assert.deepEqual(adoptSharedSituation(shared, null).scenario, shared.scenario)
})

test("the premium field: empty, unreadable, fine, or suspiciously low for a year", () => {
  assert.deepEqual(premiumStatus("", "year"), { kind: "empty", annual: null })
  assert.deepEqual(premiumStatus("18oo", "year"), { kind: "invalid", annual: null })
  assert.deepEqual(premiumStatus("1,800", "year"), { kind: "ok", annual: 1800 })
  assert.deepEqual(premiumStatus("150", "year"), { kind: "maybe-monthly", annual: 150 })
  assert.deepEqual(premiumStatus("150", "month"), { kind: "ok", annual: 1800 })
  assert.deepEqual(premiumStatus("250,000", "year"), { kind: "too-high", annual: null })
  assert.deepEqual(premiumStatus("20,000", "month"), { kind: "too-high", annual: null })
  assert.deepEqual(premiumStatus("5", "month"), { kind: "low-monthly", annual: 60 })
})

test("moving the driver from under 26 to 26 or older resets years licensed", () => {
  assert.deepEqual(ageChange({ age: "16-18", yearsLicensed: "under-1" }, "40-64"), { age: "40-64", yearsLicensed: DEFAULT_SCENARIO.yearsLicensed })
  assert.deepEqual(ageChange({ age: "40-64", yearsLicensed: "10+" }, "16-18"), { age: "16-18", yearsLicensed: "under-1" })
  assert.deepEqual(ageChange({ age: "40-64", yearsLicensed: "4-9" }, "26-39"), { age: "26-39" })
  assert.deepEqual(ageChange({ age: "16-18", yearsLicensed: "under-1" }, "19-21"), { age: "19-21" })
})
