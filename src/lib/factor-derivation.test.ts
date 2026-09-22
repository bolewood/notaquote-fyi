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

type Row = Record<string, string>

/** Same company, same profile: premium in one place ÷ premium in another. */
function placeRatios(rows: Row[], tops: string[], bottoms: string[]): number[] {
  const price = new Map(rows.map((row) => [`${row.carrier}|${row.territory}|${row.profile_id}`, Number(row.annual_premium)]))
  const out: number[] = []
  for (const row of rows) {
    if (!tops.includes(row.territory)) continue
    for (const bottom of bottoms) {
      const other = price.get(`${row.carrier}|${bottom}|${row.profile_id}`)
      if (other) out.push(Number(row.annual_premium) / other)
    }
  }
  return out
}

/** Same company and place: one profile's premium ÷ another's. */
function profileRatios(rows: Row[], pairs: [string, string][]): number[] {
  const price = new Map(rows.map((row) => [`${row.carrier}|${row.territory}|${row.profile_id}`, Number(row.annual_premium)]))
  const out: number[] = []
  for (const row of rows) {
    for (const [top, bottom] of pairs) {
      if (row.profile_id !== top) continue
      const other = price.get(`${row.carrier}|${row.territory}|${bottom}`)
      if (other) out.push(Number(row.annual_premium) / other)
    }
  }
  return out
}

const CA_FOOTNOTED = new Set([
  "Nations Ins Co",
  "KnightBrook Ins Co",
  "Qualitas Ins Co",
  "Anchor General Ins Co",
  "Federal Ins Co (CHUBB)",
  "First Acceptance Ins Co, Inc.",
  "Incline Natl Ins Co",
])

test("spot check: urban area from five states, recomputed by hand", () => {
  const ok = rows("ok-2026-premiums.csv").map((row) => ({
    ...row,
    carrier: row.carrier === "EQU+27:95ITY INSURANCE COMPANY" ? "EQUITY INSURANCE COMPANY" : row.carrier,
  }))
  const nd = rows("nd-2026-premiums.csv")
  const tx = rows("tx-2025-premiums.csv")
  const ca = rows("ca-2026-premiums.csv").filter((row) => !CA_FOOTNOTED.has(row.carrier))
  const co = rows("co-2023-premiums.csv")
  const medians = [
    median(placeRatios(ok, ["OKLAHOMA CITY", "TULSA"], ["WOODWARD", "McALESTER"])),
    median(placeRatios(nd, ["Fargo"], ["Remainder of State"])),
    median(placeRatios(tx, ["Houston 77036 (Harris County)", "Dallas 75216 (Dallas County)"], ["Plainview 79072 (Hale County)", "Alpine 79830 (Brewster County)"])),
    median(placeRatios(ca, ["Los Angeles Los Angeles - Central"], ["Modoc Alturas"])),
    median(placeRatios(co, ["Denver (80205)", "Colorado Springs (80903)"], ["Sterling (80751)", "Alamosa (81101)", "Craig (81625)"])),
  ]
  assert.equal(committed.groups.area.cells.urban.value, Math.round(median(medians) * 100))
})

test("spot check: one at-fault accident from three states, recomputed by hand", () => {
  const tx = rows("tx-2025-premiums.csv")
  const ca = rows("ca-2026-premiums.csv").filter((row) => !CA_FOOTNOTED.has(row.carrier))
  const caPairs: [string, string][] = ["1102", "1112", "1122", "1132", "1142"].map((code) => [`ca-${code}C`, `ca-${code}A`])
  caPairs.push(["ca-2512C_V3", "ca-2512A_V3"])
  for (const code of ["2522", "2532", "2542"]) caPairs.push([`ca-${code}C_V1`, `ca-${code}A_V1`])
  const sdip = rows("nc-sdip-2026.csv")
  const nc = 1 + Number(sdip.find((row) => row.points === "3")?.surcharge_percent) / 100
  const medians = [median(profileRatios(ca, caPairs)), median(profileRatios(tx, [["tx-accident", "tx-base"]])), nc]
  assert.equal(committed.groups["driving-record"].cells.one.value, Math.round(median(medians) * 100))
})

test("spot check: the premium split from ISO", () => {
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
  for (const id of ["ok-2026", "nd-2026", "dc-2024", "tx-2025", "ca-2026", "co-2023", "nc-sdip-2026", "iso-via-iii-2024", "hldi-2022-24"]) {
    assert.ok(listed.has(id), id)
  }
  for (const name of readdirSync(path.join(DATA, "sources"))) {
    if (!name.endsWith(".csv") || name.endsWith("-profiles.csv")) continue
    for (const row of rows(name)) {
      assert.ok((row.locator ?? "").trim().length > 10, `${name} row without a locator`)
    }
  }
})
