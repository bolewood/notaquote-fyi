/**
 * The site's popular lists (first cars, SUVs, trucks and fun ones), priced
 * for a new 16–18-year-old, for the state pages and the teen guides.
 *
 * The steps are the Compare page's and the API's (/api/v1/compare with
 * age=16-18): the same parent (parentFor with a fresh browser's situation),
 * the same starting point, and priceCarsTeenAdded, so a number here matches
 * what the Compare page shows for the same cars. The cars are 2022 models,
 * the API's default year: about the age of a typical first car.
 *
 * Our car data is national, so every state puts these cars in the same
 * order. Only the dollar level moves with the state's typical price.
 */
import { resolveCar } from "./car-search"
import type { VehicleCatalog, VehiclePick } from "./catalog"
import { vehicleFacts, type VehicleFacts } from "./catalog-class"
import { carLabel, DEFAULT_MODEL_YEAR, POPULAR_GROUPS } from "./agent-cars"
import {
  estimate,
  nationalTypicalStart,
  teenAddedToPolicy,
  typicalStart,
  type Estimate,
  type StartingPoint,
  type TeenAdded,
} from "./factor-engine"
import { parentFor, priceCarsTeenAdded } from "./pricing"
import { DEFAULT_SCENARIO, type Scenario, type StateCode } from "./scenario"
import { DEFAULT_SITUATION } from "./situation"

export const TEEN_LIST_YEAR = DEFAULT_MODEL_YEAR

/** The three lists a parent picks from (the starter mix repeats their cars). */
export const TEEN_GROUPS = POPULAR_GROUPS.filter((group) => group.id !== "starterMix")

export type TeenGroupId = (typeof TEEN_GROUPS)[number]["id"]

export type TeenCar = {
  pick: VehiclePick
  facts: VehicleFacts
  /** "2022 Honda Civic", with the version when it's what sets the car apart. */
  label: string
  /** "Honda Civic" */
  model: string
  group: TeenGroupId
  /** Position in the combined list, for a stable order when two cars tie. */
  order: number
}

const POOLS = new WeakMap<VehicleCatalog, TeenCar[]>()

/** Every car on the three lists, once, in list order. */
export function teenPool(catalog: VehicleCatalog): TeenCar[] {
  const cached = POOLS.get(catalog)
  if (cached) return cached
  const seen = new Set<string>()
  const cars: TeenCar[] = []
  for (const group of TEEN_GROUPS) {
    for (const quick of group.cars) {
      const pick = resolveCar(catalog, TEEN_LIST_YEAR, quick)
      if (!pick) continue
      const key = `${pick.make}|${pick.model}|${pick.trim}`
      if (seen.has(key)) continue
      seen.add(key)
      cars.push({
        pick,
        facts: vehicleFacts(catalog, pick),
        label: carLabel(pick),
        model: `${pick.make} ${pick.model}`,
        group: group.id,
        order: cars.length,
      })
    }
  }
  POOLS.set(catalog, cars)
  return cars
}

/** The new driver the Compare page starts with: a 16–18-year-old, licensed under a year. */
export function teenDriver(state: StateCode): Scenario {
  return { ...DEFAULT_SCENARIO, age: "16-18", yearsLicensed: "under-1", teen: true, state }
}

/** The parent whose policy the teen joins, as on the Compare page in a fresh browser. */
export function teenParent(state: StateCode): Scenario {
  return parentFor(teenDriver(state), DEFAULT_SITUATION)
}

export type TeenPriced = {
  car: TeenCar
  /** The household's policy before and after adding the teen, with this car. */
  added: TeenAdded
  /** The teen alone on their own policy, with this car. */
  own: Estimate
}

export type Where = { kind: "state"; state: StateCode } | { kind: "national" }

function starts(where: Where): { added: StartingPoint; own: StartingPoint } {
  const state = where.kind === "state" ? where.state : DEFAULT_SCENARIO.state
  const parent = teenParent(state)
  const driver = teenDriver(state)
  if (where.kind === "national") return { added: nationalTypicalStart(parent), own: nationalTypicalStart(driver) }
  const added = typicalStart(parent, { teenOnParentPolicy: true })
  const own = typicalStart(driver)
  if (!added || !own) throw new Error(`No typical price for ${state}`)
  return { added, own }
}

/**
 * Price cars for a new teen, cheapest to add first. "added" is what the
 * Compare page ranks by; "own" is the teen's own policy.
 *
 * The order comes from the national figures, so it's exactly the same in
 * every state. (A state's figures are the national ones scaled by its typical
 * price, so the order would match anyway, except where two cars are within a
 * dollar and rounding could swap them.)
 */
export function priceTeenCars(where: Where, cars: readonly TeenCar[]): TeenPriced[] {
  const state = where.kind === "state" ? where.state : DEFAULT_SCENARIO.state
  const start = starts(where)
  const parent = teenParent(state)
  const driver = teenDriver(state)
  const added = priceCarsTeenAdded(start.added, parent, cars.map((car) => car.facts))
  const national =
    where.kind === "national" ? added : priceCarsTeenAdded(starts({ kind: "national" }).added, teenParent(DEFAULT_SCENARIO.state), cars.map((car) => car.facts))
  return cars
    .map((car, index) => ({
      car,
      added: added[index],
      own: estimate(start.own, { ...driver, ...car.pick }, { vehicle: car.facts }),
      rank: national[index].increase,
    }))
    .sort((left, right) => left.rank - right.rank || left.car.order - right.car.order)
    .map(({ rank, ...item }) => {
      void rank
      return item
    })
}

/**
 * Adding a teen to a typical policy: one average car, full coverage, the
 * state's typical price. Also the same teen on their own policy.
 */
export function typicalTeenCost(where: Where): { added: TeenAdded; own: Estimate; start: StartingPoint } {
  const start = starts(where)
  // The typical policy itself (an average car, as old as the typical start's), then the teen joins it.
  const added = teenAddedToPolicy(start.added, start.added.scenario, { vehicle: "average" })
  const own = estimate(start.own, { ...start.own.scenario, age: "16-18", yearsLicensed: "under-1", teen: true }, { vehicle: "average" })
  return { added, own, start: start.added }
}
