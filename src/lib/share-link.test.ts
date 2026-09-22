import assert from "node:assert/strict"
import test from "node:test"
import { DATA_BUNDLE_VERSION, MODEL_VERSION } from "./copy"
import { DEFAULT_SCENARIO, JAYDEN, MOLLY, type Scenario } from "./scenario"
import {
  decodeShareSearch,
  encodeSharePath,
  FROZEN_RESULT_KEYS,
  SHARE_CAR_LIMIT,
  shareArrivalNotes,
  type SharedCar,
} from "./share-link"

const MODEL_Y: Pick<Scenario, "year" | "make" | "model" | "trim"> = {
  year: 2025,
  make: "Tesla",
  model: "Model Y",
  trim: "Model Y Long Range AWD",
}

const CARS: SharedCar[] = [
  { year: 2022, make: "Honda", model: "Civic", trim: "Civic 4Dr", starred: true },
  { year: 2022, make: "Toyota", model: "Corolla", trim: "Corolla", starred: false },
  { year: 2022, make: "Mazda", model: "3", trim: "3 4-Door 2WD", starred: true },
]

function params(path: string): URLSearchParams {
  return new URLSearchParams(path.slice(path.indexOf("?") + 1))
}

test("a What-if link round-trips the situation and never holds a dollar result", () => {
  for (const scenario of [MOLLY, JAYDEN]) {
    const path = encodeSharePath({ page: "/", scenario, teenOnParentPolicy: true })
    assert.match(path, /^\/\?/)
    const query = params(path)
    assert.equal(query.get("share"), "1")
    assert.equal(query.get("mv"), MODEL_VERSION)
    assert.equal(query.get("bv"), DATA_BUNDLE_VERSION)
    assert.equal(query.has("anchor"), false)
    for (const key of FROZEN_RESULT_KEYS) assert.equal(query.has(key), false)

    const decoded = decodeShareSearch(path)
    assert.equal(decoded.status, "ok")
    if (decoded.status !== "ok") return
    assert.deepEqual(decoded.scenario, scenario)
    assert.equal(decoded.teenOnParentPolicy, true)
    assert.equal(decoded.anchorAmount, null)
    assert.equal(decoded.next, null)
    assert.equal(decoded.cars, null)
    assert.equal(decoded.modelMismatch, false)
    assert.equal(decoded.bundleMismatch, false)
  }
})

test("a premium goes into a link only when the visitor opts in", () => {
  const withoutOptIn = encodeSharePath({ page: "/", scenario: MOLLY, teenOnParentPolicy: false, premium: 1800 })
  assert.equal(params(withoutOptIn).has("anchor"), false)

  const optedIn = encodeSharePath({
    page: "/",
    scenario: MOLLY,
    teenOnParentPolicy: false,
    premium: 1800,
    includePremium: true,
  })
  assert.equal(params(optedIn).get("anchor"), "1800")
  const decoded = decodeShareSearch(optedIn)
  assert.equal(decoded.status, "ok")
  if (decoded.status !== "ok") return
  assert.equal(decoded.anchorAmount, 1800)
  assert.equal(decoded.teenOnParentPolicy, false)
  assert.match(shareArrivalNotes(decoded).join(" "), /included what they pay now/)
})

test("a what-if travels as only what changed", () => {
  const next: Scenario = { ...MOLLY, ...MODEL_Y, deductible: 2000 }
  const path = encodeSharePath({ page: "/", scenario: MOLLY, teenOnParentPolicy: false, next })
  const query = params(path)
  assert.equal(query.get("to"), "2025|Tesla|Model Y|Model Y Long Range AWD")
  assert.equal(query.get("w.deductible"), "2000")
  assert.equal(query.has("w.age"), false)

  const decoded = decodeShareSearch(path)
  assert.equal(decoded.status, "ok")
  if (decoded.status !== "ok") return
  assert.deepEqual(decoded.next, next)
})

test("a compare link holds the cars and stars, never a premium or a price", () => {
  const driver = { ...DEFAULT_SCENARIO, age: "16-18" as const, yearsLicensed: "under-1" as const, teen: true }
  const path = encodeSharePath({
    page: "/compare",
    scenario: driver,
    teenOnParentPolicy: true,
    cars: CARS,
    premium: 1800,
    includePremium: true,
  })
  assert.match(path, /^\/compare\?/)
  const query = params(path)
  assert.equal(query.has("anchor"), false)
  assert.equal(query.has("make"), false)
  assert.deepEqual(query.getAll("c"), ["2022|Honda|Civic|Civic 4Dr", "2022|Toyota|Corolla|Corolla", "2022|Mazda|3|3 4-Door 2WD"])
  assert.equal(query.get("star"), "0.2")
  for (const key of FROZEN_RESULT_KEYS) assert.equal(query.has(key), false)
  assert.doesNotMatch(path, /1800/)

  const decoded = decodeShareSearch(path)
  assert.equal(decoded.status, "ok")
  if (decoded.status !== "ok") return
  assert.deepEqual(decoded.cars, CARS)
  assert.equal(decoded.scenario.age, "16-18")
  assert.equal(decoded.anchorAmount, null)
})

test("a compare link keeps at most 15 cars, and a longer one is refused", () => {
  const many = Array.from({ length: 20 }, (_, index) => ({ ...CARS[0], trim: `Civic ${index}` }))
  const path = encodeSharePath({ page: "/compare", scenario: MOLLY, teenOnParentPolicy: false, cars: many })
  assert.equal(params(path).getAll("c").length, SHARE_CAR_LIMIT)
  const tooMany = `${path}${"&c=2022|Kia|Soul|Soul".repeat(6)}`
  assert.equal(decodeShareSearch(tooMany).status, "invalid")
})

test("an older model in the link is named, and frozen dollars are ignored", () => {
  const path = encodeSharePath({
    page: "/",
    scenario: JAYDEN,
    teenOnParentPolicy: true,
    modelVersion: "0.1.0-sample",
    bundleVersion: "factors-2020-01-01",
  })
  const decoded = decodeShareSearch(`${path}&low=10&likely=20&high=30&monthly=2`)
  assert.equal(decoded.status, "ok")
  if (decoded.status !== "ok") return
  assert.equal(decoded.modelMismatch, true)
  assert.equal(decoded.bundleMismatch, true)
  assert.equal(decoded.ignoredFrozenDollars, true)
  assert.deepEqual(decoded.scenario, JAYDEN)

  const notes = shareArrivalNotes(decoded).join(" ")
  assert.match(notes, /older version of our math \(0\.1\.0-sample\)/)
  assert.match(notes, /ignored them/)
  assert.doesNotMatch(notes, /\$10|\$20/)
  assert.doesNotMatch(notes, /anchor|baseline|cleared/i)
})

test("a link without the marker is absent, and a broken one is invalid", () => {
  assert.equal(decodeShareSearch("").status, "absent")
  assert.equal(decodeShareSearch("?age=40-64").status, "absent")
  assert.equal(decodeShareSearch("?share=1&mv=0.2.0").status, "invalid")
  const good = encodeSharePath({ page: "/", scenario: MOLLY, teenOnParentPolicy: false })
  assert.equal(decodeShareSearch(`${good.replace("policy=own", "policy=maybe")}`).status, "invalid")
  assert.equal(decodeShareSearch(`${good}&to=2025|Tesla`).status, "invalid")
  assert.equal(decodeShareSearch(`${good}&anchor=0`).status, "invalid")
})

test("older links with a teen flag still open, and the flag follows the age", () => {
  const path = encodeSharePath({ page: "/", scenario: MOLLY, teenOnParentPolicy: false })
  const decoded = decodeShareSearch(`${path}&teen=1`)
  assert.equal(decoded.status, "ok")
  if (decoded.status !== "ok") return
  assert.equal(decoded.scenario.teen, false)
})
