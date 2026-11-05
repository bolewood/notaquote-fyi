import assert from "node:assert/strict"
import test from "node:test"
import { linearScale, niceStep, niceTicks, pct } from "./scale"

test("a linear scale maps dollars to a share of the width", () => {
  const scale = linearScale([0, 4000])
  assert.equal(scale(0), 0)
  assert.equal(scale(2000), 50)
  assert.equal(scale(4000), 100)
  assert.equal(linearScale([1000, 2000], [10, 90])(1500), 50)
})

test("ticks round out to nice numbers and always cover the data", () => {
  assert.deepEqual(niceTicks(0, 3420), { min: 0, max: 4000, ticks: [0, 1000, 2000, 3000, 4000] })
  assert.deepEqual(niceTicks(1250, 2450, 4), { min: 1000, max: 2500, ticks: [1000, 1500, 2000, 2500] })
  assert.equal(niceStep(1000, 4), 250)
  assert.equal(niceStep(900, 4), 250)
  const { min, max } = niceTicks(880, 1480)
  assert.ok(min <= 880 && max >= 1480)
  assert.equal(pct(12.3456), "12.35%")
})

test("chart labels wrap on words and never lose any", async () => {
  const { wrapLines } = await import("./wrap")
  assert.deepEqual(wrapLines("Subaru Outback instead of Toyota Camry", 30), ["Subaru Outback instead of", "Toyota Camry"])
  assert.deepEqual(wrapLines("Where you started", 30), ["Where you started"])
  const long = "Hyundai Ioniq 5 instead of Volkswagen Atlas Cross Sport"
  assert.equal(wrapLines(long, 20).join(" "), long, "every word kept")
  assert.deepEqual(wrapLines("Supercalifragilistic", 5), ["Supercalifragilistic"])
})
