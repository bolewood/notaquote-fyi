/**
 * The worked example in data/factors/README.md: 15 cars in suburban Illinois,
 * full coverage with a $1,000 deductible, starting from Illinois's typical
 * price. Three drivers: a 45-year-old, a 16-year-old on their own policy, and
 * a 16-year-old added to the 45-year-old's policy (the household's increase).
 *
 *   npx tsx scripts/example-table.ts
 *
 * A test checks that the README contains exactly what this prints.
 */
import { readFileSync } from "node:fs"
import path from "node:path"

import type { VehicleCatalog } from "../src/lib/catalog"
import { vehicleFacts } from "../src/lib/catalog-class"
import { compareVehicles, formatDollars, teenAddedToPolicy, typicalStart } from "../src/lib/factor-engine"
import { MOLLY, type Scenario } from "../src/lib/scenario"

export const EXAMPLE_CARS: [string, string, string][] = [
  ["Tesla", "Model Y", "Model Y Long Range AWD"],
  ["Toyota", "RAV4", "RAV4"],
  ["Honda", "CR-V", "CR-V FWD"],
  ["Honda", "Civic", "Civic 4Dr"],
  ["Toyota", "Camry", "Camry"],
  ["Toyota", "Corolla", "Corolla"],
  ["Ford", "F-150", "F150 Pickup 4WD"],
  ["Chevrolet", "Silverado", "Silverado 4WD"],
  ["Jeep", "Wrangler", "Wrangler 2dr 4WD"],
  ["Subaru", "Outback", "Outback AWD"],
  ["Ford", "Mustang", "Mustang"],
  ["Tesla", "Model 3", "Model 3 Long Range AWD"],
  ["Honda", "Accord", "Accord"],
  ["Toyota", "Tacoma", "Tacoma 2WD"],
  ["Kia", "Soul", "Soul"],
]

export const EXAMPLE_ADULT: Scenario = {
  ...MOLLY,
  age: "40-64",
  yearsLicensed: "10+",
  incidents: "clean",
  mileage: "7500-15000",
  teen: false,
  goodStudent: false,
  driverTraining: false,
  householdPolicy: false,
  loanLease: false,
  state: "IL",
  region: "suburban",
  coverage: "full",
  deductible: 1000,
  year: 2024,
}

export const EXAMPLE_TEEN: Scenario = { ...EXAMPLE_ADULT, age: "16-18", yearsLicensed: "under-1", teen: true }

export function loadCatalog(root = process.cwd()): VehicleCatalog {
  return JSON.parse(readFileSync(path.join(root, "public", "catalog", "vehicle-catalog.json"), "utf8")) as VehicleCatalog
}

/** The example as Markdown: one intro line and the table. */
export function exampleTable(catalog: VehicleCatalog): string {
  const vehicles = EXAMPLE_CARS.map(([make, model, trim]) => vehicleFacts(catalog, { year: 2024, make, model, trim }))
  const start = typicalStart(EXAMPLE_ADULT)
  if (!start) throw new Error("No typical premium for Illinois")
  const adult = compareVehicles(start, EXAMPLE_ADULT, vehicles)
  const teen = compareVehicles(start, EXAMPLE_TEEN, vehicles)
  const money = (low: number, likely: number, high: number) =>
    `${formatDollars(likely)} (${formatDollars(low)}–${formatDollars(high)})`
  const lines = [
    `Starting point: ${start.attribution}`,
    "",
    "| 2024 vehicle | HLDI row used | Liability | Damage | 45-year-old | 16-year-old, own policy | Adding a 16-year-old to the 45-year-old's policy |",
    "| --- | --- | --- | --- | --- | --- | --- |",
  ]
  adult.forEach((row, index) => {
    const relativity = row.estimate.vehicle
    const matched =
      relativity.level === "model" ? relativity.rows.map((item) => item.series).join("; ") : `class average (${relativity.label})`
    const a = row.estimate
    const t = teen[index].estimate
    const added = teenAddedToPolicy(start, { ...EXAMPLE_ADULT, make: row.vehicle.make, model: row.vehicle.model, trim: row.vehicle.trim }, { vehicle: row.vehicle })
    const household = `+${formatDollars(added.increase)} (policy ${formatDollars(added.after.likely)}, ${formatDollars(added.after.low)}–${formatDollars(added.after.high)})`
    lines.push(
      `| ${row.vehicle.make} ${row.vehicle.trim} | ${matched} | ${(relativity.liabilityHundredths / 100).toFixed(2)} | ${(relativity.physicalHundredths / 100).toFixed(2)} | ${money(a.low, a.likely, a.high)} | ${money(t.low, t.likely, t.high)} | ${household} |`,
    )
  })
  return lines.join("\n")
}

if (process.argv[1] && path.resolve(process.argv[1]) === path.resolve(process.cwd(), "scripts", "example-table.ts")) {
  console.log(exampleTable(loadCatalog()))
}
