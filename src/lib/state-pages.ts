/**
 * The state pages (/states/<slug>): addresses, and everything a page shows,
 * worked out at build time from the same engine and data as the rest of the
 * site.
 *
 * A state page leads with what really differs by state: its typical price
 * (NAIC), how that compares with the country and the neighbors, the least
 * insurance its law asks for, and what a new teen driver costs there. The
 * cars that cost least to insure for a teen come out in the same order in
 * every state, because our car data is national, and the page says so.
 */
import type { VehicleCatalog } from "./catalog"
import { vehicleFacts } from "./catalog-class"
import { broughtUpToToday, typicalStart, type StartingPoint } from "./factor-engine"
import { priceWhatIf, type WhatIfResult } from "./pricing"
import { DEFAULT_SCENARIO, stateName, type Scenario, type StateCode } from "./scenario"
import { STATE_SLUGS, stateBySlug, statePath, stateSlug } from "./state-slugs"
import { encodeSharePath } from "./share-link"
import { allStateBaselines, countrywideBaseline, stateBaseline, type StateBaseline } from "./state-baselines"
import { comparisonStates } from "./state-neighbors"
import { stateRule, type StateRule } from "./state-rules"
import { priceTeenCars, teenDriver, teenPool, typicalTeenCost, type TeenPriced } from "./teen-cars"

export { STATE_SLUGS, stateBySlug, statePath, stateSlug }

/** How many cars the state page lists for a teen. */
export const TEEN_TOP = 5

/** "the District of Columbia", "Ohio": for the middle of a sentence. */
export function inSentence(code: StateCode): string {
  return code === "DC" ? "the District of Columbia" : stateName(code)
}

export type PriceRank = {
  /** 1 is the most expensive. */
  rank: number
  of: number
  /** Other states with exactly the same figure. */
  tiedWith: StateCode[]
}

/** Where a state's 2023 typical price ranks among the 50 states and DC (1 = most expensive). */
export function priceRank(code: StateCode): PriceRank {
  const all = allStateBaselines()
  const own = stateBaseline(code)!
  const higher = all.filter((row) => row.annual > own.annual).length
  return {
    rank: higher + 1,
    of: all.length,
    tiedWith: all.filter((row) => row.state !== code && row.annual === own.annual).map((row) => row.state as StateCode),
  }
}

/** A percentage difference in words: "18% more than", "9% less than", "about the same as". */
export function percentVs(value: number, base: number): { percent: number; words: string } {
  const percent = Math.round((value / base - 1) * 100)
  if (Math.abs(percent) < 2) return { percent, words: "about the same as" }
  return { percent, words: percent > 0 ? `${percent}% more than` : `${-percent}% less than` }
}

export type NeighborRow = {
  code: StateCode
  name: string
  baseline: StateBaseline
  /** This state's 2023 price against the neighbor's. */
  vs: { percent: number; words: string }
  /** Moving from the neighbor to this state, same driver and car (the What-if page's defaults). */
  move: WhatIfResult
}

export type StateFigures = {
  code: StateCode
  name: string
  slug: string
  baseline: StateBaseline
  national: StateBaseline
  /** The typical price, brought up to today (what the What-if page starts from). */
  start: StartingPoint
  vsNational: { percent: number; words: string }
  rank: PriceRank
  /** Liability alone as a share of the full-coverage figure, 2023. */
  liabilityShare: number
  /** NAIC's liability-only average, brought up to today. */
  liabilityToday: number
  /** Where the liability-only average ranks (1 = highest). */
  liabilityRank: { rank: number; of: number }
  neighbors: NeighborRow[]
  bordering: boolean
  rule: StateRule | null
  teen: ReturnType<typeof typicalTeenCost>
  /** The popular lists for a new teen, cheapest to add first. */
  teenCars: TeenPriced[]
  whatIfHref: string
  compareHref: string
}

/** The What-if page's own default driver and car, in another state. */
export function moverScenario(state: StateCode): Scenario {
  return { ...DEFAULT_SCENARIO, state }
}

/** Moving from one state to another: the What-if page's default driver and car, and nothing else changed. */
export function moveWhatIf(catalog: VehicleCatalog, from: StateCode, to: StateCode): WhatIfResult {
  const now = moverScenario(from)
  const next = moverScenario(to)
  const facts = vehicleFacts(catalog, now)
  const result = priceWhatIf({ scenario: now, teenOnParentPolicy: false, premium: null }, facts, next, facts)
  if (!result) throw new Error(`No typical price for ${from}`)
  return result
}

const FIGURES = new WeakMap<VehicleCatalog, Map<StateCode, StateFigures>>()

export function stateFigures(catalog: VehicleCatalog, code: StateCode): StateFigures {
  let byCatalog = FIGURES.get(catalog)
  if (!byCatalog) {
    byCatalog = new Map()
    FIGURES.set(catalog, byCatalog)
  }
  const cached = byCatalog.get(code)
  if (cached) return cached

  const baseline = stateBaseline(code)
  const start = typicalStart(moverScenario(code))
  if (!baseline || !start) throw new Error(`No typical price for ${code}`)
  const national = countrywideBaseline()
  const { states, bordering } = comparisonStates(code)
  const neighbors = states.map((other) => {
    const otherBaseline = stateBaseline(other)!
    return {
      code: other,
      name: stateName(other),
      baseline: otherBaseline,
      vs: percentVs(baseline.annual, otherBaseline.annual),
      move: moveWhatIf(catalog, other, code),
    }
  })
  const teenCars = priceTeenCars({ kind: "state", state: code }, teenPool(catalog))
  const top = teenCars.slice(0, TEEN_TOP)

  const figures: StateFigures = {
    code,
    name: stateName(code),
    slug: stateSlug(code),
    baseline,
    national,
    start,
    vsNational: percentVs(baseline.annual, national.annual),
    rank: priceRank(code),
    liabilityShare: baseline.liabilityOnly / baseline.exact,
    liabilityToday: broughtUpToToday(baseline.liabilityOnly),
    liabilityRank: {
      rank: allStateBaselines().filter((row) => row.liabilityOnly > baseline.liabilityOnly).length + 1,
      of: allStateBaselines().length,
    },
    neighbors,
    bordering,
    rule: stateRule(code) ?? null,
    teen: typicalTeenCost({ kind: "state", state: code }),
    teenCars,
    // "Try it with your own car": the visitor's own situation, moved to this state, adding a 16-year-old.
    whatIfHref: encodeSharePath({
      page: "/",
      scenario: moverScenario(code),
      teenOnParentPolicy: true,
      next: { ...moverScenario(code), age: "16-18", yearsLicensed: "under-1", teen: true },
      via: "state",
    }),
    // "Compare cars for your teen": the same five cars, for the same teen, on the Compare page.
    compareHref: encodeSharePath({
      page: "/compare",
      scenario: teenDriver(code),
      teenOnParentPolicy: true,
      cars: top.map((item) => ({ ...item.car.pick, starred: false })),
      via: "page",
    }),
  }
  byCatalog.set(code, figures)
  return figures
}
