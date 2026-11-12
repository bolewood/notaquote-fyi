/**
 * Credits for the car photos (data/photos/images.json, built by
 * `npm run photos:download`). The photos come from Wikimedia Commons under
 * CC0, public domain, CC BY or CC BY-SA; the BY licenses require a credit
 * wherever a photo is shown, and this is where the site gives it.
 */
import { GENERATION_PHOTOS, PHOTOS, type PhotoCredit, type PhotoLibrary } from "./car-photos"

export type { PhotoCredit }

/**
 * One photo and where it's shown: the model years of one car, or (for a photo shown only in the "by
 * generation" section) its generation's years, like "2008–2012".
 */
export type CreditedPhoto = { src: string; years: number[]; generationYears?: string; credit: PhotoCredit }

/** A car's photos, in the order of the years they're shown for. */
export type CarCredits = { slug: string; photos: CreditedPhoto[] }

/** Every car with photos, sorted by slug; a photo shown for several years is listed once. */
export function photoCredits(source: PhotoLibrary = PHOTOS, generations: PhotoLibrary = GENERATION_PHOTOS): CarCredits[] {
  const slugs = [...new Set([...Object.keys(source), ...Object.keys(generations)])]
  return slugs
    .map((slug) => {
      const bySrc = new Map<string, CreditedPhoto>()
      for (const [year, entry] of Object.entries(source[slug] ?? {}).sort(([a], [b]) => Number(a) - Number(b))) {
        if (!entry) continue
        const photo = bySrc.get(entry.src) ?? { src: entry.src, years: [], credit: entry.credit }
        photo.years.push(Number(year))
        bySrc.set(entry.src, photo)
      }
      // Generation photos, oldest generation first; one already credited for a year isn't listed twice.
      for (const entry of Object.values(generations[slug] ?? {}).sort((a, b) => (a?.generationYears ?? "").localeCompare(b?.generationYears ?? ""))) {
        if (!entry || bySrc.has(entry.src)) continue
        bySrc.set(entry.src, { src: entry.src, years: [], generationYears: entry.generationYears, credit: entry.credit })
      }
      return { slug, photos: [...bySrc.values()] }
    })
    .filter((car) => car.photos.length > 0)
    .sort((a, b) => a.slug.localeCompare(b.slug))
}

/** "File:2019 Toyota Camry LE in white, front left.jpg" → "2019 Toyota Camry LE in white, front left". */
export function photoName(title: string): string {
  return title.replace(/^File:/, "").replace(/\.(jpe?g|png|webp|tiff?)$/i, "")
}

/** The number of distinct photos credited. */
export function photoCount(cars: CarCredits[] = photoCredits()): number {
  return new Set(cars.flatMap((car) => car.photos.map((photo) => photo.src))).size
}
