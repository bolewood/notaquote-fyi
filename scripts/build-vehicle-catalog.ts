/**
 * Build the versioned personal light-duty catalog.
 * Raw downloads stay in .catalog-cache and are not committed.
 */
import { createHash } from "node:crypto"
import { mkdir, readFile, writeFile } from "node:fs/promises"
import path from "node:path"

import type { CatalogTrim, VehicleCatalog } from "../src/lib/catalog"
import {
  compactName,
  higherConfidence,
  isExcludedVehicleName,
  matchFeRow,
  UNRESOLVED_TRIM_NAME,
} from "../src/lib/catalog-match"

const RETRIEVED_ON = "2026-09-21"
const VERSION = `catalog-${RETRIEVED_ON}`
const YEAR_MIN = 2006
const REFRESH_DAYS = 180
const CACHE_DIR = path.join(process.cwd(), ".catalog-cache")
const FE_CSV_URL = "https://www.fueleconomy.gov/feg/epadata/vehicles.csv"
const FE_DOCS_URL = "https://www.fueleconomy.gov/feg/ws/index.shtml"
const NHTSA_API = "https://vpic.nhtsa.dot.gov/api/"
const USER_AGENT = "NotAQuote.FYI catalog snapshot"

const TERMS =
  "Retrieved 21 September 2026. NHTSA vPIC (https://vpic.nhtsa.dot.gov/api/) is the manufacturer-submitted vehicle listing. Callers are subject to NHTSA’s automated rate control. This snapshot requests passenger car, truck, and multipurpose passenger vehicle models only and stores no VINs. FuelEconomy.gov vehicles.csv (https://www.fueleconomy.gov/feg/epadata/vehicles.csv) is the DOE and EPA fuel-economy file, described at https://www.fueleconomy.gov/feg/ws/index.shtml. This snapshot keeps year, make, base model, and model name. It does not keep fuel-cost or economy figures. Both are U.S. government public datasets, copied in this reduced form. Names the sources did not print were not added as trims."

type FeRow = {
  year: number
  make: string
  baseModel: string
  model: string
}

type NhtsaModel = {
  name: string
  types: Set<string>
}

const VEHICLE_TYPES = ["car", "truck", "mpv"] as const

function addDays(iso: string, days: number): string {
  const date = new Date(`${iso}T00:00:00Z`)
  date.setUTCDate(date.getUTCDate() + days)
  return date.toISOString().slice(0, 10)
}

async function readCache(url: string): Promise<string | null> {
  const file = path.join(CACHE_DIR, `${createHash("sha256").update(url).digest("hex")}.txt`)
  try {
    return await readFile(file, "utf8")
  } catch {
    return null
  }
}

async function writeCache(url: string, body: string): Promise<void> {
  const file = path.join(CACHE_DIR, `${createHash("sha256").update(url).digest("hex")}.txt`)
  await writeFile(file, body)
}

async function fetchText(url: string): Promise<string> {
  const cached = await readCache(url)
  if (cached !== null) return cached
  let lastError: unknown
  for (let attempt = 0; attempt < 4; attempt += 1) {
    try {
      const response = await fetch(url, {
        headers: { "user-agent": USER_AGENT, accept: "application/json,text/csv,*/*" },
      })
      if (response.status === 429 || response.status >= 500) {
        throw new Error(`HTTP ${response.status} for ${url}`)
      }
      if (!response.ok) throw new Error(`HTTP ${response.status} for ${url}`)
      const body = await response.text()
      await writeCache(url, body)
      return body
    } catch (error) {
      lastError = error
      await new Promise((resolve) => setTimeout(resolve, 1000 * (attempt + 1)))
    }
  }
  throw lastError
}

function parseCsv(text: string): string[][] {
  const rows: string[][] = []
  let row: string[] = []
  let field = ""
  let inQuotes = false
  for (let index = 0; index < text.length; index += 1) {
    const char = text[index]
    if (inQuotes) {
      if (char === '"') {
        if (text[index + 1] === '"') {
          field += '"'
          index += 1
        } else {
          inQuotes = false
        }
      } else {
        field += char
      }
      continue
    }
    if (char === '"') {
      inQuotes = true
      continue
    }
    if (char === ",") {
      row.push(field)
      field = ""
      continue
    }
    if (char === "\n" || char === "\r") {
      if (char === "\r" && text[index + 1] === "\n") index += 1
      row.push(field)
      field = ""
      if (row.some((cell) => cell.length > 0)) rows.push(row)
      row = []
      continue
    }
    field += char
  }
  if (field.length > 0 || row.length > 0) {
    row.push(field)
    if (row.some((cell) => cell.length > 0)) rows.push(row)
  }
  return rows
}

function loadFuelEconomy(csv: string): FeRow[] {
  const table = parseCsv(csv)
  const header = table[0]
  if (!header) throw new Error("FuelEconomy file has no header")
  const column = (name: string) => {
    const index = header.indexOf(name)
    if (index < 0) throw new Error(`FuelEconomy file is missing ${name}`)
    return index
  }
  const yearIndex = column("year")
  const makeIndex = column("make")
  const modelIndex = column("model")
  const baseIndex = column("baseModel")
  const rows: FeRow[] = []
  const seen = new Set<string>()
  for (const cells of table.slice(1)) {
    const year = Number(cells[yearIndex])
    if (!Number.isInteger(year) || year < YEAR_MIN) continue
    const make = cells[makeIndex]?.trim() ?? ""
    const model = cells[modelIndex]?.trim() ?? ""
    const baseModel = cells[baseIndex]?.trim() || model
    if (!make || !model) continue
    const key = `${year}|${make}|${baseModel}|${model}`
    if (seen.has(key)) continue
    seen.add(key)
    rows.push({ year, make, baseModel, model })
  }
  return rows
}

type MakeRef = { id: number; name: string }

async function loadNhtsaMakes(): Promise<Map<string, MakeRef>> {
  const makes = new Map<string, MakeRef>()
  for (const vehicleType of VEHICLE_TYPES) {
    const url = `${NHTSA_API}vehicles/GetMakesForVehicleType/${vehicleType}?format=json`
    const payload = JSON.parse(await fetchText(url)) as {
      Results?: { MakeId?: number; MakeName?: string }[]
    }
    for (const result of payload.Results ?? []) {
      if (!result.MakeId || !result.MakeName) continue
      const key = compactName(result.MakeName)
      if (!makes.has(key)) makes.set(key, { id: result.MakeId, name: result.MakeName })
    }
  }
  return makes
}

async function loadNhtsaModels(
  jobs: { id: number; year: number; compactMake: string }[],
): Promise<Map<string, Map<string, NhtsaModel>>> {
  const byYear = new Map<string, Map<string, NhtsaModel>>()
  const requests: { url: string; year: number; compactMake: string; vehicleType: string }[] = []
  for (const job of jobs) {
    for (const vehicleType of VEHICLE_TYPES) {
      requests.push({
        url: `${NHTSA_API}vehicles/GetModelsForMakeIdYear/makeId/${job.id}/modelyear/${job.year}/vehicleType/${vehicleType}?format=json`,
        year: job.year,
        compactMake: job.compactMake,
        vehicleType,
      })
    }
  }

  let cursor = 0
  let finished = 0
  async function worker() {
    while (cursor < requests.length) {
      const request = requests[cursor]
      cursor += 1
      const payload = JSON.parse(await fetchText(request.url)) as {
        Results?: { Model_Name?: string }[]
      }
      const yearKey = String(request.year)
      const yearBucket = byYear.get(yearKey) ?? new Map<string, NhtsaModel>()
      byYear.set(yearKey, yearBucket)
      const prefix = `${request.compactMake}|`
      for (const result of payload.Results ?? []) {
        const name = result.Model_Name?.trim()
        if (!name || isExcludedVehicleName(name)) continue
        const key = `${prefix}${compactName(name)}`
        const existing = yearBucket.get(key)
        if (existing) {
          existing.types.add(request.vehicleType)
          if (name.length > existing.name.length) existing.name = name
        } else {
          yearBucket.set(key, { name, types: new Set([request.vehicleType]) })
        }
      }
      finished += 1
      if (finished % 200 === 0) {
        console.log(`NHTSA ${finished}/${requests.length}`)
      }
    }
  }

  await Promise.all(Array.from({ length: 4 }, () => worker()))
  console.log(`NHTSA ${finished}/${requests.length}`)
  return byYear
}

function preferTrim(
  trims: CatalogTrim[],
  choose: (trim: CatalogTrim) => boolean,
): string {
  const strong = trims.filter((trim) => trim.confidence === "high")
  const pool = strong.length > 0 ? strong : trims.filter((trim) => trim.name !== UNRESOLVED_TRIM_NAME)
  const usable = pool.length > 0 ? pool : trims
  return (usable.find(choose) ?? usable[0]).name
}

async function main() {
  await mkdir(CACHE_DIR, { recursive: true })
  await mkdir(path.join(process.cwd(), "public", "catalog"), { recursive: true })
  await mkdir(path.join(process.cwd(), "data", "catalog"), { recursive: true })

  console.log("Downloading FuelEconomy vehicles.csv if needed")
  const csv = await fetchText(FE_CSV_URL)
  const fuelRows = loadFuelEconomy(csv)
  const excludedFuel = fuelRows.filter((row) =>
    isExcludedVehicleName(`${row.make} ${row.baseModel} ${row.model}`),
  )
  const keptFuel = fuelRows.filter(
    (row) => !isExcludedVehicleName(`${row.make} ${row.baseModel} ${row.model}`),
  )
  console.log(`FuelEconomy rows ${keptFuel.length}, excluded ${excludedFuel.length}`)

  const feMakes = new Map<string, string>()
  for (const row of keptFuel) {
    const key = compactName(row.make)
    const current = feMakes.get(key)
    if (!current || row.make.length > current.length) feMakes.set(key, row.make)
  }

  console.log("Loading NHTSA makes")
  const nhtsaMakes = await loadNhtsaMakes()
  const unmatchedMakes = [...feMakes.keys()].filter((key) => !nhtsaMakes.has(key)).sort()

  const yearsByMake = new Map<string, Set<number>>()
  for (const row of keptFuel) {
    const key = compactName(row.make)
    const years = yearsByMake.get(key) ?? new Set<number>()
    years.add(row.year)
    yearsByMake.set(key, years)
  }

  const jobs: { id: number; year: number; compactMake: string }[] = []
  for (const [compactMake, years] of yearsByMake) {
    const make = nhtsaMakes.get(compactMake)
    if (!make) continue
    for (const year of years) jobs.push({ id: make.id, year, compactMake })
  }
  console.log(`NHTSA make-year jobs ${jobs.length}`)
  const nhtsaModels = await loadNhtsaModels(jobs)

  let nhtsaYearMax = YEAR_MIN
  for (const yearKey of nhtsaModels.keys()) {
    const year = Number(yearKey)
    if (year > nhtsaYearMax && (nhtsaModels.get(yearKey)?.size ?? 0) > 0) nhtsaYearMax = year
  }
  const feYearMax = keptFuel.reduce((max, row) => Math.max(max, row.year), YEAR_MIN)
  const yearMax = Math.min(feYearMax, nhtsaYearMax)

  const vehicles: VehicleCatalog["vehicles"] = {}
  const droppedTrucks: string[] = []
  let highCount = 0
  let limitedCount = 0
  let unresolvedCount = 0
  let weakAttached = 0
  let ownModel = 0

  function addTrim(
    year: number,
    make: string,
    model: string,
    trim: CatalogTrim,
  ) {
    if (year < YEAR_MIN || year > yearMax) return
    const yearBucket = vehicles[String(year)] ?? {}
    const makeBucket = yearBucket[make] ?? {}
    const list = makeBucket[model] ?? []
    const existing = list.find((item) => item.name === trim.name)
    if (existing) {
      existing.confidence = higherConfidence(existing.confidence, trim.confidence)
    } else {
      list.push(trim)
    }
    list.sort((left, right) => left.name.localeCompare(right.name))
    makeBucket[model] = list
    yearBucket[make] = makeBucket
    vehicles[String(year)] = yearBucket
  }

  for (const row of keptFuel) {
    if (row.year > yearMax) continue
    const make = feMakes.get(compactName(row.make)) ?? row.make
    const yearModels = nhtsaModels.get(String(row.year))
    const names: string[] = []
    if (yearModels) {
      const prefix = `${compactName(row.make)}|`
      for (const [key, model] of yearModels) {
        if (key.startsWith(prefix)) names.push(model.name)
      }
    }
    const matched = names.length > 0 ? matchFeRow(row.baseModel, row.model, names) : null
    if (!matched) {
      ownModel += 1
      addTrim(row.year, make, row.baseModel, { name: row.model, confidence: "limited" })
      continue
    }
    if (matched.confidence === "limited") weakAttached += 1
    addTrim(row.year, make, matched.name, {
      name: row.model,
      confidence: matched.confidence,
    })
  }

  for (const [yearKey, models] of nhtsaModels) {
    const year = Number(yearKey)
    if (year > yearMax) continue
    for (const [key, model] of models) {
      const compactMake = key.slice(0, key.indexOf("|"))
      const make = feMakes.get(compactMake)
      if (!make) continue
      const personal = model.types.has("car") || model.types.has("mpv")
      const makeBucket = vehicles[yearKey]?.[make] ?? {}
      const present = Object.keys(makeBucket).some(
        (name) => compactName(name) === compactName(model.name),
      )
      if (present) continue
      if (!personal) {
        droppedTrucks.push(`${year} ${make} ${model.name}`)
        continue
      }
      addTrim(year, make, model.name, {
        name: UNRESOLVED_TRIM_NAME,
        confidence: "unresolved",
      })
    }
  }

  for (const yearBucket of Object.values(vehicles)) {
    for (const makeBucket of Object.values(yearBucket)) {
      for (const trims of Object.values(makeBucket)) {
        for (const trim of trims) {
          if (trim.confidence === "high") highCount += 1
          else if (trim.confidence === "limited") limitedCount += 1
          else unresolvedCount += 1
        }
      }
    }
  }

  const sortedVehicles: VehicleCatalog["vehicles"] = {}
  for (const year of Object.keys(vehicles).sort()) {
    const makes = vehicles[year] ?? {}
    const sortedMakes: (typeof makes) = {}
    for (const make of Object.keys(makes).sort((left, right) => left.localeCompare(right))) {
      const models = makes[make] ?? {}
      const sortedModels: (typeof models) = {}
      for (const model of Object.keys(models).sort((left, right) => left.localeCompare(right))) {
        sortedModels[model] = models[model] ?? []
      }
      sortedMakes[make] = sortedModels
    }
    sortedVehicles[year] = sortedMakes
  }

  const catalog: VehicleCatalog = {
    version: VERSION,
    retrievedOn: RETRIEVED_ON,
    refreshAfter: addDays(RETRIEVED_ON, REFRESH_DAYS),
    yearMin: YEAR_MIN,
    yearMax,
    terms: TERMS,
    sources: [
      {
        name: "NHTSA vPIC",
        url: `${NHTSA_API}vehicles/GetModelsForMakeIdYear/`,
        retrievedOn: RETRIEVED_ON,
        note: "Passenger car, truck, and multipurpose passenger vehicle models. No VINs.",
      },
      {
        name: "FuelEconomy.gov",
        url: FE_CSV_URL,
        retrievedOn: RETRIEVED_ON,
        note: `Year, make, baseModel, and model. Web services description: ${FE_DOCS_URL}`,
      },
    ],
    vehicles: sortedVehicles,
  }

  const ford = catalog.vehicles["2023"]?.Ford?.["F-150"]
  const rav4 = catalog.vehicles["2023"]?.Toyota?.RAV4
  const modelY = catalog.vehicles["2023"]?.Tesla?.["Model Y"]
  if (!ford || !rav4 || !modelY) {
    throw new Error("Persona models did not resolve for 2023")
  }

  const mollyTrim = preferTrim(
    ford,
    (trim) =>
      /pickup/i.test(trim.name) &&
      /4wd/i.test(trim.name) &&
      !/raptor|tremor|lightning|platinum|hev|ffv|hybrid/i.test(trim.name),
  )
  const jaydenTrim = preferTrim(
    rav4,
    (trim) => compactName(trim.name) === "rav4",
  )
  const avaTrim = preferTrim(
    modelY,
    (trim) => /long range/i.test(trim.name) && !/performance/i.test(trim.name),
  )

  const civic = Object.entries(catalog.vehicles).some(([, makes]) =>
    Boolean(makes.Honda?.Civic?.length),
  )
  const ioniq = Object.entries(catalog.vehicles).some(([, makes]) =>
    Object.entries(makes.Hyundai ?? {}).some(
      ([model, trims]) =>
        compactName(model) === "ioniq5n" ||
        trims.some((trim) => compactName(trim.name) === "ioniq5n"),
    ),
  )
  if (!civic || !ioniq) {
    throw new Error("Civic or Ioniq 5 N is missing from the snapshot")
  }

  const snapshotPath = path.join(process.cwd(), "public", "catalog", "vehicle-catalog.json")
  await writeFile(snapshotPath, `${JSON.stringify(catalog)}\n`)

  const defaults = `/** Generated by scripts/build-vehicle-catalog.ts. Do not edit by hand. */
export const CATALOG_DEFAULTS = {
  molly: { year: 2023, make: "Ford", model: "F-150", trim: ${JSON.stringify(mollyTrim)} },
  jayden: { year: 2023, make: "Toyota", model: "RAV4", trim: ${JSON.stringify(jaydenTrim)} },
  ava: { year: 2023, make: "Tesla", model: "Model Y", trim: ${JSON.stringify(avaTrim)} },
} as const
`
  await writeFile(path.join(process.cwd(), "src", "lib", "catalog-defaults.ts"), defaults)

  const meta = `/** Generated by scripts/build-vehicle-catalog.ts. Do not edit by hand. */
export const CATALOG_VERSION = ${JSON.stringify(VERSION)}
export const CATALOG_RETRIEVED_ON = ${JSON.stringify(RETRIEVED_ON)}
export const CATALOG_REFRESH_AFTER = ${JSON.stringify(catalog.refreshAfter)}
export const CATALOG_YEAR_MIN = ${YEAR_MIN}
export const CATALOG_YEAR_MAX = ${yearMax}
export const CATALOG_TERMS = ${JSON.stringify(TERMS)}
export const NHTSA_CATALOG_URL = ${JSON.stringify(catalog.sources[0].url)}
export const FUEL_ECONOMY_CATALOG_URL = ${JSON.stringify(FE_CSV_URL)}
export const FUEL_ECONOMY_DOCS_URL = ${JSON.stringify(FE_DOCS_URL)}
`
  await writeFile(path.join(process.cwd(), "src", "lib", "catalog-meta.ts"), meta)

  const yearCount = Object.keys(vehicles).length
  const diff = `# Vehicle catalog source diff

Initial snapshot. No earlier snapshot was in the repository, so this report is the baseline rather than a change list.

- Version: ${VERSION}
- Retrieved: ${RETRIEVED_ON}
- Refresh after: ${catalog.refreshAfter}
- Model years: ${YEAR_MIN}–${yearMax} (${yearCount} years with rows)
- FuelEconomy file: ${FE_CSV_URL}
- FuelEconomy description: ${FE_DOCS_URL}
- NHTSA models: ${NHTSA_API}vehicles/GetModelsForMakeIdYear/
- FuelEconomy rows kept: ${keptFuel.length}
- FuelEconomy rows excluded by name: ${excludedFuel.length}
- Trim rows, high confidence: ${highCount}
- Trim rows, limited confidence: ${limitedCount}
- Trim rows, unresolved: ${unresolvedCount}
- FuelEconomy rows filed on their own base model: ${ownModel}
- FuelEconomy rows attached with a weak prefix: ${weakAttached}
- NHTSA truck models with no FuelEconomy join, omitted: ${droppedTrucks.length}
- FuelEconomy makes with no NHTSA make: ${unmatchedMakes.length === 0 ? "none" : unmatchedMakes.join(", ")}

Persona defaults this build wrote:

- Molly: 2023 Ford F-150, ${mollyTrim}
- Jayden: 2023 Toyota RAV4, ${jaydenTrim}
- Ava: 2023 Tesla Model Y, ${avaTrim}

Omitted truck examples (not a complete list):

${droppedTrucks.slice(0, 40).map((item) => `- ${item}`).join("\n") || "- none"}

Terms: ${TERMS}
`
  await writeFile(path.join(process.cwd(), "data", "catalog", "source-diff.md"), diff)
  console.log(
    `Wrote ${VERSION} years ${YEAR_MIN}-${yearMax} high ${highCount} limited ${limitedCount} unresolved ${unresolvedCount}`,
  )
  console.log(`Molly ${mollyTrim}; Jayden ${jaydenTrim}; Ava ${avaTrim}`)
}

main().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : "Catalog build failed")
  process.exit(1)
})
