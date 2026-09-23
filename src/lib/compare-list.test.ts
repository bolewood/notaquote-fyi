import assert from "node:assert/strict"
import test from "node:test"
import { carKey } from "./car-search"
import { DEFAULT_SCENARIO } from "./scenario"
import { DEFAULT_SITUATION } from "./situation"
import {
  addCars,
  addSharedCars,
  carryFromWhatIf,
  carryNote,
  defaultCompareFor,
  clearCars,
  COMPARE_LIMIT,
  COMPARE_STORAGE_KEY,
  compareSnapshot,
  DEFAULT_COMPARE,
  readCompare,
  removeCar,
  replaceCar,
  toggleStar,
  writeCompare,
} from "./compare-list"

function memoryStorage() {
  const data = new Map<string, string>()
  return {
    data,
    getItem(key: string) {
      return data.has(key) ? data.get(key)! : null
    },
    setItem(key: string, value: string) {
      data.set(key, value)
    },
  }
}

const CIVIC = { year: 2022, make: "Honda", model: "Civic", trim: "Civic 4Dr" }
const COROLLA = { year: 2022, make: "Toyota", model: "Corolla", trim: "Corolla" }

test("the default list is a new teen driver on a parent's policy, with no cars", () => {
  assert.equal(DEFAULT_COMPARE.driver.age, "16-18")
  assert.equal(DEFAULT_COMPARE.teenOnParentPolicy, true)
  assert.equal(DEFAULT_COMPARE.cars.length, 0)
})

test("adding skips duplicates and stops at 15", () => {
  let result = addCars(DEFAULT_COMPARE, [CIVIC, COROLLA, CIVIC])
  assert.equal(result.added, 2)
  assert.equal(result.skipped, "duplicate")
  assert.deepEqual(
    result.list.cars.map((car) => car.model),
    ["Civic", "Corolla"],
  )

  const many = Array.from({ length: 20 }, (_, index) => ({ ...CIVIC, trim: `Civic ${index}` }))
  result = addCars(DEFAULT_COMPARE, many)
  assert.equal(result.list.cars.length, COMPARE_LIMIT)
  assert.equal(result.added, COMPARE_LIMIT)
  assert.equal(result.skipped, "full")
})

test("stars, removing, replacing, and clearing", () => {
  let list = addCars(DEFAULT_COMPARE, [CIVIC, COROLLA]).list
  list = toggleStar(list, carKey(CIVIC))
  assert.equal(list.cars[0].starred, true)
  list = replaceCar(list, carKey(CIVIC), { ...CIVIC, year: 2020 })
  assert.equal(list.cars[0].year, 2020)
  assert.equal(list.cars[0].starred, true, "a replaced car keeps its star")
  assert.equal(clearCars(list, true).cars.length, 1)
  assert.equal(clearCars(list).cars.length, 0)
  list = removeCar(list, carKey(COROLLA))
  assert.deepEqual(
    list.cars.map((car) => car.model),
    ["Civic"],
  )
})

test("the list survives a reload, and only known fields are stored", () => {
  const storage = memoryStorage()
  const list = toggleStar(addCars(DEFAULT_COMPARE, [CIVIC, COROLLA]).list, carKey(COROLLA))
  writeCompare(storage, list)
  const again = readCompare(storage)
  assert.deepEqual(again, list)

  const raw = storage.data.get(COMPARE_STORAGE_KEY) ?? ""
  for (const word of ['"likely"', '"low"', '"high"', '"monthly"', '"premium"', '"anchor"']) {
    assert.equal(raw.includes(word), false, word)
  }
})

test("a stored price or stray field is dropped on read, and junk reads as nothing", () => {
  const storage = memoryStorage()
  const snapshot = JSON.parse(compareSnapshot(addCars(DEFAULT_COMPARE, [CIVIC]).list))
  snapshot.list.cars[0].likely = 2500
  snapshot.list.premium = 1800
  storage.setItem(COMPARE_STORAGE_KEY, JSON.stringify(snapshot))
  const read = readCompare(storage)
  assert.ok(read)
  assert.equal("likely" in (read?.cars[0] ?? {}), false)
  assert.equal("premium" in (read ?? {}), false)

  storage.setItem(COMPARE_STORAGE_KEY, "{not json")
  assert.equal(readCompare(storage), null)
  storage.setItem(COMPARE_STORAGE_KEY, JSON.stringify({ version: 9, list: {} }))
  assert.equal(readCompare(storage), null)
})

test("a saved situation sets the starting driver, place, and coverage", () => {
  const situation = { ...DEFAULT_SITUATION, scenario: { ...DEFAULT_SCENARIO, age: "26-39" as const, state: "TX" as const } }
  const list = defaultCompareFor(situation)
  assert.equal(list.driver.age, "26-39")
  assert.equal(list.driver.state, "TX")
  assert.equal(list.cars.length, 0)
  assert.deepEqual(defaultCompareFor(null), DEFAULT_COMPARE, "no saved situation: the teen question")
})

test("Compare more cars carries the what-if's driver and both cars into your own list", () => {
  const own = addCars(DEFAULT_COMPARE, [COROLLA]).list
  const driver = { ...DEFAULT_SCENARIO, state: "CO" as const }
  const carried = carryFromWhatIf(own, driver, false, [CIVIC, COROLLA])
  assert.equal(carried.driver.state, "CO")
  assert.equal(carried.teenOnParentPolicy, false)
  assert.deepEqual(carried.cars.map((car) => car.model), ["Corolla", "Civic"], "keeps your cars, adds new ones once")
  assert.equal(carryFromWhatIf(null, driver, false, [CIVIC]).cars.length, 1)
})

test("adding a shared list keeps your own cars and driver, and brings the sender's stars", () => {
  const own = addCars(DEFAULT_COMPARE, [COROLLA]).list
  const shared = toggleStar(addCars({ ...DEFAULT_COMPARE, driver: { ...DEFAULT_SCENARIO, state: "CA" } }, [CIVIC, COROLLA]).list, carKey(CIVIC))
  const merged = addSharedCars(own, shared)
  assert.equal(merged.driver.state, own.driver.state)
  assert.deepEqual(merged.cars.map((car) => `${car.model}:${car.starred}`), ["Corolla:false", "Civic:true"])
})

test("after Compare more cars, we say what arrived and what didn't fit", () => {
  const name = (car: { year: number; make: string; model: string }) => `${car.year} ${car.make} ${car.model}`
  const camry = { year: 2020, make: "Toyota", model: "Camry", trim: "Camry" }
  const mustang = { year: 2025, make: "Ford", model: "Mustang", trim: "Mustang" }
  const list = { ...DEFAULT_COMPARE, cars: [{ ...camry, starred: false }, { ...mustang, starred: false }] }
  assert.equal(
    carryNote(list, [camry, mustang], name),
    "We brought over the driver from your what-if, and the 2020 Toyota Camry and 2025 Ford Mustang.",
  )
  const full = { ...DEFAULT_COMPARE, cars: [{ ...camry, starred: false }] }
  assert.equal(
    carryNote(full, [camry, mustang], name),
    "We brought over the driver from your what-if, and the 2020 Toyota Camry. Your list was full, so the 2025 Ford Mustang didn't fit. Remove a car to make room.",
  )
})

test("a car page's Add it to a comparison says the car arrived, not a driver", () => {
  const name = (car: { year: number; make: string; model: string }) => `${car.year} ${car.make} ${car.model}`
  const rav4 = { year: 2024, make: "Toyota", model: "RAV4", trim: "RAV4" }
  const civic = { year: 2022, make: "Honda", model: "Civic", trim: "Civic 4Dr" }
  const list = { ...DEFAULT_COMPARE, cars: [{ ...civic, starred: false }, { ...rav4, starred: false }] }
  assert.equal(carryNote(list, [rav4], name, false), "The 2024 Toyota RAV4 is on your list, priced for the same driver as the rest.")
  const alone = { ...DEFAULT_COMPARE, cars: [{ ...rav4, starred: false }] }
  assert.equal(carryNote(alone, [rav4], name, false), "The 2024 Toyota RAV4 is on your list. Check who's driving, then add more cars to compare.")
  const full = { ...DEFAULT_COMPARE, cars: [] }
  assert.equal(carryNote(full, [rav4], name, false), "Your list was full, so the 2024 Toyota RAV4 didn't fit. Remove a car to make room.")
})
