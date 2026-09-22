import assert from "node:assert/strict"
import { readFileSync } from "node:fs"
import test from "node:test"
import type { VehicleCatalog } from "./catalog"
import { vehicleFacts } from "./catalog-class"
import { vehicleRelativity } from "./factor-engine"
import {
  changeChip,
  changedKeys,
  parentFor,
  priceNow,
  priceWhatIf,
  startingPoint,
  startLine,
  addsTeen,
  vehicleMatchWords,
  vehicleReason,
  whatIfLabel,
} from "./pricing"
import { DEFAULT_SCENARIO, STARTERS, type Scenario } from "./scenario"
import { DEFAULT_SITUATION, type Situation } from "./situation"

const catalog = JSON.parse(readFileSync("public/catalog/vehicle-catalog.json", "utf8")) as VehicleCatalog
const NOW = DEFAULT_SCENARIO
const MODEL_Y = { year: 2025, make: "Tesla", model: "Model Y", trim: "Model Y Long Range AWD" }

test("with no premium, the start is the state's typical price, with its plain attribution", () => {
  const start = startingPoint(DEFAULT_SITUATION, vehicleFacts(catalog, NOW))
  assert.ok(start)
  assert.equal(start?.kind, "typical")
  assert.match(startLine(start!), /Illinois/)
  assert.match(startLine(start!), /NAIC/)
  const estimate = priceNow(DEFAULT_SITUATION, vehicleFacts(catalog, NOW))
  assert.ok(estimate && estimate.low < estimate.likely && estimate.likely < estimate.high)
})

test("with a premium, the situation now is exactly that number", () => {
  const situation: Situation = { ...DEFAULT_SITUATION, premium: 1800 }
  const start = startingPoint(situation, vehicleFacts(catalog, NOW))
  assert.equal(start?.kind, "yours")
  assert.equal(start?.annual, 1800)
  assert.equal(startLine(start!), "We started from the $1,800 a year you pay now.")
  assert.equal(priceNow(situation, vehicleFacts(catalog, NOW))?.likely, 1800)
})

test("the Model Y question in one call: the engine's headline, from the situation now", () => {
  const next: Scenario = { ...NOW, ...MODEL_Y }
  const result = priceWhatIf(DEFAULT_SITUATION, vehicleFacts(catalog, NOW), next, vehicleFacts(catalog, next))
  assert.ok(result)
  assert.match(result!.headline, /^Switching to a 2025 Tesla Model Y: about [+−]\$[\d,]+ a year\.$|about the same\.$/)
  assert.equal(result!.delta, result!.next.likely - result!.current.likely)
})

test("single changes get plain headline words; cars and states keep the engine's", () => {
  assert.equal(whatIfLabel(NOW, { ...NOW, deductible: 2000 }, false), "Raising your deductible to $2,000")
  assert.equal(whatIfLabel(NOW, { ...NOW, deductible: 500 }, false), "Lowering your deductible to $500")
  assert.equal(
    whatIfLabel(NOW, { ...NOW, age: "16-18", yearsLicensed: "under-1", teen: true }, true),
    "Adding a 16–18-year-old to your policy",
  )
  assert.equal(whatIfLabel(NOW, { ...NOW, age: "16-18" }, false), "A 16–18-year-old on their own policy")
  assert.equal(whatIfLabel(NOW, { ...NOW, coverage: "standard" }, false), "Switching to liability only")
  assert.equal(whatIfLabel(NOW, { ...NOW, region: "rural" }, false), "Moving to a small town or the country")
  assert.equal(whatIfLabel(NOW, { ...NOW, ...MODEL_Y }, false), undefined)
  assert.equal(whatIfLabel(NOW, { ...NOW, state: "CO" }, false), undefined)
  assert.equal(whatIfLabel(NOW, { ...NOW, state: "CO", deductible: 2000 }, false), undefined)

  assert.deepEqual(changedKeys(NOW, { ...NOW, ...MODEL_Y, deductible: 2000 }), ["vehicle", "deductible"])
  assert.equal(changeChip("vehicle", { ...NOW, ...MODEL_Y }), "2025 Tesla Model Y")
  assert.equal(changeChip("state", { ...NOW, state: "CO" }), "Moving to Colorado")
})

test("adding a teen on the What-if page prices the whole household's policy", () => {
  const next: Scenario = { ...NOW, age: "16-18", yearsLicensed: "under-1", teen: true }
  const facts = vehicleFacts(catalog, NOW)
  const result = priceWhatIf({ ...DEFAULT_SITUATION, premium: 1800 }, facts, next, facts)
  assert.ok(result && result.delta > 0)
  assert.match(result!.headline, /^Adding your teen to your policy: about \+\$[\d,]+ a year on a policy that costs \$1,800 now\.$/)
  assert.match(result!.next.rangeNote, /whole household/)
})

test("every starter changes something from the default situation", () => {
  for (const item of STARTERS) {
    const next = { ...NOW, ...item.change(NOW) }
    assert.ok(changedKeys(NOW, next).length > 0, item.id)
  }
})

test("a teen joins a parent: the visitor's own adult situation, or a 40–64-year-old", () => {
  const teen: Scenario = { ...NOW, age: "16-18", yearsLicensed: "under-1", state: "TX" }
  const fromDefault = parentFor(teen, DEFAULT_SITUATION)
  assert.equal(fromDefault.age, "40-64")
  assert.equal(fromDefault.state, "TX", "place comes from the compare driver")
  const own = parentFor(teen, { ...DEFAULT_SITUATION, scenario: { ...NOW, age: "26-39", incidents: "one" } })
  assert.equal(own.age, "26-39")
  assert.equal(own.incidents, "one")
  assert.equal(addsTeen(NOW, teen, true), true)
  assert.equal(addsTeen(teen, teen, true), false)
})

test("adding a teen and changing the car at once goes through the engine's teen path, not an error", () => {
  const next: Scenario = { ...NOW, ...MODEL_Y, age: "16-18", yearsLicensed: "under-1", teen: true }
  const result = priceWhatIf(DEFAULT_SITUATION, vehicleFacts(catalog, NOW), next, vehicleFacts(catalog, next))
  assert.ok(result)
  assert.match(result!.headline, /^With those changes and your teen: about [+−]\$[\d,]+ a year\.$/)
  const own = priceWhatIf(
    { ...DEFAULT_SITUATION, teenOnParentPolicy: false },
    vehicleFacts(catalog, NOW),
    next,
    vehicleFacts(catalog, next),
  )
  assert.match(own!.next.rangeNote, /own policy/)
})

test("the why phrase is short and plain, and says when we used a class average", () => {
  const civic = vehicleRelativity(vehicleFacts(catalog, { year: 2022, make: "Honda", model: "Civic", trim: "Civic 4Dr" }))
  const reason = vehicleReason(civic, true, 2022)
  assert.ok(reason.length < 80)
  assert.doesNotMatch(reason, /relativity|HLDI|factor/i)
  assert.equal(vehicleReason({ ...civic, liabilityHundredths: 100, physicalHundredths: 100 }, true, 2024), "about average claims")
  assert.equal(vehicleReason({ ...civic, physicalHundredths: 130, liabilityHundredths: 100 }, true, 2024), "higher repair costs")
  assert.equal(vehicleReason({ ...civic, physicalHundredths: 130, liabilityHundredths: 100 }, false, 2024), "about average claims", "repair costs don't matter without damage cover")
  assert.match(vehicleReason({ ...civic, liabilityHundredths: 100, physicalHundredths: 100 }, true, 2012), /older car/)
  assert.match(vehicleReason({ ...civic, level: "class", label: "small SUV" }, true, 2024), /used the small SUV average/)
  assert.match(vehicleReason({ ...civic, level: "unknown" }, true, 2024), /don't know this car/)
  assert.match(vehicleMatchWords(civic), /^Matched to /)
  assert.doesNotMatch(vehicleMatchWords(civic), /\$\d/)
})
