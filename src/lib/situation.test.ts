import assert from "node:assert/strict"
import test from "node:test"
import { DEFAULT_SCENARIO } from "./scenario"
import {
  DEFAULT_SITUATION,
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
