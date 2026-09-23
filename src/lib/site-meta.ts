/**
 * What search engines, link previews, and AI assistants read about a page:
 * titles and descriptions, the canonical address, Open Graph and Twitter
 * tags, structured data (JSON-LD), and when the data behind a page last
 * changed (for sitemap.xml). No tracking of any kind lives here, or anywhere.
 */
import type { Metadata } from "next"
import factorBundle from "@/data/model-factors.json"
import sourceManifest from "@/data/source-manifest.json"
import { CATALOG_RETRIEVED_ON } from "./catalog-meta"
import { PUBLISHER, SITE_ORIGIN } from "./copy"
import { STATE_BASELINE_DATA_YEAR, STATE_BASELINE_SOURCES, STATE_BASELINES_CHECKED_ON } from "./state-baselines"
import { STATE_RULES_CHECKED_ON } from "./state-rules"
import { GITHUB_REPO_URL } from "./suggest-fix"

export const SITE_NAME = "NotAQuote.FYI"

/** Search results show about this many characters of a title, and about 155 of a description. */
export const TITLE_MAX = 60
export const DESCRIPTION_MAX = 155

export type SocialImage = { url: string; alt: string }

/** The site's own social image (src/app/opengraph-image.tsx). */
export const SITE_IMAGE: SocialImage = {
  url: "/opengraph-image",
  alt: "NotAQuote.FYI: what a new car, a teen driver, or a move would do to your car insurance",
}

/** The guides' social image (src/app/guides/opengraph-image.tsx). */
export const GUIDES_IMAGE: SocialImage = {
  url: "/guides/opengraph-image",
  alt: "NotAQuote.FYI guides: teen drivers, cars, and car insurance in your state",
}

/** The llms.txt link every page keeps in its head, for AI assistants. */
const LLMS_TYPES = { "text/plain": [{ url: "/llms.txt", title: "For AI assistants" }] }

/**
 * Metadata for one page: its title (the layout adds " · NotAQuote.FYI"), a
 * description, its canonical address, and matching Open Graph and Twitter
 * tags. Next.js merges metadata shallowly, so every page sets the whole
 * openGraph and alternates objects here (see `image` for social images).
 */
export function pageMetadata(input: {
  title: string
  description: string
  path: string
  /** Use the title as is, without the site name after it. */
  absoluteTitle?: boolean
  type?: "website" | "article"
  /**
   * The social image. Pass null on routes with their own opengraph-image file
   * (home, Compare, each state and car page): Next.js then uses that file.
   * Otherwise name one here, since a page's openGraph object replaces its
   * parents' (and with it an image inherited from a parent folder). An
   * explicit image here wins over the route's own file, so never set both.
   * Defaults to the site's image.
   */
  image?: SocialImage | null
  /** Keep the page for visitors but out of search results. */
  noindex?: boolean
}): Metadata {
  const fullTitle = input.absoluteTitle || input.title.length + SITE_NAME.length + 3 > TITLE_MAX ? input.title : `${input.title} · ${SITE_NAME}`
  const image = input.image === undefined ? SITE_IMAGE : input.image
  const images = image ? [{ url: image.url, width: 1200, height: 630, alt: image.alt, type: "image/png" }] : undefined
  return {
    // A title that won't fit with " · NotAQuote.FYI" after it goes out on its own.
    title: fullTitle === input.title ? { absolute: input.title } : input.title,
    description: input.description,
    alternates: { canonical: input.path, types: LLMS_TYPES },
    openGraph: {
      type: input.type ?? "website",
      siteName: SITE_NAME,
      locale: "en_US",
      url: input.path,
      title: fullTitle,
      description: input.description,
      ...(images ? { images } : {}),
    },
    twitter: {
      card: "summary_large_image",
      title: fullTitle,
      description: input.description,
      ...(images ? { images } : {}),
    },
    ...(input.noindex ? { robots: { index: false, follow: true } } : {}),
  }
}

// ---------------------------------------------------------------------------
// Structured data

export const ORGANIZATION = {
  "@type": "Organization",
  name: PUBLISHER,
  url: SITE_ORIGIN,
} as const

export const CC_BY = "https://creativecommons.org/licenses/by/4.0/"

export type JsonLd = Record<string, unknown>

/** JSON-LD for a <script> tag. "<" is escaped so the text can't close the tag. */
export function jsonLdText(data: JsonLd | JsonLd[]): string {
  return JSON.stringify(data).replace(/</g, "\\u003c")
}

export type Crumb = { name: string; path: string }

/** A BreadcrumbList for the trail at the top of a page. */
export function breadcrumbJsonLd(crumbs: readonly Crumb[]): JsonLd {
  return {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: crumbs.map((crumb, index) => ({
      "@type": "ListItem",
      position: index + 1,
      name: crumb.name,
      item: `${SITE_ORIGIN}${crumb.path}`,
    })),
  }
}

/** The home page: the site, and the tool on it. */
export function homeJsonLd(description: string): JsonLd[] {
  return [
    {
      "@context": "https://schema.org",
      "@type": "WebSite",
      name: SITE_NAME,
      url: `${SITE_ORIGIN}/`,
      description,
      inLanguage: "en-US",
      publisher: ORGANIZATION,
    },
    {
      "@context": "https://schema.org",
      "@type": "WebApplication",
      name: SITE_NAME,
      url: `${SITE_ORIGIN}/`,
      description,
      applicationCategory: "FinanceApplication",
      operatingSystem: "Any (runs in a web browser)",
      browserRequirements: "Requires JavaScript for the calculator.",
      isAccessibleForFree: true,
      offers: { "@type": "Offer", price: "0", priceCurrency: "USD" },
      license: "https://opensource.org/license/mit",
      codeRepository: GITHUB_REPO_URL,
      publisher: ORGANIZATION,
    },
  ]
}

/** A guide page, as an Article. */
export function articleJsonLd(input: { title: string; description: string; path: string; dateModified: string; datePublished: string }): JsonLd {
  return {
    "@context": "https://schema.org",
    "@type": "Article",
    headline: input.title,
    description: input.description,
    url: `${SITE_ORIGIN}${input.path}`,
    mainEntityOfPage: `${SITE_ORIGIN}${input.path}`,
    image: `${SITE_ORIGIN}${GUIDES_IMAGE.url}`,
    datePublished: input.datePublished,
    dateModified: input.dateModified > input.datePublished ? input.dateModified : input.datePublished,
    inLanguage: "en-US",
    author: ORGANIZATION,
    publisher: ORGANIZATION,
    isAccessibleForFree: true,
  }
}

/**
 * The state data on /sources, as two Datasets, because they're owned
 * differently:
 * - the minimum coverage rules, which we compiled from statutes and
 *   insurance departments (ours, CC BY 4.0);
 * - the typical prices, which are NAIC's figures. We use them as facts, with
 *   credit, and claim no license or authorship for them.
 */
export function stateDatasetsJsonLd(): JsonLd[] {
  const raw = `${GITHUB_REPO_URL.replace("https://github.com/", "https://raw.githubusercontent.com/")}/main`
  const naic = STATE_BASELINE_SOURCES.filter((source) => /naic/i.test(source.id)).map((source) => ({
    "@type": "CreativeWork",
    name: source.name,
    publisher: { "@type": "Organization", name: source.publisher },
    url: source.url,
  }))
  const shared = {
    "@context": "https://schema.org",
    "@type": "Dataset",
    isAccessibleForFree: true,
    spatialCoverage: { "@type": "Place", name: "United States" },
  }
  return [
    {
      ...shared,
      name: "Minimum car insurance required by each US state",
      description:
        "For each of the 50 states and DC, the least car insurance the law requires: liability limits, personal injury protection, medical payments, uninsured and underinsured motorist coverage, and no-fault rules, each row with its statute or insurance department source and the date it was checked.",
      url: `${SITE_ORIGIN}/sources#all-states`,
      sameAs: `${SITE_ORIGIN}/states`,
      license: CC_BY,
      creator: ORGANIZATION,
      publisher: ORGANIZATION,
      dateModified: DATA_DATES.stateRules,
      temporalCoverage: DATA_DATES.stateRules.slice(0, 4),
      keywords: ["car insurance", "minimum coverage", "state insurance requirements", "no-fault"],
      variableMeasured: [
        "Minimum bodily-injury liability per person and per crash",
        "Minimum property-damage liability",
        "Personal injury protection, medical payments, uninsured and underinsured motorist requirements",
        "No-fault rules",
      ],
      isBasedOn: { "@type": "CreativeWork", name: "State statutes and insurance department pages (one or more per state, listed in the data)" },
      distribution: [{ "@type": "DataDownload", encodingFormat: "application/json", contentUrl: `${raw}/data/state-rules/state-rules.json` }],
    },
    {
      ...shared,
      name: "Average car insurance premium by US state, 2023 (NAIC)",
      description:
        "For each of the 50 states and DC, the average yearly cost of full coverage and of liability-only coverage in 2023, as published by the National Association of Insurance Commissioners (NAIC). The figures are NAIC's; we use them as facts, with credit.",
      url: `${SITE_ORIGIN}/sources#state-baselines`,
      creditText: "Source: NAIC, 2022/2023 Auto Insurance Database Report",
      publisher: ORGANIZATION,
      dateModified: DATA_DATES.stateBaselines,
      temporalCoverage: String(STATE_BASELINE_DATA_YEAR),
      keywords: ["car insurance", "average premium", "NAIC"],
      variableMeasured: ["Average full-coverage premium (combined average premium), 2023", "Average liability premium, 2023"],
      isBasedOn: naic,
      citation: naic.map((source) => `${source.publisher.name}, ${source.name}`),
      distribution: [{ "@type": "DataDownload", encodingFormat: "application/json", contentUrl: `${raw}/data/state-baselines/state-baselines.json` }],
    },
  ]
}

// ---------------------------------------------------------------------------
// When the data last changed, for sitemap.xml and dateModified

function newest(...dates: string[]): string {
  return [...dates].sort().at(-1) ?? dates[0]
}

const MANIFEST_DATE = sourceManifest.version.replace(/^manifest-/, "")

/** Every page shows the factor bundle's numbers, so it counts everywhere. */
export const DATA_DATES = {
  factors: factorBundle.checkedOn,
  stateRules: STATE_RULES_CHECKED_ON,
  stateBaselines: STATE_BASELINES_CHECKED_ON,
  catalog: CATALOG_RETRIEVED_ON,
  sources: MANIFEST_DATE,
} as const

/** Pages whose numbers come from the engine alone (what-if, compare, how it works, guides). */
export const ENGINE_UPDATED = newest(DATA_DATES.factors, DATA_DATES.stateBaselines, DATA_DATES.catalog)

/** State pages: the engine plus the state rules. */
export const STATE_PAGES_UPDATED = newest(ENGINE_UPDATED, DATA_DATES.stateRules)

/** Pages that list every source (sources, data licenses). */
export const SOURCES_UPDATED = newest(STATE_PAGES_UPDATED, DATA_DATES.sources)
