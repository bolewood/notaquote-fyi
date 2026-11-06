/**
 * Polite, cached requests to Wikimedia (Wikipedia, Wikidata, Commons) for the
 * photo pipeline. One request at a time, a User-Agent that says who we are
 * (Wikimedia's policy), maxlag on API calls, and a disk cache so reruns don't
 * hit the network. Delete data/photos/.cache/ to refetch everything.
 */
import { createHash } from "node:crypto"
import { mkdir, readFile, writeFile } from "node:fs/promises"
import path from "node:path"

export const USER_AGENT = "NotAQuote.FYI photo library (https://github.com/bolewood/notaquote-fyi)"
const CACHE = path.join(process.cwd(), "data/photos/.cache")
const GAP_MS = 400
let last = 0

async function pace() {
  const wait = last + GAP_MS - Date.now()
  if (wait > 0) await new Promise((resolve) => setTimeout(resolve, wait))
  last = Date.now()
}

/** GET a URL as JSON, from the cache when we have it. `maxAgeDays` refetches older entries. */
export async function getJson<T = unknown>(url: string, { maxAgeDays = 30, cache = true } = {}): Promise<T> {
  const key = createHash("sha1").update(url).digest("hex")
  const file = path.join(CACHE, `${key}.json`)
  if (cache) {
    try {
      const saved = JSON.parse(await readFile(file, "utf8")) as { at: number; body: T }
      if (Date.now() - saved.at < maxAgeDays * 86_400_000) return saved.body
    } catch {
      // not cached yet
    }
  }
  for (let attempt = 1; ; attempt += 1) {
    await pace()
    const response = await fetch(url, { headers: { "User-Agent": USER_AGENT, Accept: "application/json" } })
    const retryAfter = Number(response.headers.get("retry-after") ?? 0)
    if ((response.status === 429 || response.status >= 500) && attempt < 6) {
      await new Promise((resolve) => setTimeout(resolve, Math.max(retryAfter * 1000, 2000 * attempt)))
      continue
    }
    if (!response.ok) throw new Error(`${response.status} ${url}`)
    const body = (await response.json()) as T & { error?: { code?: string; info?: string } }
    if (body && typeof body === "object" && body.error?.code === "maxlag" && attempt < 6) {
      await new Promise((resolve) => setTimeout(resolve, 5000))
      continue
    }
    if (cache) {
      await mkdir(CACHE, { recursive: true })
      await writeFile(file, JSON.stringify({ at: Date.now(), url, body }))
    }
    return body
  }
}

/** A MediaWiki API URL (Wikipedia, Commons, Wikidata) with JSON, format 2, and maxlag. */
export function api(host: "en.wikipedia.org" | "commons.wikimedia.org" | "www.wikidata.org", params: Record<string, string>): string {
  const search = new URLSearchParams({ format: "json", formatversion: "2", maxlag: "5", ...params })
  return `https://${host}/w/api.php?${search.toString()}`
}

/** A Wikidata SPARQL query URL. */
export function sparql(query: string): string {
  return `https://query.wikidata.org/sparql?${new URLSearchParams({ query, format: "json" }).toString()}`
}

export function chunks<T>(items: readonly T[], size: number): T[][] {
  const out: T[][] = []
  for (let index = 0; index < items.length; index += size) out.push(items.slice(index, index + size))
  return out
}
