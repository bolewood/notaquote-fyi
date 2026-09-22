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
  files["state-baselines.json"] = readFileSync("data/state-baselines/state-baselines.json", "utf8")
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

test("spot check: the premium split from NAIC and ISO", () => {
  const naic = JSON.parse(readFileSync("data/state-baselines/state-baselines.json", "utf8")).countrywide
  assert.equal(
    committed.groups["premium-split"].cells.liability.value,
    Math.round((naic.liabilityAveragePremium / naic.combinedAveragePremium) * 100),
  )
  const iso = rows("iso-loss-costs-2024.csv")
  const cost = (coverage: string) => {
    const row = iso.find((item) => item.coverage === coverage)
    return (Number(row?.claim_frequency_per_100) * Number(row?.claim_severity)) / 100
  }
  assert.equal(
    committed.groups["premium-split"].cells["collision-in-physical"].value,
    Math.round((cost("collision") / (cost("collision") + cost("comprehensive"))) * 100),
  )
})

test("spot check: a teen added to a parent's policy, from California's two families", () => {
  const ca = rows("ca-2026-premiums.csv").filter((row) => !CA_FOOTNOTED.has(row.carrier))
  const ratios = profileRatios(ca, [
    ["ca-2565A", "ca-2555A"],
    ["ca-2565M", "ca-2555M"],
  ])
  assert.ok(ratios.length > 200)
  assert.equal(committed.groups["driver-age"].cells["16-18-added"].value, Math.round(median(ratios) * 100))
  assert.equal(committed.groups["driver-age"].cells["16-18-added"].basis, "indicative")
})

test("years licensed is an estimate, capped so a 26+ driver never costs more than a young one", () => {
  const cells = committed.groups["driving-experience"].cells
  const age = committed.groups["driver-age"].cells
  const cap = age["19-21"].value / age["26-39"].value
  for (const key of ["under-1", "1-3", "4-9"]) {
    assert.equal(cells[key].basis, "assumed", key)
    assert.deepEqual(cells[key].sources, [])
    assert.match(cells[key].derivation, /does not allow age as a rating factor/)
  }
  assert.ok(cells["1-3"].value / 100 <= cap)
  assert.ok(cells["1-3"].high / 100 <= cap + 0.005)
  assert.ok(cells["4-9"].value < cells["1-3"].value)
  // A 30-year-old licensed 1–3 years costs far less than a 16-year-old.
  assert.ok((age["26-39"].value * cells["1-3"].value) / 100 < age["16-18"].value * 0.6)
})

test("urban and suburban say how much the states disagree", () => {
  const { urban, suburban } = committed.groups.area.cells
  assert.equal(urban.basis, "sourced")
  assert.ok(urban.low <= 100 && urban.high >= 200, `${urban.low}-${urban.high}`)
  assert.equal(suburban.basis, "indicative")
  assert.match(suburban.derivation, /Rough/)
  assert.match(suburban.derivation, /\+32%/)
  assert.ok(suburban.value > 100 && suburban.value < urban.value)
})

test("the HLDI model rows switch off cleanly", () => {
  const files = readFiles()
  const families = JSON.parse(files["vehicle-families.json"])
  const off = deriveFactors({ ...files, "vehicle-families.json": JSON.stringify({ ...families, useHldiModels: false }) })
  assert.equal(off.vehicle.modelsEnabled, false)
  assert.deepEqual(off.vehicle.models, [])
  assert.ok(Object.keys(off.vehicle.classes).length > 5)
  assertFactorBundleSafe(off)
  const removed = { ...files }
  delete removed["sources/hldi-2022-24.csv"]
  const gone = deriveFactors(removed)
  assert.equal(gone.vehicle.modelsEnabled, false)
  assertFactorBundleSafe(gone)
  // Everything about drivers and coverage is unchanged.
  assert.deepEqual(gone.groups["driver-age"], committed.groups["driver-age"])
})

test("every source file is listed in sources.json and used by a factor", () => {
  const ids = new Set(committed.sources.map((source) => source.id))
  const used = new Set<string>()
  const visit = (value: unknown) => {
    if (!value || typeof value !== "object") return
    const record = value as Record<string, unknown>
    if (Array.isArray(record.sources)) for (const id of record.sources) if (typeof id === "string") used.add(id)
    for (const nested of Object.values(record)) visit(nested)
  }
  visit(committed.groups)
  visit(committed.vehicle)
  used.add(committed.vehicle.sourceId)
  for (const name of readdirSync(path.join(DATA, "sources"))) {
    if (!name.endsWith(".csv")) continue
    const id = name
      .replace(/-(premiums|profiles)\.csv$/, "")
      .replace(/^iso-loss-costs-2024\.csv$/, "iso-via-iii-2024")
      .replace(/^iso-liability-symbols-2004\.csv$/, "iso-symbols-2004")
      .replace(/^hldi-class-subtotals-2022-24\.csv$/, "hldi-2022-24")
      .replace(/\.csv$/, "")
    assert.ok(ids.has(id), `${name} is not listed in sources.json`)
    if (id !== "iso-symbols-2004") assert.ok(used.has(id), `${name} is not used by any factor`)
  }
  for (const id of ids) assert.ok(used.has(id) || id === "iso-symbols-2004", `${id} is listed but not used`)
  assert.match(committed.vehicle.liabilityWeight.derivation, /25 percent and discounts of up to 20 percent/)
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
