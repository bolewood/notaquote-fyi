/**
 * Recompute src/data/model-factors.json from data/factors/.
 *
 *   npm run factors:build
 *   npm run factors:build -- --hldi-full path/to/losses.csv
 *   npm run factors:build -- --hldi-full path/to/full-dir
 *
 * The --hldi-full form re-picks the HLDI subsets (data/factors/sources/hldi-YYYY-YY.csv)
 * from one or more full HLDI downloads, keeping only the families listed in
 * data/factors/vehicle-families.json, then derives as usual.
 *
 * The derivation itself lives in src/lib/factor-derivation.ts so the tests can
 * run it too.
 */
import { readdir, readFile, stat, writeFile } from "node:fs/promises"
import path from "node:path"

import { deriveFactors, parseCsv, pickHldiSubset, type FactorFiles } from "../src/lib/factor-derivation"
import { assertFactorBundleSafe } from "../src/lib/factor-engine"

const ROOT = process.cwd()
const DATA = path.join(ROOT, "data", "factors")
const OUT = path.join(ROOT, "src", "data", "model-factors.json")

export async function readFactorFiles(): Promise<FactorFiles> {
  const files: FactorFiles = {}
  for (const name of ["assumptions.json", "vehicle-families.json"]) {
    files[name] = await readFile(path.join(DATA, name), "utf8")
  }
  files["state-baselines.json"] = await readFile(
    path.join(ROOT, "data", "state-baselines", "state-baselines.json"),
    "utf8",
  )
  for (const name of await readdir(path.join(DATA, "sources"))) {
    if (name.endsWith(".csv") || name.endsWith(".json")) {
      files[`sources/${name}`] = await readFile(path.join(DATA, "sources", name), "utf8")
    }
  }
  return files
}

function toCsv(rows: Record<string, string>[], header: string[]): string {
  const quote = (value: string) => (/[",\n]/.test(value) ? `"${value.replace(/"/g, '""')}"` : value)
  return `${[header.join(","), ...rows.map((row) => header.map((name) => quote(row[name] ?? "")).join(","))].join("\n")}\n`
}

async function pickOneHldiFile(fullPath: string, families: Parameters<typeof pickHldiSubset>[1]) {
  const full = await readFile(fullPath, "utf8")
  const parsed = parseCsv(full)
  const modelYears = parsed[0]?.model_years || "2022-24"
  const header = full.slice(0, full.indexOf("\n")).trim().split(",")
  const subset = pickHldiSubset(full, families)
  await writeFile(path.join(DATA, "sources", `hldi-${modelYears}.csv`), toCsv(subset, header))
  console.log(`HLDI ${modelYears} subset: ${subset.length} of ${parsed.length} series`)
}

async function main() {
  const fullIndex = process.argv.indexOf("--hldi-full")
  if (fullIndex >= 0) {
    const fullPath = process.argv[fullIndex + 1]
    if (!fullPath) throw new Error("--hldi-full needs a path")
    const families = JSON.parse(await readFile(path.join(DATA, "vehicle-families.json"), "utf8"))
    const info = await stat(fullPath)
    if (info.isDirectory()) {
      const names = (await readdir(fullPath)).filter((name) => name.endsWith(".csv")).sort()
      for (const name of names) {
        await pickOneHldiFile(path.join(fullPath, name), families)
      }
    } else {
      await pickOneHldiFile(fullPath, families)
    }
  }

  const bundle = deriveFactors(await readFactorFiles())
  assertFactorBundleSafe(bundle)
  const json = JSON.stringify(bundle, null, 2).replace(
    /\[\n\s+(?=(?:\d+|"[^"]*"),\n)/g,
    (match) => match.trim(),
  )
  const compactJson = json.replace(
    /\[\s*(?:\d+|"[^"]*")(?:\s*,\s*(?:-?\d+|null|"[^"]*")){4,6}\s*\]/g,
    (tuple) => JSON.stringify(JSON.parse(tuple)),
  )
  await writeFile(OUT, `${compactJson}\n`)
  const cells = Object.values(bundle.groups).flatMap((group) => Object.values(group.cells))
  const count = (basis: string) => cells.filter((cell) => cell.basis === basis).length
  const totalSeries = bundle.vehicle.windows.reduce((sum, window) => sum + window.compactModels.length, 0)
  const newestCount = bundle.vehicle.windows[0]?.compactModels.length ?? 0
  console.log(
    `Wrote ${path.relative(ROOT, OUT)}: ${count("sourced")} sourced, ${count("indicative")} indicative, ${count("assumed")} assumed, ${count("reference")} reference cells; ${bundle.vehicle.windows.length} HLDI windows (${totalSeries} series total, ${newestCount} in ${bundle.vehicle.modelYears}).`,
  )
}

if (process.argv[1] && path.resolve(process.argv[1]) === path.resolve(ROOT, "scripts", "derive-factors.ts")) {
  main().catch((error: unknown) => {
    console.error(error instanceof Error ? error.message : error)
    process.exit(1)
  })
}
