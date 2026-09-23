/**
 * Every page in sitemap.xml, with the date its data last changed (from the
 * data files' own check dates, not the build date, so a rebuild with the same
 * data doesn't look like new content). Tested against the pages Next.js
 * generates (src/lib/seo.test.ts). The llms.txt guides aren't pages for
 * people, so they aren't listed; every page head links to /llms.txt.
 */
import type { VehicleCatalog } from "./catalog"
import { noindexCarSlugs } from "./car-content"
import { carPages } from "./car-pages"
import { SITE_ORIGIN } from "./copy"
import { GUIDES, guideModified } from "./guides"
import { DATA_DATES, ENGINE_UPDATED, SOURCES_UPDATED, STATE_PAGES_UPDATED } from "./site-meta"
import { STATE_SLUGS } from "./state-slugs"

export type SitemapEntry = { url: string; lastModified: string }

/** Pages that aren't generated from data, with the data they show. */
const STATIC_PAGES: readonly [string, string][] = [
  ["/", ENGINE_UPDATED],
  ["/compare", ENGINE_UPDATED],
  ["/guides", ENGINE_UPDATED],
  ["/states", STATE_PAGES_UPDATED],
  ["/methodology", ENGINE_UPDATED],
  ["/sources", SOURCES_UPDATED],
  ["/model-version", ENGINE_UPDATED],
  ["/privacy", DATA_DATES.sources],
  ["/disclaimer", DATA_DATES.sources],
  ["/data-licenses", SOURCES_UPDATED],
  ["/corrections", DATA_DATES.sources],
]

/**
 * Car pages below the uniqueness bar stay out (they carry noindex), and so
 * does /cars when there are no car pages (the per-model claims data is off).
 */
export function sitemapPaths(catalog: VehicleCatalog): [string, string][] {
  const cars = carPages(catalog)
  const noindex = noindexCarSlugs(catalog)
  return [
    ...STATIC_PAGES,
    ...(cars.length > 0 ? [["/cars", ENGINE_UPDATED] as [string, string]] : []),
    ...GUIDES.map((guide): [string, string] => [guide.path, guideModified(guide)]),
    ...STATE_SLUGS.map((item): [string, string] => [`/states/${item.slug}`, STATE_PAGES_UPDATED]),
    ...cars.filter((page) => !noindex.has(page.slug)).map((page): [string, string] => [`/cars/${page.slug}`, ENGINE_UPDATED]),
  ]
}

export function sitemapEntries(catalog: VehicleCatalog): SitemapEntry[] {
  return sitemapPaths(catalog).map(([path, date]) => ({ url: `${SITE_ORIGIN}${path}`, lastModified: date }))
}
