import assert from "node:assert/strict"
import { readFileSync } from "node:fs"
import test from "node:test"
import type { VehicleCatalog } from "./catalog"
import { classFromEpa, powertrainCode, powertrainFromName, vehicleFacts } from "./catalog-class"

const catalog = JSON.parse(readFileSync("public/catalog/vehicle-catalog.json", "utf8")) as VehicleCatalog

function facts(year: number, make: string, model: string, trim: string) {
  const trims = catalog.vehicles[String(year)]?.[make]?.[model]
  assert.ok(trims, `${year} ${make} ${model} is in the snapshot`)
  assert.ok(
    trim === "Trim not resolved" || trims.some((item) => item.name === trim),
    `${year} ${make} ${model} has trim ${trim}`,
  )
  return vehicleFacts(catalog, { year, make, model, trim })
}

test("the snapshot carries EPA classes and powertrain codes", () => {
  assert.ok(catalog.vehicleClasses && catalog.vehicleClasses.length >= 20)
  assert.ok(catalog.vehicleClasses.includes("Standard Pickup Trucks 4WD"))
  assert.ok(catalog.vehicleClasses.includes("Small Sport Utility Vehicle 4WD"))
  assert.deepEqual(Object.keys(catalog.powertrains ?? {}).sort(), ["e", "f", "g", "h", "p"])
  let resolved = 0
  let classed = 0
  for (const makes of Object.values(catalog.vehicles)) {
    for (const models of Object.values(makes)) {
      for (const trims of Object.values(models)) {
        for (const trim of trims) {
          if (trim.name === "Trim not resolved") {
            assert.equal(trim.c, undefined)
            continue
          }
          resolved += 1
          if (trim.c !== undefined) classed += 1
        }
      }
    }
  }
  assert.equal(classed, resolved, "every FuelEconomy trim has an EPA class")
})

test("a Range Rover is a standard SUV, not a pickup", () => {
  const rangeRover = facts(2023, "Land Rover", "Range Rover", "New Range Rover")
  assert.equal(rangeRover.epaClass, "Standard Sport Utility Vehicle 4WD")
  assert.equal(rangeRover.classId, "large-suv")
  assert.equal(rangeRover.powertrain, "combustion")
  assert.equal(rangeRover.classSource, "epa-trim")

  const evoque = facts(2024, "Land Rover", "Range Rover Evoque", "Range Rover Evoque")
  assert.equal(evoque.classId, "small-suv")

  const phev = facts(2023, "Land Rover", "Range Rover", "New Range Rover P440 PHEV")
  assert.equal(phev.classId, "large-suv")
  assert.equal(phev.powertrain, "plug-in-hybrid")

  // The unresolved NHTSA row borrows the class from another year of the same model.
  const sport = facts(2023, "Land Rover", "Range Rover Sport", "Trim not resolved")
  assert.notEqual(sport.classId, "large-pickup")
  assert.notEqual(sport.classId, "small-pickup")
})

test("the Ioniq hybrid is a hybrid car and the Ioniq 5 is an electric SUV", () => {
  const hybrid = facts(2020, "Hyundai", "Ioniq", "Ioniq")
  assert.equal(hybrid.powertrain, "hybrid")
  assert.equal(hybrid.epaClass, "Large Cars")
  assert.equal(hybrid.classId, "large-car")

  const electric = facts(2020, "Hyundai", "Ioniq", "Ioniq Electric")
  assert.equal(electric.powertrain, "electric")

  const plugIn = facts(2020, "Hyundai", "Ioniq", "Ioniq Plug-in Hybrid")
  assert.equal(plugIn.powertrain, "plug-in-hybrid")

  const ioniq5 = facts(2025, "Hyundai", "Ioniq 5", "Ioniq 5 AWD XRT")
  assert.equal(ioniq5.powertrain, "electric")
  assert.equal(ioniq5.classId, "small-suv")
  assert.equal(ioniq5.classSource, "epa-trim")

  // 2023 has only an unresolved row; the class and powertrain come from other years.
  const unresolved = facts(2023, "Hyundai", "Ioniq 5", "Trim not resolved")
  assert.equal(unresolved.powertrain, "electric")
  assert.equal(unresolved.classId, "small-suv")
  assert.equal(unresolved.classSource, "epa-other-year")
})

test("the F-150 Lightning is an electric full-size pickup; the F-150 is gas or hybrid", () => {
  const lightning = facts(2023, "Ford", "F-150", "F-150 Lightning 4WD")
  assert.equal(lightning.classId, "large-pickup")
  assert.equal(lightning.powertrain, "electric")
  const gas = facts(2023, "Ford", "F-150", "F150 Pickup 4WD")
  assert.equal(gas.classId, "large-pickup")
  assert.equal(gas.powertrain, "combustion")
  const hybrid = facts(2023, "Ford", "F-150", "F150 Pickup 4WD HEV")
  assert.equal(hybrid.powertrain, "hybrid")
  const flex = facts(2023, "Ford", "F-150", "F150 Pickup 4WD FFV")
  assert.equal(flex.powertrain, "combustion")
})

test("Model Y, RAV4, RAV4 Hybrid, and Civic", () => {
  const modelY = facts(2023, "Tesla", "Model Y", "Model Y Long Range AWD")
  assert.equal(modelY.classId, "small-suv")
  assert.equal(modelY.powertrain, "electric")
  assert.equal(modelY.epaClass, "Small Sport Utility Vehicle 4WD")

  const rav4 = facts(2023, "Toyota", "RAV4", "RAV4")
  assert.equal(rav4.classId, "small-suv")
  assert.equal(rav4.powertrain, "combustion")
  assert.equal(rav4.epaClass, "Small Sport Utility Vehicle 2WD")

  const rav4Hybrid = facts(2023, "Toyota", "RAV4", "RAV4 Hybrid AWD")
  assert.equal(rav4Hybrid.classId, "small-suv")
  assert.equal(rav4Hybrid.powertrain, "hybrid")

  const civic = facts(2024, "Honda", "Civic", "Civic 4Dr")
  assert.equal(civic.classId, "midsize-car")
  assert.equal(civic.powertrain, "combustion")
  const hatch = facts(2023, "Honda", "Civic", "Civic 5Dr")
  assert.equal(hatch.classId, "large-car", "EPA sizes by interior room, so the hatchback is a large car")
})

test("classification falls back to whole words only when the catalog has nothing", () => {
  const noCatalog = vehicleFacts(null, { year: 2023, make: "Land Rover", model: "Range Rover", trim: "" })
  assert.equal(noCatalog.classId, null, "no substring guess: 'rangerover' does not make a Ranger")
  assert.equal(noCatalog.classSource, "unknown")

  const named = vehicleFacts(null, { year: 2023, make: "Ford", model: "F-150", trim: "F-150 Lightning 4WD" })
  assert.equal(named.powertrain, "electric")
  assert.equal(named.powertrainSource, "name")

  const ioniq = vehicleFacts(null, { year: 2020, make: "Hyundai", model: "Ioniq", trim: "Ioniq" })
  assert.equal(ioniq.powertrain, null, "the word Ioniq alone says nothing about the powertrain")

  assert.equal(powertrainFromName("RAV4 Hybrid AWD"), "hybrid")
  assert.equal(powertrainFromName("Prius Prime (PHEV)"), "plug-in-hybrid")
  assert.equal(powertrainFromName("Evoque"), null)
})

test("EPA class and atvType mappings", () => {
  assert.equal(classFromEpa("Standard Pickup Trucks 4WD"), "large-pickup")
  assert.equal(classFromEpa("Small Pickup Trucks 2WD"), "small-pickup")
  assert.equal(classFromEpa("Small Sport Utility Vehicle 4WD"), "small-suv")
  assert.equal(classFromEpa("Standard Sport Utility Vehicle 2WD"), "large-suv")
  assert.equal(classFromEpa("Sport Utility Vehicle - 4WD"), "suv")
  assert.equal(classFromEpa("Minivan - 2WD"), "minivan")
  assert.equal(classFromEpa("Vans, Passenger Type"), "van")
  assert.equal(classFromEpa("Two Seaters"), "two-seater")
  assert.equal(classFromEpa("Subcompact Cars"), "small-car")
  assert.equal(classFromEpa("Midsize Station Wagons"), "midsize-car")
  assert.equal(classFromEpa("Special Purpose Vehicle 4WD"), "special-purpose")
  assert.equal(powertrainCode("EV"), "e")
  assert.equal(powertrainCode("Hybrid"), "h")
  assert.equal(powertrainCode("Plug-in Hybrid"), "p")
  assert.equal(powertrainCode("FFV"), "g")
  assert.equal(powertrainCode(""), "g")
  for (const vclass of catalog.vehicleClasses ?? []) {
    assert.notEqual(classFromEpa(vclass), null, vclass)
  }
})
