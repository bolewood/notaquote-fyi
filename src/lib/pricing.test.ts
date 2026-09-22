import assert from "node:assert/strict"
import { readFileSync } from "node:fs"
import test from "node:test"
import type { VehicleCatalog } from "./catalog"
import { vehicleFacts } from "./catalog-class"
import { vehicleRelativity } from "./factor-engine"
import {
  basisLabel,
  startShort,
  changeChip,
  changedKeys,
  parentFor,
  priceNow,
  priceWhatIf,
  startingPoint,
  startLine,
  addsTeen,
  carDifference,
  distinctReasons,
  explainChange,
  vehicleMatchWords,
  vehicleReason,
  vehicleReasonParts,
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
  assert.match(result!.headline, /^Switching to a 2025 Tesla Model Y: about \$[\d,]+ (more|less) a year\.$|about the same\.$/)
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
  assert.equal(whatIfLabel(NOW, { ...NOW, state: "CO", deductible: 2000 }, false), "With these changes")

  assert.deepEqual(changedKeys(NOW, { ...NOW, ...MODEL_Y, deductible: 2000 }), ["vehicle", "deductible"])
  assert.equal(changeChip("vehicle", { ...NOW, ...MODEL_Y }), "2025 Tesla Model Y")
  assert.equal(changeChip("state", { ...NOW, state: "CO" }), "Moving to Colorado")
})

test("adding a teen on the What-if page prices the whole household's policy", () => {
  const next: Scenario = { ...NOW, age: "16-18", yearsLicensed: "under-1", teen: true }
  const facts = vehicleFacts(catalog, NOW)
  const result = priceWhatIf({ ...DEFAULT_SITUATION, premium: 1800 }, facts, next, facts)
  assert.ok(result && result.delta > 0)
  assert.match(result!.headline, /^Adding your teen to your policy: about \$[\d,]+ more a year, on a policy that costs about \$1,800 now\.$/)
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
  assert.match(result!.headline, /^With these changes and your teen: about \$[\d,]+ (more|less) a year\.$/)
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
  assert.equal(vehicleReason({ ...civic, liabilityHundredths: 100, physicalHundredths: 100 }, true, 2016), "about average")
  assert.equal(vehicleReason({ ...civic, physicalHundredths: 130, liabilityHundredths: 100 }, true, 2016), "pricier repairs")
  assert.equal(vehicleReason({ ...civic, physicalHundredths: 130, liabilityHundredths: 100 }, false, 2016), "about average", "repair costs don't matter without damage cover")
  assert.equal(
    vehicleReason({ ...civic, liabilityHundredths: 100, physicalHundredths: 100 }, true, 2016),
    "about average",
    "an 8–12-year-old car is what a typical start assumes",
  )
  assert.match(vehicleReason({ ...civic, liabilityHundredths: 100, physicalHundredths: 100 }, true, 2024), /newer, costs more to replace/)
  assert.match(vehicleReason({ ...civic, liabilityHundredths: 100, physicalHundredths: 100 }, true, 2008), /older, cheaper to replace/)
  assert.deepEqual(vehicleReasonParts({ ...civic, liabilityHundredths: 100, physicalHundredths: 100 }, false, 2024), [], "age doesn't matter without damage cover")
  assert.match(vehicleReason({ ...civic, level: "class", label: "small SUV" }, true, 2024), /used the small SUV average/)
  assert.match(vehicleReason({ ...civic, level: "unknown" }, true, 2024), /don't know this car/)
  assert.match(vehicleMatchWords(civic), /^Matched to /)
  assert.doesNotMatch(vehicleMatchWords(civic), /\$\d/)
})

test("phrases every car shares are dropped from the compare table", () => {
  assert.deepEqual(
    distinctReasons([
      ["pricier repairs", "newer, costs more to replace"],
      ["fewer at-fault claims", "newer, costs more to replace"],
      ["newer, costs more to replace"],
    ]),
    ["pricier repairs", "fewer at-fault claims", "about average"],
  )
  assert.deepEqual(distinctReasons([["newer, costs more to replace"]]), ["newer, costs more to replace"])
  assert.deepEqual(distinctReasons([[], []]), ["about average", "about average"])
})

test("a what-if is explained as the difference, and the pieces add up to it", () => {
  const next: Scenario = { ...NOW, ...MODEL_Y, deductible: 2000 }
  const nowFacts = vehicleFacts(catalog, NOW)
  const nextFacts = vehicleFacts(catalog, next)
  const result = priceWhatIf(DEFAULT_SITUATION, nowFacts, next, nextFacts)
  assert.ok(result)
  assert.equal(result!.mode, "change")
  const labels = result!.parts.map((part) => part.label)
  assert.equal(labels[0], "Newer car (2025)")
  assert.match(labels[1], /^Toyota Camry → Tesla Model Y \(.+\)$/)
  assert.equal(labels[2], "$2,000 deductible")
  const sum = result!.parts.reduce((total, part) => total + part.amount, 0)
  assert.equal(sum, result!.delta)

  const start = startingPoint(DEFAULT_SITUATION, nowFacts)!
  assert.deepEqual(explainChange(start, NOW, nowFacts, NOW, nowFacts).parts, [], "no change, nothing to explain")

  const same = vehicleRelativity(nowFacts)
  assert.equal(carDifference(same, same, true), "similar claims")
  assert.equal(carDifference(same, { ...same, physicalHundredths: same.physicalHundredths + 20 }, true), "pricier repairs")
})

test("adding a teen is explained as the other changes plus the teen", () => {
  const next: Scenario = { ...NOW, age: "16-18", yearsLicensed: "under-1", teen: true, deductible: 500 }
  const facts = vehicleFacts(catalog, NOW)
  const result = priceWhatIf(DEFAULT_SITUATION, facts, next, facts)
  assert.equal(result?.mode, "teen-added")
  assert.deepEqual(result!.parts.map((part) => part.label), ["$500 deductible", "Adding your teen"])
  assert.equal(result!.parts.reduce((total, part) => total + part.amount, 0), result!.delta)
})

test("a teen on their own policy is a separate bill, not a replacement", () => {
  const next: Scenario = { ...NOW, age: "16-18", yearsLicensed: "under-1", teen: true }
  const facts = vehicleFacts(catalog, NOW)
  const result = priceWhatIf({ ...DEFAULT_SITUATION, teenOnParentPolicy: false }, facts, next, facts)
  assert.equal(result?.mode, "teen-own")
  assert.match(result!.headline, /^A 16–18-year-old on their own policy: about \$[\d,]+0 a year, on top of your \$[\d,]+0\.$/)
  assert.deepEqual(result!.parts, [])
})

test("a step's source says which state's prices it's based on, when that isn't yours", () => {
  assert.equal(basisLabel("sourced", ["ca-2026"], "Illinois"), "From published prices in California (Illinois may differ)")
  assert.equal(basisLabel("sourced", ["tx-2025", "ok-2026"], "Illinois"), "From published prices in Texas and Oklahoma (Illinois may differ)")
  assert.equal(basisLabel("sourced", ["ca-2026"], "California"), "From published prices")
  assert.equal(basisLabel("assumed", [], "Illinois"), "Our best guess")
  assert.equal(basisLabel("indicative", ["hldi-2022-24"], "Illinois"), "Worked out from public data")
})

test("the short start line names the state and a rounded price", () => {
  const start = startingPoint(DEFAULT_SITUATION, vehicleFacts(catalog, NOW))!
  assert.match(startShort(start, "Illinois"), /^We start from the typical Illinois price, about \$[\d,]+0 a year today, then adjust for your car and driver\.$/)
})

test("a 19–21-year-old is a separate bill on their own policy, like a teen on their own", () => {
  const next: Scenario = { ...NOW, age: "19-21", yearsLicensed: "1-3" }
  const facts = vehicleFacts(catalog, NOW)
  const result = priceWhatIf(DEFAULT_SITUATION, facts, next, facts)
  assert.equal(result?.mode, "teen-own")
  assert.match(result!.headline, /^A 19–21-year-old on their own policy: about \$[\d,]+0 a year, on top of your \$[\d,]+0\.$/)
  assert.deepEqual(result!.parts, [])
})
