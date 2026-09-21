import assert from "node:assert/strict"
import test from "node:test"
import {
  isCommercialChassisModel,
  isExcludedVehicleName,
  matchFeRow,
  UNRESOLVED_TRIM_NAME,
} from "./catalog-match"

test("F-150 pickup joins the NHTSA model at high confidence", () => {
  const match = matchFeRow("F150", "F150 Pickup 4WD", ["F-150", "F-250", "Transit"])
  assert.deepEqual(match, { name: "F-150", confidence: "high" })
})

test("Lightning keeps a limited join instead of a made-up trim", () => {
  const match = matchFeRow("F-150 Lightning", "F-150 Lightning 4WD", ["F-150", "Transit"])
  assert.deepEqual(match, { name: "F-150", confidence: "limited" })
})

test("Ioniq 5 N prefers the longer NHTSA model", () => {
  const match = matchFeRow("Ioniq 5", "Ioniq 5 N", ["Ioniq 5", "Ioniq 5 N", "Ioniq 6"])
  assert.deepEqual(match, { name: "Ioniq 5 N", confidence: "high" })
})

test("a slash in the source name limits trim confidence", () => {
  const match = matchFeRow("Camry", "Camry AWD LE/SE", ["Camry"])
  assert.equal(match?.name, "Camry")
  assert.equal(match?.confidence, "limited")
})

test("Model Y Long Range stays on Model Y", () => {
  const match = matchFeRow("Model Y", "Model Y Long Range AWD", ["Model Y", "Model 3"])
  assert.deepEqual(match, { name: "Model Y", confidence: "high" })
})

test("excluded names are not personal light-duty rows", () => {
  assert.equal(isExcludedVehicleName("Commercial Chassis"), true)
  assert.equal(isExcludedVehicleName("Motorhome Chassis"), true)
  assert.equal(isExcludedVehicleName("Ioniq 5 Robo taxi"), true)
  assert.equal(isExcludedVehicleName("Colorado Cab Chassis inc 2WD"), true)
  assert.equal(isExcludedVehicleName("Civic"), false)
  assert.equal(isCommercialChassisModel("Ram", "4500"), true)
  assert.equal(isCommercialChassisModel("Ram", "2500"), true)
  assert.equal(isCommercialChassisModel("Ram", "3500"), true)
  assert.equal(isCommercialChassisModel("Ford", "E-450"), true)
  assert.equal(isCommercialChassisModel("Ram", "1500"), false)
  assert.equal(isCommercialChassisModel("Mazda", "B4000"), false)
  assert.equal(UNRESOLVED_TRIM_NAME, "Trim not resolved")
})
