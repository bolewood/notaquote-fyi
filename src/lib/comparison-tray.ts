/**
 * The compare-cars list: who's driving, and up to 15 cars, some starred.
 * Kept in this browser's local storage only. It never holds a price: prices
 * are worked out fresh each time from the engine.
 */
import { carKey } from "./car-search"
import { DEFAULT_SCENARIO, withTeenFlag, type Scenario } from "./scenario"
import { scenarioFromRecord, vehiclePickFromRecord } from "./share-link"

export const COMPARE_STORAGE_KEY = "notaquote.compare.v1"
export const COMPARE_EVENT = "notaquote-compare"
export const COMPARE_LIMIT = 15

export type ComparedCar = {
  year: number
  make: string
  model: string
  trim: string
  starred: boolean
}

export type CompareList = {
  /** The driver, place, and coverage. Its car fields aren't used here. */
  driver: Scenario
  teenOnParentPolicy: boolean
  /** Start from what they pay now (set on the What-if page) instead of a typical price. */
  useMyPremium: boolean
  cars: ComparedCar[]
}

/** A new driver on a parent's policy: the question most people bring here. */
export const DEFAULT_COMPARE: CompareList = {
  driver: withTeenFlag({ ...DEFAULT_SCENARIO, age: "16-18", yearsLicensed: "under-1" }),
  teenOnParentPolicy: true,
  useMyPremium: false,
  cars: [],
}

export type AddResult = { list: CompareList; added: number; skipped: "full" | "duplicate" | null }

/** Add cars to the end of the list, skipping ones already there, up to 15. */
export function addCars(list: CompareList, picks: readonly Omit<ComparedCar, "starred">[]): AddResult {
  const cars = [...list.cars]
  const keys = new Set(cars.map((car) => carKey(car)))
  let added = 0
  let skipped: AddResult["skipped"] = null
  for (const pick of picks) {
    const clean = vehiclePickFromRecord(pick)
    if (!clean) continue
    if (keys.has(carKey(clean))) {
      skipped ??= "duplicate"
      continue
    }
    if (cars.length >= COMPARE_LIMIT) {
      skipped = "full"
      break
    }
    cars.push({ ...clean, starred: false })
    keys.add(carKey(clean))
    added += 1
  }
  return { list: { ...list, cars }, added, skipped }
}

export function removeCar(list: CompareList, key: string): CompareList {
  return { ...list, cars: list.cars.filter((car) => carKey(car) !== key) }
}

export function toggleStar(list: CompareList, key: string): CompareList {
  return { ...list, cars: list.cars.map((car) => (carKey(car) === key ? { ...car, starred: !car.starred } : car)) }
}

/** Swap one car for another version of it (a different trim or year), keeping its place and star. */
export function replaceCar(list: CompareList, key: string, next: Omit<ComparedCar, "starred">): CompareList {
  const clean = vehiclePickFromRecord(next)
  if (!clean) return list
  if (list.cars.some((car) => carKey(car) === carKey(clean) && carKey(car) !== key)) return list
  return { ...list, cars: list.cars.map((car) => (carKey(car) === key ? { ...clean, starred: car.starred } : car)) }
}

export function clearCars(list: CompareList, keepStarred = false): CompareList {
  return { ...list, cars: keepStarred ? list.cars.filter((car) => car.starred) : [] }
}

function carFromRecord(value: unknown): ComparedCar | null {
  const pick = vehiclePickFromRecord(value)
  if (!pick) return null
  const starred = (value as { starred?: unknown }).starred
  return { ...pick, starred: starred === true }
}

export function compareFromRecord(value: unknown): CompareList | null {
  if (!value || typeof value !== "object") return null
  const record = value as Record<string, unknown>
  const driver = scenarioFromRecord(record.driver)
  if (!driver) return null
  if (typeof record.teenOnParentPolicy !== "boolean") return null
  if (!Array.isArray(record.cars)) return null
  const cars: ComparedCar[] = []
  const keys = new Set<string>()
  for (const item of record.cars.slice(0, COMPARE_LIMIT)) {
    const car = carFromRecord(item)
    if (!car || keys.has(carKey(car))) continue
    keys.add(carKey(car))
    cars.push(car)
  }
  return {
    driver: withTeenFlag(driver),
    teenOnParentPolicy: record.teenOnParentPolicy,
    useMyPremium: record.useMyPremium === true,
    cars,
  }
}

export function compareFromSnapshot(raw: string): CompareList | null {
  if (!raw) return null
  try {
    const parsed = JSON.parse(raw) as { version?: unknown; list?: unknown }
    if (parsed?.version !== 1) return null
    return compareFromRecord(parsed.list)
  } catch {
    return null
  }
}

/** Only known fields are written, so no price or stray field can be stored. */
export function compareSnapshot(list: CompareList): string {
  const clean = compareFromRecord(list)
  if (!clean) throw new Error("This list could not be saved")
  return JSON.stringify({ version: 1, list: clean })
}

export function readCompare(storage: Pick<Storage, "getItem">): CompareList | null {
  try {
    return compareFromSnapshot(storage.getItem(COMPARE_STORAGE_KEY) ?? "")
  } catch {
    return null
  }
}

export function writeCompare(storage: Pick<Storage, "setItem">, list: CompareList): void {
  storage.setItem(COMPARE_STORAGE_KEY, compareSnapshot(list))
}
