/**
 * The next four years of a new teen driver: years 1–4 of driving, from 16
 * until they turn 20, with each year's own range, basis, and source.
 *
 * It sits on top of the engine and changes nothing in it. Each year starts
 * from today's one-year estimate for a new 16-year-old and multiplies it by
 * a single-year factor from `teenYears` in the factor bundle:
 *
 * - Their own policy: the 16–18 estimate × age ÷ the 16–18 factor. That
 *   factor is Texas's age-18 point, so year 3 (age 18) is today's estimate
 *   exactly, and year 1 (age 16) is higher.
 * - Added to a parent's policy: only the teen's increase moves. Year 1 is
 *   today's increase; later years keep a share of it (our estimate).
 *
 * Ranges: each year swaps the band's spread for its own age's spread, combined
 * the way the engine combines spreads (in quadrature). The four-year total
 * adds the lows, the likely figures, and the highs, as if the years move
 * together, which gives a wider, more cautious total.
 */
import { FACTOR_BUNDLE, type Estimate, type TeenAdded } from "./factor-engine"
import type { FactorBasis, FactorCell, TeenYearAge } from "./factor-types"
import { basisLabel, type WhatIfResult } from "./pricing"
import { stateName, type Scenario, type StateCode } from "./scenario"

export const TEEN_YEARS_METHOD_PATH = "/methodology#next-four-years"

/** Years 1–4 of driving, starting at 16. Age 20 is where year 4 ends. */
export const FOUR_YEAR_AGES = ["16", "17", "18", "19"] as const satisfies readonly TeenYearAge[]

export type TeenYearKind = "own" | "added"

export type TeenYearRow = {
  /** 1–4. */
  year: number
  age: TeenYearAge
  low: number
  likely: number
  high: number
  basis: FactorBasis
  sources: string[]
  /** "From published prices in Texas (Illinois may differ)". */
  basisWords: string
  /** Where this year's number comes from, in a few plain words. */
  how: string
  /** This year ÷ today's one-year figure (the estimate, or the increase), in hundredths. */
  versusToday: number
}

export type TeenFourYears = {
  kind: TeenYearKind
  rows: TeenYearRow[]
  /** The lows, likely figures, and highs added up. */
  total: { low: number; likely: number; high: number }
}

const BP = 10000

/** A state, or "national" for the national typical figures. */
export type Place = StateCode | "national"

function placeName(place: Place): string {
  return place === "national" ? "your state" : stateName(place)
}

function ageCell(key: "16-18" | "16-18-added"): FactorCell {
  return FACTOR_BUNDLE.groups["driver-age"].cells[key]
}

function spreadOf(cell: FactorCell): { down: number; up: number } {
  return {
    down: Math.floor(((cell.value - cell.low) * BP) / cell.value),
    up: Math.floor(((cell.high - cell.value) * BP) / cell.value),
  }
}

/** Round half up, in whole numbers: amount × parts ÷ BP. */
function times(amount: number, parts: number): number {
  return Math.floor((2 * amount * parts + BP) / (2 * BP))
}

function edges(likely: number, down: number, up: number): { low: number; high: number } {
  const cappedDown = Math.min(down, 8000)
  let low = times(likely, BP - cappedDown)
  let high = times(likely, BP + up)
  if (low >= likely) low = Math.max(1, likely - 1)
  if (high <= likely) high = likely + 1
  return { low, high }
}

const OWN_HOW: Record<TeenYearAge, string> = {
  "16": "Oklahoma's published prices for a 16-year-old",
  "17": "Filled in between ages 16 and 18",
  "18": "Texas's published prices for an 18-year-old",
  "19": "Filled in between ages 18 and 21",
  "20": "Filled in between ages 18 and 21",
}

const ADDED_HOW: Record<TeenYearAge, string> = {
  "16": "California's published prices for a household adding a new driver",
  "17": "The increase falls the way a teen's own price does",
  "18": "The increase falls the way a teen's own price does",
  "19": "The increase falls the way a teen's own price does",
  "20": "The increase falls the way a teen's own price does",
}

function total(rows: TeenYearRow[]) {
  return rows.reduce(
    (sum, row) => ({ low: sum.low + row.low, likely: sum.likely + row.likely, high: sum.high + row.high }),
    { low: 0, likely: 0, high: 0 },
  )
}

/**
 * A new 16-year-old on their own policy, years 1–4. `today` is the engine's
 * estimate for the teen at 16–18 on their own policy (not added to a parent's).
 */
export function ownPolicyYears(today: Estimate, state: Place): TeenFourYears {
  const band = ageCell("16-18")
  const bandSpread = spreadOf(band)
  // Whether today's range already counts the 16–18 band (it does whenever the
  // starting point is another age, such as a typical 40–64-year-old's price).
  const counted = today.steps.some((step) => step.group === "driver-age")
  const rows = FOUR_YEAR_AGES.map((age, index): TeenYearRow => {
    const cell = FACTOR_BUNDLE.teenYears.own[age]
    const likely = Math.floor((2 * today.likely * cell.value + band.value) / (2 * band.value))
    const own = spreadOf(cell)
    const keepDown = Math.max(0, today.spread.down ** 2 - (counted ? bandSpread.down ** 2 : 0))
    const keepUp = Math.max(0, today.spread.up ** 2 - (counted ? bandSpread.up ** 2 : 0))
    const down = Math.floor(Math.sqrt(keepDown + own.down ** 2))
    const up = Math.floor(Math.sqrt(keepUp + own.up ** 2))
    const edge = age === "18" && counted ? { low: today.low, high: today.high } : edges(likely, down, up)
    return {
      year: index + 1,
      age,
      likely,
      ...edge,
      basis: cell.basis,
      sources: cell.sources,
      basisWords: basisLabel(cell.basis, cell.sources, placeName(state)),
      how: OWN_HOW[age],
      versusToday: Math.round((100 * likely) / today.likely),
    }
  })
  return { kind: "own", rows, total: total(rows) }
}

/**
 * A new 16-year-old added to a parent's policy, years 1–4: the household's
 * increase each year. `added` is the engine's `teenAddedToPolicy` result.
 */
export function addedToPolicyYears(added: TeenAdded, state: Place): TeenFourYears {
  const factor = ageCell("16-18-added")
  // The increase's own spread: the household factor's edges, as a share of
  // the part above 1.00 (what the teen adds), not of the whole bill.
  const extra = factor.value - 100
  const increaseDown = Math.floor(((factor.value - factor.low) * BP) / extra)
  const increaseUp = Math.floor(((factor.high - factor.value) * BP) / extra)
  const before = added.before.spread
  const rows = FOUR_YEAR_AGES.map((age, index): TeenYearRow => {
    const cell = FACTOR_BUNDLE.teenYears.added[age]
    const likely = times(added.increase, cell.value * 100)
    const own = cell.basis === "indicative" ? { down: 0, up: 0 } : spreadOf(cell)
    const down = Math.floor(Math.sqrt(before.down ** 2 + increaseDown ** 2 + own.down ** 2))
    const up = Math.floor(Math.sqrt(before.up ** 2 + increaseUp ** 2 + own.up ** 2))
    return {
      year: index + 1,
      age,
      likely,
      ...edges(likely, down, up),
      basis: cell.basis,
      sources: cell.sources,
      basisWords: basisLabel(cell.basis, cell.sources, placeName(state)),
      how: ADDED_HOW[age],
      versusToday: cell.value,
    }
  })
  return { kind: "added", rows, total: total(rows) }
}

/** "Year 1 (age 16)". */
export function yearName(row: Pick<TeenYearRow, "year" | "age">): string {
  return `Year ${row.year} (age ${row.age})`
}

/** "+47%", "−13%", or "Same" against today's one-year figure. */
export function versusTodayWords(row: Pick<TeenYearRow, "versusToday">): string {
  const change = row.versusToday - 100
  if (change === 0) return "Same"
  return change > 0 ? `+${change}%` : `−${-change}%`
}

/** The four-year view's words, in one place so every page says the same thing. */
export function fourYearWords(kind: TeenYearKind) {
  return {
    title: kind === "own" ? "The next four years on their own policy" : "The next four years on your policy",
    lead: "This is the most expensive stretch, and it gets better.",
    what:
      kind === "own"
        ? "Your teen on their own policy, each year from 16 until they turn 20."
        : "What adding your teen adds to your policy each year, from 16 until they turn 20.",
    today:
      kind === "own"
        ? "The estimate above prices drivers 16 to 18 together. The first year usually costs more than that, and it comes down from there."
        : "Year 1 is what adding your teen costs today. After that, the increase usually shrinks as your teen gets older.",
    why: "It comes down because your teen gets older, gains experience behind the wheel, and, we assume, keeps a clean record.",
    reset: "An accident or a ticket resets much of that drop.",
    together:
      "The four-year range adds up each year's range, as if every year came out high, or every year low, at once. That makes it wider than it's likely to be, on purpose.",
    method: "Here's how we got each year",
    compared: kind === "own" ? "Compared with the estimate above" : "Compared with year 1",
    column: kind === "own" ? "Their own policy" : "Added to your policy",
    axis: kind === "own" ? "A year on their own policy" : "Added to your policy a year",
  }
}

/**
 * The four-year view for a calculator result, when it adds a new 16-year-old
 * (on their own policy, or to yours). Null for anything else.
 */
export function teenFourYears(
  result: Pick<WhatIfResult, "mode" | "next" | "teenAdded">,
  now: Pick<Scenario, "age">,
  next: Pick<Scenario, "age" | "state">,
): TeenFourYears | null {
  if (next.age !== "16-18" || now.age === "16-18") return null
  if (result.mode === "teen-own") return ownPolicyYears(result.next, next.state)
  if (result.mode === "teen-added" && result.teenAdded) return addedToPolicyYears(result.teenAdded, next.state)
  return null
}

export type TeenYearMethodRow = {
  age: TeenYearAge
  /** "4.22 (2.79–5.41)": their own policy, compared with a 40–64-year-old. */
  own: string
  ownBasis: string
  ownHow: string
  /** "82% (73%–91%)": how much of the first year's increase is left. */
  added: string
  addedBasis: string
}

/** The single-age numbers behind the four-year view, for How it works. */
export function teenYearMethodRows(): TeenYearMethodRow[] {
  const times = (cell: FactorCell) =>
    `${(cell.value / 100).toFixed(2)}${cell.low === cell.high ? "" : ` (${(cell.low / 100).toFixed(2)}–${(cell.high / 100).toFixed(2)})`}`
  const share = (cell: FactorCell) => `${cell.value}%${cell.low === cell.high ? "" : ` (${cell.low}%–${cell.high}%)`}`
  return (["16", "17", "18", "19", "20"] as const).map((age) => {
    const own = FACTOR_BUNDLE.teenYears.own[age]
    const added = FACTOR_BUNDLE.teenYears.added[age]
    return {
      age,
      own: times(own),
      ownBasis: basisLabel(own.basis, own.sources, "your state"),
      ownHow: OWN_HOW[age],
      added: share(added),
      addedBasis: basisLabel(added.basis, added.sources, "your state"),
    }
  })
}
