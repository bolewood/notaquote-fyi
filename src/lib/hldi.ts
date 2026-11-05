/**
 * How we explain the Highway Loss Data Institute's (HLDI's) results, in
 * HLDI's own words first and then what we do with them. HLDI reviewed the
 * site and asked that it either match their published results or plainly
 * explain why it looks different. So every explanation here is built from
 * the same values the engine uses (src/lib/factor-engine.ts); nothing is
 * typed in by hand. This file only explains; it never changes a price.
 */
import { FACTOR_BUNDLE, type VehicleRelativity } from "./factor-engine"
import { estimateDollars } from "./format"

// ---------------------------------------------------------------------------
// Ratings

/** HLDI's five rating levels, best first. */
export const HLDI_RATINGS = [
  "Substantially better than average",
  "Better than average",
  "Average",
  "Worse than average",
  "Substantially worse than average",
] as const

export type HldiRating = (typeof HLDI_RATINGS)[number]

/**
 * TODO(HLDI): provisional cutoffs, waiting for HLDI to confirm them (see
 * docs/hldi-review.md). Each band is the highest whole index (100 = an
 * average car) that still gets that rating: 50 or less is substantially
 * better, 51–79 better, 80–122 average, 123–149 worse, 150 or more
 * substantially worse.
 */
export const HLDI_RATING_BANDS: readonly { max: number; rating: HldiRating }[] = [
  { max: 50, rating: "Substantially better than average" },
  { max: 79, rating: "Better than average" },
  { max: 122, rating: "Average" },
  { max: 149, rating: "Worse than average" },
  { max: Number.POSITIVE_INFINITY, rating: "Substantially worse than average" },
]

/** HLDI's rating for one result. The index is rounded to a whole number first, as HLDI publishes it. */
export function hldiRating(index: number): HldiRating {
  const whole = Math.round(index)
  return HLDI_RATING_BANDS.find((band) => whole <= band.max)!.rating
}

// ---------------------------------------------------------------------------
// Coverages, named the same way everywhere

export type CoverageKey = "collision" | "comprehensive" | "propertyDamage" | "bodilyInjury"

export type CoverageName = {
  key: CoverageKey
  /** "Crash repairs (collision)" */
  name: string
  /** "crash repairs", for the middle of a sentence. */
  short: string
  /** What it covers, when the name alone isn't enough. */
  helper: string
  /** HLDI publishes overall losses (how often × how much) for three, and only how often claims are filed for injuries. */
  measures: "losses" | "frequency"
}

export const HLDI_COVERAGES: readonly CoverageName[] = [
  {
    key: "collision",
    name: "Crash repairs (collision)",
    short: "crash repairs",
    helper: "fixing this car after a crash",
    measures: "losses",
  },
  {
    key: "comprehensive",
    name: "Non-crash damage (comprehensive)",
    short: "non-crash damage",
    helper: "theft, weather, fire, vandalism, glass, and animal strikes",
    measures: "losses",
  },
  {
    key: "propertyDamage",
    name: "Damage to others' property (property damage liability)",
    short: "damage to others' property",
    helper: "other people's cars and property, when this car's driver is at fault",
    measures: "losses",
  },
  {
    key: "bodilyInjury",
    name: "Injuries to others (bodily injury liability)",
    short: "injury claims",
    helper: "how often injury claims are filed against this car's drivers, not how much they cost",
    measures: "frequency",
  },
]

export function coverageName(key: CoverageKey): CoverageName {
  return HLDI_COVERAGES.find((item) => item.key === key)!
}

/**
 * HLDI's result in words, straight from the index: 79 is "21% better than
 * average". Injury results are how often claims are filed, so they read as
 * "filed 24% less often than average".
 */
export function hldiPercentWords(index: number, measures: CoverageName["measures"] = "losses"): string {
  const whole = Math.round(index)
  const percent = Math.abs(100 - whole)
  if (percent === 0) return measures === "frequency" ? "filed about as often as average" : "the same as average"
  if (measures === "frequency") return `filed ${percent}% ${whole < 100 ? "less" : "more"} often than average`
  return `${percent}% ${whole < 100 ? "better" : "worse"} than average`
}

// ---------------------------------------------------------------------------
// What HLDI reports for one car

export type HldiRow = CoverageName & {
  /** The index (100 = an average car), whole, as HLDI publishes it. */
  index: number
  rating: HldiRating
  /** "21% better than average" */
  percent: string
}

export type HldiReport = {
  /** The HLDI report window, like "2022–24". */
  modelYears: string
  /** The HLDI series we matched, like "Subaru Legacy 4WD with EyeSight". */
  series: string[]
  rows: HldiRow[]
  /** Where HLDI publishes the table. */
  url: string | null
}

function medianOf(values: number[]): number | null {
  if (values.length === 0) return null
  const sorted = [...values].sort((left, right) => left - right)
  const middle = Math.floor(sorted.length / 2)
  return sorted.length % 2 === 1 ? sorted[middle] : (sorted[middle - 1] + sorted[middle]) / 2
}

/**
 * HLDI's own results for a car, one row per coverage. Null unless HLDI
 * publishes this exact model (class averages aren't one car's results).
 * When a model has more than one HLDI series, each figure is the middle of
 * them, the same value the engine uses.
 */
export function hldiReport(relativity: VehicleRelativity): HldiReport | null {
  if (relativity.level !== "model" || relativity.rows.length === 0 || !relativity.modelYears) return null
  const rows = HLDI_COVERAGES.flatMap((coverage): HldiRow[] => {
    const value = medianOf(relativity.rows.flatMap((row) => (row[coverage.key] === null ? [] : [row[coverage.key] as number])))
    if (value === null) return []
    const index = Math.round(value)
    return [{ ...coverage, index, rating: hldiRating(index), percent: hldiPercentWords(index, coverage.measures) }]
  })
  const source = FACTOR_BUNDLE.sources.find((item) => item.id === relativity.sourceId)
  return { modelYears: relativity.modelYears, series: relativity.rows.map((row) => row.series), rows, url: source?.url ?? null }
}

// ---------------------------------------------------------------------------
// What we estimate that means for price

/** The share of collision in the damage side, and of injuries in the liability side (whole percents, from the bundle). */
export function premiumWeights(): { collision: number; comprehensive: number; injury: number; property: number } {
  const cells = FACTOR_BUNDLE.groups["premium-split"].cells
  const collision = cells["collision-in-physical"].value
  const injury = cells["bodily-injury-in-liability"].value
  return { collision, comprehensive: 100 - collision, injury, property: 100 - injury }
}

/**
 * How much of HLDI's difference from average we count: (1 − our factor) ÷
 * (1 − HLDI's combined result). Null when HLDI's combined result is too
 * close to average for the ratio to mean anything.
 */
export function shareCounted(ours: number, hldi: number): number | null {
  if (Math.abs(100 - hldi) < 2) return null
  return (100 - ours) / (100 - hldi)
}

/** 0.37 as "about 40%", 0.51 as "about half", 0.33 as "about a third". */
export function shareWords(share: number): string {
  if (Math.abs(share - 1 / 3) < 0.03) return "about a third"
  if (Math.abs(share - 2 / 3) < 0.03) return "about two-thirds"
  if (Math.abs(share - 0.25) < 0.025) return "about a quarter"
  const tens = Math.round(share * 10) * 10
  if (tens === 50) return "about half"
  if (tens >= 100) return "about all"
  if (tens <= 0) return "very little"
  return `about ${tens}%`
}

/** 0.94 as "about 6% less than average"; within half a percent, "about the same as average". */
function factorWords(index: number): string {
  const percent = Math.round(100 - index)
  if (percent === 0) return "about the same as average"
  return `about ${Math.abs(percent)}% ${percent > 0 ? "less" : "more"} than average`
}

/** HLDI's combined result as words: 83.9 as "about 16% better than average". */
function combinedWords(index: number): string {
  const percent = Math.round(100 - index)
  if (percent === 0) return "about average"
  return `about ${Math.abs(percent)}% ${percent > 0 ? "better" : "worse"} than average`
}

function ratio(value: { num: bigint; den: bigint }): number {
  return (Number((value.num * BigInt(1000000)) / value.den) / 1000000) * 100
}

/** The two parts of a full-coverage bill, for this car and an average car of the same age. */
export type BillPair = { car: { liability: number; ownCar: number }; average: { liability: number; ownCar: number } }

export type PriceSide = {
  /** HLDI's combined result for this side (100 = average). */
  hldi: number
  /** Our factor for this side (100 = average). */
  ours: number
  /** The share of HLDI's difference we count, or null when it can't be said that way. */
  share: number | null
  /** "about 40%" */
  shareText: string | null
}

export type PriceMeaning = {
  damage: PriceSide
  liability: PriceSide
  /** The full plain paragraph (step B on a car page). */
  paragraph: string
  /** The paragraph without its fixed opening (SOFTENING_REASON): the part about this car. */
  own: string
  /** One short line for the What-if panel. */
  short: string
}

/** The opening every explanation shares: why prices move less than loss results. */
export const SOFTENING_REASON =
  "Prices move less than loss results do: a car's loss record is only one of many things insurers weigh, and each weighs it differently. So we count only part of HLDI's difference."

/**
 * Step B: what we estimate HLDI's results mean for price, in one paragraph,
 * from the engine's own values. `name` is how the car is called in a
 * sentence ("the Legacy").
 */
export function priceMeaning(relativity: VehicleRelativity, name: string, bill: BillPair | null): PriceMeaning | null {
  const combined = relativity.hldiCombined
  if (!combined) return null
  const weights = premiumWeights()
  const damageOurs = ratio(relativity.physical)
  const liabilityOurs = ratio(relativity.liability)
  const damageShare = relativity.valueTier && relativity.valueTier !== "none" ? null : shareCounted(damageOurs, combined.physical)
  const liabilityShare = relativity.liabilityClipped ? null : shareCounted(liabilityOurs, combined.liability)
  // A share outside 0–120% means something besides HLDI's result moved our number; say it that way instead.
  const usable = (share: number | null) => (share !== null && share > 0 && share <= 1.2 ? share : null)
  const damage: PriceSide = {
    hldi: combined.physical,
    ours: damageOurs,
    share: usable(damageShare),
    shareText: usable(damageShare) === null ? null : shareWords(usable(damageShare)!),
  }
  const liability: PriceSide = {
    hldi: combined.liability,
    ours: liabilityOurs,
    share: usable(liabilityShare),
    shareText: usable(liabilityShare) === null ? null : shareWords(usable(liabilityShare)!),
  }
  const dollars = (part: "ownCar" | "liability", lead: boolean) =>
    bill ? `: ${lead ? "about " : ""}${estimateDollars(bill.car[part])} a year vs ${estimateDollars(bill.average[part])}` : ""

  // Which coverages HLDI publishes for this car: the engine uses whatever is there.
  const has = (key: CoverageKey) => relativity.rows.some((row) => row[key] !== null)
  const damageResult =
    has("collision") && has("comprehensive")
      ? `Combining crash repairs and non-crash damage (weighted about ${weights.collision}% and ${weights.comprehensive}%, the share each makes up of industry claim costs), ${name} comes out ${combinedWords(combined.physical)}.`
      : has("collision") || has("comprehensive")
        ? `HLDI publishes ${has("collision") ? "crash repairs" : "non-crash damage"} but not ${has("collision") ? "non-crash damage" : "crash repairs"} for ${name}, so we go by that one result: ${combinedWords(combined.physical)}.`
        : `HLDI doesn't publish damage results for ${name}, so we use its average for this kind of car: ${combinedWords(combined.physical)}.`
  let damageCount: string
  if (relativity.valueTier && relativity.valueTier !== "none") {
    damageCount = `Our estimate also adds what the car costs to replace, which HLDI's results don't measure, so the part of the bill that fixes the car is ${factorWords(damageOurs)}${dollars("ownCar", true)}.`
  } else if (damage.shareText) {
    damageCount = `We count ${damage.shareText} of that difference, so the part of the bill that fixes the car is ${factorWords(damageOurs)}${dollars("ownCar", true)}.`
  } else {
    damageCount = `So the part of the bill that fixes the car is ${factorWords(damageOurs)}${dollars("ownCar", true)}.`
  }

  const liabilityResult =
    has("propertyDamage") && has("bodilyInjury")
      ? `On the liability side, damage to others and injury claims combine to ${combinedWords(combined.liability)}.`
      : has("propertyDamage") || has("bodilyInjury")
        ? `On the liability side, HLDI publishes ${has("propertyDamage") ? "damage to others' property" : "injury claims"} but not ${has("propertyDamage") ? "injury claims" : "damage to others' property"} for ${name}, so we go by that one result: ${combinedWords(combined.liability)}.`
        : `On the liability side, HLDI doesn't publish results for ${name}, so we use its average for this kind of car: ${combinedWords(combined.liability)}.`
  let liabilityCount: string
  if (relativity.liabilityClipped) {
    const { liabilityFloor, liabilityCap } = FACTOR_BUNDLE.vehicle
    const limit = relativity.liabilityClipped === "floor" ? `${100 - liabilityFloor}% less` : `${liabilityCap - 100}% more`
    liabilityCount = `Counting about half would go past the band insurers' own car ratings stay inside, so we hold that part at ${limit} than average${dollars("liability", false)}.`
  } else if (liability.shareText) {
    liabilityCount = `We count ${liability.shareText}, so that part is ${factorWords(liabilityOurs).replace(" than average", "")}${dollars("liability", false)}.`
  } else {
    liabilityCount = `So that part is ${factorWords(liabilityOurs)}${dollars("liability", false)}.`
  }

  const own = [damageResult, damageCount, liabilityResult, liabilityCount].join(" ")
  const paragraph = `${SOFTENING_REASON} ${own}`
  const valueNote = relativity.valueTier && relativity.valueTier !== "none" ? " (including what the car costs to replace, which HLDI's results don't measure)" : ""
  const clipNote = relativity.liabilityClipped ? " (the most we ever move it)" : ""
  const short = `We estimate the part of the bill that fixes the car is ${factorWords(damageOurs)}${valueNote}, and the liability part is ${factorWords(liabilityOurs)}${clipNote}.`
  return { damage, liability, paragraph, own, short }
}

// ---------------------------------------------------------------------------
// Why one car costs more or less than another, in HLDI's coverages

/** How each coverage reads as a reason: "lower crash-repair losses", "fewer injury claims". */
export const LOSS_PHRASES: Record<CoverageKey, { lower: string; higher: string }> = {
  collision: { lower: "lower crash-repair losses", higher: "higher crash-repair losses" },
  comprehensive: { lower: "lower non-crash losses", higher: "higher non-crash losses" },
  propertyDamage: { lower: "less damage to others' property", higher: "more damage to others' property" },
  bodilyInjury: { lower: "fewer injury claims", higher: "more injury claims" },
}

/**
 * When no single coverage stands out (a class average, or the car-value term
 * on a luxury make), the side of the bill in plain words.
 */
export const SIDE_PHRASES = {
  damage: { lower: "lower costs to fix or replace", higher: "higher costs to fix or replace" },
  liability: { lower: "lower liability losses", higher: "higher liability losses" },
} as const

const SIDE_KEYS: Record<keyof typeof SIDE_PHRASES, readonly CoverageKey[]> = {
  damage: ["collision", "comprehensive"],
  liability: ["propertyDamage", "bodilyInjury"],
}

/** A car's HLDI index per coverage (the middle of its rows); an average car is 100 everywhere; a class average has none. */
export function coverageIndexes(relativity: VehicleRelativity): Partial<Record<CoverageKey, number>> {
  if (relativity.level === "average") return { collision: 100, comprehensive: 100, propertyDamage: 100, bodilyInjury: 100 }
  if (relativity.level !== "model") return {}
  const found: Partial<Record<CoverageKey, number>> = {}
  for (const coverage of HLDI_COVERAGES) {
    const value = medianOf(relativity.rows.flatMap((row) => (row[coverage.key] === null ? [] : [row[coverage.key] as number])))
    if (value !== null) found[coverage.key] = value
  }
  return found
}

export type ReasonPhrase = { size: number; words: string }

/**
 * Why `to` is higher or lower than `from` on one side of the bill: the HLDI
 * coverages on that side that moved the same way by at least 5 points,
 * biggest first. When none did, the side in plain words, so a reason never
 * contradicts the price.
 */
export function sideReasons(
  from: VehicleRelativity,
  to: VehicleRelativity,
  side: keyof typeof SIDE_PHRASES,
  direction: "lower" | "higher",
  sideSize: number,
): ReasonPhrase[] {
  const before = coverageIndexes(from)
  const after = coverageIndexes(to)
  const found: ReasonPhrase[] = []
  for (const key of SIDE_KEYS[side]) {
    const left = before[key]
    const right = after[key]
    if (left === undefined || right === undefined) continue
    const change = right - left
    if (direction === "lower" ? change <= -5 : change >= 5) found.push({ size: Math.abs(change), words: LOSS_PHRASES[key][direction] })
  }
  if (found.length === 0) return [{ size: Math.abs(sideSize), words: SIDE_PHRASES[side][direction] }]
  return found.sort((left, right) => right.size - left.size)
}

/** "a", "a and b", "a, b, and c" */
export function listWords(items: readonly string[]): string {
  if (items.length <= 1) return items[0] ?? ""
  if (items.length === 2) return `${items[0]} and ${items[1]}`
  return `${items.slice(0, -1).join(", ")}, and ${items.at(-1)}`
}

/**
 * HLDI's results in one line, for the What-if panel: "crash repairs 21%
 * better than average, non-crash damage 4% better, damage to others'
 * property 18% better, injury claims filed 24% less often".
 */
export function hldiShortLine(report: HldiReport): string {
  const parts = report.rows.map((row, index) => {
    const words = index === 0 ? row.percent : row.percent.replace(" than average", "")
    return `${row.short} ${words}`
  })
  return listWords(parts)
}

/**
 * When we last pulled HLDI's tables (every window, 2006–08 through the newest).
 * The sources list and the line below both use it. Update it in the January
 * refresh (docs/DATA-REFRESH.md). The 2022–24 source entry's own checkedOn is
 * September 22, 2026; the older windows were added in October 2026.
 */
export const HLDI_RETRIEVED = "October 2026"

/** The newest HLDI window, like "2022–24". */
export function newestHldiWindow(): string | null {
  const windows = FACTOR_BUNDLE.vehicle.windows
  if (windows.length === 0) return null
  return [...windows].sort((left, right) => right.yearMax - left.yearMax)[0].modelYears.replace("-", "–")
}

/** "HLDI data through 2022–24 models, retrieved October 2026." */
export function hldiDataLine(): string | null {
  const newest = newestHldiWindow()
  return newest ? `HLDI data through ${newest} models, retrieved ${HLDI_RETRIEVED}.` : null
}
