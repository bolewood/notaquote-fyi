/**
 * The questions the photo review asks Jev about each candidate, and how it
 * asks. photos:eval and photos:verify both use these, so the eval measures
 * exactly what production does.
 *
 * Jev sees only the image and a neutral line of text: never the filename, the
 * Commons category or the car we expect, so its answer is an independent check
 * on Commons' labels. The options name every generation of the car, its badge
 * twins, "a different make or model" and "no single car shown".
 */
import { readFile } from "node:fs/promises"
import type { Candidate } from "./candidates"
import type { CarCoverage } from "./coverage"
import { GENERATIONS_FILE, type CarGenerations } from "./generations"
import { fetchRetry, USER_AGENT } from "./http"
import { decide, imagePart, type Decision, type Question } from "./jev"
import type { SeriesEntry } from "./series"

export const OTHER = "other"
export const NONE = "none"
export const twinKey = (slug: string) => `twin-${slug}`

/** The short key for a generation option: the end of its id ("toyota-camry/toyota-camry-xv70" → "toyota-camry-xv70"). */
export const generationKey = (id: string) => id.split("/")[1]

export type Library = { generations: Record<string, CarGenerations>; coverage: Map<string, CarCoverage>; series: Record<string, SeriesEntry> }

export async function loadLibrary(series: Record<string, SeriesEntry>): Promise<Library> {
  const generations = JSON.parse(await readFile(GENERATIONS_FILE, "utf8")) as Record<string, CarGenerations>
  const coverage = new Map((JSON.parse(await readFile("data/photos/coverage.json", "utf8")) as CarCoverage[]).map((car) => [car.slug, car]))
  return { generations, coverage, series }
}

const years = (from: number, to: number | null) => (to === from ? `${from}` : `${from}–${to ?? "present"}`)

/** The questions for one car's photos. */
export function questionsFor(library: Library, slug: string): Record<string, Question> {
  const car = library.generations[slug]
  const criteria: Record<string, string> = {}
  for (const g of car.generations) criteria[generationKey(g.id)] = `${car.name}, ${g.label}: US model years ${years(g.from, g.to)}`
  for (const twin of library.series[slug]?.twins ?? []) {
    const other = library.generations[twin]
    if (other) criteria[twinKey(twin)] = `${other.name} (any year): a close relative of the ${car.name} with its own badge, grille or trim`
  }
  criteria[OTHER] = `A different make or model, not a ${car.name}`
  criteria[NONE] = "No single car clearly shown: a crowd of cars, an interior, an engine, a detail, a drawing or a toy"
  return {
    generation: {
      type: "choice",
      instructions: "Which car is the main subject of this photo? Look at the body shape, headlights, grille, badges and taillights.",
      criteria,
    },
    exterior: {
      type: "noul",
      instructions: "Does the photo show the outside of one whole car, with its front or side clearly visible and no large part of it cut off or hidden?",
    },
    face: { type: "noul", instructions: "Is a person's face recognizable in this photo?" },
    plate: { type: "noul", instructions: "Can you read the characters on a license plate in this photo?" },
    special: {
      type: "noul",
      instructions:
        "Is the main car a taxi, a police car, a race car, a show car with heavy modifications, damaged or wrecked, or covered in advertising?",
    },
    quality: {
      type: "score",
      instructions: "How well does this photo show what the car looks like?",
      criteria: [
        "Poor: blurry, dark, or the car is small in the frame",
        "Fair: the car is visible but the angle, light or background gets in the way",
        "Good: a clear, well-lit view of the car",
        "Excellent: sharp, well lit, and the car fills the frame",
      ],
    },
  }
}

let lastImageFetch = 0

/** The candidate's Commons thumbnail (about 1024 pixels wide), held in memory only. */
async function thumbnail(candidate: Candidate): Promise<Buffer> {
  const wait = lastImageFetch + 250 - Date.now()
  if (wait > 0) await new Promise((resolve) => setTimeout(resolve, wait))
  lastImageFetch = Date.now()
  for (let attempt = 0; attempt < 4; attempt += 1) {
    const response = await fetchRetry(candidate.thumbUrl, { headers: { "User-Agent": USER_AGENT } })
    if (response.ok) return Buffer.from(await response.arrayBuffer())
    if (response.status !== 429 && response.status < 500) throw new Error(`${candidate.title}: HTTP ${response.status}`)
    await new Promise((resolve) => setTimeout(resolve, 3000 * 2 ** attempt))
  }
  throw new Error(`${candidate.title}: Commons kept refusing the thumbnail`)
}

/**
 * Ask a car's questions about one candidate (cached by the file's sha1, so a
 * rerun is free). Null when Jev refuses the image itself (HTTP 400): skip it.
 */
export async function reviewPhoto(questions: Record<string, Question>, candidate: Candidate): Promise<Decision | null> {
  return decide(async () => [{ type: "text", text: "A photo of a car." }, imagePart(await thumbnail(candidate))], questions, `sha1:${candidate.sha1}`).catch((error: Error) => {
    if (!/HTTP 400/.test(error.message)) throw error
    console.log(`  skipped ${candidate.title}: ${error.message.slice(0, 160)}`)
    return null
  })
}

/**
 * Asked only about accepted photos: is this car registered outside the US and Canada? A non-US car is
 * the right generation but may differ in details (lights, bumpers), so it ranks lower. Null if Jev refuses the image.
 */
export async function marketCheck(candidate: Candidate): Promise<number | null> {
  const questions: Record<string, Question> = {
    foreign: {
      type: "noul",
      instructions:
        "Is this car registered outside the United States and Canada? Look for a license plate in a European, Asian, Australian or other non-North-American format, or a steering wheel on the right side.",
    },
  }
  const decision = await decide(async () => [{ type: "text", text: "A photo of a car." }, imagePart(await thumbnail(candidate))], questions, `market:${candidate.sha1}`).catch(
    (error: Error) => {
      if (!/HTTP 400/.test(error.message)) throw error
      return null
    },
  )
  const answer = decision?.answers.foreign
  return answer?.type === "noul" ? answer.noul : null
}
