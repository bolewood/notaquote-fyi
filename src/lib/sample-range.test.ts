import assert from "node:assert/strict"
import test from "node:test"
import { DISCLAIMER } from "./copy"
import { AVA, JAYDEN, MOLLY, vehicleParts } from "./scenario"
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

test("an allowed premium never prints zero or a negative sample dollar", () => {
  const weight = sampleWeight(MOLLY)
  const amounts = [1, 2, 5, 9, 10, 15, 1800]
  const scenarios = [
    MOLLY,
    { ...MOLLY, age: "65+" as const },
    { ...MOLLY, age: "65+" as const, coverage: "state-minimum" as const },
    { ...MOLLY, coverage: "high" as const, incidents: "two-or-more" as const },
  ]

  for (const amount of amounts) {
    for (const scenario of scenarios) {
      const range = buildSampleRange(scenario, { amount, weight })
      assert.ok(range.low >= 1, `low ${range.low} for ${amount}`)
      assert.ok(range.likely >= 1, `likely ${range.likely} for ${amount}`)
      assert.ok(range.high >= 1, `high ${range.high} for ${amount}`)
      assert.ok(range.monthly >= 1, `monthly ${range.monthly} for ${amount}`)
      assert.ok(range.low < range.likely && range.likely < range.high)
    }
  }

  const typed = buildSampleRange(MOLLY, { amount: 2, weight })
  assert.equal(typed.displayFloor, true)
  assert.equal(typed.likely, 2)

  const aged = buildSampleRange({ ...MOLLY, age: "65+" }, { amount: 2, weight })
  assert.equal(aged.displayFloor, true)
  assert.ok(aged.low > 0 && aged.likely > 0)

  const sane = buildSampleRange(MOLLY, { amount: 1800, weight })
  assert.equal(sane.likely, 1800)
  assert.equal(sane.displayFloor, false)
  assert.equal(buildSampleRange(MOLLY, null).displayFloor, false)
})

test("Jayden uses the same mileage band as Molly", () => {
  assert.equal(JAYDEN.mileage, MOLLY.mileage)
  assert.equal(JAYDEN.mileage, "7500-15000")
})

test("vehicle controls decompose only the three stand-ins", () => {
  const ford = vehicleParts("f150")
  const toyota = vehicleParts("rav4")
  const tesla = vehicleParts("model-y-lr")

  assert.equal(ford.makeLabel, "Ford")
  assert.equal(ford.modelLabel, "F-150")
  assert.equal(ford.trimLabel, "Trim confidence unavailable")
  assert.equal(toyota.makeLabel, "Toyota")
  assert.equal(toyota.modelLabel, "RAV4")
  assert.equal(tesla.makeLabel, "Tesla")
  assert.equal(tesla.modelLabel, "Model Y")
  assert.equal(tesla.trimLabel, "Long Range")
  assert.equal(ford.trimConfidence, "unavailable")
  assert.equal(toyota.trimConfidence, "unavailable")
  assert.equal(tesla.trimConfidence, "unavailable")
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
