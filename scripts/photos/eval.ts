/**
 * How far can we trust Jev's answers? Ask the production questions about
 * photos whose answer Commons already tells us (the category each was found
 * in), on hard cases on purpose: neighboring generations, badge twins
 * (Colorado and Canyon, Tahoe, Yukon and Escalade) and plug-in versions. Then
 * report how often an answer at each confidence is right, to pick the gate
 * photos:verify uses.
 *
 *   npm run with:secrets -- npm run photos:eval
 *
 * Needs photos:candidates first. Answers are cached, so a rerun is free.
 * Commons labels are sometimes wrong too: look at the disagreements before
 * blaming Jev. A file whose name starts with a model year outside its
 * generation's years is marked "label doubtful".
 */
import { readFile, writeFile } from "node:fs/promises"
import { CANDIDATES_FILE, type Candidate, type GenerationCandidates } from "./candidates"
import { readSeries } from "./series"
import { generationKey, loadLibrary, NONE, OTHER, questionsFor, reviewPhoto, twinKey } from "./review"

/** The hard cases. */
const EVAL_CARS = [
  "toyota-camry",
  "toyota-corolla",
  "honda-civic",
  "honda-accord",
  "honda-cr-v",
  "toyota-rav4",
  "toyota-rav4-prime",
  "toyota-prius",
  "ford-f-150",
  "chevrolet-silverado",
  "gmc-sierra",
  "chevrolet-colorado",
  "gmc-canyon",
  "chevrolet-tahoe",
  "gmc-yukon",
  "cadillac-escalade",
  "volkswagen-atlas",
]
const PER_GENERATION = 8
const PER_TWIN = 4
const OTHERS = 3
const GATES = [0, 0.5, 0.6, 0.7, 0.8, 0.9]

/** `count` items spread through a best-first list, so the sample isn't only the easiest photos. */
function spread<T>(items: readonly T[], count: number): T[] {
  if (items.length <= count) return [...items]
  return Array.from({ length: count }, (_, index) => items[Math.round((index * (items.length - 1)) / (count - 1))])
}

/** The model year a Commons filename starts with ("2019 Toyota Camry LE…"), if any. */
const fileYear = (title: string) => Number(/^File:(?:'(\d\d)|((?:19|20)\d\d))\b/.exec(title)?.slice(1).find(Boolean)?.replace(/^(\d\d)$/, "20$1")) || null

type Trial = { slug: string; candidate: Candidate; expected: string; labelDoubt: boolean }

type Result = {
  slug: string
  title: string
  descriptionUrl: string
  thumbUrl: string
  path: string[]
  expected: string
  labelDoubt: boolean
  got: string
  confidence: number
  probabilities: Record<string, number>
  exterior: number | null
  face: number | null
  plate: number | null
  special: number | null
  quality: number | null
  model: string
}

async function main() {
  const series = await readSeries()
  const library = await loadLibrary(series)
  const pool = JSON.parse(await readFile(CANDIDATES_FILE, "utf8")) as Record<string, GenerationCandidates>
  const bySlug = (slug: string) => Object.values(pool).filter((g) => g.slug === slug)
  const trials: Trial[] = []
  for (const slug of EVAL_CARS) {
    const generations = library.generations[slug]?.generations ?? []
    for (const found of bySlug(slug)) {
      const g = generations.find((item) => item.id === found.generation)
      if (!g) continue
      for (const candidate of spread(found.candidates, PER_GENERATION)) {
        const year = fileYear(candidate.title)
        trials.push({ slug, candidate, expected: generationKey(g.id), labelDoubt: year !== null && (year < g.from - 1 || year > (g.to ?? 9999) + 1) })
      }
    }
    for (const twin of series[slug]?.twins ?? []) {
      const photos = bySlug(twin).flatMap((g) => g.candidates)
      for (const candidate of spread(photos, PER_TWIN)) trials.push({ slug, candidate, expected: twinKey(twin), labelDoubt: false })
    }
    const make = library.generations[slug].name.split(" ")[0]
    const elsewhere = EVAL_CARS.filter((other) => library.generations[other]?.name.split(" ")[0] !== make)
    const photos = elsewhere.flatMap((other) => bySlug(other).flatMap((g) => g.candidates.slice(0, 2)))
    for (const candidate of spread(photos, OTHERS)) trials.push({ slug, candidate, expected: OTHER, labelDoubt: false })
  }
  const missing = EVAL_CARS.filter((slug) => bySlug(slug).length === 0)
  if (missing.length) console.log(`No candidates yet for ${missing.join(", ")}: run photos:candidates for them`)
  console.log(`${trials.length} photos to check`)

  const results: Result[] = []
  let cost = 0
  for (const [index, trial] of trials.entries()) {
    const decision = await reviewPhoto(questionsFor(library, trial.slug), trial.candidate)
    if (!decision) continue
    cost += decision.cost
    const answer = decision.answers.generation
    if (answer.type !== "choice") throw new Error("generation should be a choice")
    const noul = (id: string) => {
      const item = decision.answers[id]
      return item.type === "noul" ? item.noul : null
    }
    const quality = decision.answers.quality
    results.push({
      slug: trial.slug,
      title: trial.candidate.title,
      descriptionUrl: trial.candidate.descriptionUrl,
      thumbUrl: trial.candidate.thumbUrl,
      path: trial.candidate.path,
      expected: trial.expected,
      labelDoubt: trial.labelDoubt,
      got: answer.choice,
      confidence: answer.confidence,
      probabilities: answer.probabilities,
      exterior: noul("exterior"),
      face: noul("face"),
      plate: noul("plate"),
      special: noul("special"),
      quality: quality.type === "score" ? quality.score : null,
      model: decision.model,
    })
    if ((index + 1) % 25 === 0) console.log(`  ${index + 1}/${trials.length}`)
  }

  const lines: string[] = [`Jev eval: ${results.length} photos, ${EVAL_CARS.length} cars, cost $${cost.toFixed(4)} (cached answers cost nothing)`, ""]
  // What production does with an answer: use the photo only if Jev names a generation of this car at or above the gate.
  const isGeneration = (key: string) => key !== OTHER && key !== NONE && !key.startsWith("twin-")
  const usable = (r: Result) => (r.exterior ?? 0) >= 0.5 && (r.special ?? 1) < 0.5
  lines.push(
    "When Jev names a generation at or above the gate, how often is it the one Commons files the photo under (precision)?",
    "And what share of the generation-labeled photos does that keep (yield)? Production also needs the two to agree,",
    "so a wrong photo gets through only if Commons is wrong and Jev makes the same mistake.",
    "",
    `| | ${GATES.map((gate) => `gate ${gate}`).join(" | ")} |`,
    `| --- | ${GATES.map(() => "---").join(" | ")} |`,
  )
  const labeled = results.filter((r) => isGeneration(r.expected))
  for (const [name, extra] of [
    ["Jev's answer alone", () => true],
    ["…and exterior, not special", usable],
  ] as const) {
    const precision = GATES.map((gate) => {
      const named = results.filter((r) => isGeneration(r.got) && r.confidence >= gate && extra(r))
      const right = named.filter((r) => r.got === r.expected).length
      return named.length ? `${Math.round((100 * right) / named.length)}% (${named.length - right} wrong of ${named.length})` : "—"
    })
    const kept = GATES.map((gate) => {
      const agreed = labeled.filter((r) => r.got === r.expected && r.confidence >= gate && extra(r)).length
      return `${Math.round((100 * agreed) / Math.max(labeled.length, 1))}%`
    })
    lines.push(`| ${name}: precision | ${precision.join(" | ")} |`, `| ${name}: yield | ${kept.join(" | ")} |`)
  }
  const twins = results.filter((r) => r.expected.startsWith("twin-"))
  const others = results.filter((r) => r.expected === OTHER)
  lines.push(
    "",
    `Badge twins taken for this car (any confidence): ${twins.filter((r) => isGeneration(r.got)).length} of ${twins.length}.`,
    `Other makes taken for this car (any confidence): ${others.filter((r) => isGeneration(r.got)).length} of ${others.length}.`,
  )
  lines.push("", "Jev named a generation that isn't the label (worst first):", "")
  for (const r of results.filter((item) => isGeneration(item.got) && item.got !== item.expected).sort((a, b) => b.confidence - a.confidence))
    lines.push(`- ${r.slug}: ${r.expected} → ${r.got} (${r.confidence.toFixed(2)})${r.labelDoubt ? " [label doubtful]" : ""} ${r.title}`)
  lines.push("", "Labeled photos Jev turned down (fine if they're interiors, details or crowds):", "")
  for (const r of labeled.filter((item) => !isGeneration(item.got)))
    lines.push(`- ${r.slug}: ${r.expected} → ${r.got} (${r.confidence.toFixed(2)}) ${r.title}`)
  await writeFile("data/photos/.cache/eval.json", `${JSON.stringify(results, null, 1)}\n`)
  await writeFile("data/photos/.cache/eval.md", `${lines.join("\n")}\n`)
  console.log(lines.slice(0, 16).join("\n"))
  console.log(`Full report: data/photos/.cache/eval.md`)
}

if (import.meta.url === `file://${process.argv[1]}`) void main()
