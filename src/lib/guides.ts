/**
 * The national guides (/guides/...): their addresses, titles, and the figures
 * they show, from the same engine as the rest of the site.
 */
import type { VehicleCatalog } from "./catalog"
import { differenceWords } from "./format"
import { ENGINE_UPDATED } from "./site-meta"
import { DEFAULT_SCENARIO, STATES, type StateCode } from "./scenario"
import { encodeSharePath } from "./share-link"
import { MODELS_ENABLED } from "./car-page-links"
import { modelsWords, tiedAtTop } from "./state-content"
import { priceTeenCars, teenDriver, teenPool, TEEN_GROUPS, typicalTeenCost, type TeenGroupId, type TeenPriced } from "./teen-cars"

export type Guide = { slug: string; path: string; title: string; description: string; blurb: string; published: string }

export const TEEN_CARS_GUIDE = {
  slug: "cheapest-cars-to-insure-for-teens",
  path: "/guides/cheapest-cars-to-insure-for-teens",
  title: "Cheapest cars to insure for a teen driver",
  description:
    "Which popular first cars, SUVs, and trucks cost the least to insure for a new 16-year-old, why, and why the order is the same in every state.",
  blurb: "Which popular cars cost the least to add a new 16-year-old with, and why.",
  published: "2026-09-23",
} as const satisfies Guide

export const TEEN_COST_GUIDE = {
  slug: "adding-a-teen-driver",
  path: "/guides/adding-a-teen-driver",
  title: "Adding a teen driver: what it costs",
  description:
    "What adding a 16-year-old to your car insurance costs in every state, how it compares with the teen's own policy, and what changes it. From public data.",
  blurb: "What a new 16-year-old adds to a typical policy, state by state, and what changes it.",
  published: "2026-09-23",
} as const satisfies Guide

export const GUIDES: readonly Guide[] = [TEEN_CARS_GUIDE, TEEN_COST_GUIDE]

/** When a guide last changed: its launch, or the data behind it if that's newer. The Article and the sitemap both use this. */
export function guideModified(guide: Guide): string {
  return ENGINE_UPDATED > guide.published ? ENGINE_UPDATED : guide.published
}

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

/** "Compare these for your teen": the cars, for a new 16-year-old in the visitor's own state, shown like a shared list. */
export function teenCarsHref(cars: readonly TeenPriced[]): string {
  return encodeSharePath({
    page: "/compare",
    scenario: teenDriver(DEFAULT_SCENARIO.state),
    teenOnParentPolicy: true,
    cars: cars.map((item) => ({ ...item.car.pick, starred: false })),
    via: "teen",
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

/** The national typical figures. */
export function nationalTeenCost() {
  const plain = typicalTeenCost({ kind: "national" })
  return { ...plain, share: plain.added.after.likely / plain.added.before.likely - 1 }
}

/** "roughly two-thirds more": a share of a bill in words. */
export function shareWords(share: number): string {
  const options: [number, string][] = [
    [1 / 4, "a quarter"],
    [1 / 3, "a third"],
    [1 / 2, "half"],
    [2 / 3, "two-thirds"],
    [3 / 4, "three-quarters"],
    [1, "double"],
  ]
  const [, words] = options.reduce((best, option) => (Math.abs(option[0] - share) < Math.abs(best[0] - share) ? option : best))
  return words === "double" ? "roughly double" : `roughly ${words} more`
}

export { modelsWords }

/**
 * The guide's answer, from the numbers: the three cheapest and the priciest.
 * When many cars tie (no per-model claims data), it says so instead of naming
 * a winner.
 */
export function teenCarsLead(catalog: VehicleCatalog): string {
  const all = nationalTeenCars(catalog)
  const ties = tiedAtTop(all)
  if (ties >= 3 && !MODELS_ENABLED) {
    return `Of ${all.length} popular first cars, SUVs, and trucks, ${ties} tie for the least to add a new 16-year-old with, about ${differenceWords(all[0].added.increase)} nationally: without claims results for each model, cars of the same kind come out the same.`
  }
  const top = all.slice(0, Math.max(3, ties))
  const lastMake = all.at(-1)!.car.pick.make
  const priciest = all.slice(-2).every((item) => item.car.pick.make === lastMake) ? `${lastMake}s cost the most` : `The ${all.at(-1)!.car.model} costs the most`
  return `Of ${all.length} popular first cars, SUVs, and trucks, ${modelsWords(top)} cost the least to add a new 16-year-old: about ${differenceWords(top[0].added.increase)} nationally. ${priciest}, at about ${differenceWords(all.at(-1)!.added.increase)}.`
}
