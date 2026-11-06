/**
 * Add a car to the photo library, or refresh one:
 *
 *   npm run photos:add -- <slug> [<slug> ...]
 *
 * Runs the steps for just those cars: find the Wikipedia article and Wikidata
 * item (photos:series), read the generations and US model years
 * (photos:generations), then rebuild the coverage report (photos:coverage).
 * Read the car's lines under "Needs attention" in docs/photo-coverage.md and
 * fix anything there in data/photos/series.json (see docs/DATA-REFRESH.md,
 * "Photo library").
 */
import { execFileSync } from "node:child_process"

const slugs = process.argv.slice(2).filter((arg) => !arg.startsWith("--"))
if (slugs.length === 0) {
  console.error("Usage: npm run photos:add -- <slug> [<slug> ...]")
  process.exit(1)
}
const run = (script: string, args: string[]) =>
  execFileSync("npx", ["tsx", `scripts/photos/${script}.ts`, ...args], { stdio: "inherit" })
run("series", slugs)
run("generations", slugs)
run("coverage", [])
