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
import { VEHICLE_CLASS_LABELS, type VehicleClassId } from "./catalog-class"
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

/** A ratio as a plain change: "+16%", "6% less", or "no change". */
export function change(ratio: number): string {
  const percent = Math.round(ratio * 100 - 100)
  if (percent === 0) return "no change"
  return percent > 0 ? `+${percent}%` : `${-percent}% less`
}

function pct(summary: Summary): string {
  return `${change(summary.median)} (median ratio ${summary.median.toFixed(3)}; middle half of companies ${change(summary.p25)} to ${change(summary.p75)})`
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

/** Body words in an HLDI model name. Empty for the plain version. */
export function hldiBody(model: string): string[] {
  const value = model.toLowerCase()
  const tags: string[] = []
  if (/\bconvertible\b/.test(value)) tags.push("convertible")
  if (/\bhatchback\b/.test(value)) tags.push("hatchback")
  if (/\bwagon\b/.test(value)) tags.push("wagon")
  if (/\b2dr\b/.test(value)) tags.push("2dr")
  return tags
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
    body: hldiBody(row.model),
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
  useHldiModels: boolean
  luxuryMakes: string[]
  luxuryClasses: Record<string, string>
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
  const urbanSummary = combine([okArea, ndArea, txArea, caArea, coArea])
  const urbanStates = [okArea, ndArea, txArea, caArea, coArea].map((item) => item.median)
  const urbanCell = cellFrom(
    "Urban",
    urbanSummary,
    "sourced",
    ["ok-2026", "nd-2026", "tx-2025", "ca-2026", "co-2023"],
    `Same company and driver, city versus rural area, in five states. Oklahoma 2026, Oklahoma City and Tulsa ÷ Woodward and McAlester: ${pct(okArea)}, ${okArea.n} comparisons. North Dakota 2026, Fargo ÷ "Remainder of State" (Examples 1–3, 5–12): ${pct(ndArea)}, ${ndArea.n}. Texas 2025, Houston and Dallas ÷ Plainview and Alpine: ${pct(txArea)}, ${txArea.n}. California 2026, Los Angeles Central ÷ Alturas: ${pct(caArea)}, ${caArea.n}. Colorado 2023, Denver and Colorado Springs ÷ Sterling, Alamosa, and Craig: ${pct(coArea)}, ${coArea.n}. The value is the middle of the five state medians. The states disagree a lot, so the low and high edges are the lowest and highest state medians (${change(Math.min(...urbanStates))} to ${change(Math.max(...urbanStates))}), not the spread between companies.`,
  )
  urbanCell.low = Math.min(urbanCell.value, toHundredths(Math.min(...urbanStates)))
  urbanCell.high = Math.max(urbanCell.value, toHundredths(Math.max(...urbanStates)))

  // Suburbs: only Texas, California, and Colorado publish a suburb, a city,
  // and a rural area. Those three states have bigger city-versus-rural gaps
  // than the five-state middle, so their direct suburb ÷ rural figure would
  // put suburbs above cities. Instead we take where the suburb sits between
  // rural and city in each state, on a multiplying scale:
  // position = ln(suburb ÷ rural) ÷ ln(city ÷ rural), and apply the middle
  // position to the five-state urban factor.
  const txSubRural = summarize(ratios(tx, same(profilesOf(tx)), cross(TX_SUBURB, TX_RURAL)))
  const caSubRural = summarize(ratios(ca, same(profilesOf(ca)), cross(CA_SUBURB, CA_RURAL)))
  const coSubRural = summarize(ratios(co, same(profilesOf(co)), cross(CO_SUBURB, CO_RURAL)))
  const txSubCity = summarize(ratios(tx, same(profilesOf(tx)), cross(TX_SUBURB, TX_URBAN)))
  const caSubCity = summarize(ratios(ca, same(profilesOf(ca)), cross(CA_SUBURB, CA_URBAN)))
  const coSubCity = summarize(ratios(co, same(profilesOf(co)), cross(CO_SUBURB, CO_URBAN)))
  const positions = [
    Math.log(txSubRural.median) / Math.log(txArea.median),
    Math.log(caSubRural.median) / Math.log(caArea.median),
    Math.log(coSubRural.median) / Math.log(coArea.median),
  ]
  const position = percentile(positions, 0.5)
  const directSuburb = combine([txSubRural, caSubRural, coSubRural])
  const chainedSuburb = chain(combine([txSubCity, caSubCity, coSubCity]), urbanSummary)
  const suburbanValue = Math.pow(urbanSummary.median, position)
  const suburbStates = [txSubRural, caSubRural, coSubRural].map((item) => item.median)
  const suburbanCell: FactorCell = {
    label: "Suburban",
    value: toHundredths(suburbanValue),
    low: Math.min(toHundredths(suburbanValue), toHundredths(Math.min(...suburbStates))),
    high: Math.max(toHundredths(suburbanValue), toHundredths(Math.max(...suburbStates))),
    basis: "indicative",
    sources: ["tx-2025", "ca-2026", "co-2023", "ok-2026", "nd-2026"],
    derivation: `Rough. Only Texas, California, and Colorado publish a suburb, a city, and a rural area. Direct suburb ÷ rural, same company and driver: Texas 2025, Plano ÷ Plainview and Alpine: ${pct(txSubRural)}, ${txSubRural.n} comparisons. California 2026, Irvine ÷ Alturas: ${pct(caSubRural)}, ${caSubRural.n}. Colorado 2023, Highlands Ranch ÷ Sterling, Alamosa, and Craig: ${pct(coSubRural)}, ${coSubRural.n}. The middle of those three is ${change(directSuburb.median)}, which is above our five-state urban factor (${change(urbanSummary.median)}), because these three states have bigger city-versus-rural gaps than the others. Multiplying suburb ÷ city in the same three states (${change(combine([txSubCity, caSubCity, coSubCity]).median)}) by the urban factor gives ${change(chainedSuburb.median)}. We use neither. We measure where each state's suburb sits between its rural area and its city on a multiplying scale (Texas ${positions[0].toFixed(2)}, California ${positions[1].toFixed(2)}, Colorado ${positions[2].toFixed(2)} of the way), take the middle (${position.toFixed(2)}), and apply it to the urban factor: ${change(suburbanValue)}. The low and high edges are the lowest and highest direct suburb ÷ rural figures.`,
    n: txSubRural.n + caSubRural.n + coSubRural.n,
  }
  const area: FactorGroup = {
    title: "Area",
    appliesTo: "whole",
    note: "Where the car is kept. Rural is the starting point.",
    cells: {
      urban: urbanCell,
      suburban: suburbanCell,
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
  // A teen added to a parent's policy. California 2026 publishes a married
  // couple with a 17-year-old (2565) and a younger married couple without one
  // (2555), both full coverage on two family cars.
  const teenAdded = summarize(
    ratios(
      ca,
      [
        ["ca-2565A", "ca-2555A"],
        ["ca-2565M", "ca-2555M"],
      ],
      "same",
    ),
  )
  const age1618Added = cellFrom(
    "16–18, added to a parent's policy",
    teenAdded,
    "indicative",
    ["ca-2026"],
    `The whole household's premium after adding a teen, compared with before. California 2026, profile 2565 (married couple licensed 28 and 25 years, plus a 17-year-old licensed 1 year who "drives pleasure use only"; Camry 20,000 miles and Highlander 12,000 miles) ÷ profile 2555 (married couple licensed 13 and 10 years; Camry and Sienna, 15,000 miles each), with and without a multi-policy discount, same company and place: ${pct(teenAdded)}, ${teenAdded.n} comparisons. Rough, because the two households also differ in the parents' experience, the second car, and mileage, and because both are two-car households. California rates by years licensed, not age. Used only when you ask for a teen added to your own policy.`,
  )

  const driverAge: FactorGroup = {
    title: "Driver age",
    appliesTo: "whole",
    note: "The main driver's age. 16–18 is the teen factor; there is no separate teen switch.",
    cells: {
      "16-18": age1618,
      "16-18-added": age1618Added,
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
        `Median of three states. California 2026, one at-fault accident ÷ clean, same company, place, car, and years licensed (single-driver profiles, liability-only and full coverage): ${pct(caAccident)}, ${caAccident.n} comparisons; CDI says its survey premiums are "before any applicable discounts are applied", and company footnotes list California's Good Driver discount as one of those discounts (for example "California Good Driver Discount 30%" and "20% Good Driver Discount"). So the clean figures leave that discount out, and a California driver who loses it after an accident probably sees a bigger jump than this. Texas 2025, one at-fault accident ÷ clean (liability only): ${pct(txAccident)}, ${txAccident.n} comparisons. North Carolina's Safe Driver Incentive Plan, set by state law: ${surcharge("1")}% for a small accident, ${surcharge("2")}% for a medium one, and ${surcharge("3")}% for $3,850 or more of damage or an injury; we count it as a median of ${surcharge("3")}% (typical claims are above $3,850) with ${surcharge("1")}% as the low edge.`,
      ),
      "two-or-more": assumed(guess("driving-record", "two-or-more")),
    },
  }

  // --- Years licensed (California rates by years licensed, not age).
  const caYears = (codes: [string, string][]) =>
    summarize(ratios(ca, codes.map(([top, bottom]) => [caProfile(top, "A"), caProfile(bottom, "A")]), "same"))
  // California bans age as a rating factor, so its years-licensed factor
  // also carries the youth of newly licensed drivers. We only use years
  // licensed from age 26, so California's figure is an upper bound, not the
  // answer. The cap keeps a 26+ driver with little experience below a young
  // driver: factor(19–21) ÷ factor(26–39).
  const experienceCap = age1921.value / age2539.value
  const experienceEstimate = (label: string, summary: Summary, what: string): FactorCell => {
    const upper = Math.min(summary.median, experienceCap)
    const value = Math.sqrt(upper)
    return {
      label,
      value: toHundredths(value),
      low: 100,
      high: toHundredths(upper),
      basis: "assumed",
      sources: [],
      derivation: `Our estimate. No public source yet; help wanted. California 2026 (${what}): ${pct(summary)}, ${summary.n} comparisons. But California does not allow age as a rating factor (10 CCR §2632.5), so its newly licensed drivers are mostly young, and its years-licensed figure includes the youth effect our age factor already counts. We treat it as an upper bound, capped at the 19–21 age factor ÷ the 26–39 age factor (${experienceCap.toFixed(2)}), so an experienced-age driver never costs more than a young one. We don't know how much of the gap is experience and how much is age, so we take the middle of 1.00 and that upper bound on a multiplying scale (the square root). The range runs from 1.00 to the upper bound.`,
      n: null,
    }
  }
  const years13 = caYears([["1102", "1132"]])
  const years49 = caYears([
    ["1112", "1132"],
    ["1122", "1132"],
    ["2512", "2532"],
    ["2522", "2532"],
  ])
  const oneToThree = experienceEstimate("Licensed 1–3 years (age 26 and up)", years13, "licensed 2 years ÷ 13 years, liability only")
  const newDriverCap = age1618.value / age2539.value
  const experienceSourced: Record<string, FactorCell> = {
    "1-3": oneToThree,
    "4-9": experienceEstimate(
      "Licensed 4–9 years (age 26 and up)",
      years49,
      "licensed 4 and 7 years ÷ 13 years, liability-only and full-coverage profiles",
    ),
    "under-1": {
      ...oneToThree,
      label: "Licensed under 1 year (age 26 and up)",
      high: Math.max(oneToThree.value, Math.min(Math.round(oneToThree.high * 1.2), Math.round(newDriverCap * 100))),
      derivation: `Our estimate. No public source yet; help wanted. No survey we found prices a driver licensed under a year, and California, which does not allow age as a rating factor (10 CCR §2632.5), only goes down to 2 years. We use the 1–3 year estimate and raise the top of the range by a fifth, capped at the 16–18 age factor ÷ the 26–39 age factor (${newDriverCap.toFixed(2)}).`,
    },
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
      cells[key] = assumed(entry)
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
  const isoLiabilityShare = (bi + pd) / (bi + pd + coll + comp)
  const baselines = JSON.parse(need(files, "state-baselines.json")) as {
    countrywide: { liabilityAveragePremium: number; combinedAveragePremium: number }
  }
  const naicLiability = baselines.countrywide.liabilityAveragePremium
  const naicCombined = baselines.countrywide.combinedAveragePremium
  const liabilityShare = naicLiability / naicCombined
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
        sources: ["naic-auto-db-2022-2023", "iso-via-iii-2024"],
        derivation: `NAIC 2023 countrywide average liability premium $${naicLiability.toFixed(2)} ÷ combined average premium (liability + collision + comprehensive) $${naicCombined.toFixed(2)} = ${(liabilityShare * 100).toFixed(1)}%. Source: NAIC, 2022/2023 Auto Insurance Database Report, 2023 data (the same figures as data/state-baselines). For comparison, ISO's 2024 claim costs give ${(isoLiabilityShare * 100).toFixed(1)}%. Rough because it's an average across all insured cars and states. The low and high edges are our estimate; help wanted.`,
        n: 2,
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
  // The per-model rows are one file behind one switch, so they can be removed
  // cleanly. Without them every vehicle uses its class average (from HLDI's
  // class subtotals); without those too, every vehicle is "not recognized".
  const hldiText = files["sources/hldi-2022-24.csv"]
  const modelsEnabled = families.useHldiModels && hldiText !== undefined
  const models = modelsEnabled
    ? parseCsv(hldiText)
        .map(hldiRow)
        .filter((row): row is VehicleLossRow => row !== null)
        .sort((left, right) => left.series.localeCompare(right.series))
    : []
  const subtotalText = files["sources/hldi-class-subtotals-2022-24.csv"]
  const subtotals = subtotalText === undefined ? [] : parseCsv(subtotalText)
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

  // How much of HLDI's liability result to pass on. Insurers rate liability
  // by vehicle much less than their loss data would suggest: ISO's liability
  // symbol plan moves liability premiums at most +25% and −20% by vehicle. We
  // pick the largest weight that keeps the middle 90% of the HLDI liability
  // results we keep inside that band, and cap every vehicle at the band.
  const isoSymbols = parseCsv(need(files, "sources/iso-liability-symbols-2004.csv"))
  const symbolPercent = (measure: string) => {
    const row = isoSymbols.find((item) => item.measure === measure)
    if (!row) throw new Error(`ISO symbols row ${measure} missing`)
    return Number(row.percent)
  }
  const surchargeMax = symbolPercent("largest surcharge")
  const discountMax = symbolPercent("largest discount")
  const hldiLiabilities = (models.length > 0 ? models : [])
    .map((row) => relativities(row).liability)
    .filter((value): value is number => value !== null)
    .map((value) => value / 100)
  const p05 = hldiLiabilities.length > 0 ? percentile(hldiLiabilities, 0.05) : 1
  const p95 = hldiLiabilities.length > 0 ? percentile(hldiLiabilities, 0.95) : 1
  const weightUp = p95 > 1 ? surchargeMax / 100 / (p95 - 1) : 1
  const weightDown = p05 < 1 ? discountMax / 100 / (1 - p05) : 1
  const weight = Math.min(1, weightUp, weightDown)
  const liabilityWeight: FactorCell = {
    label: "How much of a vehicle's liability losses we pass on",
    value: toHundredths(weight),
    low: toHundredths(weight / 2),
    high: toHundredths(Math.min(1, weight * 1.5)),
    basis: "assumed",
    sources: [],
    derivation: `Our estimate, and our judgment; help wanted. HLDI's liability results by vehicle spread widely (the middle 90% of the ${hldiLiabilities.length} series we keep run from ${change(p05)} to ${change(p95)}), but insurers move liability prices by vehicle much less: ISO's liability symbol plan, as reported by Insurance Journal in 2004, allows surcharges "of up to 25 percent and discounts of up to 20 percent". We pass on the largest share of HLDI's liability result that keeps that middle 90% inside +${surchargeMax}% and ${discountMax}% less, and keep every vehicle inside that band: liability factor = 1 + ${weight.toFixed(2)} × (HLDI − 1). Collision and comprehensive results are passed on in full. The range allows half to one and a half times this weight.`,
    n: null,
  }

  const plainClass = (classId: string) => VEHICLE_CLASS_LABELS[classId as VehicleClassId] ?? classId
  // Lower-case the first letter, but leave acronyms such as "SUV" alone.
  const lower = (value: string) => (/^[A-Z]{2}/.test(value) ? value : value.charAt(0).toLowerCase() + value.slice(1))
  const classRow = (
    classId: string,
    label: string,
    words: string,
    kind: "" | "Luxury " | "Electric ",
  ): VehicleClassRow | null => {
    const subtotal = subtotals.find((row) => row.subtotal_label === label)
    if (!subtotal) return null
    const rel = relativities({
      bodilyInjury: numberOrNull(subtotal.bodily_injury),
      propertyDamage: numberOrNull(subtotal.property_damage),
      collision: numberOrNull(subtotal.collision),
      comprehensive: numberOrNull(subtotal.comprehensive),
    })
    if (rel.liability === null || rel.physical === null) throw new Error(`HLDI subtotal ${label} incomplete`)
    const name = kind ? `${kind}${lower(plainClass(classId))}` : plainClass(classId)
    return {
      hldiSubtotal: label,
      liability: {
        label: `${name}: damage and injuries you cause`,
        value: Math.round(rel.liability),
        low: Math.round(rel.liability),
        high: Math.round(rel.liability),
        basis: "indicative",
        sources: ["hldi-2022-24"],
        derivation: `${words} Bodily injury ${subtotal.bodily_injury || "—"} and property damage ${subtotal.property_damage || "—"}, weighted ${biShare}/${100 - biShare}, before the liability weight.`,
        n: 1,
      },
      physical: {
        label: `${name}: damage to your own car`,
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
  const memberRatios = (label: string, into: number[]) => {
    const subtotal = subtotals.find((row) => row.subtotal_label === label)
    if (!subtotal) return
    const rel = relativities({
      bodilyInjury: numberOrNull(subtotal.bodily_injury),
      propertyDamage: numberOrNull(subtotal.property_damage),
      collision: numberOrNull(subtotal.collision),
      comprehensive: numberOrNull(subtotal.comprehensive),
    })
    if (rel.liability === null || rel.physical === null) return
    for (const member of models.filter((row) => row.hldiClass === `${subtotal.body_class} / ${subtotal.size}`)) {
      const own = relativities(member)
      if (own.liability !== null && own.physical !== null) {
        into.push(combined(own.liability, own.physical) / combined(rel.liability, rel.physical))
      }
    }
  }

  const classes: Record<string, VehicleClassRow> = {}
  const classRatios: number[] = []
  for (const [classId, label] of Object.entries(families.classes)) {
    const words = `HLDI 2022–24 class average "${label}", used for the EPA-based class "${plainClass(classId)}". Which HLDI class stands in for which EPA class is our judgment.${
      classId === "large-car"
        ? " EPA sizes cars by interior room, so its large class includes hatchbacks such as the Hyundai Ioniq; HLDI sizes by footprint and weight, so we use HLDI's midsize average."
        : ""
    }`
    const row = classRow(classId, label, words, "")
    if (row) classes[classId] = row
    memberRatios(label, classRatios)
  }

  const luxuryClasses: Record<string, VehicleClassRow> = {}
  const luxuryRatios: number[] = []
  for (const [classId, label] of Object.entries(families.luxuryClasses)) {
    const words = `HLDI 2022–24 class average "${label}", used for the class "${plainClass(classId)}" from makes HLDI mostly files as luxury or sports cars (see vehicle-families.json). The mapping is our judgment.`
    const row = classRow(classId, label, words, "Luxury ")
    if (row) luxuryClasses[classId] = row
    memberRatios(label, luxuryRatios)
  }

  const electricClasses: Record<string, VehicleClassRow> = {}
  for (const [classId, [body, size]] of Object.entries(families.electricClassCells)) {
    const electric = models.filter(
      (row) => row.powertrain === "electric" && row.hldiClass === `${body} / ${size}`,
    )
    const liabilities = electric.map((row) => relativities(row).liability).filter((value): value is number => value !== null)
    const physicals = electric.map((row) => relativities(row).physical).filter((value): value is number => value !== null)
    if (liabilities.length < 3 || physicals.length < 3) continue
    const name = `Electric ${lower(plainClass(classId))}`
    const words = `Middle of the ${electric.length} electric HLDI 2022–24 series we keep in HLDI's ${body} / ${size} class (${electric.map((row) => row.series).join("; ")}).`
    electricClasses[classId] = {
      hldiSubtotal: `Electric ${body} / ${size}`,
      liability: {
        label: `${name}: damage and injuries you cause`,
        value: Math.round(percentile(liabilities, 0.5)),
        low: Math.round(percentile(liabilities, 0.25)),
        high: Math.round(percentile(liabilities, 0.75)),
        basis: "indicative",
        sources: ["hldi-2022-24"],
        derivation: `${words} Liability result per series, weighted as above, before the liability weight.`,
        n: liabilities.length,
      },
      physical: {
        label: `${name}: damage to your own car`,
        value: Math.round(percentile(physicals, 0.5)),
        low: Math.round(percentile(physicals, 0.25)),
        high: Math.round(percentile(physicals, 0.75)),
        basis: "indicative",
        sources: ["hldi-2022-24"],
        derivation: `${words} Damage result per series, weighted as above.`,
        n: physicals.length,
      },
    }
  }

  const allCombined = models
    .map((row) => relativities(row))
    .filter((rel): rel is { liability: number; physical: number } => rel.liability !== null && rel.physical !== null)
    .map((rel) => combined(rel.liability, rel.physical) / 100)
  const spreadOf = (values: number[], fallback: Summary): Summary => (values.length >= 5 ? summarize(values) : fallback)
  const wide: Summary = { median: 1, p25: 0.8, p75: 1.25, n: 0 }
  const classSpread = spreadOf(classRatios, wide)
  const luxurySpread = spreadOf(luxuryRatios, wide)
  const unknownSpread = spreadOf(allCombined, wide)
  const luxuryHldiClasses = new Set(
    subtotals
      .filter((row) => Object.values(families.luxuryClasses).includes(row.subtotal_label))
      .map((row) => `${row.body_class} / ${row.size}`),
  )
  const luxuryCombined = models
    .filter((row) => luxuryHldiClasses.has(row.hldiClass))
    .map((row) => relativities(row))
    .filter((rel): rel is { liability: number; physical: number } => rel.liability !== null && rel.physical !== null)
    .map((rel) => combined(rel.liability, rel.physical) / 100)
  const unknownLuxurySpread = spreadOf(luxuryCombined, { median: 1, p25: 0.8, p75: 1.6, n: 0 })

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
      "vehicle-mixed-powertrain": rangeAssumption("vehicle-mixed-powertrain"),
      "vehicle-luxury-class": {
        label: "Using a luxury class average instead of the exact model",
        value: 100,
        low: Math.min(100, toHundredths(luxurySpread.p25)),
        high: Math.max(100, toHundredths(luxurySpread.p75)),
        basis: luxurySpread.n > 0 ? "indicative" : "assumed",
        sources: luxurySpread.n > 0 ? ["hldi-2022-24"] : [],
        derivation:
          luxurySpread.n > 0
            ? `How far the HLDI luxury and sports-car series we keep sit from their class average, full-coverage weighting: 25th and 75th percentiles over ${luxurySpread.n} series.`
            : "Our estimate. No public source yet; help wanted. Without HLDI's model rows we use a wide spread.",
        n: luxurySpread.n > 0 ? luxurySpread.n : null,
      },
      "vehicle-class": {
        label: "Using a class average instead of the exact model",
        value: 100,
        low: Math.min(100, toHundredths(classSpread.p25)),
        high: Math.max(100, toHundredths(classSpread.p75)),
        basis: classSpread.n > 0 ? "indicative" : "assumed",
        sources: classSpread.n > 0 ? ["hldi-2022-24"] : [],
        derivation:
          classSpread.n > 0
            ? `How far the HLDI series we keep sit from their class average, full-coverage weighting: 25th and 75th percentiles over ${classSpread.n} series.`
            : "Our estimate. No public source yet; help wanted. Without HLDI's model rows we use a wide spread.",
        n: classSpread.n > 0 ? classSpread.n : null,
      },
      "vehicle-unknown": {
        label: "Vehicle not recognized",
        value: 100,
        low: Math.min(100, toHundredths(unknownSpread.p25)),
        high: Math.max(100, toHundredths(unknownSpread.p75)),
        basis: unknownSpread.n > 0 ? "indicative" : "assumed",
        sources: unknownSpread.n > 0 ? ["hldi-2022-24"] : [],
        derivation:
          unknownSpread.n > 0
            ? `How far the HLDI series we keep sit from the all-vehicle average (100), full-coverage weighting: 25th and 75th percentiles over ${unknownSpread.n} series.`
            : "Our estimate. No public source yet; help wanted. Without HLDI's model rows we use a wide spread.",
        n: unknownSpread.n > 0 ? unknownSpread.n : null,
      },
      "vehicle-unknown-luxury": {
        label: "Luxury or sports vehicle not recognized",
        value: 100,
        low: Math.min(100, toHundredths(unknownLuxurySpread.p25)),
        high: Math.max(100, toHundredths(unknownLuxurySpread.p75)),
        basis: unknownLuxurySpread.n > 0 ? "indicative" : "assumed",
        sources: unknownLuxurySpread.n > 0 ? ["hldi-2022-24"] : [],
        derivation:
          unknownLuxurySpread.n > 0
            ? `How far the HLDI luxury and sports-car series we keep sit from the all-vehicle average (100), full-coverage weighting: 25th and 75th percentiles over ${unknownLuxurySpread.n} series. Used for a luxury make when we can't tell what kind of vehicle it is.`
            : "Our estimate. No public source yet; help wanted. Without HLDI's model rows we use a wide spread.",
        n: unknownLuxurySpread.n > 0 ? unknownLuxurySpread.n : null,
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
      "Factors now come from public sources where we could find them: state insurance-department price surveys from Oklahoma, North Dakota, the District of Columbia, Texas, California, and Colorado; North Carolina's accident surcharge rule; NAIC and ISO premium and claim figures; and HLDI insurance losses by make and model. Everything else is labeled as our estimate and widens the range. The separate teen switch is gone; the 16–18 age band is the teen factor. Vehicle liability results are passed on only partly, the way insurers' vehicle ratings do.",
    sources: sources.sources,
    groups,
    vehicle: {
      modelsEnabled,
      sourceId: "hldi-2022-24",
      modelYears: "2022-24",
      yearMin: 2022,
      yearMax: 2024,
      note: "HLDI insurance losses for 2022–24 models, 100 = the average vehicle. Collision and comprehensive move only the damage share of the premium, in full. Property-damage and bodily-injury liability move only the liability share, and only partly (see the liability weight). When we don't have the exact model, we use the class average.",
      models,
      aliases: families.aliases,
      classes,
      electricClasses,
      luxuryClasses,
      luxuryMakes: families.luxuryMakes.map((make) => compactName(make)),
      liabilityWeight,
      liabilityFloor: 100 - discountMax,
      liabilityCap: 100 + surchargeMax,
    },
  }
}
