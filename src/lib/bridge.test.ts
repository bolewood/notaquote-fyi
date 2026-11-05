import assert from "node:assert/strict"
import { readFileSync } from "node:fs"
import test from "node:test"
import { bridgeRows, shortPartLabel } from "./bridge"
import type { VehicleCatalog } from "./catalog"
import { vehicleFacts } from "./catalog-class"
import { priceWhatIf } from "./pricing"
import { DEFAULT_SCENARIO, type Scenario } from "./scenario"
import { DEFAULT_SITUATION, type Situation } from "./situation"

const catalog = JSON.parse(readFileSync(new URL("../../public/catalog/vehicle-catalog.json", import.meta.url), "utf8")) as VehicleCatalog

function bridgeFor(next: Scenario, situation: Situation = DEFAULT_SITUATION) {
  const now = situation.scenario
  const result = priceWhatIf(situation, vehicleFacts(catalog, now), next, vehicleFacts(catalog, next))!
  const bridge = bridgeRows({
    start: { label: "Where you started", likely: result.current.likely, ownNumber: false },
    parts: result.parts,
    end: { label: "With this change", likely: result.next.likely, low: result.next.low, high: result.next.high },
    neutral: (part) => part.key === "coverage" || part.key === "deductible",
  })
  return { result, bridge }
}

function assertAddsUp(name: string, next: Scenario, situation?: Situation) {
  const { result, bridge } = bridgeFor(next, situation)
  // The start plus every piece is exactly the result, and the last piece lands on it.
  const sum = result.current.likely + result.parts.reduce((total, part) => total + part.amount, 0)
  assert.ok(Math.abs(sum - result.next.likely) < 1e-6, `${name}: ${sum} vs ${result.next.likely}`)
  assert.ok(Math.abs(bridge.drift) < 1e-6, `${name}: drift ${bridge.drift}`)
  const steps = bridge.rows.filter((row) => row.kind === "step")
  for (let index = 1; index < steps.length; index += 1) {
    assert.ok(steps[index].from >= Math.min(steps[index - 1].to, steps[index - 1].from) - 10, `${name}: bars connect`)
  }
  assert.equal(bridge.rows[0].kind, "start")
  assert.equal(bridge.rows.at(-1)!.kind, "end")
  assert.equal(bridge.rows.at(-1)!.to, result.next.likely)
  return { result, bridge }
}

test("the bridge adds up exactly: a 2025 Subaru Outback instead of a 2020 Camry", () => {
  const outback = { year: 2025, make: "Subaru", model: "Outback", trim: catalog.vehicles["2025"].Subaru.Outback[0].name }
  const { bridge } = assertAddsUp("outback", { ...DEFAULT_SCENARIO, ...outback })
  const steps = bridge.rows.filter((row) => row.kind === "step")
  assert.ok(steps.length >= 1)
  assert.ok(steps.every((row) => /^[+−]\$/.test(row.value)), "every piece has its sign")
})

test("the bridge adds up exactly: adding a teen to the policy", () => {
  const teen: Scenario = { ...DEFAULT_SCENARIO, age: "16-18", yearsLicensed: "under-1", teen: true }
  const { result, bridge } = assertAddsUp("teen", teen, { ...DEFAULT_SITUATION, teenOnParentPolicy: true })
  assert.equal(result.mode, "teen-added")
  assert.ok(bridge.rows.some((row) => row.label === "Adding your teen" && row.tone === "up"))
})

test("the bridge adds up exactly: a coverage change, drawn neutral, not as good news", () => {
  const { bridge } = assertAddsUp("coverage", { ...DEFAULT_SCENARIO, coverage: "standard" })
  const steps = bridge.rows.filter((row) => row.kind === "step")
  assert.equal(steps.length, 1)
  assert.equal(steps[0].tone, "neutral")
  assert.match(steps[0].value, /^−\$/)
})

test("several changes at once still add up, and one change still makes three rows", () => {
  assertAddsUp("several", { ...DEFAULT_SCENARIO, state: "TX", deductible: 2000, mileage: "under-7500", incidents: "one" })
  const { bridge } = bridgeFor({ ...DEFAULT_SCENARIO, deductible: 2000 })
  assert.equal(bridge.rows.length, 3)
  assert.equal(shortPartLabel("Subaru Outback instead of Toyota Camry: lower crash-repair losses"), "Subaru Outback instead of Toyota Camry")
})
