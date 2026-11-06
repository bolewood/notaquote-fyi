/**
 * Step 6: download. Bring the repo's photos in line with the manifest: one
 * WebP per chosen photo (the first pick for each shown year), with its credit.
 *
 *   npm run photos:download
 *
 * A sync, safe to rerun: files are named by the Commons file's sha1, so a
 * photo two years share is stored once, an unchanged one isn't fetched again,
 * and a file the manifest no longer uses is deleted. It first checks each
 * pick is still on Commons with the same sha1 (the version Jev reviewed) and
 * a license we can use; a pick that fails is left out and listed, so rerun
 * photos:verify for that car.
 *
 * Writes public/car-photos/*.webp and data/photos/images.json (which photo
 * each car page year shows, its size, and its credit).
 */
import { mkdir, readdir, readFile, rm, stat, writeFile } from "node:fs/promises"
import path from "node:path"
import sharp from "sharp"
import { licenseOk, restrictionsOk, stripHtml } from "./candidates"
import { api, chunks, getJson, USER_AGENT } from "./http"
import { MANIFEST_FILE, type Manifest, type PhotoPick } from "./verify"

export const IMAGE_DIR = "public/car-photos"
export const IMAGES_FILE = "data/photos/images.json"
/** Wide enough for a sharp card on a large screen; Commons originals are often 6000 pixels. */
const WIDTH = 1200

export type Credit = {
  /** "File:2019 Toyota Camry LE in white, front left.jpg" */
  title: string
  author: string
  license: string
  licenseUrl: string | null
  /** The file's page on Commons: the source to link. */
  source: string
  changes: string
}

export type ImageEntry = { src: string; width: number; height: number; generation: string; photoYear: number | null; credit: Credit }

/** "User:McChizzle" → "McChizzle". Empty → null, so the credit falls back to the file page. */
export function cleanAuthor(artist: string): string | null {
  const text = artist.replace(/^User:/, "").trim()
  return text || null
}

type InfoResponse = {
  query: {
    pages: {
      title: string
      missing?: boolean
      imageinfo?: { sha1: string; extmetadata?: Record<string, { value: string }> }[]
      categories?: { title: string }[]
    }[]
    normalized?: { from: string; to: string }[]
  }
}

/** Categories Commons puts a file in when it may delete it (a deletion request, no permission, no source, a copyright violation). */
const PENDING_DELETION = /deletion requests|copyright violation|without (?:a )?(?:license|source)|missing permission|no permission|speedy deletion|copyvio/i

/** Each pick still on Commons, with the same sha1, a usable license, and no pending deletion? Title → reason it isn't. */
async function recheck(picks: PhotoPick[]): Promise<Map<string, string>> {
  const problems = new Map<string, string>()
  for (const group of chunks(picks, 40)) {
    const body = await getJson<InfoResponse>(
      api("commons.wikimedia.org", {
        action: "query",
        titles: group.map((pick) => pick.file).join("|"),
        prop: "imageinfo|categories",
        cllimit: "max",
        iiprop: "sha1|extmetadata",
        iiextmetadatafilter: "LicenseShortName|Restrictions|NonFree",
      }),
      { maxAgeDays: 1 },
    )
    for (const pick of group) {
      const title = body.query.normalized?.find((item) => item.from === pick.file)?.to ?? pick.file
      const page = body.query.pages.find((item) => item.title === title)
      const info = page?.imageinfo?.[0]
      const meta = (key: string) => stripHtml(info?.extmetadata?.[key]?.value ?? "")
      if (!page || page.missing || !info) problems.set(pick.file, "deleted from Commons")
      else if (info.sha1 !== pick.sha1) problems.set(pick.file, "a new version was uploaded (not the one reviewed)")
      else if (page.categories?.some((category) => PENDING_DELETION.test(category.title)))
        problems.set(pick.file, `Commons may delete it: ${page.categories.find((category) => PENDING_DELETION.test(category.title))!.title}`)
      else if (meta("NonFree") === "true" || !licenseOk(meta("LicenseShortName")) || !restrictionsOk(meta("Restrictions")))
        problems.set(pick.file, `license or restrictions changed: ${meta("LicenseShortName")} ${meta("Restrictions")}`.trim())
    }
  }
  return problems
}

/** The file, resized by Commons to about WIDTH (not the multi-megabyte original). */
async function fetchResized(pick: PhotoPick): Promise<Buffer> {
  const url = `https://commons.wikimedia.org/wiki/Special:FilePath/${encodeURIComponent(pick.file.replace(/^File:/, ""))}?width=${Math.min(WIDTH, pick.width)}`
  for (let attempt = 0; attempt < 4; attempt += 1) {
    const response = await fetch(url, { headers: { "User-Agent": USER_AGENT } })
    if (response.ok) return Buffer.from(await response.arrayBuffer())
    if (response.status !== 429 && response.status < 500) throw new Error(`${pick.file}: HTTP ${response.status}`)
    await new Promise((resolve) => setTimeout(resolve, 3000 * 2 ** attempt))
  }
  throw new Error(`${pick.file}: Commons kept refusing`)
}

const exists = (file: string) =>
  stat(file).then(
    () => true,
    () => false,
  )

async function main() {
  const manifest = JSON.parse(await readFile(MANIFEST_FILE, "utf8")) as Manifest
  const chosen = new Map<string, PhotoPick>()
  for (const car of Object.values(manifest)) for (const year of Object.values(car.years)) if (year) chosen.set(year.picks[0].sha1, year.picks[0])
  const problems = await recheck([...chosen.values()])

  await mkdir(IMAGE_DIR, { recursive: true })
  const sizes = new Map<string, { width: number; height: number }>()
  let fetched = 0
  for (const [sha1, pick] of chosen) {
    if (problems.has(pick.file)) continue
    const file = path.join(IMAGE_DIR, `${sha1}.webp`)
    if (!(await exists(file))) {
      // Metadata (EXIF, GPS) is dropped: sharp keeps none unless asked.
      await sharp(await fetchResized(pick)).rotate().resize({ width: WIDTH, withoutEnlargement: true }).webp({ quality: 78 }).toFile(file)
      fetched += 1
      await new Promise((resolve) => setTimeout(resolve, 250))
    }
    const { width = 0, height = 0 } = await sharp(file).metadata()
    sizes.set(sha1, { width, height })
  }
  // Files the manifest no longer uses.
  let removed = 0
  for (const name of await readdir(IMAGE_DIR)) {
    if (!name.endsWith(".webp") || sizes.has(name.replace(/\.webp$/, ""))) continue
    await rm(path.join(IMAGE_DIR, name))
    removed += 1
  }

  const images: Record<string, Record<string, ImageEntry | null>> = {}
  for (const [slug, car] of Object.entries(manifest)) {
    images[slug] = {}
    for (const [year, value] of Object.entries(car.years)) {
      const pick = value?.picks[0]
      const size = pick ? sizes.get(pick.sha1) : undefined
      images[slug][year] =
        value && pick && size
          ? {
              src: `/car-photos/${pick.sha1}.webp`,
              ...size,
              generation: value.generation,
              photoYear: pick.photoYear,
              credit: {
                title: pick.file,
                author: cleanAuthor(pick.artist) ?? "See the file page",
                license: pick.license,
                licenseUrl: pick.licenseUrl,
                source: pick.descriptionUrl,
                changes: "Resized and converted to WebP",
              },
            }
          : null
    }
  }
  await writeFile(IMAGES_FILE, `${JSON.stringify(images, null, 2)}\n`)
  console.log(`${sizes.size} photos (${fetched} new, ${removed} removed) in ${IMAGE_DIR}`)
  for (const [file, reason] of problems) console.log(`  left out ${file}: ${reason}`)
}

if (import.meta.url === `file://${process.argv[1]}`) void main()
