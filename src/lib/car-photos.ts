/**
 * The car photo library (data/photos/images.json, built by `npm run photos:download`): for each car page,
 * a photo of the right generation for each model year the page shows, with its credit.
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

export type CarPhoto = {
  /** "/car-photos/<sha1>.webp" (1200 pixels wide; 320 and 640 copies sit next to it). */
  src: string
  width: number
  height: number
  generation: string
  /** The generation's US model years: "2018–2024", "2025–present". */
  generationYears: string
  /** The model year in the photo, when its filename or Commons category says. */
  photoYear: number | null
  credit: PhotoCredit
}

export type PhotoLibrary = Record<string, Record<string, CarPhoto | null>>

export const PHOTOS = images as PhotoLibrary

/** The photo for a car page's model year, if there is one. */
export function carPhoto(slug: string, year: number, library: PhotoLibrary = PHOTOS): CarPhoto | null {
  return library[slug]?.[String(year)] ?? null
}

/** "Photo: Elise240SX, CC BY-SA 4.0" pieces, for a caption. Public domain has no license link. */
export function licenseLabel(credit: PhotoCredit): string {
  return credit.license.toLowerCase() === "public domain" ? "public domain" : credit.license
}
