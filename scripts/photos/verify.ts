/**
 * Step 5: verify and pick. For each model year a car page shows, choose a
 * photo of the right generation, checked by Jev, with its credit and license.
 *
 *   npm run with:secrets -- npm run photos:verify                 every car
 *   npm run with:secrets -- npm run photos:verify -- honda-civic   one or more cars
 *
 * A photo is used only when two independent signals agree: Commons files it
 * under the generation, and Jev, seeing only the image, names that generation
 * with confidence at or above GATE (set from photos:eval). It also has to show
 * the outside of one whole car that isn't a taxi, police car, race car or
 * wreck, with no recognizable face. A readable plate only ranks a photo lower.
 *
 * Among accepted photos, each shown year gets the one whose own year (from the
 * filename or the Commons subcategory) is closest, so a year after a facelift
 * gets a photo of the facelifted car. Writes data/photos/manifest.json.
 */
import { readFile, writeFile } from "node:fs/promises"
import { CANDIDATES_FILE, type Candidate, type GenerationCandidates } from "./candidates"
import { generationKey, loadLibrary, marketCheck, questionsFor, reviewPhoto, type Library } from "./review"
import { readSeries } from "./series"

export const MANIFEST_FILE = "data/photos/manifest.json"

/**
 * Jev's confidence a photo needs. From photos:eval (November 2026, jev-1.14, 469 photos of 17 hard cars):
 * a generation named at 0.7+ was wrong 3% of the time, at 0.8+ 1% (2 of 138: a facelifted 2015 Civic Si and a
 * Chinese-market CR-V, both turned down here anyway because Commons disagreed), at 0.9+ never, but that kept only
 * 19% of photos. At 0.8 no badge twin or other make was taken for the car.
 */
export const GATE = 0.8
/**
 * When a generation has no photo at GATE after EXTENDED_REVIEWS (some generations look so much like their
 * neighbors that Jev is rarely sure: the 2017–2022 Prius Prime, Subarus, the Frontier D40), take photos at this
 * confidence where Commons and Jev still agree, marked `gate: 0.6` for a person to look at. At 0.6, Jev alone
 * was right 95% of the time in photos:eval; with Commons agreeing, more.
 */
export const FALLBACK_GATE = 0.6
/** Review this many candidates for a generation, or up to EXTENDED_REVIEWS while it has no photo at GATE. */
const MAX_REVIEWS = 40
const EXTENDED_REVIEWS = 150
/** Keep this many accepted photos per shown year: the pick and alternates. */
const PER_YEAR = 3

/** A photo's own model year: the filename's ("2019 Toyota Camry…", "'18 Camry…") or the deepest subcategory's. */
export function photoYear(candidate: Pick<Candidate, "title" | "path">): number | null {
  const fromName = /^File:(?:'(\d\d)\b|((?:19|20)\d\d)\b)/.exec(candidate.title)
  if (fromName) return fromName[1] ? 2000 + Number(fromName[1]) : Number(fromName[2])
  for (const name of [...candidate.path].reverse()) {
    const year = /\b((?:19|20)\d\d)\)?$/.exec(name.replace(/\)$/, ""))
    if (year) return Number(year[1])
  }
  return null
}

export type PhotoPick = {
  file: string
  descriptionUrl: string
  sha1: string
  /** The file version reviewed: if Commons gets a new upload, recheck it. */
  timestamp: string
  width: number
  height: number
  license: string
  licenseUrl: string | null
  artist: string
  credit: string
  photoYear: number | null
  /** The confidence gate it passed: GATE, or FALLBACK_GATE (worth a look). */
  gate: number
  /** Jev: the probability the car is registered outside the US and Canada (a foreign plate, the wheel on the right). Ranks it lower. */
  foreign: number | null
  jev: { model: string; id: string; confidence: number; exterior: number; face: number; plate: number; special: number; quality: number }
}

export type ManifestYear = { generation: string; picks: PhotoPick[] }
export type Manifest = Record<string, { name: string; years: Record<string, ManifestYear | null> }>

type Reviewed = { candidate: Candidate; pick: PhotoPick | null }

async function reviewGeneration(library: Library, slug: string, found: GenerationCandidates, wantYears: number[]): Promise<Reviewed[]> {
  const questions = questionsFor(library, slug)
  const key = generationKey(found.generation)
  const reviewed: Reviewed[] = []
  // Review best-first, photos from near a shown year first (so a year after a facelift gets the facelifted car);
  // stop once every shown year has enough accepted photos within a year of it.
  const near = (candidate: Candidate) => {
    const year = photoYear(candidate)
    return year !== null && wantYears.some((want) => Math.abs(want - year) <= 1) ? 1.5 : 0
  }
  const order = [...found.candidates].sort((a, b) => b.prior + near(b) - (a.prior + near(a)))
  for (const [index, candidate] of order.slice(0, EXTENDED_REVIEWS).entries()) {
    if (index >= MAX_REVIEWS && reviewed.some((item) => item.pick && item.pick.gate === GATE)) break
    const decision = await reviewPhoto(questions, candidate)
    if (!decision) continue
    const answer = decision.answers.generation
    const noul = (id: string) => {
      const item = decision.answers[id]
      return item?.type === "noul" ? item.noul : Number.NaN
    }
    const quality = decision.answers.quality
    const jev = {
      model: decision.model,
      id: decision.id,
      confidence: answer.type === "choice" ? answer.confidence : 0,
      exterior: noul("exterior"),
      face: noul("face"),
      plate: noul("plate"),
      special: noul("special"),
      quality: quality?.type === "score" ? quality.score : 0,
    }
    const accepted =
      answer.type === "choice" && answer.choice === key && jev.confidence >= FALLBACK_GATE && jev.exterior >= 0.5 && jev.special < 0.5 && jev.face < 0.5
    reviewed.push({
      candidate,
      pick: accepted
        ? {
            file: candidate.title,
            descriptionUrl: candidate.descriptionUrl,
            sha1: candidate.sha1,
            timestamp: candidate.timestamp,
            width: candidate.width,
            height: candidate.height,
            license: candidate.license,
            licenseUrl: candidate.licenseUrl,
            artist: candidate.artist,
            credit: candidate.credit,
            photoYear: photoYear(candidate),
            gate: jev.confidence >= GATE ? GATE : FALLBACK_GATE,
            foreign: null,
            jev,
          }
        : null,
    })
    const picks = reviewed.flatMap((item) => (item.pick && item.pick.gate === GATE ? [item.pick] : []))
    const covered = wantYears.every((year) => picks.filter((pick) => pick.photoYear !== null && Math.abs(pick.photoYear - year) <= 1).length >= PER_YEAR)
    if (covered) break
  }
  return reviewed
}

/** The best picks for one year: photos at GATE if there are any, then nearest photo year first, then Jev's quality score (less for a readable plate), then confidence. */
function bestFor(year: number, picks: PhotoPick[]): PhotoPick[] {
  const rank = (pick: PhotoPick) => pick.jev.quality - (pick.jev.plate >= 0.5 ? 1 : 0) - ((pick.foreign ?? 0) >= 0.5 ? 1.5 : 0)
  const distance = (pick: PhotoPick) => (pick.photoYear === null ? 3 : Math.min(Math.abs(pick.photoYear - year), 3))
  const strong = picks.filter((pick) => pick.gate === GATE)
  return [...(strong.length ? strong : picks)].sort((a, b) => distance(a) - distance(b) || rank(b) - rank(a) || b.jev.confidence - a.jev.confidence).slice(0, PER_YEAR)
}

async function main() {
  const wanted = process.argv.slice(2).filter((arg) => !arg.startsWith("-"))
  const series = await readSeries()
  const library = await loadLibrary(series)
  const pool = JSON.parse(await readFile(CANDIDATES_FILE, "utf8")) as Record<string, GenerationCandidates>
  let manifest: Manifest = {}
  try {
    manifest = JSON.parse(await readFile(MANIFEST_FILE, "utf8"))
  } catch {
    // first run
  }
  let reviews = 0
  for (const car of library.coverage.values()) {
    if (wanted.length && !wanted.includes(car.slug)) continue
    const years: Record<string, ManifestYear | null> = {}
    const byGeneration = new Map<string, number[]>()
    for (const year of car.shownYears) for (const id of car.years[year] ?? []) byGeneration.set(id, [...(byGeneration.get(id) ?? []), year])
    const picksByGeneration = new Map<string, PhotoPick[]>()
    for (const [id, wantYears] of byGeneration) {
      const found = pool[id]
      if (!found) continue
      const reviewed = await reviewGeneration(library, car.slug, found, wantYears)
      reviews += reviewed.length
      const picks: PhotoPick[] = []
      for (const item of reviewed) {
        if (!item.pick) continue
        item.pick.foreign = await marketCheck(item.candidate)
        picks.push(item.pick)
      }
      picksByGeneration.set(id, picks)
    }
    for (const year of car.shownYears) {
      // A split year (sold as both generations) shows the newer one.
      const id = (car.years[year] ?? []).at(-1)
      const picks = id ? bestFor(year, picksByGeneration.get(id) ?? []) : []
      years[year] = id && picks.length ? { generation: id, picks } : null
    }
    manifest[car.slug] = { name: car.name, years }
    // Saved after every car, so an interrupted run keeps what it did (and its Jev answers are cached).
    await writeFile(MANIFEST_FILE, `${JSON.stringify(Object.fromEntries(Object.entries(manifest).sort(([x], [y]) => x.localeCompare(y))), null, 2)}\n`)
    const missing = Object.entries(years).filter(([, value]) => !value).map(([year]) => year)
    console.log(`  ${car.slug}: ${car.shownYears.length - missing.length}/${car.shownYears.length} years${missing.length ? ` (none for ${missing.join(", ")})` : ""}`)
  }
  const sorted = Object.fromEntries(Object.entries(manifest).sort(([a], [b]) => a.localeCompare(b)))
  await writeFile(MANIFEST_FILE, `${JSON.stringify(sorted, null, 2)}\n`)
  const all = Object.values(sorted).flatMap((car) => Object.values(car.years))
  const fallback = Object.entries(sorted).flatMap(([slug, car]) =>
    Object.entries(car.years).flatMap(([year, value]) => (value && value.picks[0].gate !== GATE ? [`${slug} ${year}`] : [])),
  )
  console.log(`${all.filter(Boolean).length}/${all.length} shown years have a photo; ${reviews} photos reviewed (cached ones are free)`)
  if (fallback.length) console.log(`Picked at the fallback gate (${FALLBACK_GATE}), worth a look: ${fallback.join(", ")}`)
}

if (import.meta.url === `file://${process.argv[1]}`) void main()
