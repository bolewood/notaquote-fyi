/**
 * Step 4: candidates. For each generation a car page shows, list the openly
 * licensed photos in its Commons category (and the usable subcategories under
 * it), best first. No photo is judged here; that's photos:verify.
 *
 *   npm run photos:candidates                 every car
 *   npm run photos:candidates -- honda-civic  one or more cars
 *
 * Writes data/photos/.cache/candidates.json (not committed: it's rebuilt from
 * Commons). Run it after photos:coverage.
 */
import { mkdir, readFile, writeFile } from "node:fs/promises"
import path from "node:path"
import { SKIP_SUBCATEGORY, type CarCoverage } from "./coverage"
import { api, getJson } from "./http"
import { readSeries } from "./series"

export const CANDIDATES_FILE = path.join(process.cwd(), "data/photos/.cache/candidates.json")

/** How deep to look under a generation's category. The US Camry XV50 photos are three levels down. */
const MAX_DEPTH = 4
/** Stop walking a generation after this many categories (a few have huge trees). */
const MAX_CATEGORIES = 80
/** The smallest original we'd use: big enough for a sharp 1200-pixel-wide card. */
const MIN_WIDTH = 1200
const MIN_HEIGHT = 700

/** Licenses we can use with credit: public domain, CC0, CC BY and CC BY-SA (any version). Not NC, ND, or GFDL-only. */
export function licenseOk(shortName: string): boolean {
  const name = shortName.trim()
  if (/\b(NC|ND)\b|non-?commercial|no ?deriv|fair use|GFDL(?!.*CC)/i.test(name)) return false
  return /^(public domain|PD\b|CC0|CC BY(?:-SA)? \d\.\d)/i.test(name)
}

/** Restrictions we can't use. A trademark notice (the badge on the car) is fine; personality rights aren't. */
export function restrictionsOk(restrictions: string): boolean {
  return !/personality|consent|insignia|ukraine-?war/i.test(restrictions)
}

export function stripHtml(text: string): string {
  return text
    .replace(/<[^>]+>/g, "")
    .replace(/&amp;/g, "&")
    .replace(/&quot;/g, '"')
    .replace(/&#0?39;/g, "'")
    .replace(/&nbsp;/g, " ")
    .replace(/\s+/g, " ")
    .trim()
}

export type Candidate = {
  /** "File:'18 Toyota Camry.jpg" */
  title: string
  descriptionUrl: string
  /** A resized JPEG or PNG from Commons, 1024 pixels on its long side: what the review looks at. */
  thumbUrl: string
  width: number
  height: number
  mime: string
  sha1: string
  /** When this version of the file was uploaded (it pins the exact image). */
  timestamp: string
  license: string
  licenseUrl: string | null
  artist: string
  credit: string
  restrictions: string
  /** The categories from the generation's down to the file's, e.g. ["Toyota Camry (XV50)", "…, North America", "…, North America, 2011"]. */
  path: string[]
  /** Higher is better: a hint for which to review first, not a verdict. */
  prior: number
}

export type GenerationCandidates = { slug: string; generation: string; label: string; commons: string; candidates: Candidate[]; categoriesWalked: number }

type MembersResponse = {
  continue?: Record<string, string>
  query?: {
    pages?: {
      title: string
      ns: number
      imageinfo?: {
        url: string
        thumburl?: string
        width: number
        height: number
        mime: string
        sha1: string
        timestamp: string
        descriptionurl: string
        extmetadata?: Record<string, { value: string }>
      }[]
    }[]
  }
}

/** Every page in a category of one namespace, following continuation. */
async function members(category: string, type: "file" | "subcat"): Promise<NonNullable<NonNullable<MembersResponse["query"]>["pages"]>> {
  const out: NonNullable<NonNullable<MembersResponse["query"]>["pages"]> = []
  let more: Record<string, string> = {}
  for (let page = 0; page < 20; page += 1) {
    const params: Record<string, string> = {
      action: "query",
      generator: "categorymembers",
      gcmtitle: `Category:${category}`,
      gcmtype: type,
      gcmlimit: type === "file" ? "50" : "200",
      ...more,
    }
    if (type === "file") {
      Object.assign(params, {
        prop: "imageinfo",
        iiprop: "url|size|mime|sha1|timestamp|extmetadata",
        iiurlwidth: "1024",
        iiextmetadatafilter: "LicenseShortName|LicenseUrl|Restrictions|Artist|Credit|NonFree",
      })
    }
    const body = await getJson<MembersResponse>(api("commons.wikimedia.org", params), { maxAgeDays: 14 })
    out.push(...(body.query?.pages ?? []))
    if (!body.continue) break
    more = body.continue
  }
  return out
}

/** The thumbnail with its long side 1024 pixels (Commons gives one 1024 wide; a tall photo would be too tall). */
export function thumbnailUrl(thumb: string, width: number, height: number): string {
  if (height <= width) return thumb
  return thumb.replace(/\b1024px-/, `${Math.round((1024 * width) / height)}px-`)
}

/** A hint for review order: North American, shallow, large, and not obviously a detail shot. */
function prior(pathNames: string[], title: string, width: number): number {
  let score = 0
  if (pathNames.some((name) => /north america|\bU\.?S\.?A?\b|united states|canada/i.test(name))) score += 3
  score -= (pathNames.length - 1) * 0.25
  score += Math.min(width, 4000) / 4000
  if (/interior|dashboard|engine|cockpit|seats?\b|trunk|boot|wheel\b|badge|emblem|detail|taillight|headlight|grille|steering/i.test(title)) score -= 4
  if (/\b(rear|back)\b/i.test(title)) score -= 1
  if (/\bfront\b/i.test(title)) score += 0.5
  return Math.round(score * 100) / 100
}

/** Walk a generation's category tree and list the usable photos in it. */
export async function generationCandidates(commons: string, skip: RegExp[]): Promise<{ candidates: Candidate[]; categoriesWalked: number }> {
  const seen = new Set<string>([commons])
  const queue: { name: string; path: string[] }[] = [{ name: commons, path: [commons] }]
  const files = new Map<string, Candidate>()
  let walked = 0
  while (queue.length > 0 && walked < MAX_CATEGORIES) {
    const { name, path: pathNames } = queue.shift()!
    walked += 1
    for (const page of await members(name, "file")) {
      const info = page.imageinfo?.[0]
      if (!info || files.has(page.title)) continue
      const meta = (key: string) => stripHtml(info.extmetadata?.[key]?.value ?? "")
      if (!/^image\/(jpeg|png|webp|tiff)$/.test(info.mime) || !info.thumburl) continue
      if (info.width < MIN_WIDTH || info.height < MIN_HEIGHT) continue
      // Jev reads images with sides from 280 to 1568 pixels: no panoramas or slivers.
      if (Math.max(info.width, info.height) / Math.min(info.width, info.height) > 3) continue
      if (meta("NonFree") === "true" || !licenseOk(meta("LicenseShortName")) || !restrictionsOk(meta("Restrictions"))) continue
      files.set(page.title, {
        title: page.title,
        descriptionUrl: info.descriptionurl,
        thumbUrl: thumbnailUrl(info.thumburl, info.width, info.height),
        width: info.width,
        height: info.height,
        mime: info.mime,
        sha1: info.sha1,
        timestamp: info.timestamp,
        license: meta("LicenseShortName"),
        licenseUrl: meta("LicenseUrl") || null,
        artist: meta("Artist"),
        credit: meta("Credit"),
        restrictions: meta("Restrictions"),
        path: pathNames,
        prior: prior(pathNames, page.title, info.width),
      })
    }
    if (pathNames.length > MAX_DEPTH) continue
    for (const sub of await members(name, "subcat")) {
      const child = sub.title.replace(/^Category:/, "")
      if (seen.has(child)) continue
      seen.add(child)
      if (SKIP_SUBCATEGORY.test(child) && !/north america/i.test(child)) continue
      if (skip.some((pattern) => pattern.test(child))) continue
      queue.push({ name: child, path: [...pathNames, child] })
    }
  }
  const candidates = [...files.values()].sort((left, right) => right.prior - left.prior || right.width - left.width)
  return { candidates, categoriesWalked: walked }
}

async function main() {
  const wanted = process.argv.slice(2).filter((arg) => !arg.startsWith("-"))
  const coverage = JSON.parse(await readFile("data/photos/coverage.json", "utf8")) as CarCoverage[]
  const series = await readSeries()
  let existing: Record<string, GenerationCandidates> = {}
  try {
    existing = JSON.parse(await readFile(CANDIDATES_FILE, "utf8"))
  } catch {
    // first run
  }
  for (const car of coverage) {
    if (wanted.length && !wanted.includes(car.slug)) continue
    const skip = (series[car.slug]?.exclude ?? []).map((pattern) => new RegExp(pattern, "i"))
    for (const g of car.generations) {
      if (!g.shown || !g.commons) continue
      const { candidates, categoriesWalked } = await generationCandidates(g.commons, skip)
      existing[g.id] = { slug: car.slug, generation: g.id, label: g.label, commons: g.commons, candidates, categoriesWalked }
      console.log(`  ${g.id}: ${candidates.length} usable photos in ${categoriesWalked} categories`)
    }
  }
  await mkdir(path.dirname(CANDIDATES_FILE), { recursive: true })
  await writeFile(CANDIDATES_FILE, `${JSON.stringify(existing, null, 1)}\n`)
  const all = Object.values(existing)
  const thin = all.filter((g) => g.candidates.length < 5)
  console.log(`${all.length} generations, ${all.reduce((sum, g) => sum + g.candidates.length, 0)} usable photos; under 5: ${thin.map((g) => g.generation).join(", ") || "none"}`)
}

if (import.meta.url === `file://${process.argv[1]}`) void main()
