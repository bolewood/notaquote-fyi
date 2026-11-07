"use client"

/**
 * next/image loader for the car photos (next.config.ts: images.loaderFile). The photos are already
 * resized by `npm run photos:download` into 320, 640 and 1200 pixel files, so this picks the smallest
 * file at least as wide as the width asked for, instead of using an image service.
 */
const WIDTHS = [320, 640] as const

export default function carPhotoLoader({ src, width }: { src: string; width: number; quality?: number }): string {
  if (!src.startsWith("/car-photos/")) return src
  const variant = WIDTHS.find((candidate) => candidate >= width)
  // The full-size file is the photo itself; the width in the query (ignored by the server) tells next/image the loader honors it.
  return variant ? src.replace(/\.webp$/, `-${variant}.webp`) : `${src}?w=${width}`
}
