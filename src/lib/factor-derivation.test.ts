import assert from "node:assert/strict"
import { readdirSync, readFileSync } from "node:fs"
import path from "node:path"
import test from "node:test"
import { deriveFactors, hldiFamily, hldiPowertrain, parseCsv, type FactorFiles } from "./factor-derivation"
import { assertFactorBundleSafe } from "./factor-engine"
import type { FactorBundle } from "./factor-types"

const DATA = "data/factors"

function readFiles(): FactorFiles {
  const files: FactorFiles = {}
  for (const name of ["assumptions.json", "vehicle-families.json"]) {
    files[name] = readFileSync(path.join(DATA, name), "utf8")
  }
  for (const name of readdirSync(path.join(DATA, "sources"))) {
    if (name.endsWith(".csv") || name.endsWith(".json")) {
      files[`sources/${name}`] = readFileSync(path.join(DATA, "sources", name), "utf8")
    }
  }
  return files
}

const committed = JSON.parse(readFileSync("src/data/model-factors.json", "utf8")) as FactorBundle
const rows = (name: string) => parseCsv(readFileSync(path.join(DATA, "sources", name), "utf8"))

/** A plain median, written separately from the derivation on purpose. */
function median(values: number[]): number {
  const sorted = [...values].sort((a, b) => a - b)
  const mid = sorted.length >> 1
  return sorted.length % 2 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2
}

test("the committed factors are exactly what the sources produce", () => {
  const derived = deriveFactors(readFiles())
  assert.deepEqual(derived, committed, "run `npm run factors:build` after changing data/factors")
  assertFactorBundleSafe(derived)
})

test("spot check: age 26–39 from Oklahoma, recomputed by hand", () => {
  const ok = rows("ok-2026-premiums.csv")
  const price = new Map(ok.map((row) => [`${row.carrier}|${row.territory}|${row.profile_id}`, Number(row.annual_premium)]))
  const ratios: number[] = []
  for (const row of ok) {
    const match = /^ok-2026-C-(male|female)$/.exec(row.profile_id)
    if (!match) continue
    const other = price.get(`${row.carrier}|${row.territory}|ok-2026-D-${match[1]}`)
    if (other) ratios.push(Number(row.annual_premium) / other)
  }
  assert.equal(ratios.length, 200)
  assert.equal(committed.groups["driver-age"].cells["26-39"].value, Math.round(median(ratios) * 100))
})

test("spot check: urban area from Oklahoma and North Dakota, recomputed by hand", () => {
  const ok = rows("ok-2026-premiums.csv").map((row) => ({
    ...row,
    carrier: row.carrier === "EQU+27:95ITY INSURANCE COMPANY" ? "EQUITY INSURANCE COMPANY" : row.carrier,
  }))
  const okPrice = new Map(ok.map((row) => [`${row.carrier}|${row.territory}|${row.profile_id}`, Number(row.annual_premium)]))
  const okRatios: number[] = []
  for (const row of ok) {
    if (row.territory !== "OKLAHOMA CITY" && row.territory !== "TULSA") continue
    for (const rural of ["WOODWARD", "McALESTER"]) {
      const other = okPrice.get(`${row.carrier}|${rural}|${row.profile_id}`)
      if (other) okRatios.push(Number(row.annual_premium) / other)
    }
  }
  const nd = rows("nd-2026-premiums.csv")
  const ndPrice = new Map(nd.map((row) => [`${row.carrier}|${row.territory}|${row.profile_id}`, Number(row.annual_premium)]))
  const ndRatios: number[] = []
  for (const row of nd) {
    if (row.territory !== "Fargo") continue
    const other = ndPrice.get(`${row.carrier}|Remainder of State|${row.profile_id}`)
    if (other) ndRatios.push(Number(row.annual_premium) / other)
  }
  assert.equal(okRatios.length, 800)
  const value = Math.round(((median(okRatios) + median(ndRatios)) / 2) * 100)
  assert.equal(committed.groups.area.cells.urban.value, value)
})

test("spot check: one at-fault accident and the premium split", () => {
  const sdip = rows("nc-sdip-2026.csv")
  assert.equal(committed.groups["driving-record"].cells.one.value, 100 + Number(sdip.find((row) => row.points === "3")?.surcharge_percent))
  const iso = rows("iso-loss-costs-2024.csv")
  const cost = (coverage: string) => {
    const row = iso.find((item) => item.coverage === coverage)
    return (Number(row?.claim_frequency_per_100) * Number(row?.claim_severity)) / 100
  }
  const liability = cost("bodily injury liability") + cost("property damage liability")
  const damage = cost("collision") + cost("comprehensive")
  assert.equal(committed.groups["premium-split"].cells.liability.value, Math.round((liability / (liability + damage)) * 100))
})

test("HLDI rows are copied faithfully and named consistently", () => {
  const source = rows("hldi-2022-24.csv")
  assert.ok(source.length >= 200)
  for (const row of source) {
    const kept = committed.vehicle.models.find((model) => model.series === row.series && model.hldiClass === `${row.body_class} / ${row.size}`)
    if (hldiPowertrain(row.model) === null) {
      assert.equal(kept, undefined)
      continue
    }
    assert.ok(kept, row.series)
    assert.equal(kept.collision, row.collision ? Number(row.collision) : null)
    assert.equal(kept.comprehensive, row.comprehensive ? Number(row.comprehensive) : null)
    assert.equal(kept.propertyDamage, row.property_damage ? Number(row.property_damage) : null)
    assert.equal(kept.bodilyInjury, row.bodily_injury ? Number(row.bodily_injury) : null)
  }
  assert.equal(hldiFamily("F-150 Lightning electric crew cab pickup 4WD"), "f150lightning")
  assert.equal(hldiFamily("RAV4 Prime plug-in hybrid 4dr 4WD"), "rav4prime")
  assert.equal(hldiFamily("Range Rover 4dr LWB 4WD (NEW)"), "rangerover")
  assert.equal(hldiFamily("Outback 4dr 4WD with EyeSight"), "outback")
  assert.equal(hldiFamily("1500 crew cab SWB 4WD"), "1500")
  assert.equal(hldiPowertrain("Model Y electric 4dr 4WD"), "electric")
  assert.equal(hldiPowertrain("RAV4 hybrid 4dr 4WD"), "hybrid")
  assert.equal(hldiPowertrain("RAV4 Prime plug-in hybrid 4dr 4WD"), "plug-in-hybrid")
})

test("every source file is listed and every row keeps a locator", () => {
  const listed = new Set(committed.sources.map((source) => source.id))
  for (const id of ["ok-2026", "nd-2026", "dc-2024", "nc-sdip-2026", "iso-via-iii-2024", "hldi-2022-24"]) {
    assert.ok(listed.has(id), id)
  }
  for (const name of readdirSync(path.join(DATA, "sources"))) {
    if (!name.endsWith(".csv") || name.endsWith("-profiles.csv")) continue
    for (const row of rows(name)) {
      assert.ok((row.locator ?? "").trim().length > 10, `${name} row without a locator`)
    }
  }
})
