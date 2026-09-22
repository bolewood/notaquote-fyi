import assert from "node:assert/strict"
import { readdirSync, readFileSync, statSync } from "node:fs"
import path from "node:path"
import test from "node:test"
import type { VehicleCatalog } from "./catalog"
import { vehicleFacts, type VehicleFacts } from "./catalog-class"
import {
  assertFactorBundleSafe,
  compareVehicles,
  estimate,
  FACTOR_BUNDLE,
  FACTOR_BUNDLE_VERSION,
  factorSnapshot,
  matchVehicleRows,
  publishedFactorGroups,
  runFactorEngine,
  selectionKeys,
  teenAddedToPolicy,
  FACTOR_YEAR,
  typicalScenario,
  typicalStart,
  TYPICAL_START_ATTRIBUTION,
  vehicleRelativity,
  whatIf,
  type PremiumAnchor,
  type StartingPoint,
} from "./factor-engine"
import { deriveFactors, type FactorFiles } from "./factor-derivation"
import { stateBaseline } from "./state-baselines"
import { EXAMPLE_ADULT, exampleTable, loadCatalog } from "../../scripts/example-table"
import type { FactorBundle } from "./factor-types"
import { DATA_BUNDLE_VERSION, MODEL_VERSION } from "./copy"
import { JAYDEN, MOLLY, type Scenario } from "./scenario"
import { assertManifestSafe, MANIFEST_VERSION, NAIC_PARAPHRASE, naicPublicationRows } from "./source-manifest"
import { MANIFEST_VERSION as COPY_MANIFEST } from "./copy"

const catalog = JSON.parse(readFileSync("public/catalog/vehicle-catalog.json", "utf8")) as VehicleCatalog

function car(year: number, make: string, model: string, trim: string): VehicleFacts {
  const trims = catalog.vehicles[String(year)]?.[make]?.[model] ?? []
  assert.ok(trims.some((item) => item.name === trim), `${year} ${make} ${model} ${trim}`)
  return vehicleFacts(catalog, { year, make, model, trim })
}

function on(scenario: Scenario, vehicle: VehicleFacts): Scenario {
  return { ...scenario, year: vehicle.year, make: vehicle.make, model: vehicle.model, trim: vehicle.trim }
}

const F150 = car(2023, "Ford", "F-150", "F150 Pickup 4WD")
const MODEL_Y = car(2025, "Tesla", "Model Y", "Model Y Long Range AWD")
const RAV4 = car(2023, "Toyota", "RAV4", "RAV4")
const RAV4_HYBRID = car(2023, "Toyota", "RAV4", "RAV4 Hybrid AWD")
const LIGHTNING = car(2023, "Ford", "F-150", "F-150 Lightning 4WD")
const RANGE_ROVER = car(2023, "Land Rover", "Range Rover", "New Range Rover")
const CIVIC = car(2024, "Honda", "Civic", "Civic 4Dr")

const MOLLY_F150 = on(MOLLY, F150)
const YOURS: StartingPoint = { annual: 1800, scenario: MOLLY_F150, vehicle: F150, kind: "yours" }

const JARGON = /\b(anchor|baseline|thin|lawful|sensitivity|cleared|relativit|counsel|family|factor engine)\b/i

test("bundle versions line up and the guardrails pass", () => {
  assertFactorBundleSafe()
  assert.equal(DATA_BUNDLE_VERSION, FACTOR_BUNDLE_VERSION)
  assert.equal(FACTOR_BUNDLE_VERSION, "factors-2026-09-22")
  assert.equal(MODEL_VERSION, "0.2.0")
})

test("the guardrails reject unsourced or unlabeled cells", () => {
  const copy = () => JSON.parse(JSON.stringify(FACTOR_BUNDLE)) as FactorBundle
  const noSource = copy()
  noSource.groups["driver-age"].cells["26-39"].sources = []
  assert.throws(() => assertFactorBundleSafe(noSource), /needs a source/)
  const unknownSource = copy()
  unknownSource.groups["driver-age"].cells["26-39"].sources = ["made-up"]
  assert.throws(() => assertFactorBundleSafe(unknownSource), /unknown source/)
  const quietGuess = copy()
  quietGuess.groups.deductible.cells["500"].derivation = "Seems right."
  assert.throws(() => assertFactorBundleSafe(quietGuess), /estimate/)
  const narrowGuess = copy()
  const cell = narrowGuess.groups.deductible.cells["500"]
  cell.low = cell.value
  cell.high = cell.value
  assert.throws(() => assertFactorBundleSafe(narrowGuess), /widen/)
  const credit = copy()
  credit.groups.credit = { title: "Credit", appliesTo: "whole", note: "", cells: {} }
  assert.throws(() => assertFactorBundleSafe(credit), /credit/)
})

test("your own premium comes back unchanged when nothing changes", () => {
  const result = estimate(YOURS, MOLLY_F150, { vehicle: F150 })
  assert.equal(result.likely, 1800)
  assert.equal(result.monthly, 150)
  assert.equal(result.steps.length, 0)
  assert.ok(result.low < result.likely && result.likely < result.high)
  assert.match(result.summary, /\$1,800 a year you told us you pay now/)
})

test("arithmetic is exact: one sourced change moves the premium by its factor", () => {
  const younger = estimate(YOURS, { ...MOLLY_F150, age: "26-39" }, { vehicle: F150 })
  const factor = FACTOR_BUNDLE.groups["driver-age"].cells["26-39"].value
  // 1,800 × factor ÷ 100, rounded half up.
  assert.equal(younger.likely, Math.floor((1800 * factor * 2 + 100) / 200))
  assert.equal(younger.steps.length, 1)
  assert.equal(younger.steps[0].group, "driver-age")
  assert.equal(younger.steps[0].basis, "sourced")
  assert.ok(younger.low < younger.likely && younger.likely < younger.high)
})

test("the teen checkbox does not stack on the 16–18 age band", () => {
  const teen = { ...MOLLY_F150, age: "16-18" as const, yearsLicensed: "under-1" as const }
  const flagged = estimate(YOURS, { ...teen, teen: true }, { vehicle: F150 })
  const unflagged = estimate(YOURS, { ...teen, teen: false }, { vehicle: F150 })
  assert.equal(flagged.likely, unflagged.likely)
  assert.equal(selectionKeys(teen)["driving-experience"], "not-used", "age already covers a new driver")
  const senior = { ...MOLLY_F150, age: "65+" as const }
  assert.equal(
    estimate(YOURS, { ...senior, teen: true, goodStudent: true, driverTraining: true }, { vehicle: F150 }).likely,
    estimate(YOURS, senior, { vehicle: F150 }).likely,
    "teen, good-student, and driver-training switches do nothing for a 65+ driver",
  )
})

test("what if I bought a Tesla Model Y?", () => {
  const next = on(MOLLY_F150, MODEL_Y)
  const result = whatIf(YOURS, MOLLY_F150, next, { currentVehicle: F150, nextVehicle: MODEL_Y })
  assert.equal(result.current.likely, 1800)
  assert.equal(result.delta, result.next.likely - 1800)
  assert.equal(result.deltaRounded % 10, 0)
  assert.match(result.headline, /^Switching to a 2025 Tesla Model Y: about [+−]\$[\d,]+ a year\.$|^Switching to a 2025 Tesla Model Y: about the same\.$/)
  assert.equal(result.next.vehicle.level, "model")
  assert.ok(result.next.vehicle.rows.every((row) => row.family === "modely" && row.powertrain === "electric"))
  assert.ok(result.next.vehicle.rows.every((row) => row.drive === "4wd"), "AWD Model Y uses HLDI's 4WD series")
  assert.notEqual(result.next.likely, estimate(YOURS, on(MOLLY_F150, RAV4), { vehicle: RAV4 }).likely)
})

test("a comparison table of 15 cars for the same driver keeps order and stays sane", () => {
  const picks: [number, string, string][] = [
    [2025, "Tesla", "Model Y"],
    [2023, "Toyota", "RAV4"],
    [2024, "Honda", "Civic"],
    [2024, "Honda", "CR-V"],
    [2024, "Toyota", "Corolla"],
    [2024, "Toyota", "Camry"],
    [2024, "Hyundai", "Elantra"],
    [2024, "Mazda", "CX-5"],
    [2024, "Subaru", "Outback"],
    [2024, "Kia", "Soul"],
    [2024, "Nissan", "Sentra"],
    [2023, "Ford", "F-150"],
    [2024, "Chevrolet", "Equinox"],
    [2024, "Jeep", "Wrangler"],
    [2018, "Honda", "Fit"],
  ]
  const vehicles = picks.map(([year, make, model]) => {
    const trims = catalog.vehicles[String(year)]?.[make]?.[model] ?? []
    assert.ok(trims.length > 0, `${year} ${make} ${model}`)
    return vehicleFacts(catalog, { year, make, model, trim: trims[0].name })
  })
  const teenDriver: Scenario = { ...JAYDEN, state: "IL" }
  const rows = compareVehicles(YOURS, teenDriver, vehicles)
  assert.equal(rows.length, 15)
  rows.forEach((row, index) => {
    assert.equal(row.vehicle, vehicles[index])
    assert.ok(row.estimate.low >= 1 && row.estimate.low < row.estimate.likely && row.estimate.likely < row.estimate.high)
    assert.ok(row.estimate.steps.some((step) => step.group === "driver-age"))
  })
  const levels = rows.map((row) => row.estimate.vehicle.level)
  assert.ok(levels.filter((level) => level === "model").length >= 12, levels.join(","))
  assert.equal(rows[14].estimate.vehicle.level, "class", "the Fit is not in HLDI 2022–24, so its class stands in")
  assert.ok(new Set(rows.map((row) => row.estimate.likely)).size > 8, "cars differ")
})

test("vehicle rows: Lightning, hybrids, Range Rover, and Civic match the right HLDI series", () => {
  const lightning = matchVehicleRows(LIGHTNING)
  assert.ok(lightning.length > 0)
  assert.ok(lightning.every((row) => row.family === "f150lightning"))
  const f150 = matchVehicleRows(F150)
  assert.ok(f150.length > 0 && f150.every((row) => row.family === "f150" && row.powertrain === "combustion" && row.drive === "4wd"))
  const hybrid = matchVehicleRows(RAV4_HYBRID)
  assert.ok(hybrid.length > 0 && hybrid.every((row) => row.family === "rav4" && row.powertrain === "hybrid"))
  const rav4 = matchVehicleRows(RAV4)
  assert.ok(rav4.length > 0 && rav4.every((row) => row.powertrain === "combustion" && row.drive === "2wd"))
  const rangeRover = matchVehicleRows(RANGE_ROVER)
  assert.ok(rangeRover.length > 0 && rangeRover.every((row) => row.family === "rangerover" && /Luxury SUVs/.test(row.hldiClass)))
  const civic = matchVehicleRows(CIVIC)
  assert.ok(civic.length > 0 && civic.every((row) => row.family === "civic"))

  // Without the catalog (names only), a Tesla still finds its electric rows,
  // and an F-150 finds the gas rows rather than the Lightning.
  const namedTesla = vehicleFacts(null, { year: 2025, make: "Tesla", model: "Model Y", trim: "Model Y Long Range AWD" })
  assert.equal(namedTesla.powertrain, null)
  assert.ok(matchVehicleRows(namedTesla).every((row) => row.family === "modely" && row.drive === "4wd"))
  assert.ok(matchVehicleRows(namedTesla).length > 0)
  const namedFord = vehicleFacts(null, { year: 2023, make: "Ford", model: "F-150", trim: "F150 Pickup 4WD" })
  assert.ok(matchVehicleRows(namedFord).every((row) => row.powertrain === "combustion"))
})

test("vehicle factors move only their own share of the premium", () => {
  const liabilityOnly = { ...MOLLY_F150, coverage: "standard" as const }
  const start: StartingPoint = { annual: 1000, scenario: liabilityOnly, vehicle: RAV4, kind: "yours" }
  const rr = vehicleRelativity(RANGE_ROVER)
  const rav = vehicleRelativity(RAV4)
  const result = estimate(start, on(liabilityOnly, RANGE_ROVER), { vehicle: RANGE_ROVER })
  // Liability only: the ratio is the liability relativities alone (exact fractions).
  const expected = (1000 * Number(rr.liability.num) * Number(rav.liability.den)) /
    (Number(rr.liability.den) * Number(rav.liability.num))
  assert.equal(result.likely, Math.round(expected), `${result.likely} vs ${expected}`)
  assert.ok(rr.physicalHundredths > rav.physicalHundredths * 2, "the Range Rover's damage losses are far higher")
  const full = estimate({ ...start, scenario: MOLLY_F150 }, on(MOLLY_F150, RANGE_ROVER), { vehicle: RANGE_ROVER })
  assert.ok(full.likely > result.likely + 500, "with collision and comprehensive the Range Rover costs much more")
})

test("deductible and vehicle age only matter with collision and comprehensive", () => {
  const liabilityOnly = { ...MOLLY_F150, coverage: "standard" as const }
  const start: StartingPoint = { annual: 900, scenario: liabilityOnly, vehicle: F150, kind: "yours" }
  assert.equal(estimate(start, { ...liabilityOnly, deductible: 500 }, { vehicle: F150 }).likely, 900)
  const lower = estimate(YOURS, { ...MOLLY_F150, deductible: 500 }, { vehicle: F150 })
  assert.ok(lower.likely > 1800)
  assert.equal(lower.steps[0].basis, "assumed")
})

test("the range is wider when more of the change is assumed", () => {
  const sourced = estimate(YOURS, { ...MOLLY_F150, region: "rural" }, { vehicle: F150 })
  const assumedToo = estimate(YOURS, { ...MOLLY_F150, region: "rural", deductible: 500 }, { vehicle: F150 })
  assert.ok(assumedToo.spread.down > sourced.spread.down)
  assert.ok(assumedToo.spread.up > sourced.spread.up)
  assert.match(assumedToo.rangeNote, /deductible is our own estimate/)

  const typical = estimate(
    { annual: 1800, scenario: MOLLY_F150, vehicle: "average", kind: "typical", label: "a typical yearly price in Illinois" },
    MOLLY_F150,
    { vehicle: F150 },
  )
  assert.ok(typical.spread.down > 1000 && typical.spread.up > 1000, "a typical start is much less certain than your own premium")
  assert.match(typical.summary, /typical yearly price in Illinois/)

  const unknown = vehicleFacts(null, { year: 2024, make: "Nobody", model: "Mystery", trim: "" })
  const mystery = estimate(YOURS, { ...MOLLY_F150, make: "Nobody", model: "Mystery", trim: "" }, { vehicle: unknown })
  assert.equal(mystery.vehicle.level, "unknown")
  assert.match(mystery.rangeNote, /couldn't tell what kind of vehicle/)
})

test("changing state uses typical state prices when given, and widens a lot when not", () => {
  const texas = { ...MOLLY_F150, state: "TX" as const }
  const withPrices = estimate(YOURS, texas, { vehicle: F150, stateAnnual: { IL: 1500, TX: 1800 } })
  assert.equal(withPrices.likely, 2160)
  const without = estimate(YOURS, texas, { vehicle: F150, stateAnnual: {} })
  assert.equal(without.likely, 1800)
  assert.ok(without.spread.up > withPrices.spread.up)
  assert.match(without.rangeNote, /don't have a typical price for Texas yet/)
  // By default the NAIC state figures are used.
  const illinois = stateBaseline("IL")?.annual ?? 0
  const texasTypical = stateBaseline("TX")?.annual ?? 0
  const byDefault = estimate(YOURS, texas, { vehicle: F150 })
  assert.equal(byDefault.likely, Math.floor((1800 * texasTypical * 2 + illinois) / (2 * illinois)))
  assert.ok(byDefault.steps.some((step) => step.group === "state" && step.sources.includes("naic-auto-db-2022-2023")))
})

test("what-if headlines for a move", () => {
  const texas = { ...MOLLY_F150, state: "TX" as const }
  const move = whatIf(YOURS, MOLLY_F150, texas, { currentVehicle: F150, nextVehicle: F150 })
  assert.match(move.headline, /^Moving to Texas: about [+−]\$[\d,]+ a year\.$/)
  const unknown = whatIf(YOURS, MOLLY_F150, texas, { currentVehicle: F150, nextVehicle: F150, stateAnnual: { IL: 1257 } })
  assert.equal(unknown.headline, "We don't have a typical price for Texas yet, so we can't say how moving changes your price.")
  assert.doesNotMatch(unknown.headline, /about the same/)
  const both = whatIf(YOURS, MOLLY_F150, on(texas, MODEL_Y), { currentVehicle: F150, nextVehicle: MODEL_Y })
  assert.match(both.headline, /^With those changes/)
  const trim = whatIf(YOURS, MOLLY_F150, { ...MOLLY_F150, age: "26-39" }, { currentVehicle: F150, nextVehicle: F150, trimConfidence: "unresolved" })
  assert.match(trim.next.rangeNote, /exact version of the car/)
})

test("a typical start comes from the state's NAIC figure", () => {
  const target: Scenario = { ...MOLLY_F150, state: "OH" }
  const start = typicalStart(target)
  assert.ok(start)
  const naic = stateBaseline("OH")?.annual ?? 0
  const trend = FACTOR_BUNDLE.typicalStart.trend
  // Moved forward by the BLS index, exactly: NAIC × latest ÷ 2023 average, rounded half up.
  const trended = Math.round(naic * (trend.latestValue / trend.baseValue))
  assert.equal(start.annual, trended)
  assert.equal(start.untrendedAnnual, naic)
  assert.equal(start.trended, true)
  assert.equal(start.kind, "typical")
  assert.equal(start.vehicle, "average")
  assert.equal(start.scenario.age, "40-64")
  assert.equal(start.scenario.region, "suburban")
  // As old as the insured fleet (8–12 band), not the target's model year.
  assert.equal(start.scenario.year, FACTOR_YEAR - 12)
  assert.equal(selectionKeys(start.scenario)["vehicle-age"], "8-12")
  assert.match(start.label ?? "", /Ohio/)
  const illinois = typicalStart({ ...MOLLY_F150, state: "IL" })
  assert.equal(
    illinois?.attribution,
    "Illinois's average full-coverage cost in 2023 was $1,257 (NAIC). Car insurance prices nationally have risen about 18% since then (government price index, August 2026), so we start from about $1,490.",
  )
  // The trend widens a typical start's range; a premium you enter is never trended.
  const withTrend = estimate(illinois!, { ...MOLLY_F150, state: "IL" }, { vehicle: F150 })
  const withoutTrend = estimate({ ...illinois!, trended: false }, { ...MOLLY_F150, state: "IL" }, { vehicle: F150 })
  assert.ok(withTrend.spread.up > withoutTrend.spread.up)
  assert.match(withTrend.rangeNote, /moved the typical price forward/)
  assert.equal(estimate(YOURS, MOLLY_F150, { vehicle: F150 }).likely, 1800)
  assert.equal(TYPICAL_START_ATTRIBUTION, "Source: NAIC, 2022/2023 Auto Insurance Database Report, 2023 data")
  assert.deepEqual(typicalScenario(target), start.scenario)
})

test("a trim name sold as gas and hybrid is priced as gas and widens the range", () => {
  const crv = car(2024, "Honda", "CR-V", "CR-V FWD")
  assert.equal(crv.powertrain, "combustion")
  assert.equal(crv.powertrainMixed, true)
  const rows = matchVehicleRows(crv)
  assert.ok(rows.length > 0 && rows.every((row) => row.family === "crv" && row.powertrain === "combustion" && row.drive === "2wd"))
  const plain = estimate(YOURS, on(MOLLY_F150, RAV4), { vehicle: RAV4 })
  const mixed = estimate(YOURS, on(MOLLY_F150, crv), { vehicle: crv })
  assert.match(mixed.rangeNote, /more than one version\. We priced the gas one/)
  assert.doesNotMatch(plain.rangeNote, /more than one version/)
  // The 2024 Mazda CX-90 4WD is listed as a mild hybrid and a plug-in; we price the hybrid and say so.
  const cx90 = car(2024, "Mazda", "CX-90", "CX-90 4WD")
  assert.equal(cx90.powertrain, "hybrid")
  assert.match(estimate(YOURS, on(MOLLY_F150, cx90), { vehicle: cx90 }).rangeNote, /We priced it as a mild hybrid, using HLDI's figures for the gas version/)
})

test("body style: plain rows unless the trim names a body", () => {
  const series = (facts: VehicleFacts) => matchVehicleRows(facts).map((row) => row.series)
  assert.deepEqual(series(car(2024, "Ford", "Mustang", "Mustang")), ["Ford Mustang 2dr"])
  assert.deepEqual(series(car(2024, "Honda", "Civic", "Civic 4Dr")), ["Honda Civic"])
  assert.deepEqual(series(car(2024, "Honda", "Civic", "Civic 5Dr")), ["Honda Civic hatchback"])
  assert.deepEqual(series(car(2024, "Toyota", "Corolla", "Corolla")), ["Toyota Corolla"])
  assert.deepEqual(series(car(2024, "Toyota", "Corolla", "Corolla Hatchback")), ["Toyota Corolla hatchback"])
  assert.deepEqual(series(car(2024, "Jeep", "Wrangler", "Wrangler 2dr 4WD")), ["Jeep Wrangler 2dr convertible 4WD"])
  assert.deepEqual(series(car(2024, "Jeep", "Wrangler", "Wrangler 4dr 4WD")), ["Jeep Wrangler 4dr convertible 4WD"])
  assert.deepEqual(series(car(2024, "Porsche", "Cayenne", "Cayenne")), ["Porsche Cayenne 4dr 4WD"])
  assert.deepEqual(series(car(2024, "Porsche", "Cayenne", "Cayenne Coupe")), ["Porsche Cayenne Coupe 4dr 4WD"])
  assert.deepEqual(series(car(2024, "BMW", "M", "M4 Coupe")), ["BMW M4 2dr", "BMW M4 2dr 4WD"])
  assert.deepEqual(series(car(2024, "Porsche", "911", "911 Turbo S Cabriolet")), ["Porsche 911 Turbo convertible 4WD"])
})

test("luxury makes without their own HLDI row use luxury or sports-car class averages", () => {
  const gt3 = car(2024, "Porsche", "911", "911 GT3")
  const relativity = vehicleRelativity(gt3)
  assert.equal(relativity.level, "class")
  assert.equal(relativity.label, "sporty luxury two-seater")
  assert.equal(relativity.spreadKey, "vehicle-luxury-class")
  assert.ok(relativity.physicalHundredths >= 180, `${relativity.physicalHundredths}`)
  const note = estimate(YOURS, on(MOLLY_F150, gt3), { vehicle: gt3 }).rangeNote
  assert.match(note, /average for its class \(sporty luxury two-seater\)/)
  // Electric beats luxury: a Macan Electric uses the electric small SUV average, not the gas luxury one.
  const macanElectric = car(2024, "Porsche", "Macan", "Macan 4 Electric")
  assert.equal(vehicleRelativity(macanElectric).label, "electric small SUV")
  const panamera = car(2024, "Porsche", "Panamera", "Panamera")
  assert.equal(vehicleRelativity(panamera).label, "luxury large car")
  assert.doesNotMatch(note, /smallcar|liability share|4-door/i)
  // A luxury make we can't classify at all gets the wider luxury spread.
  const unresolved = vehicleFacts(catalog, { year: 2024, make: "BMW", model: "Z9", trim: "Concept" })
  assert.equal(vehicleRelativity(unresolved).spreadKey, "vehicle-unknown-luxury")
  const plainUnknown = vehicleFacts(null, { year: 2024, make: "Nobody", model: "Mystery", trim: "" })
  const luxurySpread = estimate(YOURS, on(MOLLY_F150, unresolved), { vehicle: unresolved }).spread.up
  const plainSpread = estimate(YOURS, { ...MOLLY_F150, make: "Nobody", model: "Mystery", trim: "" }, { vehicle: plainUnknown }).spread.up
  assert.ok(luxurySpread > plainSpread)
})

test("liability losses are passed on only partly, inside the ISO band", () => {
  const data = FACTOR_BUNDLE.vehicle
  assert.equal(data.liabilityWeight.basis, "assumed")
  assert.ok(data.liabilityWeight.value >= 40 && data.liabilityWeight.value <= 60)
  assert.equal(data.liabilityFloor, 80)
  assert.equal(data.liabilityCap, 125)
  for (const facts of [F150, MODEL_Y, RAV4, CIVIC, RANGE_ROVER, LIGHTNING]) {
    const relativity = vehicleRelativity(facts)
    assert.ok(relativity.liabilityHundredths >= 80 && relativity.liabilityHundredths <= 125, facts.model)
  }
  // Damage results are passed on in full: the Range Rover's damage factor is well above 2.
  assert.ok(vehicleRelativity(RANGE_ROVER).physicalHundredths > 200)
})

test("without HLDI's model rows, vehicles use their class averages", () => {
  const files: FactorFiles = {}
  for (const name of ["assumptions.json", "vehicle-families.json"]) files[name] = readFileSync(`data/factors/${name}`, "utf8")
  files["state-baselines.json"] = readFileSync("data/state-baselines/state-baselines.json", "utf8")
  for (const name of readdirSync("data/factors/sources")) {
    if (name !== "hldi-2022-24.csv") files[`sources/${name}`] = readFileSync(`data/factors/sources/${name}`, "utf8")
  }
  const without = deriveFactors(files)
  for (const facts of [RAV4, F150, CIVIC, LIGHTNING]) {
    assert.deepEqual(matchVehicleRows(facts, without.vehicle), [])
    const relativity = vehicleRelativity(facts, without.vehicle)
    assert.equal(relativity.level, "class", facts.model)
    assert.equal(relativity.spreadKey, "vehicle-class")
  }
  // HLDI files Teslas as luxury vehicles, so a Model Y uses the luxury small SUV average.
  assert.equal(vehicleRelativity(MODEL_Y, without.vehicle).label, "luxury small SUV")
  assert.equal(vehicleRelativity(LIGHTNING, without.vehicle).label, "full-size pickup")
})

test("teens: own policy by default, and a rough figure for adding them to a parent's policy", () => {
  const teen = { ...MOLLY_F150, age: "16-18" as const, yearsLicensed: "under-1" as const }
  const own = estimate(YOURS, teen, { vehicle: F150 })
  const added = estimate(YOURS, teen, { vehicle: F150, teenOnParentPolicy: true })
  assert.match(own.rangeNote, /only driver on their own policy\. Adding a teen to a parent's policy usually costs less than this\./)
  assert.match(added.rangeNote, /whole household's policy after adding your teen, not the teen's own price/)
  assert.ok(added.likely < own.likely)
  assert.equal(added.steps.find((step) => step.group === "driver-age")?.basis, "indicative")
  const young = estimate(YOURS, { ...MOLLY_F150, age: "19-21" as const }, { vehicle: F150, teenOnParentPolicy: true })
  assert.match(young.rangeNote, /only driver on their own policy/)
  const adult = estimate(YOURS, { ...MOLLY_F150, age: "26-39" as const }, { vehicle: F150 })
  assert.doesNotMatch(adult.rangeNote, /own policy/)
})

test("the engine never prints zero or a negative dollar", () => {
  const scenarios: Scenario[] = [
    MOLLY_F150,
    { ...MOLLY_F150, age: "65+", coverage: "state-minimum", region: "rural", year: 2008 },
    { ...MOLLY_F150, coverage: "high", incidents: "two-or-more", age: "16-18" },
    { ...MOLLY_F150, goodStudent: true, mileage: "under-7500", year: 2010, region: "rural" },
  ]
  for (const annual of [1, 2, 5, 1800]) {
    for (const scenario of scenarios) {
      const result = estimate({ ...YOURS, annual }, scenario, { trimConfidence: "unresolved" })
      assert.ok(result.low >= 1 && result.low < result.likely && result.likely < result.high, `${annual}`)
      assert.ok(result.monthly >= 1)
    }
  }
})

test("everything the page shows is plain language", () => {
  const results = [
    estimate(YOURS, { ...MOLLY_F150, age: "16-18", mileage: "over-15000", incidents: "one" }, { vehicle: F150, trimConfidence: "limited" }),
    estimate(YOURS, on(MOLLY_F150, MODEL_Y), { vehicle: MODEL_Y }),
    estimate({ annual: 1500, scenario: MOLLY_F150, vehicle: "average", kind: "typical" }, MOLLY_F150),
  ]
  for (const result of results) {
    assert.doesNotMatch(result.summary, JARGON)
    assert.doesNotMatch(result.rangeNote, JARGON)
  }
  const engine = runFactorEngine({
    scenario: MOLLY_F150,
    anchor: null,
    trimConfidence: "high",
    catalogStatus: "ready",
    stale: false,
  })
  assert.doesNotMatch(engine.explanation, JARGON)
  assert.doesNotMatch(engine.confidenceDetail, JARGON)
  for (const group of publishedFactorGroups()) {
    assert.doesNotMatch(group.family, JARGON)
    assert.doesNotMatch(group.note, JARGON)
  }
})

test("the older calculator API still works", () => {
  const none = runFactorEngine({ scenario: MOLLY, anchor: null, trimConfidence: "high", catalogStatus: "ready", stale: false })
  assert.equal(none.dollars, null)
  assert.equal(none.baselineCleared, false)
  assert.equal(none.creditFactor, 1)
  assert.equal(none.confidence, "low")

  const anchor: PremiumAnchor = { amount: 1800, snapshot: factorSnapshot(MOLLY) }
  const same = runFactorEngine({ scenario: MOLLY, anchor, trimConfidence: "high", catalogStatus: "ready", stale: false })
  assert.equal(same.dollars?.likely, 1800)
  assert.deepEqual(same.familiesChanged, [])

  const aged = runFactorEngine({
    scenario: { ...MOLLY, age: "16-18" },
    anchor,
    trimConfidence: "limited",
    catalogStatus: "ready",
    stale: false,
  })
  assert.ok((aged.dollars?.likely ?? 0) > 1800)
  assert.deepEqual(aged.familiesChanged, ["driver"])
  assert.equal(aged.confidence, "lower")

  const moved = runFactorEngine({
    scenario: { ...MOLLY, state: "TX", coverage: "standard" },
    anchor,
    trimConfidence: "high",
    catalogStatus: "ready",
    stale: false,
  })
  assert.deepEqual(moved.familiesChanged, ["geography", "coverage"])
})

test("published tables show every group with its basis in plain words", () => {
  const groups = publishedFactorGroups()
  assert.ok(groups.length >= 14)
  const age = groups.find((group) => group.family === "Driver age")
  assert.ok(age)
  assert.equal(age.rows.find((row) => row.key === "40–64")?.confidence, "Starting point")
  assert.equal(age.rows.find((row) => row.key === "26–39")?.confidence, "From public prices or rules")
  assert.ok(groups.some((group) => group.family === "Credit" && /don't ask about credit/.test(group.note)))
})

test("the repository has no premium-report PDF", () => {
  const root = path.resolve(new URL("../../", import.meta.url).pathname)
  const skip = new Set(["node_modules", ".git", ".next", ".catalog-cache"])
  const found: string[] = []
  const walk = (dir: string) => {
    for (const name of readdirSync(dir)) {
      if (skip.has(name)) continue
      const full = path.join(dir, name)
      const info = statSync(full)
      if (info.isDirectory()) walk(full)
      else if (name.toLowerCase().endsWith(".pdf")) found.push(full)
    }
  }
  walk(root)
  assert.deepEqual(found, [])
})

test("the source manifest is safe and NAIC manifest rows cite the publications, and only the final report is used", () => {
  assertManifestSafe()
  assert.equal(COPY_MANIFEST, MANIFEST_VERSION)
  assert.match(MANIFEST_VERSION, /^manifest-\d{4}-\d{2}-\d{2}$/)
  const [supplement, report] = naicPublicationRows()
  assert.equal(supplement.catalogCode, "AUT-PB 2023")
  assert.equal(supplement.publicationDate, "June 2025")
  assert.match(supplement.licenseNote, /Not used/)
  assert.deepEqual(supplement.derivedFields, [])
  assert.equal(report.catalogCode, "AUT-PB 2022-2023")
  assert.equal(report.publicationDate, "December 2025")
  assert.match(report.licenseNote, /Used with credit/)
  assert.match(report.licenseNote, /Source: NAIC, 2022\/2023 Auto Insurance Database Report, 2023 data/)
  assert.ok(report.derivedFields.length > 0)
  assert.match(NAIC_PARAPHRASE, /car-years/)
  assert.equal(/naic estimate/i.test(NAIC_PARAPHRASE), false)
  assert.equal(NAIC_PARAPHRASE.includes("$"), false)
})

test("vehicle bias checks, from a typical start in suburban Illinois", () => {
  const start = typicalStart(EXAMPLE_ADULT)!
  const price = (make: string, model: string, trim: string) => {
    const facts = car(2024, make, model, trim)
    return estimate(start, { ...EXAMPLE_ADULT, make, model, trim }, { vehicle: facts }).likely
  }
  const modelY = price("Tesla", "Model Y", "Model Y Long Range AWD")
  const model3 = price("Tesla", "Model 3", "Model 3 Long Range AWD")
  const accord = price("Honda", "Accord", "Accord")
  const rav4 = price("Toyota", "RAV4", "RAV4")
  const civic = price("Honda", "Civic", "Civic 4Dr")
  const mustang = price("Ford", "Mustang", "Mustang")
  const f150 = price("Ford", "F-150", "F150 Pickup 4WD")
  const crv = price("Honda", "CR-V", "CR-V FWD")
  assert.ok(price("Porsche", "911", "911 Carrera") > mustang, "911 > Mustang")
  assert.ok(modelY > rav4, "Model Y > RAV4")
  assert.ok(modelY > accord * 1.15, "Model Y well above the Accord")
  assert.ok(model3 > accord, "Model 3 > Accord")
  assert.ok(price("Porsche", "Macan", "Macan") > civic, "Macan > Civic")
  assert.ok(price("Porsche", "Cayenne", "Cayenne") > rav4, "Cayenne > RAV4")
  assert.ok(price("BMW", "M", "M4 Coupe") > mustang, "M4 > Mustang")
  assert.ok(f150 > crv && f150 < modelY, "a full-size pickup sits between a small SUV and a Tesla")
  assert.ok(rav4 < accord, "a RAV4 costs less than an Accord, as in California's survey")
})

test("the README's worked example is exactly what the engine gives", () => {
  const readme = readFileSync("data/factors/README.md", "utf8")
  const table = exampleTable(loadCatalog())
  assert.ok(readme.includes(table), "run `npx tsx scripts/example-table.ts` and paste the output into data/factors/README.md")
})

test("a teen added to a parent's policy is the whole household's premium", () => {
  const start = typicalStart(EXAMPLE_ADULT, { teenOnParentPolicy: true })!
  assert.match(start.label ?? "", /one insured car in Illinois/)
  const accord = car(2024, "Honda", "Accord", "Accord")
  const parent = { ...EXAMPLE_ADULT, make: "Honda", model: "Accord", trim: "Accord" }
  const added = teenAddedToPolicy(start, parent, { vehicle: accord })
  const factor = FACTOR_BUNDLE.groups["driver-age"].cells["16-18-added"].value
  assert.ok(Math.abs(added.after.likely - (added.before.likely * factor) / 100) <= 1)
  assert.equal(added.increase, added.after.likely - added.before.likely)
  assert.match(
    added.headline,
    /^Adding your teen to your policy: about \+\$[\d,]+ a year on a policy that costs \$[\d,]+ now\.$/,
  )
  assert.throws(
    () => compareVehicles(start, { ...EXAMPLE_ADULT, age: "16-18" }, [accord], { teenOnParentPolicy: true }),
    /isn't a price for a teen's own car/,
  )
})

test("the car-value term: full, half strength, or none", () => {
  const start = typicalStart(EXAMPLE_ADULT)!
  const price = (make: string, model: string, trim?: string) => {
    const trims = catalog.vehicles["2024"]?.[make]?.[model] ?? []
    const name = trim ?? trims[0]?.name
    assert.ok(name, `${make} ${model}`)
    const facts = car(2024, make, model, name)
    return estimate(start, { ...EXAMPLE_ADULT, make, model, trim: name }, { vehicle: facts })
  }
  const envista = price("Buick", "Envista").likely
  const trax = price("Chevrolet", "Trax").likely
  assert.ok(Math.abs(envista / trax - 1) <= 0.15, `Envista ${envista} vs Trax ${trax}`)
  const integra = price("Acura", "Integra").likely
  const civic = price("Honda", "Civic", "Civic 4Dr").likely
  assert.ok(Math.abs(integra / civic - 1) <= 0.15, `Integra ${integra} vs Civic ${civic}`)
  const calibration = FACTOR_BUNDLE.vehicle.calibration
  assert.ok(calibration.valueFull.includes("bmw") && calibration.valueFull.includes("tesla"))
  assert.ok(calibration.valueHalf.includes("acura"))
  assert.ok(!calibration.valueFull.includes("buick") && !calibration.valueHalf.includes("buick"))
  assert.equal(calibration.luxuryHalf.value, Math.round(Math.sqrt(calibration.luxury.value / 100) * 100))
  // The luxury and electric range reaches lower as well as higher.
  const modelY = price("Tesla", "Model Y", "Model Y Long Range AWD")
  const rav4 = price("Toyota", "RAV4", "RAV4")
  assert.ok(modelY.spread.down > rav4.spread.down && modelY.spread.up > rav4.spread.up)
  assert.ok(FACTOR_BUNDLE.groups.range.cells["vehicle-value"].low < 100)
})

test("sporty mainstream cars get room above, with a note", () => {
  const mustang = car(2024, "Ford", "Mustang", "Mustang")
  assert.equal(vehicleRelativity(mustang).sporty, true)
  assert.equal(vehicleRelativity(CIVIC).sporty, false)
  const result = estimate(YOURS, on(MOLLY_F150, mustang), { vehicle: mustang })
  const civic = estimate(YOURS, on(MOLLY_F150, CIVIC), { vehicle: CIVIC })
  assert.match(result.rangeNote, /Sporty cars often cost more to insure than their repair records suggest/)
  assert.ok(result.spread.up > civic.spread.up)
  // A Camry's repair costs are just above the fitted mainstream cars: wider range, but not called sporty.
  const camry = car(2024, "Toyota", "Camry", "Camry")
  const camryNote = estimate(YOURS, on(MOLLY_F150, camry), { vehicle: camry }).rangeNote
  assert.doesNotMatch(camryNote, /Sporty/)
  assert.match(camryNote, /higher than any mainstream car we checked against real prices/)
})

test("teenOnParentPolicy refuses a change of car or state", () => {
  const teen = { ...MOLLY_F150, age: "16-18" as const, yearsLicensed: "under-1" as const }
  assert.throws(() => estimate(YOURS, on(teen, RAV4), { vehicle: RAV4, teenOnParentPolicy: true }), /car and the state must match/)
  assert.throws(() => estimate(YOURS, { ...teen, state: "TX" }, { vehicle: F150, teenOnParentPolicy: true }), /car and the state must match/)
  assert.ok(estimate(YOURS, teen, { vehicle: F150, teenOnParentPolicy: true }).likely > 1800)
})
