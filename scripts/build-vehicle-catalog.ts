/**
 * Build the versioned personal light-duty catalog.
 * Raw downloads stay in .catalog-cache and are not committed.
 *
 * Modes:
 * - `npm run catalog:build` downloads FuelEconomy.gov vehicles.csv and about
 *   3,000 NHTSA vPIC model lists, then writes a fresh snapshot.
 * - `npx tsx scripts/build-vehicle-catalog.ts --enrich` keeps the committed
 *   snapshot's year, make, model, and trim rows exactly as they are and only
 *   attaches the EPA vehicle class (VClass) and powertrain (atvType) from
 *   vehicles.csv. It makes no NHTSA requests. Trim names in the snapshot are
 *   FuelEconomy.gov model strings, so the join is by year, make, and that exact
 *   string.
 */
import { createHash } from "node:crypto"
import { mkdir, readFile, writeFile } from "node:fs/promises"
import path from "node:path"

import type { CatalogTrim, VehicleCatalog } from "../src/lib/catalog"
import { POWERTRAIN_LEGEND, powertrainCode } from "../src/lib/catalog-class"
import {
  compactName,
  higherConfidence,
  isCommercialChassisModel,
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
/** Pause between uncached NHTSA requests per worker, in milliseconds. */
const NHTSA_SPACING_MS = 250
const NHTSA_WORKERS = 2

const TERMS =
  "Retrieved 21 September 2026. NHTSA vPIC (https://vpic.nhtsa.dot.gov/api/) is the manufacturer-submitted vehicle listing. Callers are subject to NHTSA’s automated rate control. This snapshot requests passenger car, truck, and multipurpose passenger vehicle models only and stores no VINs. FuelEconomy.gov vehicles.csv (https://www.fueleconomy.gov/feg/epadata/vehicles.csv) is the DOE and EPA fuel-economy file, described at https://www.fueleconomy.gov/feg/ws/index.shtml. This snapshot keeps year, make, base model, model name, EPA vehicle size class (VClass), and powertrain type (atvType). It does not keep fuel-cost or economy figures. Both are U.S. government public datasets, copied in this reduced form. Names the sources did not print were not added as trims."

type FeRow = {
  year: number
  make: string
  baseModel: string
  model: string
}

/** EPA class and powertrain seen for one FuelEconomy year, make, and model name. */
type FeAttributes = {
  classes: Map<string, number>
  powertrains: Set<string>
}

function attributeKey(year: number, make: string, model: string): string {
  return `${year}|${compactName(make)}|${model}`
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
      if (response.status === 403) {
        throw new Error(
          `HTTP 403 for ${url}. NHTSA's rate control is refusing requests. Wait a while and run again; finished responses are cached.`,
        )
      }
      if (response.status === 429 || response.status >= 500) {
        throw new Error(`HTTP ${response.status} for ${url}`)
      }
      if (!response.ok) throw new Error(`HTTP ${response.status} for ${url}`)
      const body = await response.text()
      await writeCache(url, body)
      return body
    } catch (error) {
      lastError = error
      if (error instanceof Error && error.message.includes("HTTP 403")) break
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

function loadFuelEconomy(csv: string): { rows: FeRow[]; attributes: Map<string, FeAttributes> } {
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
  const classIndex = column("VClass")
  const atvIndex = column("atvType")
  const rows: FeRow[] = []
  const attributes = new Map<string, FeAttributes>()
  const seen = new Set<string>()
  for (const cells of table.slice(1)) {
    const year = Number(cells[yearIndex])
    if (!Number.isInteger(year) || year < YEAR_MIN) continue
    const make = cells[makeIndex]?.trim() ?? ""
    const model = cells[modelIndex]?.trim() ?? ""
    const baseModel = cells[baseIndex]?.trim() || model
    if (!make || !model) continue
    const attrKey = attributeKey(year, make, model)
    const attr = attributes.get(attrKey) ?? { classes: new Map<string, number>(), powertrains: new Set<string>() }
    const vclass = cells[classIndex]?.trim() ?? ""
    if (vclass) attr.classes.set(vclass, (attr.classes.get(vclass) ?? 0) + 1)
    attr.powertrains.add(powertrainCode(cells[atvIndex]?.trim() ?? ""))
    attributes.set(attrKey, attr)
    const key = `${year}|${make}|${baseModel}|${model}`
    if (seen.has(key)) continue
    seen.add(key)
    rows.push({ year, make, baseModel, model })
  }
  return { rows, attributes }
}

/**
 * The most common EPA class for the name. Ties go to the alphabetically first
 * class so the build is deterministic. Only a handful of names carry two
 * classes (for example a 2WD and a 4WD row filed under one model name).
 */
function dominantClass(classes: Map<string, number>): string | null {
  let best: string | null = null
  let bestCount = -1
  for (const [name, count] of [...classes.entries()].sort(([left], [right]) => left.localeCompare(right))) {
    if (count > bestCount) {
      best = name
      bestCount = count
    }
  }
  return best
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
      const wasCached = (await readCache(request.url)) !== null
      if (!wasCached) await new Promise((resolve) => setTimeout(resolve, NHTSA_SPACING_MS))
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

  await Promise.all(Array.from({ length: NHTSA_WORKERS }, () => worker()))
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

function classTools(feAttributes: Map<string, FeAttributes>) {
  const classNames = new Set<string>()
  for (const attr of feAttributes.values()) {
    const name = dominantClass(attr.classes)
    if (name) classNames.add(name)
  }
  const vehicleClasses = [...classNames].sort((left, right) => left.localeCompare(right))
  const classIndex = new Map(vehicleClasses.map((name, index) => [name, index]))

  function feFields(year: number, make: string, model: string): Pick<CatalogTrim, "c" | "p"> {
    const attr = feAttributes.get(attributeKey(year, make, model))
    if (!attr) return {}
    const name = dominantClass(attr.classes)
    const fields: Pick<CatalogTrim, "c" | "p"> = {}
    if (name !== null) fields.c = classIndex.get(name)
    // "g" (gasoline, diesel, flex-fuel, or natural gas) is the default and is
    // not written, which keeps the snapshot small. A trim with a class and no
    // code is combustion-only.
    const codes = [...attr.powertrains].sort().join("")
    if (codes && codes !== "g") fields.p = codes
    return fields
  }
  return { vehicleClasses, feFields }
}

/**
 * Attach EPA class and powertrain to the committed snapshot without touching
 * its rows or making NHTSA requests.
 */
async function enrich() {
  await mkdir(CACHE_DIR, { recursive: true })
  const snapshotPath = path.join(process.cwd(), "public", "catalog", "vehicle-catalog.json")
  const catalog = JSON.parse(await readFile(snapshotPath, "utf8")) as VehicleCatalog
  console.log("Downloading FuelEconomy vehicles.csv if needed")
  const csv = await fetchText(FE_CSV_URL)
  const { attributes } = loadFuelEconomy(csv)
  const { vehicleClasses, feFields } = classTools(attributes)
  let total = 0
  let classed = 0
  let powered = 0
  for (const [yearKey, makes] of Object.entries(catalog.vehicles)) {
    for (const [make, models] of Object.entries(makes)) {
      for (const trims of Object.values(models)) {
        for (const trim of trims) {
          total += 1
          delete trim.c
          delete trim.p
          if (trim.name === UNRESOLVED_TRIM_NAME) continue
          const fields = feFields(Number(yearKey), make, trim.name)
          if (fields.c !== undefined) {
            trim.c = fields.c
            classed += 1
          }
          if (fields.p) {
            trim.p = fields.p
            powered += 1
          }
        }
      }
    }
  }
  const enriched: VehicleCatalog = {
    version: catalog.version,
    retrievedOn: catalog.retrievedOn,
    refreshAfter: catalog.refreshAfter,
    yearMin: catalog.yearMin,
    yearMax: catalog.yearMax,
    terms: TERMS,
    vehicleClasses,
    powertrains: POWERTRAIN_LEGEND,
    sources: catalog.sources.map((source) =>
      source.url === FE_CSV_URL
        ? {
            ...source,
            note: `Year, make, baseModel, model, VClass, and atvType. VClass and atvType were attached on ${CLASS_NOTE_DATE} from the same file. Web services description: ${FE_DOCS_URL}`,
          }
        : source,
    ),
    vehicles: catalog.vehicles,
  }
  await writeFile(snapshotPath, `${JSON.stringify(enriched)}\n`)
  await writeMeta(enriched)
  const diffPath = path.join(process.cwd(), "data", "catalog", "source-diff.md")
  const previous = await readFile(diffPath, "utf8")
  const marker = "\n## EPA class and powertrain\n"
  const kept = previous.includes(marker) ? previous.slice(0, previous.indexOf(marker)) : previous.trimEnd()
  const section = `${marker}
Attached on ${CLASS_NOTE_DATE} by \`npx tsx scripts/build-vehicle-catalog.ts --enrich\`. No rows were added or removed; NHTSA was not called.

- Trim rows: ${total}
- Trim rows with an EPA vehicle class (VClass): ${classed}
- Trim rows with an EPA powertrain type (atvType): ${powered}
- Rows without either are the "${UNRESOLVED_TRIM_NAME}" rows and FuelEconomy names that no longer appear in vehicles.csv.
- EPA vehicle classes kept: ${vehicleClasses.length}
`
  await writeFile(diffPath, `${kept}\n${section}`)
  console.log(`Enriched ${total} trims: class ${classed}, powertrain ${powered}`)
}

const CLASS_NOTE_DATE = "2026-09-22"

async function writeMeta(catalog: VehicleCatalog) {
  const meta = `/** Generated by scripts/build-vehicle-catalog.ts. Do not edit by hand. */
export const CATALOG_VERSION = ${JSON.stringify(catalog.version)}
export const CATALOG_RETRIEVED_ON = ${JSON.stringify(catalog.retrievedOn)}
export const CATALOG_REFRESH_AFTER = ${JSON.stringify(catalog.refreshAfter)}
export const CATALOG_YEAR_MIN = ${catalog.yearMin}
export const CATALOG_YEAR_MAX = ${catalog.yearMax}
export const CATALOG_TERMS = ${JSON.stringify(catalog.terms)}
export const NHTSA_CATALOG_URL = ${JSON.stringify(catalog.sources[0].url)}
export const FUEL_ECONOMY_CATALOG_URL = ${JSON.stringify(FE_CSV_URL)}
export const FUEL_ECONOMY_DOCS_URL = ${JSON.stringify(FE_DOCS_URL)}
`
  await writeFile(path.join(process.cwd(), "src", "lib", "catalog-meta.ts"), meta)
}

async function main() {
  await mkdir(CACHE_DIR, { recursive: true })
  await mkdir(path.join(process.cwd(), "public", "catalog"), { recursive: true })
  await mkdir(path.join(process.cwd(), "data", "catalog"), { recursive: true })

  console.log("Downloading FuelEconomy vehicles.csv if needed")
  const csv = await fetchText(FE_CSV_URL)
  const { rows: fuelRows, attributes: feAttributes } = loadFuelEconomy(csv)
  const { vehicleClasses, feFields } = classTools(feAttributes)
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
  const droppedChassis: string[] = []
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
      if (existing.c === undefined && trim.c !== undefined) existing.c = trim.c
      if (trim.p && existing.p !== trim.p) {
        existing.p = [...new Set(`${existing.p ?? ""}${trim.p}`)].sort().join("")
      }
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
    const modelName = matched?.name ?? row.baseModel
    if (isCommercialChassisModel(make, modelName) || isCommercialChassisModel(make, row.baseModel)) {
      droppedChassis.push(`${row.year} ${make} ${modelName}`)
      continue
    }
    if (!matched) {
      ownModel += 1
      addTrim(row.year, make, row.baseModel, {
        name: row.model,
        confidence: "limited",
        ...feFields(row.year, row.make, row.model),
      })
      continue
    }
    if (matched.confidence === "limited") weakAttached += 1
    addTrim(row.year, make, matched.name, {
      name: row.model,
      confidence: matched.confidence,
      ...feFields(row.year, row.make, row.model),
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
      if (isCommercialChassisModel(make, model.name)) {
        droppedChassis.push(`${year} ${make} ${model.name}`)
        continue
      }
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

  let classedCount = 0
  let powertrainCount = 0
  for (const yearBucket of Object.values(vehicles)) {
    for (const makeBucket of Object.values(yearBucket)) {
      for (const trims of Object.values(makeBucket)) {
        for (const trim of trims) {
          if (trim.c !== undefined) classedCount += 1
          if (trim.p) powertrainCount += 1
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
    vehicleClasses,
    powertrains: POWERTRAIN_LEGEND,
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
        note: `Year, make, baseModel, model, VClass, and atvType. Web services description: ${FE_DOCS_URL}`,
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

  await writeMeta(catalog)

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
- Trim rows with an EPA vehicle class (VClass): ${classedCount}
- Trim rows with an EPA powertrain type (atvType): ${powertrainCount}
- EPA vehicle classes kept: ${vehicleClasses.length}
- FuelEconomy rows filed on their own base model: ${ownModel}
- FuelEconomy rows attached with a weak prefix: ${weakAttached}
- NHTSA truck models with no FuelEconomy join, omitted: ${droppedTrucks.length}
- Commercial chassis cabs omitted (Ram 2500, 3500, 4000, 4500, 5500, and Ford E-450): ${droppedChassis.length}
- FuelEconomy makes with no NHTSA make: ${unmatchedMakes.length === 0 ? "none" : unmatchedMakes.join(", ")}

Persona defaults this build wrote:

- Molly: 2023 Ford F-150, ${mollyTrim}
- Jayden: 2023 Toyota RAV4, ${jaydenTrim}
- Ava: 2023 Tesla Model Y, ${avaTrim}

Omitted commercial chassis cabs (not a complete list):

${droppedChassis.slice(0, 24).map((item) => `- ${item}`).join("\n") || "- none"}

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

const run = process.argv.includes("--enrich") ? enrich : main
run().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : "Catalog build failed")
  process.exit(1)
})
