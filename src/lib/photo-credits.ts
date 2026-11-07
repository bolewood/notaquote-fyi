/**
 * Credits for the car photos (data/photos/images.json, built by
 * `npm run photos:download`). The photos come from Wikimedia Commons under
 * CC0, public domain, CC BY or CC BY-SA; the BY licenses require a credit
 * wherever a photo is shown, and this is where the site gives it.
 */
import images from "../../data/photos/images.json"

export type PhotoCredit = {
  title: string
  author: string
  license: string
  licenseUrl: string | null
  source: string
  changes: string
}

type ImageEntry = { src: string; width: number; height: number; generation: string; photoYear: number | null; credit: PhotoCredit }

/** One photo and the model years of one car it's shown for. */
export type CreditedPhoto = { src: string; years: number[]; credit: PhotoCredit }

/** A car's photos, in the order of the years they're shown for. */
export type CarCredits = { slug: string; photos: CreditedPhoto[] }

const IMAGES = images as Record<string, Record<string, ImageEntry | null>>

/** Every car with photos, sorted by slug; a photo shown for several years is listed once. */
export function photoCredits(source: Record<string, Record<string, ImageEntry | null>> = IMAGES): CarCredits[] {
  return Object.entries(source)
    .map(([slug, years]) => {
      const bySrc = new Map<string, CreditedPhoto>()
      for (const [year, entry] of Object.entries(years).sort(([a], [b]) => Number(a) - Number(b))) {
        if (!entry) continue
        const photo = bySrc.get(entry.src) ?? { src: entry.src, years: [], credit: entry.credit }
        photo.years.push(Number(year))
        bySrc.set(entry.src, photo)
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
