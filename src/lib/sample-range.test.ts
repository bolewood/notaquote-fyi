import assert from "node:assert/strict"
import test from "node:test"
import { DISCLAIMER } from "./copy"
import { AVA, JAYDEN, MOLLY } from "./scenario"
import {
  buildSampleRange,
  CREDIT_FACTOR,
  parseAnnualPremium,
  sampleWeight,
} from "./sample-range"

const VERBATIM_DISCLAIMER =
  "THIS IS NOT A QUOTE. NotAQuote.FYI is an independent educational estimate tool, not an insurance company, agency, broker, producer, or lead-generation service. Actual premiums are set by licensed insurers after underwriting and may vary materially."

test("disclaimer is the required sentence", () => {
  assert.equal(DISCLAIMER, VERBATIM_DISCLAIMER)
})

test("presets move the sample likely figure", () => {
  const molly = buildSampleRange(MOLLY, null)
  const jayden = buildSampleRange(JAYDEN, null)
  const ava = buildSampleRange(AVA, null)

  assert.notEqual(molly.likely, jayden.likely)
  assert.notEqual(ava.likely, molly.likely)
  assert.ok(jayden.likely > ava.likely)
  assert.ok(ava.likely > molly.likely)
  assert.ok(molly.low < molly.likely && molly.likely < molly.high)
  assert.equal(molly.anchored, false)
})

test("coverage packages move the sample and keep a wide band", () => {
  const stateMinimum = buildSampleRange(
    { ...MOLLY, coverage: "state-minimum" },
    null,
  ).likely
  const standard = buildSampleRange({ ...MOLLY, coverage: "standard" }, null)
    .likely
  const full = buildSampleRange(MOLLY, null).likely
  const high = buildSampleRange({ ...MOLLY, coverage: "high" }, null).likely

  assert.ok(stateMinimum < standard)
  assert.ok(standard < full)
  assert.ok(full < high)
})

test("deductible is ignored when the package has no physical damage", () => {
  const lowDeductible = buildSampleRange(
    { ...MOLLY, coverage: "state-minimum", deductible: 500 },
    null,
  ).likely
  const highDeductible = buildSampleRange(
    { ...MOLLY, coverage: "state-minimum", deductible: 2000 },
    null,
  ).likely
  assert.equal(lowDeductible, highDeductible)

  const fullLow = buildSampleRange({ ...MOLLY, deductible: 500 }, null).likely
  const fullHigh = buildSampleRange({ ...MOLLY, deductible: 2000 }, null).likely
  assert.ok(fullLow > fullHigh)
})

test("year and vehicle stand-ins move the sample", () => {
  const recent = buildSampleRange(MOLLY, null).likely
  const older = buildSampleRange({ ...MOLLY, year: 2018 }, null).likely
  const rav4 = buildSampleRange({ ...MOLLY, vehicle: "rav4" }, null).likely
  assert.notEqual(recent, older)
  assert.notEqual(recent, rav4)
})

test("entered premium re-anchors and later controls move from that amount", () => {
  const weight = sampleWeight(MOLLY)
  const anchored = buildSampleRange(MOLLY, { amount: 3200, weight })
  assert.equal(anchored.likely, 3200)
  assert.equal(anchored.anchored, true)

  const aged = buildSampleRange(
    { ...MOLLY, age: "65+" },
    { amount: 3200, weight },
  )
  assert.notEqual(aged.likely, 3200)
  assert.notEqual(aged.likely, buildSampleRange({ ...MOLLY, age: "65+" }, null).likely)
})

test("credit factor stays locked", () => {
  assert.equal(CREDIT_FACTOR, 1)
  const california = sampleWeight(AVA)
  const sameDriverElsewhere = sampleWeight({ ...AVA, state: "IL", region: "urban" })
  assert.notEqual(california, sameDriverElsewhere)
})

test("annual premium parser accepts dollars and rejects empty or zero", () => {
  assert.equal(parseAnnualPremium(""), null)
  assert.equal(parseAnnualPremium("   "), null)
  assert.equal(parseAnnualPremium("0"), null)
  assert.equal(parseAnnualPremium("-20"), null)
  assert.equal(parseAnnualPremium("100001"), null)
  assert.equal(parseAnnualPremium("1200"), 1200)
  assert.equal(parseAnnualPremium("$1,200"), 1200)
})
