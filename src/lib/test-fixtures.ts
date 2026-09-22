/**
 * Sample drivers for tests and the worked example script. The site itself
 * never shows these; it offers the common questions in scenario.ts.
 */
import { CATALOG_DEFAULTS } from "./catalog-defaults"
import type { Scenario } from "./scenario"

export const MOLLY: Scenario = {
  age: "40-64",
  yearsLicensed: "10+",
  incidents: "clean",
  mileage: "7500-15000",
  teen: false,
  goodStudent: false,
  driverTraining: false,
  householdPolicy: true,
  loanLease: false,
  state: "IL",
  region: "urban",
  coverage: "full",
  deductible: 1000,
  year: CATALOG_DEFAULTS.molly.year,
  make: CATALOG_DEFAULTS.molly.make,
  model: CATALOG_DEFAULTS.molly.model,
  trim: CATALOG_DEFAULTS.molly.trim,
}

export const JAYDEN: Scenario = {
  age: "16-18",
  yearsLicensed: "under-1",
  incidents: "clean",
  mileage: "7500-15000",
  teen: true,
  goodStudent: true,
  driverTraining: true,
  householdPolicy: true,
  loanLease: false,
  state: "TX",
  region: "suburban",
  coverage: "full",
  deductible: 1000,
  year: CATALOG_DEFAULTS.jayden.year,
  make: CATALOG_DEFAULTS.jayden.make,
  model: CATALOG_DEFAULTS.jayden.model,
  trim: CATALOG_DEFAULTS.jayden.trim,
}

export const AVA: Scenario = {
  age: "26-39",
  yearsLicensed: "4-9",
  incidents: "clean",
  mileage: "7500-15000",
  teen: false,
  goodStudent: false,
  driverTraining: false,
  householdPolicy: false,
  loanLease: false,
  state: "CA",
  region: "urban",
  coverage: "full",
  deductible: 1000,
  year: CATALOG_DEFAULTS.ava.year,
  make: CATALOG_DEFAULTS.ava.make,
  model: CATALOG_DEFAULTS.ava.model,
  trim: CATALOG_DEFAULTS.ava.trim,
}
