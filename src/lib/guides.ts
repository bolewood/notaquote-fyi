/**
 * The national guides (/guides/...): their addresses, titles, and the figures
 * they show, from the same engine as the rest of the site.
 */
import type { VehicleCatalog } from "./catalog"
import { differenceWords, estimateDollars } from "./format"
import { DEFAULT_SCENARIO, STATES, type StateCode } from "./scenario"
import { encodeSharePath } from "./share-link"
import { priceTeenCars, teenDriver, teenPool, TEEN_GROUPS, typicalTeenCost, type TeenGroupId, type TeenPriced } from "./teen-cars"
import { estimate } from "./factor-engine"

export type Guide = { slug: string; path: string; title: string; description: string; blurb: string }

export const TEEN_CARS_GUIDE = {
  slug: "cheapest-cars-to-insure-for-teens",
  path: "/guides/cheapest-cars-to-insure-for-teens",
  title: "The cheapest cars to insure for a new teen driver",
  description:
    "Which popular first cars, SUVs, and trucks cost the least to insure for a new 16-year-old, why (insurance claims data), and why the order is the same in every state. Planning estimates, not quotes.",
  blurb: "Which popular cars cost the least to add a new 16-year-old with, and why.",
} as const satisfies Guide

export const TEEN_COST_GUIDE = {
  slug: "adding-a-teen-driver",
  path: "/guides/adding-a-teen-driver",
  title: "How much does adding a teen driver cost?",
  description:
    "What adding a 16-year-old to your car insurance costs in every state, how it compares with the teen's own policy, and what brings it down. From public data, with the range shown.",
  blurb: "What a new 16-year-old adds to a typical policy, state by state, and what brings it down.",
} as const satisfies Guide

export const GUIDES: readonly Guide[] = [TEEN_CARS_GUIDE, TEEN_COST_GUIDE]

/** The popular lists for a new teen, priced nationally, cheapest to add first. */
export function nationalTeenCars(catalog: VehicleCatalog): TeenPriced[] {
  return priceTeenCars({ kind: "national" }, teenPool(catalog))
}

export function teenCarsByGroup(catalog: VehicleCatalog): { id: TeenGroupId; label: string; cars: TeenPriced[] }[] {
  const all = nationalTeenCars(catalog)
  return TEEN_GROUPS.map((group) => ({
    id: group.id,
    label: group.label,
    cars: all.filter((item) => item.car.group === group.id),
  }))
}

/** "Add these to a comparison": the cars, added to the visitor's own list (their own driver). */
export function addCarsHref(cars: readonly TeenPriced[]): string {
  return encodeSharePath({
    page: "/compare",
    scenario: teenDriver(DEFAULT_SCENARIO.state),
    teenOnParentPolicy: true,
    cars: cars.map((item) => ({ ...item.car.pick, starred: false })),
    via: "add",
  })
}

/** "Try it with your own numbers": a new 16-year-old, tried on the visitor's own situation. */
export function addTeenHref(): string {
  return encodeSharePath({
    page: "/",
    scenario: DEFAULT_SCENARIO,
    teenOnParentPolicy: true,
    next: { ...DEFAULT_SCENARIO, age: "16-18", yearsLicensed: "under-1", teen: true },
    via: "add",
  })
}

export type StateTeenRow = {
  code: StateCode
  name: string
  /** What adding the teen costs a year. */
  added: number
  /** The whole policy after adding the teen: low and high. */
  afterLow: number
  afterHigh: number
  own: number
}

/** Adding a 16-year-old to a typical policy in every state, and the teen's own policy. */
export function teenCostByState(): StateTeenRow[] {
  return STATES.map((state) => {
    const cost = typicalTeenCost({ kind: "state", state: state.code })
    return {
      code: state.code,
      name: state.name,
      added: cost.added.increase,
      afterLow: cost.added.after.low,
      afterHigh: cost.added.after.high,
      own: cost.own.likely,
    }
  })
}

/** The national typical figures, with and without the two usual discounts. */
export function nationalTeenCost() {
  const plain = typicalTeenCost({ kind: "national" })
  const start = plain.start
  const discounts = { ...start.scenario, goodStudent: true, driverTraining: true }
  const withDiscounts = estimate(start, { ...discounts, age: "16-18", yearsLicensed: "under-1", teen: true }, { vehicle: "average", teenOnParentPolicy: true })
  return {
    ...plain,
    withDiscounts: withDiscounts.likely - plain.added.before.likely,
    percent: Math.round((plain.added.after.likely / plain.added.before.likely - 1) * 100),
  }
}

export function teenCarsHeadline(catalog: VehicleCatalog): string {
  const all = nationalTeenCars(catalog)
  const first = all[0]
  const last = all.at(-1)!
  return `Nationally, the ${first.car.label} costs the least of the ${all.length} to add a new 16-year-old with: about ${differenceWords(first.added.increase)}. The ${last.car.label} costs the most: about ${differenceWords(last.added.increase)}. On their own policy, the same teen would pay about ${estimateDollars(first.own.likely)} a year with the ${first.car.model}.`
}
