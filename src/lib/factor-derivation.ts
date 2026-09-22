/**
 * Recompute every factor from the files in data/factors/.
 *
 * This module is pure: it takes the text of each file and returns the bundle
 * that scripts/derive-factors.ts writes to src/data/model-factors.json. The
 * test suite runs it again and checks the committed JSON matches, so a factor
 * cannot drift from its sources without the tests failing.
 *
 * The method, for every sourced factor:
 * 1. Find two published profiles that differ in (ideally) one thing.
 * 2. For each company, in the same place, divide one premium by the other.
 * 3. Take the median across companies in each source. The low and high edges
 *    are the 25th and 75th percentiles, which show how differently companies
 *    price the same thing.
 * 4. Where two sources measure the same thing, take the median of the source
 *    medians (and of their percentiles).
 * 5. Round to hundredths.
 */
import { compactName } from "./catalog-match"
import type {
  FactorBasis,
  FactorBundle,
  FactorCell,
  FactorGroup,
  FactorSource,
  VehicleClassRow,
  VehicleLossRow,
} from "./factor-types"

export const DERIVATION_VERSION = "factors-2026-09-22"
export const EFFECTIVE_DATE = "2026-09-22"
export const CHECKED_ON = "2026-09-22"

export type FactorFiles = Record<string, string>

// ---------------------------------------------------------------------------
// Small helpers

export function parseCsv(text: string): Record<string, string>[] {
  const rows: string[][] = []
  let row: string[] = []
  let field = ""
  let quoted = false
  for (let index = 0; index < text.length; index += 1) {
    const char = text[index]
    if (quoted) {
      if (char === '"') {
        if (text[index + 1] === '"') {
          field += '"'
          index += 1
        } else quoted = false
      } else field += char
      continue
    }
    if (char === '"') quoted = true
    else if (char === ",") {
      row.push(field)
      field = ""
    } else if (char === "\n" || char === "\r") {
      if (char === "\r" && text[index + 1] === "\n") index += 1
      row.push(field)
      field = ""
      if (row.some((cell) => cell.length > 0)) rows.push(row)
      row = []
    } else field += char
  }
  if (field.length > 0 || row.length > 0) {
    row.push(field)
    if (row.some((cell) => cell.length > 0)) rows.push(row)
  }
  const [header, ...body] = rows
  if (!header) return []
  return body.map((cells) => Object.fromEntries(header.map((name, index) => [name, cells[index] ?? ""])))
}

function need(files: FactorFiles, name: string): string {
  const text = files[name]
  if (text === undefined) throw new Error(`Missing data/factors file ${name}`)
  return text
}

/** Linear-interpolation percentile (the usual spreadsheet PERCENTILE). */
export function percentile(values: number[], p: number): number {
  if (values.length === 0) throw new Error("No values")
  const sorted = [...values].sort((left, right) => left - right)
  const position = (sorted.length - 1) * p
  const lower = Math.floor(position)
  const upper = Math.ceil(position)
  if (lower === upper) return sorted[lower]
  return sorted[lower] + (sorted[upper] - sorted[lower]) * (position - lower)
}

export function toHundredths(value: number): number {
  return Math.round(value * 100)
}

type Summary = { median: number; p25: number; p75: number; n: number }

function summarize(ratios: number[]): Summary {
  return {
    median: percentile(ratios, 0.5),
    p25: percentile(ratios, 0.25),
    p75: percentile(ratios, 0.75),
    n: ratios.length,
  }
}

/** Median of the source medians, and of their percentiles. */
function combine(summaries: Summary[]): Summary {
  return {
    median: percentile(summaries.map((item) => item.median), 0.5),
    p25: percentile(summaries.map((item) => item.p25), 0.5),
    p75: percentile(summaries.map((item) => item.p75), 0.5),
    n: summaries.reduce((total, item) => total + item.n, 0),
  }
}

/** Multiply two factors; relative spreads add in quadrature. */
function chain(first: Summary, second: Summary): Summary {
  const median = first.median * second.median
  const down = Math.hypot(1 - first.p25 / first.median, 1 - second.p25 / second.median)
  const up = Math.hypot(first.p75 / first.median - 1, second.p75 / second.median - 1)
  return { median, p25: median * (1 - down), p75: median * (1 + up), n: first.n + second.n }
}

function cellFrom(
  label: string,
  summary: Summary,
  basis: Exclude<FactorBasis, "reference" | "assumed">,
  sources: string[],
  derivation: string,
): FactorCell {
  const value = toHundredths(summary.median)
  return {
    label,
    value,
    low: Math.min(value, toHundredths(summary.p25)),
    high: Math.max(value, toHundredths(summary.p75)),
    basis,
    sources,
    derivation,
    n: summary.n,
  }
}

function reference(label: string, derivation: string): FactorCell {
  return { label, value: 100, low: 100, high: 100, basis: "reference", sources: [], derivation, n: null }
}

type AssumedEntry = { label: string; value: number | null; low: number | null; high: number | null; why: string }

function assumed(entry: AssumedEntry, value = entry.value, low = entry.low, high = entry.high): FactorCell {
  if (value === null || low === null || high === null) throw new Error(`Assumption ${entry.label} has no value`)
  return {
    label: entry.label,
    value,
    low,
    high,
    basis: "assumed",
    sources: [],
    derivation: `Our estimate. No public source yet; help wanted. ${entry.why}`,
    n: null,
  }
}

// ---------------------------------------------------------------------------
// Premium surveys

type Premium = { territory: string; carrier: string; profile: string; annual: number }

/** Company names printed two ways in one survey. */
const CARRIER_ALIASES: Record<string, string> = {
  "EQU+27:95ITY INSURANCE COMPANY": "EQUITY INSURANCE COMPANY",
}

/**
 * Companies whose own footnotes say they priced different coverage from the
 * survey's profile. Left out of every comparison from that survey.
 */
export const EXCLUDED_CARRIERS: Record<string, string[]> = {
  // California 2026 footnotes (APS2026Footnotes.xlsx): other limits or
  // deductibles, a combined single limit, the highest available limit, or
  // mileage rated below the profile's range.
  "ca-2026": [
    "Nations Ins Co",
    "KnightBrook Ins Co",
    "Qualitas Ins Co",
    "Anchor General Ins Co",
    "Federal Ins Co (CHUBB)",
    "First Acceptance Ins Co, Inc.",
    "Incline Natl Ins Co",
  ],
}

function premiums(files: FactorFiles, sourceId: string): Premium[] {
  const excluded = new Set(EXCLUDED_CARRIERS[sourceId] ?? [])
  const rows = parseCsv(need(files, `sources/${sourceId}-premiums.csv`)).filter((row) => !excluded.has(row.carrier))
  return rows.map((row) => {
    const annual = Number(row.annual_premium)
    if (!Number.isFinite(annual) || annual <= 0) throw new Error(`${sourceId}: bad premium ${row.annual_premium}`)
    return {
      territory: row.territory,
      carrier: CARRIER_ALIASES[row.carrier] ?? row.carrier,
      profile: row.profile_id,
      annual,
    }
  })
}

function index(rows: Premium[]): Map<string, number> {
  const map = new Map<string, number>()
  for (const row of rows) map.set(`${row.carrier}|${row.territory}|${row.profile}`, row.annual)
  return map
}

/**
 * Per-company ratios premium(numerator) ÷ premium(denominator), matching the
 * company and the place. `pairs` lists [numerator profile, denominator
 * profile]; `places` lists [numerator territory, denominator territory].
 */
function ratios(
  rows: Premium[],
  pairs: [string, string][],
  places: [string, string][] | "same",
): number[] {
  const lookup = index(rows)
  const carriers = [...new Set(rows.map((row) => row.carrier))].sort()
  const territories = [...new Set(rows.map((row) => row.territory))].sort()
  const placePairs: [string, string][] =
    places === "same" ? territories.map((territory) => [territory, territory]) : places
  const out: number[] = []
  for (const carrier of carriers) {
    for (const [top, bottom] of pairs) {
      for (const [topPlace, bottomPlace] of placePairs) {
        const numerator = lookup.get(`${carrier}|${topPlace}|${top}`)
        const denominator = lookup.get(`${carrier}|${bottomPlace}|${bottom}`)
        if (numerator && denominator) out.push(numerator / denominator)
      }
    }
  }
  return out
}

/** Each company's premium ÷ the median premium for the same profile and place. */
function dispersion(rows: Premium[]): number[] {
  const groups = new Map<string, number[]>()
  for (const row of rows) {
    const key = `${row.territory}|${row.profile}`
    const list = groups.get(key) ?? []
    list.push(row.annual)
    groups.set(key, list)
  }
  const out: number[] = []
  for (const key of [...groups.keys()].sort()) {
    const list = groups.get(key) ?? []
    if (list.length < 5) continue
    const middle = percentile(list, 0.5)
    for (const value of list) out.push(value / middle)
  }
  return out
}

const OK_SEXES = ["male", "female"] as const
function okPairs(top: string, bottom: string): [string, string][] {
  return OK_SEXES.map((sex) => [`ok-2026-${top}-${sex}`, `ok-2026-${bottom}-${sex}`])
}

const DC_GROUPS = ["married", "single-female", "single-male"] as const
function dcPairs(top: number, bottom: number): [string, string][] {
  return DC_GROUPS.map((group) => [`dc-${group}-${top}`, `dc-${group}-${bottom}`])
}

const ND_PROFILES = ["01", "02", "03", "05", "06", "07", "08", "09", "10", "11", "12"].map(
  (item) => `nd-2026-ex${item}`,
)

function pct(summary: Summary): string {
  const format = (value: number) => (value * 100 - 100).toFixed(0)
  return `median ${summary.median.toFixed(3)} (middle half of companies ${summary.p25.toFixed(3)}–${summary.p75.toFixed(3)}; ${format(summary.median)}%)`
}

// ---------------------------------------------------------------------------
// HLDI

type HldiRow = Record<string, string>

const STRIP_WORDS = new Set([
  "4dr",
  "2dr",
  "4wd",
  "2wd",
  "2wd/4wd",
  "awd",
  "electric",
  "hybrid",
  "plug-in",
  "crew",
  "cab",
  "crewmax",
  "ext.",
  "mega",
  "quad",
  "double",
  "access",
  "king",
  "supercab",
  "supercrew",
  "pickup",
  "(new)",
  "lwb",
  "swb",
  "with",
  "eyesight",
  "hatchback",
  "sedan",
  "coupe",
  "convertible",
  "wagon",
  "station",
  "sportback",
  "van",
])

export function hldiFamily(model: string): string {
  const words = model
    .toLowerCase()
    .replace(/fuel cell/g, " ")
    .split(/\s+/)
    .filter((word) => word && !STRIP_WORDS.has(word))
  return compactName(words.join(" "))
}

export function hldiPowertrain(model: string): VehicleLossRow["powertrain"] | null {
  const value = model.toLowerCase()
  if (/fuel cell/.test(value)) return null
  if (/plug-in/.test(value)) return "plug-in-hybrid"
  if (/\belectric\b/.test(value)) return "electric"
  if (/\bhybrid\b/.test(value)) return "hybrid"
  return "combustion"
}

function numberOrNull(value: string | undefined): number | null {
  if (value === undefined || value.trim() === "") return null
  const parsed = Number(value)
  if (!Number.isInteger(parsed) || parsed <= 0) throw new Error(`Bad HLDI value ${value}`)
  return parsed
}

function yearRange(label: string): { yearMin: number; yearMax: number } {
  const match = /^(\d{4})-(\d{2})$/.exec(label)
  if (!match) throw new Error(`Bad model years ${label}`)
  const yearMin = Number(match[1])
  return { yearMin, yearMax: Math.floor(yearMin / 100) * 100 + Number(match[2]) }
}

function hldiRow(row: HldiRow): VehicleLossRow | null {
  const powertrain = hldiPowertrain(row.model)
  if (!powertrain) return null
  return {
    series: row.series,
    make: row.make,
    family: hldiFamily(row.model),
    powertrain,
    drive: /\b4wd\b/i.test(row.model) ? "4wd" : "2wd",
    hldiClass: `${row.body_class} / ${row.size}`,
    modelYears: row.model_years,
    ...yearRange(row.model_years),
    collision: numberOrNull(row.collision),
    comprehensive: numberOrNull(row.comprehensive),
    propertyDamage: numberOrNull(row.property_damage),
    bodilyInjury: numberOrNull(row.bodily_injury),
  }
}

type Families = {
  families: Record<string, string[]>
  aliases: Record<string, string>
  classes: Record<string, string>
  electricClassCells: Record<string, [string, string]>
}

/** Keep only the rows for the families listed in vehicle-families.json. */
export function pickHldiSubset(fullCsv: string, families: Families): HldiRow[] {
  const wanted = new Set(
    Object.entries(families.families).flatMap(([make, list]) => list.map((family) => `${compactName(make)}|${family}`)),
  )
  return parseCsv(fullCsv).filter((row) => wanted.has(`${compactName(row.make)}|${hldiFamily(row.model)}`))
}

function weightedRelativity(first: number | null, second: number | null, firstShare: number): number | null {
  if (first !== null && second !== null) return (first * firstShare + second * (100 - firstShare)) / 100
  return first ?? second
}

// ---------------------------------------------------------------------------
// The bundle

export function deriveFactors(files: FactorFiles): FactorBundle {
  const sources = JSON.parse(need(files, "sources/sources.json")) as { sources: FactorSource[] }
  const assumptions = JSON.parse(need(files, "assumptions.json")) as Record<string, Record<string, AssumedEntry>>
  const families = JSON.parse(need(files, "vehicle-families.json")) as Families
  const guess = (groupId: string, key: string) => {
    const entry = assumptions[groupId]?.[key]
    if (!entry) throw new Error(`Missing assumption ${groupId}.${key}`)
    return entry
  }

  const ok = premiums(files, "ok-2026")
  const nd = premiums(files, "nd-2026")
  const dc = premiums(files, "dc-2024")
  const tx = premiums(files, "tx-2025")
  const ca = premiums(files, "ca-2026")
  const co = premiums(files, "co-2023")
  const same = (profiles: string[]): [string, string][] => profiles.map((profile) => [profile, profile])
  const cross = (tops: string[], bottoms: string[]): [string, string][] =>
    tops.flatMap((top) => bottoms.map((bottom): [string, string] => [top, bottom]))
  const profilesOf = (rows: Premium[]) => [...new Set(rows.map((row) => row.profile))].sort()

  // --- Area: same company, same profile, city (or suburb) versus rural area.
  const TX_URBAN = ["Houston 77036 (Harris County)", "Dallas 75216 (Dallas County)"]
  const TX_SUBURB = ["Plano 75023 (Collin County)"]
  const TX_RURAL = ["Plainview 79072 (Hale County)", "Alpine 79830 (Brewster County)"]
  const CA_URBAN = ["Los Angeles Los Angeles - Central"]
  const CA_SUBURB = ["Orange Irvine"]
  const CA_RURAL = ["Modoc Alturas"]
  const CO_URBAN = ["Denver (80205)", "Colorado Springs (80903)"]
  const CO_SUBURB = ["Highlands Ranch (80126)"]
  const CO_RURAL = ["Sterling (80751)", "Alamosa (81101)", "Craig (81625)"]
  const okArea = summarize(
    ratios(ok, same(profilesOf(ok)), cross(["OKLAHOMA CITY", "TULSA"], ["WOODWARD", "McALESTER"])),
  )
  const ndArea = summarize(ratios(nd, same(ND_PROFILES), [["Fargo", "Remainder of State"]]))
  const txArea = summarize(ratios(tx, same(profilesOf(tx)), cross(TX_URBAN, TX_RURAL)))
  const caArea = summarize(ratios(ca, same(profilesOf(ca)), cross(CA_URBAN, CA_RURAL)))
  const coArea = summarize(ratios(co, same(profilesOf(co)), cross(CO_URBAN, CO_RURAL)))
  // Suburbs are compared with the city in the same state (only Texas,
  // California, and Colorado publish all three), then scaled by the urban
  // factor, so suburban and urban come from consistent comparisons.
  const txSuburb = summarize(ratios(tx, same(profilesOf(tx)), cross(TX_SUBURB, TX_URBAN)))
  const caSuburb = summarize(ratios(ca, same(profilesOf(ca)), cross(CA_SUBURB, CA_URBAN)))
  const coSuburb = summarize(ratios(co, same(profilesOf(co)), cross(CO_SUBURB, CO_URBAN)))
  const urbanSummary = combine([okArea, ndArea, txArea, caArea, coArea])
  const area: FactorGroup = {
    title: "Area",
    appliesTo: "whole",
    note: "Where the car is kept. Rural is the starting point.",
    cells: {
      urban: cellFrom(
        "Urban",
        urbanSummary,
        "sourced",
        ["ok-2026", "nd-2026", "tx-2025", "ca-2026", "co-2023"],
        `Same company and driver, city versus rural area, in five states; value is the median of the five state medians. Oklahoma 2026, Oklahoma City and Tulsa ÷ Woodward and McAlester: ${pct(okArea)}, ${okArea.n} comparisons. North Dakota 2026, Fargo ÷ "Remainder of State" (Examples 1–3, 5–12): ${pct(ndArea)}, ${ndArea.n}. Texas 2025, Houston and Dallas ÷ Plainview and Alpine: ${pct(txArea)}, ${txArea.n}. California 2026, Los Angeles Central ÷ Alturas: ${pct(caArea)}, ${caArea.n}. Colorado 2023, Denver and Colorado Springs ÷ Sterling, Alamosa, and Craig: ${pct(coArea)}, ${coArea.n}.`,
      ),
      suburban: cellFrom(
        "Suburban",
        chain(combine([txSuburb, caSuburb, coSuburb]), urbanSummary),
        "sourced",
        ["tx-2025", "ca-2026", "co-2023", "ok-2026", "nd-2026"],
        `Same company and driver, suburb versus city in the same state, in the three states that publish both (median of the three state medians), times the urban factor above. Texas 2025, Plano ÷ Houston and Dallas: ${pct(txSuburb)}, ${txSuburb.n} comparisons. California 2026, Irvine ÷ Los Angeles Central: ${pct(caSuburb)}, ${caSuburb.n}. Colorado 2023, Highlands Ranch ÷ Denver and Colorado Springs: ${pct(coSuburb)}, ${coSuburb.n}.`,
      ),
      rural: reference("Rural", "The starting point for area. Other areas are compared with it."),
    },
  }

  // --- Age.
  const okCD = summarize(ratios(ok, okPairs("C", "D"), "same"))
  const okAD = summarize(ratios(ok, okPairs("A", "D"), "same"))
  const okBD = summarize(ratios(ok, okPairs("B", "D"), "same"))
  const dc25 = summarize(ratios(dc, dcPairs(25, 39), "same"))
  const dc66 = summarize(ratios(dc, dcPairs(66, 39), "same"))
  const tx18 = summarize(
    ratios(
      tx,
      [
        ["tx-age18", "tx-base"],
        ["tx-age18_female", "tx-female"],
      ],
      "same",
    ),
  )
  const tx65 = summarize(
    ratios(
      tx,
      [
        ["tx-age65", "tx-base"],
        ["tx-age65_married", "tx-married"],
      ],
      "same",
    ),
  )
  const age2539 = cellFrom(
    "26–39",
    okCD,
    "sourced",
    ["ok-2026"],
    `Oklahoma 2026, Scenario C (age 36) ÷ Scenario D (age 55): both married, 18-mile round-trip commute, 12,000 miles, same car and coverage. Same company, city, and sex; ${pct(okCD)} over ${okCD.n} comparisons.`,
  )
  const age1618 = cellFrom(
    "16–18",
    chain(tx18, okCD),
    "sourced",
    ["tx-2025", "ok-2026"],
    `Texas 2025 (HelpInsure sample rates, liability only), age 18 ÷ age 30, single, same company, ZIP, car, use, and credit; male and female; ${pct(tx18)} over ${tx18.n} comparisons. Times the 26–39 factor above, because 30 is in that band. The site shows ages as bands (16–24, 25–64, 65+); TDI's data call rates them at 18, 30, and 65. The teen is the only driver on their own policy; adding a teen to a parent's policy is priced differently. For comparison, Oklahoma 2026's 16-year-old ÷ 55-year-old (who also differ in marital status, use, and mileage) is ${pct(okAD)} over ${okAD.n} comparisons.`,
  )
  const age1921 = cellFrom(
    "19–21",
    okBD,
    "indicative",
    ["ok-2026"],
    `Oklahoma 2026, Scenario B (age 21, single) ÷ Scenario D (age 55, married); same commute, mileage, car, and coverage. Same company, city, and sex; ${pct(okBD)} over ${okBD.n} comparisons. Rough because marital status also differs.`,
  )
  const age2225 = cellFrom(
    "22–25",
    chain(dc25, okCD),
    "sourced",
    ["dc-2024", "ok-2026"],
    `District of Columbia 2024, age 25 ÷ age 39 (same company, same group: married, single female, single male; state-minimum coverage), ${pct(dc25)} over ${dc25.n} comparisons, times the 26–39 factor above (age 39 is in that band).`,
  )
  const senior = combine([dc66, tx65])
  const age65 = cellFrom(
    "65+",
    chain(senior, okCD),
    "sourced",
    ["dc-2024", "tx-2025", "ok-2026"],
    `Median of two senior-versus-adult comparisons, times the 26–39 factor above (both adult ages are in that band). District of Columbia 2024, age 66 ÷ age 39 (same company and group; state-minimum coverage): ${pct(dc66)}, ${dc66.n} comparisons. Texas 2025, age 65 ÷ age 30 (single male, and married): ${pct(tx65)}, ${tx65.n} comparisons.`,
  )
  const driverAge: FactorGroup = {
    title: "Driver age",
    appliesTo: "whole",
    note: "The main driver's age. 16–18 is the teen factor; there is no separate teen switch.",
    cells: {
      "16-18": age1618,
      "19-21": age1921,
      "22-25": age2225,
      "26-39": age2539,
      "40-64": reference("40–64", "The starting point for age."),
      "65+": age65,
    },
  }

  // --- Driving record.
  const sdip = parseCsv(need(files, "sources/nc-sdip-2026.csv"))
  const surcharge = (points: string) => {
    const row = sdip.find((item) => item.points === points)
    if (!row) throw new Error(`NC SDIP row ${points} missing`)
    return Number(row.surcharge_percent)
  }
  // California's single-driver profiles: Basic (liability only, Camry) and
  // Standard (full coverage, Accord), clean (A) versus one at-fault accident (C).
  const CA_SINGLE = ["1102", "1112", "1122", "1132", "1142", "2512", "2522", "2532", "2542"]
  const caProfile = (code: string, letter: string) => (code.startsWith("25") ? `ca-${code}${letter}_${code.startsWith("251") ? "V3" : "V1"}` : `ca-${code}${letter}`)
  const caAccident = summarize(
    ratios(ca, CA_SINGLE.map((code) => [caProfile(code, "C"), caProfile(code, "A")]), "same"),
  )
  const txAccident = summarize(ratios(tx, [["tx-accident", "tx-base"]], "same"))
  const ncAccident: Summary = {
    median: 1 + surcharge("3") / 100,
    p25: 1 + surcharge("1") / 100,
    p75: 1 + surcharge("3") / 100,
    n: 3,
  }
  const drivingRecord: FactorGroup = {
    title: "Driving record",
    appliesTo: "whole",
    note: "At-fault accidents in the last three years.",
    cells: {
      clean: reference("Clean", "The starting point for driving record."),
      one: cellFrom(
        "One at-fault accident",
        combine([caAccident, txAccident, ncAccident]),
        "sourced",
        ["ca-2026", "tx-2025", "nc-sdip-2026"],
        `Median of three states. California 2026, one at-fault accident ÷ clean, same company, place, car, and years licensed (single-driver profiles, liability-only and full coverage): ${pct(caAccident)}, ${caAccident.n} comparisons; California's clean profiles include its required Good Driver discount, so this includes losing it. Texas 2025, one at-fault accident ÷ clean (liability only): ${pct(txAccident)}, ${txAccident.n} comparisons. North Carolina's Safe Driver Incentive Plan, set by state law: ${surcharge("1")}% for a small accident, ${surcharge("2")}% for a medium one, and ${surcharge("3")}% for $3,850 or more of damage or an injury; we count it as a median of ${surcharge("3")}% (typical claims are above $3,850) with ${surcharge("1")}% as the low edge.`,
      ),
      "two-or-more": assumed(guess("driving-record", "two-or-more")),
    },
  }

  // --- Years licensed (California rates by years licensed, not age).
  const caYears = (codes: [string, string][]) =>
    summarize(ratios(ca, codes.map(([top, bottom]) => [caProfile(top, "A"), caProfile(bottom, "A")]), "same"))
  const years13 = caYears([["1102", "1132"]])
  const years49 = caYears([
    ["1112", "1132"],
    ["1122", "1132"],
    ["2512", "2532"],
    ["2522", "2532"],
  ])
  const yearsWords = "California 2026, same company, place, car, record, and mileage; California profiles give years licensed but no age (its rules make years licensed a main rating factor), so a newly licensed California driver may also be younger. Rough for that reason. We only use this factor from age 26, so it doesn't pile on top of the young-driver age factors."
  const experienceSourced: Record<string, FactorCell> = {
    "1-3": cellFrom(
      "Licensed 1–3 years (age 26 and up)",
      years13,
      "indicative",
      ["ca-2026"],
      `Licensed 2 years ÷ 13 years (Basic, liability only): ${pct(years13)}, ${years13.n} comparisons. ${yearsWords}`,
    ),
    "4-9": cellFrom(
      "Licensed 4–9 years (age 26 and up)",
      years49,
      "indicative",
      ["ca-2026"],
      `Licensed 4 and 7 years ÷ 13 years (Basic liability-only and Standard full-coverage profiles): ${pct(years49)}, ${years49.n} comparisons. ${yearsWords}`,
    ),
  }

  // --- Mileage (California, Los Angeles only; clean single drivers).
  const LA = "Los Angeles Los Angeles - Central"
  const caMileage = (top: string, bottom: string) =>
    summarize(
      ratios(
        ca.filter((row) => row.territory === LA),
        ["110", "111", "112", "113", "114", "251", "252", "253", "254"].map((stem): [string, string] => [
          caProfile(`${stem}${top}`, "A"),
          caProfile(`${stem}${bottom}`, "A"),
        ]),
        "same",
      ),
    )
  const lowMiles = caMileage("1", "2")
  const highMiles = caMileage("3", "2")
  const txPleasure = summarize(ratios(tx, [["tx-base", "tx-pleasure"]], "same"))
  const mileageSourced: Record<string, FactorCell> = {
    "under-7500": cellFrom(
      "Under 7,500 miles a year",
      lowMiles,
      "sourced",
      ["ca-2026"],
      `California 2026, 5,000–7,500 miles ÷ 7,600–10,000 miles, same company, car, record, and years licensed, Los Angeles: ${pct(lowMiles)}, ${lowMiles.n} comparisons.`,
    ),
    "over-15000": cellFrom(
      "Over 15,000 miles a year",
      combine([highMiles, txPleasure]),
      "indicative",
      ["ca-2026", "tx-2025"],
      `Median of two rough comparisons. California 2026, 12,500–16,000 miles ÷ 7,600–10,000 miles, Los Angeles: ${pct(highMiles)}, ${highMiles.n} comparisons (only part of that band is over 15,000). Texas 2025, commuting 18,000 miles ÷ pleasure use 10,000 miles: ${pct(txPleasure)}, ${txPleasure.n} comparisons (use changes too).`,
    ),
  }

  // --- Bundling (California married profiles with and without a multi-policy discount).
  const bundle = summarize(
    ratios(
      ca,
      ["2555", "2565", "2592"].map((code): [string, string] => [`ca-${code}M`, `ca-${code}A`]),
      "same",
    ),
  )
  const bundleSourced: Record<string, FactorCell> = {
    yes: cellFrom(
      "Bundled with a home or renters policy",
      bundle,
      "sourced",
      ["ca-2026"],
      `California 2026, the same married household with and without a multi-policy discount (profiles 2555, 2565, 2592; full coverage), same company and place: ${pct(bundle)}, ${bundle.n} comparisons.`,
    ),
  }

  // --- Liability limits (Texas, liability-only sample rates).
  const txMinimum = summarize(ratios(tx, [["tx-base", "tx-limits100"]], "same"))
  const limitsSourced: Record<string, FactorCell> = {
    "state-minimum": cellFrom(
      "State-minimum liability limits",
      txMinimum,
      "sourced",
      ["tx-2025"],
      `Texas 2025, 30/60/25 (the Texas minimum) ÷ 100/300/100, liability only, same company, ZIP, and driver: ${pct(txMinimum)}, ${txMinimum.n} comparisons. Minimums differ by state, so the real difference in your state may be bigger or smaller.`,
    ),
  }

  // --- The rest: a reference, sourced cells, and assumptions for the gaps.
  const assumedGroup = (
    id: string,
    title: string,
    appliesTo: FactorGroup["appliesTo"],
    note: string,
    referenceKey: string,
    referenceLabel: string,
    sourced: Record<string, FactorCell> = {},
  ): FactorGroup => {
    const cells: Record<string, FactorCell> = {
      [referenceKey]: reference(referenceLabel, `The starting point for ${title.toLowerCase()}.`),
      ...sourced,
    }
    for (const [key, entry] of Object.entries(assumptions[id] ?? {})) {
      if (key in sourced) throw new Error(`${id}.${key} is sourced; delete its assumption`)
      // Entries without a value are filled in below from a related factor.
      if (entry.value !== null) cells[key] = assumed(entry)
    }
    if (id === "driving-experience") {
      // Nobody publishes a price for under a year of experience. It should
      // cost at least as much as 1–3 years, so we start from that factor and
      // only widen the top.
      const oneToThree = cells["1-3"]
      const entry = assumptions[id]?.["under-1"]
      if (!oneToThree || !entry) throw new Error("driving-experience needs 1-3 and an under-1 assumption")
      cells["under-1"] = assumed(entry, oneToThree.value, oneToThree.low, Math.round(oneToThree.high * 1.2))
    }
    if (id === "driving-experience") {
      cells["not-used"] = reference(
        "Not used under 26",
        "For drivers under 26 the age factor already covers being a new driver, so years licensed is not counted again.",
      )
    }
    return { title, appliesTo, note, cells }
  }
  // --- Premium split from ISO loss costs.
  const iso = parseCsv(need(files, "sources/iso-loss-costs-2024.csv"))
  const lossCost = (coverage: string) => {
    const row = iso.find((item) => item.coverage === coverage)
    if (!row) throw new Error(`ISO row ${coverage} missing`)
    return (Number(row.claim_frequency_per_100) / 100) * Number(row.claim_severity)
  }
  const bi = lossCost("bodily injury liability")
  const pd = lossCost("property damage liability")
  const coll = lossCost("collision")
  const comp = lossCost("comprehensive")
  const liabilityShare = (bi + pd) / (bi + pd + coll + comp)
  const splitAssumption = guess("premium-split", "liability") as AssumedEntry & { spreadLow: number; spreadHigh: number }
  const isoWords = `ISO 2024 paid-claim frequency × severity, as published by the Insurance Information Institute: bodily injury ${bi.toFixed(2)}, property damage ${pd.toFixed(2)}, collision ${coll.toFixed(2)}, comprehensive ${comp.toFixed(2)} dollars per car-year.`
  const premiumSplit: FactorGroup = {
    title: "How a full-coverage premium splits",
    appliesTo: "whole",
    note: "Shares, not multipliers. Vehicle, limit, and deductible factors only move their own share.",
    cells: {
      liability: {
        label: "Liability share of a full-coverage premium",
        value: toHundredths(liabilityShare),
        low: splitAssumption.spreadLow,
        high: splitAssumption.spreadHigh,
        basis: "indicative",
        sources: ["iso-via-iii-2024"],
        derivation: `${isoWords} Liability (bodily injury + property damage) is ${(liabilityShare * 100).toFixed(1)}% of the four. Rough because these are loss costs, not prices, and leave out uninsured-motorist, medical, and PIP coverage. The low and high edges are our estimate; help wanted.`,
        n: 4,
      },
      "collision-in-physical": {
        label: "Collision share of collision + comprehensive",
        value: toHundredths(coll / (coll + comp)),
        low: toHundredths(coll / (coll + comp)),
        high: toHundredths(coll / (coll + comp)),
        basis: "indicative",
        sources: ["iso-via-iii-2024"],
        derivation: `${isoWords} Collision ÷ (collision + comprehensive). Used to weight HLDI's collision and comprehensive results for a vehicle.`,
        n: 2,
      },
      "bodily-injury-in-liability": {
        label: "Bodily-injury share of liability",
        value: toHundredths(bi / (bi + pd)),
        low: toHundredths(bi / (bi + pd)),
        high: toHundredths(bi / (bi + pd)),
        basis: "indicative",
        sources: ["iso-via-iii-2024"],
        derivation: `${isoWords} Bodily injury ÷ (bodily injury + property damage). Used to weight HLDI's bodily-injury and property-damage results for a vehicle.`,
        n: 2,
      },
    },
  }
  const collisionShare = premiumSplit.cells["collision-in-physical"].value
  const biShare = premiumSplit.cells["bodily-injury-in-liability"].value
  const fullLiability = premiumSplit.cells.liability.value

  // --- Vehicles (HLDI).
  const hldiRows = parseCsv(need(files, "sources/hldi-2022-24.csv"))
  const models = hldiRows
    .map(hldiRow)
    .filter((row): row is VehicleLossRow => row !== null)
    .sort((left, right) => left.series.localeCompare(right.series))
  const subtotals = parseCsv(need(files, "sources/hldi-class-subtotals-2022-24.csv"))
  const combined = (liability: number, physical: number) =>
    (fullLiability * liability + (100 - fullLiability) * physical) / 100
  const relativities = (row: {
    bodilyInjury: number | null
    propertyDamage: number | null
    collision: number | null
    comprehensive: number | null
  }) => ({
    liability: weightedRelativity(row.bodilyInjury, row.propertyDamage, biShare),
    physical: weightedRelativity(row.collision, row.comprehensive, collisionShare),
  })

  const classes: Record<string, VehicleClassRow> = {}
  const classRatios: number[] = []
  for (const [classId, label] of Object.entries(families.classes)) {
    const subtotal = subtotals.find((row) => row.subtotal_label === label)
    if (!subtotal) throw new Error(`HLDI subtotal ${label} missing`)
    const rel = relativities({
      bodilyInjury: numberOrNull(subtotal.bodily_injury),
      propertyDamage: numberOrNull(subtotal.property_damage),
      collision: numberOrNull(subtotal.collision),
      comprehensive: numberOrNull(subtotal.comprehensive),
    })
    if (rel.liability === null || rel.physical === null) throw new Error(`HLDI subtotal ${label} incomplete`)
    const members = models.filter((row) => row.hldiClass === `${subtotal.body_class} / ${subtotal.size}`)
    for (const member of members) {
      const own = relativities(member)
      if (own.liability !== null && own.physical !== null) {
        classRatios.push(combined(own.liability, own.physical) / combined(rel.liability, rel.physical))
      }
    }
    const words = `HLDI 2022–24 class average "${label}" (${subtotal.body_class}, ${subtotal.size}), used for EPA class ${classId}. The mapping from EPA class to HLDI class is our judgment.${
      classId === "large-car"
        ? " EPA sizes cars by interior room, so its large class includes hatchbacks such as the Hyundai Ioniq; HLDI sizes by footprint and weight, so we use HLDI's midsize average."
        : ""
    }`
    classes[classId] = {
      hldiSubtotal: label,
      liability: {
        label: `${label}, liability share`,
        value: Math.round(rel.liability),
        low: Math.round(rel.liability),
        high: Math.round(rel.liability),
        basis: "indicative",
        sources: ["hldi-2022-24"],
        derivation: `${words} Bodily injury ${subtotal.bodily_injury || "—"} and property damage ${subtotal.property_damage || "—"}, weighted ${biShare}/${100 - biShare}.`,
        n: 1,
      },
      physical: {
        label: `${label}, damage share`,
        value: Math.round(rel.physical),
        low: Math.round(rel.physical),
        high: Math.round(rel.physical),
        basis: "indicative",
        sources: ["hldi-2022-24"],
        derivation: `${words} Collision ${subtotal.collision || "—"} and comprehensive ${subtotal.comprehensive || "—"}, weighted ${collisionShare}/${100 - collisionShare}.`,
        n: 1,
      },
    }
  }

  const electricClasses: Record<string, VehicleClassRow> = {}
  for (const [classId, [body, size]] of Object.entries(families.electricClassCells)) {
    const electric = models.filter(
      (row) => row.powertrain === "electric" && row.hldiClass === `${body} / ${size}`,
    )
    const liabilities = electric.map((row) => relativities(row).liability).filter((value): value is number => value !== null)
    const physicals = electric.map((row) => relativities(row).physical).filter((value): value is number => value !== null)
    if (liabilities.length < 3 || physicals.length < 3) continue
    const words = `Median of the ${electric.length} electric HLDI 2022–24 series we keep in ${body} / ${size} (${electric.map((row) => row.series).join("; ")}).`
    electricClasses[classId] = {
      hldiSubtotal: `Electric ${body} / ${size}`,
      liability: {
        label: `Electric ${body.toLowerCase()} (${size.toLowerCase()}), liability share`,
        value: Math.round(percentile(liabilities, 0.5)),
        low: Math.round(percentile(liabilities, 0.25)),
        high: Math.round(percentile(liabilities, 0.75)),
        basis: "indicative",
        sources: ["hldi-2022-24"],
        derivation: `${words} Liability relativity per series, weighted as above.`,
        n: liabilities.length,
      },
      physical: {
        label: `Electric ${body.toLowerCase()} (${size.toLowerCase()}), damage share`,
        value: Math.round(percentile(physicals, 0.5)),
        low: Math.round(percentile(physicals, 0.25)),
        high: Math.round(percentile(physicals, 0.75)),
        basis: "indicative",
        sources: ["hldi-2022-24"],
        derivation: `${words} Damage relativity per series, weighted as above.`,
        n: physicals.length,
      },
    }
  }

  const allCombined = models
    .map((row) => relativities(row))
    .filter((rel): rel is { liability: number; physical: number } => rel.liability !== null && rel.physical !== null)
    .map((rel) => combined(rel.liability, rel.physical) / 100)
  const classSpread = summarize(classRatios)
  const unknownSpread = summarize(allCombined)

  // --- Range cells.
  const typicalSummary = combine([ok, nd, tx, ca, co].map((rows) => summarize(dispersion(rows))))
  const rangeAssumption = (key: string) => assumed(guess("range", key))
  const range: FactorGroup = {
    title: "How wide the range is",
    appliesTo: "whole",
    note: "Not multipliers. Each one says how much less or more a real price could be when that thing changes.",
    cells: {
      "typical-start": {
        label: "Starting from a typical price instead of your own",
        value: 100,
        low: toHundredths(typicalSummary.p25),
        high: toHundredths(typicalSummary.p75),
        basis: "sourced",
        sources: ["ok-2026", "nd-2026", "tx-2025", "ca-2026", "co-2023"],
        derivation: `How far companies' prices sit from the middle company for the same driver, car, and place: each premium ÷ the median premium for that profile and place (groups of 5 or more companies). Oklahoma 2026, North Dakota 2026, Texas 2025, California 2026, and Colorado 2023; median of the five states' 25th and 75th percentiles; ${typicalSummary.n} premiums.`,
        n: typicalSummary.n,
      },
      "vehicle-model": rangeAssumption("vehicle-model"),
      "vehicle-model-years": rangeAssumption("vehicle-model-years"),
      "vehicle-class": {
        label: "Using a class average instead of the exact model",
        value: 100,
        low: Math.min(100, toHundredths(classSpread.p25)),
        high: Math.max(100, toHundredths(classSpread.p75)),
        basis: "indicative",
        sources: ["hldi-2022-24"],
        derivation: `How far the HLDI series we keep sit from their class average, full-coverage weighting: 25th and 75th percentiles over ${classSpread.n} series.`,
        n: classSpread.n,
      },
      "vehicle-unknown": {
        label: "Vehicle not recognized",
        value: 100,
        low: Math.min(100, toHundredths(unknownSpread.p25)),
        high: Math.max(100, toHundredths(unknownSpread.p75)),
        basis: "indicative",
        sources: ["hldi-2022-24"],
        derivation: `How far the HLDI series we keep sit from the all-vehicle average (100), full-coverage weighting: 25th and 75th percentiles over ${unknownSpread.n} series.`,
        n: unknownSpread.n,
      },
      "trim-limited": rangeAssumption("trim-limited"),
      "trim-unresolved": rangeAssumption("trim-unresolved"),
      "state-unknown": rangeAssumption("state-unknown"),
      "state-typical": rangeAssumption("state-typical"),
    },
  }

  const groups: Record<string, FactorGroup> = {
    "driver-age": driverAge,
    "driving-experience": assumedGroup(
      "driving-experience",
      "Years licensed",
      "whole",
      "Only used from age 26. For younger drivers the age factor already covers being new.",
      "10+",
      "Licensed 10 or more years",
      experienceSourced,
    ),
    "driving-record": drivingRecord,
    "annual-mileage": assumedGroup(
      "annual-mileage",
      "Yearly mileage",
      "whole",
      "Miles driven a year.",
      "7500-15000",
      "7,500–15,000 miles a year",
      mileageSourced,
    ),
    "good-student": assumedGroup("good-student", "Good student", "whole", "Drivers under 26.", "no", "No good-student discount"),
    "driver-training": assumedGroup(
      "driver-training",
      "Driver training",
      "whole",
      "Drivers under 22.",
      "no",
      "No driver-training discount",
    ),
    "multi-policy": assumedGroup("multi-policy", "Bundling", "whole", "Home or renters policy with the same company.", "no", "Not bundled", bundleSourced),
    area,
    "liability-limits": assumedGroup(
      "liability-limits",
      "Liability limits",
      "liability",
      "How much the policy pays others. Moves only the liability share.",
      "100-300-100",
      "100/300/100 limits",
      limitsSourced,
    ),
    deductible: assumedGroup(
      "deductible",
      "Deductible",
      "physical",
      "What you pay first on a collision or comprehensive claim. Moves only the damage share.",
      "1000",
      "$1,000 deductible",
    ),
    "loan-lease": assumedGroup("loan-lease", "Loan or lease", "physical", "Moves only the damage share.", "no", "Owned outright"),
    "vehicle-age": assumedGroup(
      "vehicle-age",
      "Vehicle age",
      "physical",
      `Years since the model year, counted from ${EFFECTIVE_DATE.slice(0, 4)}. Moves only the damage share.`,
      "0-3",
      "Vehicle 0–3 years old",
    ),
    "premium-split": premiumSplit,
    range,
  }

  return {
    version: DERIVATION_VERSION,
    effectiveDate: EFFECTIVE_DATE,
    checkedOn: CHECKED_ON,
    scale: 100,
    formula:
      "estimate = starting premium × index(new) ÷ index(start), where index = driver and area factors × (liability share × limits × vehicle liability + damage share × deductible × loan or lease × vehicle age × vehicle damage)",
    changelogNote:
      "Factors now come from public sources where we could find them: state insurance-department price surveys (Oklahoma, North Dakota, District of Columbia), North Carolina's accident surcharge rule, ISO loss costs, and HLDI losses by make and model. Everything else is labeled as our estimate and widens the range. The separate teen switch is gone; the 16–18 age band is the teen factor.",
    sources: sources.sources,
    groups,
    vehicle: {
      sourceId: "hldi-2022-24",
      modelYears: "2022-24",
      yearMin: 2022,
      yearMax: 2024,
      note: "HLDI insurance losses for 2022–24 models, 100 = the average vehicle. Collision and comprehensive move only the damage share of the premium; property-damage and bodily-injury liability move only the liability share. When we don't have the exact model, we use the class average.",
      models,
      aliases: families.aliases,
      classes,
      electricClasses,
    },
  }
}
