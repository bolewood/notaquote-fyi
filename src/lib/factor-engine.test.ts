import assert from "node:assert/strict"
import { readFileSync, readdirSync, statSync } from "node:fs"
import path from "node:path"
import test from "node:test"
import { AGE_WEIGHT } from "./sample-range"
import { MOLLY } from "./scenario"
import {
  assertFactorBundleSafe,
  factorSnapshot,
  FACTOR_BUNDLE_VERSION,
  runFactorEngine,
  type PremiumAnchor,
} from "./factor-engine"
import {
  assertManifestSafe,
  MANIFEST_VERSION,
  NAIC_PARAPHRASE,
  naicPublicationRows,
} from "./source-manifest"
import { DATA_BUNDLE_VERSION, DISCLAIMER, MANIFEST_VERSION as COPY_MANIFEST, MODEL_VERSION, SAMPLE_RANGE_HEADING } from "./copy"

const VERBATIM_DISCLAIMER =
  "THIS IS NOT A QUOTE. NotAQuote.FYI is an independent educational estimate tool, not an insurance company, agency, broker, producer, or lead-generation service. Actual premiums are set by licensed insurers after underwriting and may vary materially."

function anchorFor(scenario: typeof MOLLY, amount: number): PremiumAnchor {
  return { amount, snapshot: factorSnapshot(scenario) }
}

function engine(
  scenario: typeof MOLLY,
  anchor: PremiumAnchor | null,
  trim: "high" | "limited" | "unresolved" | null = "high",
) {
  return runFactorEngine({
    scenario,
    anchor,
    trimConfidence: trim,
    catalogStatus: "ready",
    stale: false,
  })
}

test("bundles are safe to ship without a cleared baseline", () => {
  assertFactorBundleSafe()
  assertManifestSafe()
  assert.equal(DISCLAIMER, VERBATIM_DISCLAIMER)
  assert.equal(SAMPLE_RANGE_HEADING, "Sample range. Baseline not cleared.")
  assert.equal(MODEL_VERSION, "0.2.0")
  assert.equal(DATA_BUNDLE_VERSION, FACTOR_BUNDLE_VERSION)
  assert.equal(FACTOR_BUNDLE_VERSION, "factors-2026-09-21")
  assert.equal(COPY_MANIFEST, MANIFEST_VERSION)
  assert.equal(MANIFEST_VERSION, "manifest-2026-09-21")
})

test("the engine does not emit dollars when no premium is entered", () => {
  const result = engine(MOLLY, null)
  assert.equal(result.dollars, null)
  assert.equal(result.baselineCleared, false)
  assert.equal(result.trendApplied, false)
  assert.equal(result.creditFactor, 1)
  assert.match(result.explanation, /did not emit a dollar range/)
  assert.match(result.explanation, /labeled sample/)
  assert.match(result.explanation, /not this engine's output/)
  assert.match(result.explanation, /40–64/)
  assert.match(result.explanation, /Illinois/)
  assert.match(result.explanation, /full coverage/)
  assert.match(result.explanation, /F-150/)
  assert.equal(result.confidence, "low")
  assert.match(result.confidenceDetail, /baseline is not cleared/i)
})

test("changing age, state, coverage, or vehicle updates the no-dollar explanation", () => {
  const base = engine(MOLLY, null).explanation
  const older = engine({ ...MOLLY, age: "65+" }, null).explanation
  const texas = engine({ ...MOLLY, state: "TX" }, null).explanation
  const standard = engine({ ...MOLLY, coverage: "standard" }, null).explanation
  const rav4 = engine(
    { ...MOLLY, make: "Toyota", model: "RAV4", trim: "RAV4" },
    null,
  ).explanation
  assert.notEqual(base, older)
  assert.match(older, /65\+/)
  assert.notEqual(base, texas)
  assert.match(texas, /Texas/)
  assert.notEqual(base, standard)
  assert.match(standard, /standard liability/)
  assert.notEqual(base, rav4)
  assert.match(rav4, /RAV4/)
  for (const text of [base, older, texas, standard, rav4]) {
    assert.match(text, /did not emit a dollar range/)
  }
})

test("an entered premium is the base, and age names the driver family", () => {
  const anchor = anchorFor(MOLLY, 1800)
  const entered = engine(MOLLY, anchor)
  assert.equal(entered.dollars?.likely, 1800)
  assert.equal(entered.dollars?.low, 1296)
  assert.equal(entered.dollars?.high, 2466)
  assert.equal(entered.dollars?.monthly, 150)
  assert.match(entered.explanation, /No factor family has changed/)
  assert.match(entered.explanation, /base for this scenario only/)
  assert.match(entered.explanation, /Trend is not applied/)

  const aged = engine({ ...MOLLY, age: "16-18" }, anchor)
  assert.equal(aged.dollars?.likely, 2952)
  assert.ok(aged.dollars && aged.dollars.low < aged.dollars.likely)
  assert.ok(aged.dollars && aged.dollars.likely < aged.dollars.high)
  assert.match(aged.explanation, /Driver factor changed/)
  assert.match(aged.explanation, /moved from the amount entered/)
  assert.equal(aged.familiesChanged.includes("driver"), true)
  assert.notEqual(aged.dollars?.likely, entered.dollars?.likely)
})

test("state, coverage, and vehicle name their factor families", () => {
  const anchor = anchorFor(MOLLY, 1800)
  const state = engine({ ...MOLLY, state: "TX" }, anchor)
  assert.equal(state.dollars?.likely, 1800)
  assert.match(state.explanation, /Geography factor changed/)
  assert.match(state.explanation, /stays on the amount entered/)
  assert.match(state.explanation, /geography factor is thin/)

  const coverage = engine({ ...MOLLY, coverage: "standard" }, anchor)
  assert.equal(coverage.dollars?.likely, 1404)
  assert.match(coverage.explanation, /Coverage factor changed/)

  const vehicle = engine(
    { ...MOLLY, make: "Toyota", model: "RAV4", trim: "RAV4" },
    anchor,
  )
  assert.equal(vehicle.dollars?.likely, 1622)
  assert.match(vehicle.explanation, /Vehicle factor changed/)
})

test("a weak trim lowers confidence and widens the range", () => {
  const anchor = anchorFor(MOLLY, 1800)
  const strong = engine(MOLLY, anchor, "high")
  const limited = engine(MOLLY, anchor, "limited")
  const unresolved = engine(MOLLY, anchor, "unresolved")
  assert.equal(strong.confidence, "low")
  assert.equal(limited.confidence, "lower")
  assert.equal(unresolved.confidence, "lower")
  assert.match(limited.confidenceDetail, /lower/)
  assert.match(limited.explanation, /trim match is limited/)
  const span = (result: ReturnType<typeof engine>) =>
    (result.dollars?.high ?? 0) - (result.dollars?.low ?? 0)
  assert.ok(span(limited) > span(strong))
  assert.ok(span(unresolved) > span(limited))
})

test("an unclassified vehicle is a thin factor and widens the range further", () => {
  const anchor = anchorFor(MOLLY, 1800)
  const known = engine(MOLLY, anchor)
  const other = engine(
    { ...MOLLY, make: "Polestar", model: "2", trim: "Long range" },
    anchor,
  )
  assert.match(other.explanation, /vehicle factor is thin|geography and vehicle factors are thin/)
  const knownSpan = (known.dollars?.high ?? 0) - (known.dollars?.low ?? 0)
  const otherSpan = (other.dollars?.high ?? 0) - (other.dollars?.low ?? 0)
  assert.ok(otherSpan > knownSpan)
})

test("the engine never prints zero or a negative dollar", () => {
  const amounts = [1, 2, 5, 1800]
  const scenarios = [
    MOLLY,
    { ...MOLLY, age: "65+" as const, coverage: "state-minimum" as const, region: "rural" as const, year: 2008 },
    { ...MOLLY, coverage: "high" as const, incidents: "two-or-more" as const, age: "16-18" as const },
    { ...MOLLY, goodStudent: true, mileage: "under-7500" as const, year: 2010, region: "rural" as const },
  ]
  for (const amount of amounts) {
    const anchor = anchorFor(MOLLY, amount)
    for (const scenario of scenarios) {
      const result = engine(scenario, anchor, "unresolved")
      const dollars = result.dollars
      assert.ok(dollars)
      assert.ok(dollars.low >= 1, `low ${dollars.low}`)
      assert.ok(dollars.likely >= 1, `likely ${dollars.likely}`)
      assert.ok(dollars.high >= 1, `high ${dollars.high}`)
      assert.ok(dollars.monthly >= 1, `monthly ${dollars.monthly}`)
      assert.ok(dollars.low < dollars.likely && dollars.likely < dollars.high)
    }
  }
})

test("factor values are not the sample display weights", () => {
  assert.notEqual(AGE_WEIGHT["16-18"], 1.64)
  assert.notEqual(AGE_WEIGHT["19-21"], 1.36)
  assert.notEqual(AGE_WEIGHT["22-25"], 1.15)
  const source = readFileSync(new URL("./factor-engine.ts", import.meta.url), "utf8")
  assert.equal(source.includes("SAMPLE_BASE"), false)
  assert.equal(source.includes("2400"), false)
  assert.equal(source.includes("sampleWeight"), false)
})

test("NAIC manifest rows cite the publications and store no figures", () => {
  const [supplement, report] = naicPublicationRows()
  assert.equal(supplement.catalogCode, "AUT-PB 2023")
  assert.equal(supplement.publicationDate, "June 2025")
  assert.match(supplement.licenseNote, /Not cleared/)
  assert.deepEqual(supplement.derivedFields, [])
  assert.equal(report.catalogCode, "AUT-PB 2022-2023")
  assert.equal(report.publicationDate, "December 2025")
  assert.match(report.licenseNote, /Not cleared/)
  assert.deepEqual(report.derivedFields, [])
  assert.match(NAIC_PARAPHRASE, /car-years/)
  assert.equal(/naic estimate/i.test(NAIC_PARAPHRASE), false)
  assert.equal(NAIC_PARAPHRASE.includes("$"), false)
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
