/**
 * TypeSafe's Jev, a decision model, through OpenRouter's decisions endpoint.
 * It answers typed questions about a state (here, a photo) with probabilities:
 * a Choice between named options, a Score on an ordered scale, or a Noul (the
 * probability something is true). No prose comes back.
 *
 * The endpoint is an alpha (https://openrouter.ai/api/alpha/decisions). If it
 * moves, change DECISIONS_URL here and nothing else. The model is pinned, so
 * answers don't shift when a new Jev comes out; to upgrade, change MODEL and
 * rerun photos:eval before trusting the new answers.
 *
 * Needs OPENROUTER_API_KEY in the environment (set it however you keep secrets).
 * The key is never logged.
 */
import { createHash } from "node:crypto"
import { mkdir, readFile, writeFile } from "node:fs/promises"
import path from "node:path"
import { fetchRetry } from "./http"

export const DECISIONS_URL = "https://openrouter.ai/api/alpha/decisions"
export const MODEL = "typesafe/jev-1.14"

export type Question =
  | { type: "choice"; instructions: string; criteria: Record<string, string> }
  | { type: "score"; instructions: string; criteria: string[] }
  | { type: "noul"; instructions: string }

export type Answer =
  | { type: "choice"; choice: string; probabilities: Record<string, number>; confidence: number }
  | { type: "score"; score: number; probabilities: Record<string, number>; confidence: number }
  | { type: "noul"; noul: number }

export type Decision = { model: string; id: string; answers: Record<string, Answer>; cost: number }

export type StatePart = { type: "text"; text: string } | { type: "image_url"; image_url: { url: string } }

const CACHE = path.join(process.cwd(), "data/photos/.cache/jev")

/** A PNG or JPEG as a state part (the endpoint reads only those), typed from its bytes, not its name. */
export function imagePart(bytes: Buffer): StatePart {
  const mime = bytes.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]))
    ? "image/png"
    : bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff
      ? "image/jpeg"
      : null
  if (!mime) throw new Error("Jev reads PNG and JPEG images only")
  return { type: "image_url", image_url: { url: `data:${mime};base64,${bytes.toString("base64")}` } }
}

/**
 * Ask `questions` about `state`. Answers are cached on disk under `cacheKey`
 * (with the model and the questions), so a rerun costs nothing. `state` can be
 * a function, so an image is only downloaded when the answer isn't cached.
 */
export async function decide(state: StatePart[] | (() => Promise<StatePart[]>), questions: Record<string, Question>, cacheKey: string): Promise<Decision> {
  const hash = createHash("sha256").update(JSON.stringify({ MODEL, questions, cacheKey })).digest("hex").slice(0, 32)
  const file = path.join(CACHE, `${hash}.json`)
  try {
    return JSON.parse(await readFile(file, "utf8")) as Decision
  } catch {
    // not asked yet
  }
  const key = process.env.OPENROUTER_API_KEY
  if (!key) throw new Error("OPENROUTER_API_KEY isn't set: put your OpenRouter key in the environment and run this again")
  const parts = typeof state === "function" ? await state() : state
  let lastError = ""
  for (let attempt = 0; attempt < 4; attempt += 1) {
    const response = await fetchRetry(DECISIONS_URL, {
      method: "POST",
      headers: { "content-type": "application/json", authorization: `Bearer ${key}` },
      body: JSON.stringify({ model: MODEL, state: parts, questions }),
    })
    const text = await response.text()
    if (response.ok) {
      const body = JSON.parse(text) as { model: string; id: string; answers: Record<string, Answer>; usage?: { cost?: number } }
      for (const id of Object.keys(questions)) if (!body.answers[id]) throw new Error(`Jev gave no answer to "${id}"`)
      const decision: Decision = { model: body.model, id: body.id, answers: body.answers, cost: body.usage?.cost ?? 0 }
      await mkdir(CACHE, { recursive: true })
      await writeFile(file, JSON.stringify(decision))
      return decision
    }
    lastError = `HTTP ${response.status}: ${text.slice(0, 300)}`
    if (response.status !== 429 && response.status < 500) break
    await new Promise((resolve) => setTimeout(resolve, 2000 * 2 ** attempt))
  }
  throw new Error(`Jev: ${lastError}`)
}
