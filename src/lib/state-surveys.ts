/**
 * State insurance department rate-comparison surveys and surcharge schedules
 * from data/factors/sources/*.csv. Every figure is computed directly from the
 * committed CSVs—never hand-typed—and carries its source, vintage, check date,
 * and exact sample profile description.
 */
import { readFileSync } from "node:fs"
import { join } from "node:path"
import sourcesFile from "../../data/factors/sources/sources.json"
import { EXCLUDED_CARRIERS, parseCsv, percentile } from "./factor-derivation"
import { dollars } from "./format"
import type { StateCode } from "./scenario"

export type SurveyPlaceRow = {
  /** Territory or city name as shown on the page. */
  place: string
  /** Raw territory string in the CSV. */
  territory: string
  /** Number of companies with a positive rate in this place for this profile. */
  carrierCount: number
  /** Median yearly premium across companies, rounded to the nearest dollar. */
  median: number
  /** Lowest company's yearly premium, rounded to the nearest dollar. */
  low: number
  /** Highest company's yearly premium, rounded to the nearest dollar. */
  high: number
}

export type SurveyProfileTable = {
  profileId: string
  /** Short column or table heading for this sample profile. */
  shortLabel: string
  /** Exact profile and coverage description from the CSV and README.md. */
  profileDescription: string
  /** CSV description field verbatim, for verification tests. */
  csvDescription: string
  places: SurveyPlaceRow[]
}

export type StateRateSurvey = {
  kind: "rate-survey"
  state: StateCode
  sourceId: string
  title: string
  publisher: string
  url: string
  dataYear: string
  effectiveNote: string
  checkedOn: string
  heading: string
  intro: string
  caveat: string
  profiles: SurveyProfileTable[]
}

export type NcSdipRow = {
  points: number
  surchargePercent: number
  whatCounts: string
}

export type StateSurchargeSchedule = {
  kind: "surcharge-schedule"
  state: "NC"
  sourceId: string
  title: string
  publisher: string
  url: string
  dataYear: string
  checkedOn: string
  heading: string
  intro: string
  caveat: string
  rows: NcSdipRow[]
}

export type StateSurveySection = StateRateSurvey | StateSurchargeSchedule

const SOURCES_DIR = join(process.cwd(), "data/factors/sources")

function sourceMeta(id: string) {
  const found = sourcesFile.sources.find((item) => item.id === id)
  if (!found) throw new Error(`Missing source ${id} in data/factors/sources/sources.json`)
  return found
}

function readCsv(filename: string): Record<string, string>[] {
  return parseCsv(readFileSync(join(SOURCES_DIR, filename), "utf8"))
}

const PLACE_LABELS: Record<string, string> = {
  "Houston 77036 (Harris County)": "Houston 77036 (Harris County)",
  "Dallas 75216 (Dallas County)": "Dallas 75216 (Dallas County)",
  "Plano 75023 (Collin County)": "Plano 75023 (Collin County)",
  "Plainview 79072 (Hale County)": "Plainview 79072 (Hale County)",
  "Alpine 79830 (Brewster County)": "Alpine 79830 (Brewster County)",
  "Los Angeles Los Angeles - Central": "Los Angeles (Central)",
  "Orange Irvine": "Irvine (Orange County)",
  "Modoc Alturas": "Alturas (Modoc County)",
  "OKLAHOMA CITY": "Oklahoma City",
  "TULSA": "Tulsa",
  "LAWTON": "Lawton",
  "WOODWARD": "Woodward",
  "McALESTER": "McAlester",
  statewide: "District-wide",
}

function computePlaceRows(
  sourceId: string,
  profileId: string,
  territoryOrder?: readonly string[],
): SurveyPlaceRow[] {
  const excluded = new Set(EXCLUDED_CARRIERS[sourceId] ?? [])
  const rows = readCsv(`${sourceId}-premiums.csv`).filter(
    (row) => row.profile_id === profileId && !excluded.has(row.carrier),
  )
  const byTerritory = new Map<string, number[]>()
  for (const row of rows) {
    const annual = Number(row.annual_premium)
    if (!Number.isFinite(annual) || annual <= 0) continue
    const list = byTerritory.get(row.territory) ?? []
    list.push(annual)
    byTerritory.set(row.territory, list)
  }
  const territories = territoryOrder
    ? territoryOrder.filter((t) => byTerritory.has(t))
    : [...byTerritory.keys()]
  return territories.map((territory) => {
    const sorted = [...(byTerritory.get(territory) ?? [])].sort((a, b) => a - b)
    if (sorted.length === 0) throw new Error(`No rows for ${sourceId} ${profileId} in ${territory}`)
    return {
      place: PLACE_LABELS[territory] ?? territory,
      territory,
      carrierCount: sorted.length,
      median: Math.round(percentile(sorted, 0.5)),
      low: Math.round(sorted[0]),
      high: Math.round(sorted.at(-1)!),
    }
  })
}

function csvProfileDescription(sourceId: string, profileId: string): string {
  const rows = readCsv(`${sourceId}-profiles.csv`)
  const found = rows.find((row) => row.profile_id === profileId)
  if (!found) throw new Error(`Missing profile ${profileId} in ${sourceId}-profiles.csv`)
  return found.description
}

function buildTxSurvey(): StateRateSurvey {
  const meta = sourceMeta("tx-2025")
  const order = [
    "Houston 77036 (Harris County)",
    "Dallas 75216 (Dallas County)",
    "Plano 75023 (Collin County)",
    "Plainview 79072 (Hale County)",
    "Alpine 79830 (Brewster County)",
  ]
  const basePlaces = computePlaceRows("tx-2025", "tx-base", order)
  const age18Places = computePlaceRows("tx-2025", "tx-age18", order)
  const houstonBase = basePlaces.find((p) => p.territory.startsWith("Houston"))!
  const alpineBase = basePlaces.find((p) => p.territory.startsWith("Alpine"))!
  return {
    kind: "rate-survey",
    state: "TX",
    sourceId: meta.id,
    title: meta.title,
    publisher: meta.publisher,
    url: meta.url,
    dataYear: "2025",
    effectiveNote: "rates in effect June 1, 2025 (Commissioner's Bulletin B-0005-25)",
    checkedOn: meta.checkedOn,
    heading: "What sample drivers pay across 5 Texas ZIP codes (TDI HelpInsure, 2025)",
    intro: `The Texas Department of Insurance (TDI) and the Office of Public Insurance Counsel publish sample liability-only 30/60/25 rates on HelpInsure.com for five ZIP codes (rates in effect June 1, 2025, across ${houstonBase.carrierCount} companies). For the base sample driver, the median company rate runs from ${dollars(alpineBase.median)} a year in Alpine (79830) to ${dollars(houstonBase.median)} a year in Houston (77036).`,
    caveat:
      "These are sample rates for one specific driver profile in five ZIP codes, not statewide or citywide averages. TDI's data call covers bodily-injury and property-damage liability only (30/60/25), without collision or comprehensive coverage.",
    profiles: [
      {
        profileId: "tx-base",
        shortLabel: "Base sample driver (age 30, 30/60/25 liability only)",
        profileDescription:
          "Liability-only 30/60/25, one sample driver: single male, age band 25 to 64 (TDI data call rates age 30), average credit score, 2024 Toyota Camry four-door sedan, driven mostly for going to work (18,000 miles a year), no at-fault accidents and no speeding tickets in the past 3 years. Rates in effect June 1, 2025, from the Texas Department of Insurance's HelpInsure.",
        csvDescription: csvProfileDescription("tx-2025", "tx-base"),
        places: basePlaces,
      },
      {
        profileId: "tx-age18",
        shortLabel: "18-year-old sample driver (30/60/25 liability only)",
        profileDescription:
          "Liability-only 30/60/25, one sample driver: single male, age band 16 to 24 (TDI data call rates age 18), average credit score, 2024 Toyota Camry four-door sedan, driven mostly for going to work (18,000 miles a year), no at-fault accidents and no speeding tickets in the past 3 years. Rates in effect June 1, 2025, from the Texas Department of Insurance's HelpInsure.",
        csvDescription: csvProfileDescription("tx-2025", "tx-age18"),
        places: age18Places,
      },
    ],
  }
}

function buildCaSurvey(): StateRateSurvey {
  const meta = sourceMeta("ca-2026")
  const order = ["Los Angeles Los Angeles - Central", "Orange Irvine", "Modoc Alturas"]
  const standardPlaces = computePlaceRows("ca-2026", "ca-2542A_V1", order)
  const basicPlaces = computePlaceRows("ca-2026", "ca-1142A", order)
  const laStd = standardPlaces[0]
  const modocStd = standardPlaces[2]
  return {
    kind: "rate-survey",
    state: "CA",
    sourceId: meta.id,
    title: meta.title,
    publisher: meta.publisher,
    url: meta.url,
    dataYear: "2026",
    effectiveNote: "rates effective January 1, 2026",
    checkedOn: meta.checkedOn,
    heading: "What sample drivers pay in Los Angeles, Irvine, and Alturas (CDI, 2026)",
    intro: `The California Department of Insurance (CDI) 2026 Automobile Premium Survey compares company rates effective January 1, 2026 in three places. For a single driver licensed 14 to 25 years with a clean record on a Honda Accord (Profile 2542A, Standard full coverage), the median yearly quote moves from ${dollars(modocStd.median)} in rural Alturas to ${dollars(laStd.median)} in Central Los Angeles.`,
    caveat:
      "These are sample rates before applicable discounts (including California's Good Driver discount) for specific profiles in three locations, not statewide averages. Seven companies whose footnotes state they priced different limits or deductibles are left out.",
    profiles: [
      {
        profileId: "ca-2542A_V1",
        shortLabel: "Standard full coverage (Profile 2542A, Honda Accord)",
        profileDescription:
          "Single driver licensed 14 to 25 years, 7,600–10,000 miles a year, no violations, 2023 Honda Accord. Standard Full Coverage: 100/300/50 liability, $5,000 medical payments, 30/60 uninsured/underinsured motorist bodily injury, $250 comprehensive deductible, $500 collision deductible with collision deductible waiver.",
        csvDescription: csvProfileDescription("ca-2026", "ca-2542A_V1"),
        places: standardPlaces,
      },
      {
        profileId: "ca-1142A",
        shortLabel: "Basic liability-only 30/60/15 (Profile 1142A, Toyota Camry)",
        profileDescription:
          "Single driver licensed 14 to 25 years, 7,600–10,000 miles a year, no violations, Toyota Camry. Basic Limits (liability coverage only): 30/60/15 liability, $2,000 medical payments, 30/60 uninsured/underinsured motorist bodily injury, $3,500 uninsured motorist property damage.",
        csvDescription: csvProfileDescription("ca-2026", "ca-1142A"),
        places: basicPlaces,
      },
    ],
  }
}

function buildCoSurvey(): StateRateSurvey {
  const meta = sourceMeta("co-2023")
  const order = [
    "Denver (80205)",
    "Colorado Springs (80903)",
    "Sterling (80751)",
    "Highlands Ranch (80126)",
    "Craig (81625)",
    "Alamosa (81101)",
  ]
  const adultPlaces = computePlaceRows("co-2023", "co-C-P1", order)
  const youngPlaces = computePlaceRows("co-2023", "co-A-P1", order)
  const denver = adultPlaces[0]
  const alamosa = adultPlaces.at(-1)!
  return {
    kind: "rate-survey",
    state: "CO",
    sourceId: meta.id,
    title: meta.title,
    publisher: meta.publisher,
    url: meta.url,
    dataYear: "2023",
    effectiveNote: "published as current July 2023 (rates effective July 1, 2022)",
    checkedOn: meta.checkedOn,
    heading: "What sample drivers pay across 6 Colorado ZIP codes (DOI, 2023)",
    intro: `The Colorado Division of Insurance Private Passenger Automobile Premium Comparison Report (six-month figures doubled to yearly, across ${denver.carrierCount} companies) shows sample full-coverage rates in six Colorado ZIP codes. For a 45-year-old married commuter on a 2019 Toyota Camry LE (Driver C, Plan 1), the median yearly premium goes from ${dollars(alamosa.median)} in Alamosa (81101) to ${dollars(denver.median)} in Denver (80205).`,
    caveat:
      "These are sample company rates for specific profiles in six ZIP codes, not statewide averages. Six-month survey figures are doubled to yearly.",
    profiles: [
      {
        profileId: "co-C-P1",
        shortLabel: "Driver C: 45-year-old married male (Plan 1 full coverage)",
        profileDescription:
          "Driver C: 45-year-old married male, principal operator, less than 15 miles to work one way, no accidents or traffic convictions in 3 years, 15,000 annual miles, 2019 Toyota Camry LE. Plan 1: 25/50/15 liability, 25/50 uninsured/underinsured motorist, $5,000 medical payments, $1,000 comprehensive and $1,000 collision deductibles.",
        csvDescription: csvProfileDescription("co-2023", "co-C-P1"),
        places: adultPlaces,
      },
      {
        profileId: "co-A-P1",
        shortLabel: "Driver A: 25-year-old single male (Plan 1 full coverage)",
        profileDescription:
          "Driver A: 25-year-old single male, principal operator, less than 10 miles to work one way, no accidents or traffic convictions in 3 years, 15,000 annual miles, 2019 Toyota Camry LE. Plan 1: 25/50/15 liability, 25/50 uninsured/underinsured motorist, $5,000 medical payments, $1,000 comprehensive and $1,000 collision deductibles.",
        csvDescription: csvProfileDescription("co-2023", "co-A-P1"),
        places: youngPlaces,
      },
    ],
  }
}

function buildOkSurvey(): StateRateSurvey {
  const meta = sourceMeta("ok-2026")
  const order = ["OKLAHOMA CITY", "TULSA", "LAWTON", "WOODWARD", "McALESTER"]
  const adultPlaces = computePlaceRows("ok-2026", "ok-2026-C-male", order)
  const teenPlaces = computePlaceRows("ok-2026", "ok-2026-A-male", order)
  const okc = adultPlaces[0]
  const mca = adultPlaces.at(-1)!
  return {
    kind: "rate-survey",
    state: "OK",
    sourceId: meta.id,
    title: meta.title,
    publisher: meta.publisher,
    url: meta.url,
    dataYear: "2026",
    effectiveNote: "PDF dated September 1, 2026 (six-month premiums doubled to yearly)",
    checkedOn: meta.checkedOn,
    heading: "What sample drivers pay in 5 Oklahoma cities (OID, 2026)",
    intro: `The Oklahoma Insurance Department's September 2026 Auto Insurance Rate Comparison lists sample six-month rates (shown below as yearly, ×2) from ${okc.carrierCount} companies in five cities. For a 36-year-old married commuter driving a 2018 Chevrolet Malibu LS with full coverage (Scenario C, male), the median company rate runs from ${dollars(mca.median)} a year in McAlester to ${dollars(okc.median)} a year in Oklahoma City.`,
    caveat:
      "These are sample company rates for one vehicle and coverage package in five cities, not statewide averages. The survey excludes operator discounts (such as accident-free or good-student discounts) but includes vehicle safety discounts.",
    profiles: [
      {
        profileId: "ok-2026-C-male",
        shortLabel: "Scenario C (male): 36-year-old married commuter, full coverage",
        profileDescription:
          "Age 36 married male, principal operator, drives 18 miles roundtrip to work, 12,000 miles a year, no accidents or moving violations in 3 years, 2018 Chevrolet Malibu LS 4-door sedan: 25/50/25 liability and $500 comprehensive / $500 collision deductibles.",
        csvDescription: csvProfileDescription("ok-2026", "ok-2026-C-male"),
        places: adultPlaces,
      },
      {
        profileId: "ok-2026-A-male",
        shortLabel: "Scenario A (male): 16-year-old single principal operator, full coverage",
        profileDescription:
          "Age 16 single male, principal operator, drives to school, under 7,500 miles a year, no accidents or moving violations in 3 years, 2018 Chevrolet Malibu LS 4-door sedan: 25/50/25 liability and $500 comprehensive / $500 collision deductibles.",
        csvDescription: csvProfileDescription("ok-2026", "ok-2026-A-male"),
        places: teenPlaces,
      },
    ],
  }
}

function buildNdSurvey(): StateRateSurvey {
  const meta = sourceMeta("nd-2026")
  const order = ["Remainder of State", "Bismarck / Mandan", "Minot", "Fargo", "Grand Forks"]
  const adultPlaces = computePlaceRows("nd-2026", "nd-2026-ex02", order)
  const teenPlaces = computePlaceRows("nd-2026", "nd-2026-ex06", order)
  const gf = adultPlaces.find((p) => p.territory === "Grand Forks")!
  const rem = adultPlaces.find((p) => p.territory === "Remainder of State")!
  return {
    kind: "rate-survey",
    state: "ND",
    sourceId: meta.id,
    title: meta.title,
    publisher: meta.publisher,
    url: meta.url,
    dataYear: "2026",
    effectiveNote: "rates from January 1, 2026 (six-month premiums doubled to yearly)",
    checkedOn: meta.checkedOn,
    heading: "What sample drivers pay across 5 North Dakota regions (NDISD, 2026)",
    intro: `The North Dakota Insurance & Securities Department's 2026 Auto Insurance Cost Comparison Survey (rates from January 1, 2026, six-month figures doubled to yearly across ${gf.carrierCount} companies) compares four cities and the remainder of the state. For a 30-year-old single woman driving a 2017 Acura TL with full coverage (Example #2), the median yearly quote ranges from ${dollars(gf.median)} in Grand Forks to ${dollars(rem.median)} in the remainder of the state.`,
    caveat:
      "These are sample rates for specific driver and vehicle examples in five North Dakota rating regions, not statewide averages.",
    profiles: [
      {
        profileId: "nd-2026-ex02",
        shortLabel: "Example #2: 30-year-old single female, 2017 Acura TL (full coverage)",
        profileDescription:
          "Example #2: Single female, age 30, drives a 2017 Acura TL 4 miles each way to work 5 days a week (10,000 annual miles), clean driving record for 3 years, excellent credit history, no other drivers in household: 100/300/50 liability, 100/300 UM and UIM, $30,000 Basic PIP, and $250/$500 deductibles.",
        csvDescription: csvProfileDescription("nd-2026", "nd-2026-ex02"),
        places: adultPlaces,
      },
      {
        profileId: "nd-2026-ex06",
        shortLabel: "Example #6: 48-year-old single parent + 16-year-old occasional driver",
        profileDescription:
          "Example #6: Single female, age 48, with 16-year-old male high-school junior ('A' average, occasional driver, no credit history) on one 2017 Buick LaCrosse (18,000 annual miles, clean records, parent has excellent credit): 100/300/50 liability, 100/300 UM and UIM, $30,000 Basic PIP, and $250/$500 deductibles.",
        csvDescription: csvProfileDescription("nd-2026", "nd-2026-ex06"),
        places: teenPlaces,
      },
    ],
  }
}

function buildDcSurvey(): StateRateSurvey {
  const meta = sourceMeta("dc-2024")
  const f39 = computePlaceRows("dc-2024", "dc-single-female-39", ["statewide"])
  const m25 = computePlaceRows("dc-2024", "dc-single-male-25", ["statewide"])
  return {
    kind: "rate-survey",
    state: "DC",
    sourceId: meta.id,
    title: meta.title,
    publisher: meta.publisher,
    url: meta.url,
    dataYear: "2024",
    effectiveNote: "2024 edition (company rate effective dates November 2022 to August 2024; six-month premiums doubled to yearly)",
    checkedOn: meta.checkedOn,
    heading: "What sample drivers pay across DC insurers (DISB, 2024)",
    intro: `The DC Department of Insurance, Securities and Banking (DISB) 2024 Automobile Insurance Premium Comparison lists six-month sample rates (shown below as yearly, ×2) across ${f39[0].carrierCount} insurer filings for minimum required coverages on a three-year-old Toyota Camry. For a 39-year-old single woman with a clean record, the median yearly premium is ${dollars(f39[0].median)} (ranging from ${dollars(f39[0].low)} to ${dollars(f39[0].high)} across companies).`,
    caveat:
      "These are sample rates for minimum required coverages on one vehicle profile, not District-wide full-coverage averages. The DISB table quotes six-month policies, which are doubled here to yearly.",
    profiles: [
      {
        profileId: "dc-single-female-39",
        shortLabel: "Single female, age 39 (minimum required coverages)",
        profileDescription:
          "Single female, age 39, three-year-old Toyota Camry 4-door 4-cylinder sedan, clean driving record, mid-range insurance score, commuting 3–15 miles each way to work. Minimum required coverages quoted: Bodily Injury $25,000/$50,000 ($500 deductible), Physical Damage $10,000 ($500 deductible), Uninsured Motorist Bodily Injury $25,000/$50,000 ($500 deductible), Uninsured Motorist Physical Damage $5,000 ($200 deductible).",
        csvDescription: csvProfileDescription("dc-2024", "dc-single-female-39"),
        places: f39,
      },
      {
        profileId: "dc-single-male-25",
        shortLabel: "Single male, age 25 (minimum required coverages)",
        profileDescription:
          "Single male, age 25, three-year-old Toyota Camry 4-door 4-cylinder sedan, clean driving record, mid-range insurance score, commuting 3–15 miles each way to work, with the same minimum required coverages.",
        csvDescription: csvProfileDescription("dc-2024", "dc-single-male-25"),
        places: m25,
      },
    ],
  }
}

function buildNcSchedule(): StateSurchargeSchedule {
  const meta = sourceMeta("nc-sdip-2026")
  const rows = readCsv("nc-sdip-2026.csv").map((row) => ({
    points: Number(row.points),
    surchargePercent: Number(row.surcharge_percent),
    whatCounts: row.what_counts,
  }))
  return {
    kind: "surcharge-schedule",
    state: "NC",
    sourceId: meta.id,
    title: meta.title,
    publisher: meta.publisher,
    url: meta.url,
    dataYear: "2026",
    checkedOn: meta.checkedOn,
    heading: "How North Carolina insurance points raise your rate (SDIP, 2026)",
    intro:
      "North Carolina's Safe Driver Incentive Plan (SDIP), set by state law and published by the North Carolina Department of Insurance, assigns fixed percentage rate increases for at-fault accidents and moving violations over a three-year period.",
    caveat:
      "SDIP surcharges apply to the policy's base premium for three years when points are assessed. Some minor speeding violations or a small property-damage crash with no other points may qualify for a waiver under North Carolina law.",
    rows,
  }
}

const CACHE = new Map<StateCode, StateSurveySection | null>()

export function stateSurveyFor(code: StateCode): StateSurveySection | null {
  if (CACHE.has(code)) return CACHE.get(code) ?? null
  let result: StateSurveySection | null = null
  if (code === "TX") result = buildTxSurvey()
  else if (code === "CA") result = buildCaSurvey()
  else if (code === "CO") result = buildCoSurvey()
  else if (code === "OK") result = buildOkSurvey()
  else if (code === "ND") result = buildNdSurvey()
  else if (code === "DC") result = buildDcSurvey()
  else if (code === "NC") result = buildNcSchedule()
  CACHE.set(code, result)
  return result
}

export const SURVEY_STATE_CODES: readonly StateCode[] = ["TX", "CA", "CO", "OK", "ND", "DC", "NC"]
