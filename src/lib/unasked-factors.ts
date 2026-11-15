/**
 * What the calculator doesn't ask, and how much each thing can move a price.
 * Every figure is computed here from the committed survey CSVs in
 * data/factors/sources/ (never typed by hand), or says that no public number
 * exists. Server-only: reads files at build time. Credit stays out of
 * FACTOR_BUNDLE on purpose (assertFactorBundleSafe forbids it); it lives here,
 * as an explanation, not as an input to any estimate.
 */
import { readFileSync } from "node:fs"
import { join } from "node:path"
import sourcesFile from "../../data/factors/sources/sources.json"
import { EXCLUDED_CARRIERS, parseCsv, percentile } from "./factor-derivation"
import { FACTOR_BUNDLE } from "./factor-engine"
import type { StateCode } from "./scenario"
import type { RatingFactor } from "./rating-rules"

const SOURCES_DIR = join(process.cwd(), "data/factors/sources")

/** One survey's source, as cited on the page. */
export type UnaskedSource = { id: string; title: string; publisher: string; url: string; checkedOn: string }

/** How a factor's figure was found. */
export type UnaskedKind = "sourced" | "asked" | "no-public-number"

/** A ratio range from survey comparisons: same company, same place, one thing changed. */
export type RatioSummary = {
  /** Median ratio across comparisons. */
  median: number
  /** 25th and 75th percentiles: the middle half of companies. */
  p25: number
  p75: number
  /** Number of comparisons. */
  n: number
}

export type UnaskedFactor = {
  id: string
  name: string
  kind: UnaskedKind
  /** Lowest and highest multiplier the bar spans (1 = no change). Null when no public number. */
  low: number | null
  high: number | null
  /** Short plain-words reading of the bar, e.g. "17% less to 19% more". */
  reading: string
  /** One or two sentences: what it is and why insurers use it. */
  what: string
  /** How the number was worked out, with the comparison count. */
  howWorkedOut: string
  /** Which state-law factor this is, so banned states can collapse the bar. */
  ruleFactor: RatingFactor | null
  /** Things a person can do or ask. */
  whatYouCanDo: string[]
  sources: UnaskedSource[]
}

function source(id: string): UnaskedSource {
  const found = sourcesFile.sources.find((item) => item.id === id)
  if (!found) throw new Error(`Missing source ${id} in data/factors/sources/sources.json`)
  return { id, title: found.title, publisher: found.publisher, url: found.url, checkedOn: found.checkedOn }
}

type Premium = { territory: string; carrier: string; profile: string; annual: number }

const cache = new Map<string, Premium[]>()

function premiums(sourceId: string): Premium[] {
  const hit = cache.get(sourceId)
  if (hit) return hit
  const excluded = new Set(EXCLUDED_CARRIERS[sourceId] ?? [])
  const rows = parseCsv(readFileSync(join(SOURCES_DIR, `${sourceId}-premiums.csv`), "utf8"))
    .filter((row) => !excluded.has(row.carrier))
    .map((row) => ({ territory: row.territory, carrier: row.carrier, profile: row.profile_id, annual: Number(row.annual_premium) }))
    .filter((row) => Number.isFinite(row.annual) && row.annual > 0)
  cache.set(sourceId, rows)
  return rows
}

/** Same company, same place: premium for `changed` ÷ premium for `base`. */
export function pairedRatios(sourceId: string, changed: string, base: string): RatioSummary {
  const byKey = new Map<string, Map<string, number>>()
  for (const row of premiums(sourceId)) {
    const key = `${row.carrier}\u0000${row.territory}`
    const map = byKey.get(key) ?? new Map<string, number>()
    map.set(row.profile, row.annual)
    byKey.set(key, map)
  }
  const ratios: number[] = []
  for (const map of byKey.values()) {
    const a = map.get(changed)
    const b = map.get(base)
    if (a !== undefined && b !== undefined) ratios.push(a / b)
  }
  if (ratios.length === 0) throw new Error(`${sourceId}: no paired rows for ${changed} ÷ ${base}`)
  ratios.sort((x, y) => x - y)
  return { median: percentile(ratios, 0.5), p25: percentile(ratios, 0.25), p75: percentile(ratios, 0.75), n: ratios.length }
}

/**
 * How far companies sit from the middle company for the same driver, car, and
 * place, in one survey: each premium ÷ the median for its profile and place,
 * for groups of 5 or more companies. Same method as the bundle's
 * "typical-start" range cell, for one state.
 */
export function insurerSpread(sourceId: string): RatioSummary {
  const groups = new Map<string, number[]>()
  for (const row of premiums(sourceId)) {
    const key = `${row.profile}\u0000${row.territory}`
    const list = groups.get(key) ?? []
    list.push(row.annual)
    groups.set(key, list)
  }
  const ratios: number[] = []
  for (const list of groups.values()) {
    if (list.length < 5) continue
    const sorted = [...list].sort((a, b) => a - b)
    const middle = percentile(sorted, 0.5)
    for (const value of sorted) ratios.push(value / middle)
  }
  ratios.sort((x, y) => x - y)
  return { median: 1, p25: percentile(ratios, 0.25), p75: percentile(ratios, 0.75), n: ratios.length }
}

/** "17% less", "19% more", "about the same". */
export function percentWords(ratio: number): string {
  const percent = Math.round((ratio - 1) * 100)
  if (percent === 0) return "about the same"
  return percent > 0 ? `${percent}% more` : `${-percent}% less`
}

const TX = "tx-2025"
const TX_NOTE =
  "Texas's 2025 sample rates, same company and same place, liability-only coverage: a 30-year-old single man with average credit, a car driven to work, compared with the same driver with one thing changed."

/** The insurer spread for the states whose surveys we have, keyed by state. */
export const SURVEY_SPREAD_SOURCES: Partial<Record<StateCode, string>> = {
  CA: "ca-2026",
  OK: "ok-2026",
  TX: "tx-2025",
  ND: "nd-2026",
  CO: "co-2023",
}

function nationalInsurerSpread(): RatioSummary {
  const cell = FACTOR_BUNDLE.groups.range?.cells["typical-start"]
  if (!cell || cell.n === null) throw new Error("model-factors.json is missing the range group's typical-start cell")
  return { median: 1, p25: cell.low / 100, p75: cell.high / 100, n: cell.n }
}

function accident(): RatioSummary {
  return pairedRatios(TX, "tx-accident", "tx-base")
}

/** Everything the chart and its explainers need, computed once at build time. */
export function unaskedFactors(): UnaskedFactor[] {
  const insurer = nationalInsurerSpread()
  const poor = pairedRatios(TX, "tx-creditPoor", "tx-base")
  const good = pairedRatios(TX, "tx-creditGood", "tx-base")
  const speeding = pairedRatios(TX, "tx-speeding", "tx-base")
  const crash = accident()
  const married = pairedRatios(TX, "tx-married", "tx-base")
  const woman30 = pairedRatios(TX, "tx-female", "tx-base")
  const woman18 = pairedRatios(TX, "tx-age18_female", "tx-age18")
  const surveys = ["ok-2026", "nd-2026", "tx-2025", "ca-2026", "co-2023"].map(source)

  return [
    {
      id: "insurer",
      name: "Which insurer you choose",
      kind: "sourced",
      low: insurer.p25,
      high: insurer.p75,
      reading: `${percentWords(insurer.p25)} to ${percentWords(insurer.p75)} than the middle company`,
      what:
        "Each company builds its own price from its own claims history, its own list of factors, and its own weights, and files it separately in each state. Companies also want different customers: one may see you as an ideal customer while another prices you high because you're not who they're looking for.",
      howWorkedOut: `For the same driver, car, and place, each company's price ÷ the middle company's price, in five states' surveys (Oklahoma, North Dakota, Texas, California, Colorado). The bar is the middle half of companies; the cheapest and priciest companies sit well beyond it. ${insurer.n.toLocaleString("en-US")} prices.`,
      ruleFactor: null,
      whatYouCanDo: [
        "Get quotes from three or four companies. Of everything on this page, it's usually the biggest thing you control.",
        "Ask each one for the same coverage and deductibles, so you're comparing like with like.",
      ],
      sources: surveys,
    },
    {
      id: "credit",
      name: "Your credit",
      kind: "sourced",
      low: good.median,
      high: poor.median,
      reading: `good credit ${percentWords(good.median)}, poor credit ${percentWords(poor.median)} than average (Texas's survey)`,
      what:
        "Many insurers use a credit-based insurance score where the law allows it, because it tends to line up with claims. Some states ban it for car insurance; many others limit how it can be used.",
      howWorkedOut: `${TX_NOTE} Poor credit vs. average: median ${percentWords(poor.median)} (${poor.n} comparisons). Good credit vs. average: median ${percentWords(good.median)} (${good.n} comparisons).`,
      ruleFactor: "credit",
      whatYouCanDo: [
        "Ask whether the company uses credit, and whether it will re-check your score if it has improved.",
        "If something like a divorce, a serious illness, or a job loss hurt your credit, ask whether the company makes exceptions; many states require it.",
      ],
      sources: [source(TX)],
    },
    {
      id: "accident",
      name: "An at-fault accident",
      kind: "asked",
      low: 1,
      high: crash.median,
      reading: `about ${percentWords(crash.median)} (Texas's survey)`,
      what: "Causing a crash is one of the strongest signs of future claims, so it's in every insurer's price. The calculator asks about it.",
      howWorkedOut: `${TX_NOTE} One at-fault accident vs. none: median ${percentWords(crash.median)} (${crash.n} comparisons). The calculator's own accident factor draws on California and North Carolina too.`,
      ruleFactor: null,
      whatYouCanDo: ["Ask how long the surcharge lasts. It usually drops off after three to five years."],
      sources: [source(TX)],
    },
    {
      id: "speeding",
      name: "A speeding ticket",
      kind: "sourced",
      low: 1,
      high: speeding.median,
      reading: `about ${percentWords(speeding.median)} (Texas's survey)`,
      what: "Tickets count against you for a few years. A speeding ticket usually costs less than an accident, and some companies don't charge for one at all.",
      howWorkedOut: `${TX_NOTE} One speeding ticket vs. none: median ${percentWords(speeding.median)}; the middle half of companies ranged from ${percentWords(speeding.p25)} to ${percentWords(speeding.p75)} (${speeding.n} comparisons).`,
      ruleFactor: null,
      whatYouCanDo: ["Ask whether a defensive-driving course removes or reduces the surcharge."],
      sources: [source(TX)],
    },
    {
      id: "marital",
      name: "Being married",
      kind: "sourced",
      low: married.median,
      high: 1,
      reading: `about ${percentWords(married.median)} than single (Texas's survey)`,
      what: "Many insurers charge married drivers less; some states don't allow marital status to count.",
      howWorkedOut: `${TX_NOTE} Married vs. single: median ${percentWords(married.median)} (${married.n} comparisons).`,
      ruleFactor: "maritalStatus",
      whatYouCanDo: ["If you married recently, tell your insurer."],
      sources: [source(TX)],
    },
    {
      id: "gender",
      name: "Gender",
      kind: "sourced",
      // The bar is for the example adult driver, so it uses the age-30 pair; the teen figure is in the words.
      low: Math.min(woman30.median, 1),
      high: Math.max(woman30.median, 1),
      reading: `at 30, ${percentWords(woman30.median)} for women; at 18, women pay about ${percentWords(woman18.median)} (Texas's survey)`,
      what: "Young men crash more often than young women, so where it's allowed, gender mostly matters for teens and young adults. Several states ban it.",
      howWorkedOut: `${TX_NOTE} Woman vs. man at 18: median ${percentWords(woman18.median)} (${woman18.n} comparisons). At 30: median ${percentWords(woman30.median)} (${woman30.n} comparisons).`,
      ruleFactor: "gender",
      whatYouCanDo: ["Nothing to change here, but it helps explain why two teens' quotes differ."],
      sources: [source(TX)],
    },
    {
      id: "coverage-gap",
      name: "A gap in coverage",
      kind: "no-public-number",
      low: null,
      high: null,
      reading: "Insurers use this. No public source we use shows how much.",
      what: "Going without insurance for a while, even between cars, can raise your price when you start again. Some states limit this.",
      howWorkedOut: "None of the state surveys we use price a gap in coverage, so we don't have a number.",
      ruleFactor: "priorInsurance",
      whatYouCanDo: ["Between cars, ask about a non-owner policy, which can keep your history unbroken."],
      sources: [],
    },
    {
      id: "dui",
      name: "A DUI",
      kind: "no-public-number",
      low: null,
      high: null,
      reading: "Insurers use this. No public source we use shows how much.",
      what: "A DUI is among the most expensive things on a driving record, and in many states it means filing proof of insurance (an SR-22) for years.",
      howWorkedOut: "None of the state surveys we use price a DUI for one driver, so we don't show a number.",
      ruleFactor: null,
      whatYouCanDo: ["Ask how long it will count, and compare companies: some specialize in drivers with a DUI."],
      sources: [],
    },
  ]
}

/** Each survey state's own insurer spread, for the state picker. */
export function stateInsurerSpreads(): Partial<Record<StateCode, RatioSummary & { sourceId: string }>> {
  const out: Partial<Record<StateCode, RatioSummary & { sourceId: string }>> = {}
  for (const [code, sourceId] of Object.entries(SURVEY_SPREAD_SOURCES) as [StateCode, string][]) {
    out[code] = { ...insurerSpread(sourceId), sourceId }
  }
  return out
}
