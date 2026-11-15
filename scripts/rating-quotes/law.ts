/**
 * Pure helpers for the rating-rule quote checker and the law snapshots
 * (data/state-rules/law/<STATE>/<slug>.md). No network and no file reads here,
 * so everything in this file is unit-tested (law.test.ts).
 *
 * The snapshot script and the live check both call `extractSection`, so a
 * difference between a snapshot and today's page means the law's text moved,
 * not that the two used different methods.
 */

// ---------------------------------------------------------------------------
// Text

const NAMED_ENTITIES: Record<string, string> = {
  amp: "&",
  lt: "<",
  gt: ">",
  quot: '"',
  apos: "'",
  nbsp: " ",
  ensp: " ",
  emsp: " ",
  thinsp: " ",
  sect: "§",
  para: "¶",
  ndash: "–",
  mdash: "—",
  hyphen: "-",
  lsquo: "‘",
  rsquo: "’",
  sbquo: "‚",
  ldquo: "“",
  rdquo: "”",
  bdquo: "„",
  hellip: "…",
  copy: "©",
  reg: "®",
  shy: "",
  middot: "·",
  bull: "•",
}

export function decodeEntities(text: string): string {
  return text.replace(/&(#x[0-9a-f]+|#\d+|[a-z]+);/gi, (match, name: string) => {
    if (name[0] === "#") {
      const code = name[1] === "x" || name[1] === "X" ? parseInt(name.slice(2), 16) : parseInt(name.slice(1), 10)
      return Number.isFinite(code) && code > 0 && code <= 0x10ffff ? String.fromCodePoint(code) : match
    }
    return NAMED_ENTITIES[name.toLowerCase()] ?? match
  })
}

const BLOCK_TAGS =
  "address|article|aside|blockquote|br|dd|div|dl|dt|fieldset|figcaption|figure|footer|form|h[1-6]|header|hr|li|main|nav|ol|p|pre|section|table|tbody|td|tfoot|th|thead|tr|ul"

/** HTML to readable text: scripts and styles dropped, one line per block, entities decoded. */
export function htmlToText(html: string): string {
  const text = html
    .replace(/<!--[\s\S]*?-->/g, " ")
    .replace(/<(script|style|noscript|template|svg|head)\b[\s\S]*?<\/\1\s*>/gi, " ")
    // Line breaks in HTML source are just spaces; only tags start a new line.
    .replace(/\s+/g, " ")
    .replace(new RegExp(`<\\/?(?:${BLOCK_TAGS})\\b[^>]*>`, "gi"), "\n")
    .replace(/<[^>]+>/g, "")
  return tidyLines(decodeEntities(text))
}

/** Trim each line, squeeze spaces, and keep at most one blank line between paragraphs. */
export function tidyLines(text: string): string {
  return text
    .replace(/\r\n?/g, "\n")
    .split("\n")
    .map((line) => line.replace(/[\t\f\v   -​  　]+/g, " ").trim())
    .join("\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim()
}

/**
 * The form two texts are compared in: one space for any run of whitespace,
 * straight quotes, one kind of dash, "..." for an ellipsis, and "§ " with one
 * space after it. Case is kept: a quote is copied exactly.
 */
export function normalizeText(text: string): string {
  return decodeEntities(text)
    .normalize("NFKC") // also turns "…" into "..." and non-breaking spaces into spaces
    .replace(/[­​-‍⁠﻿]/g, "") // soft hyphens and zero-width characters
    .replace(/[‘’‚‛′`´]/g, "'")
    .replace(/[“”„‟″«»]/g, '"')
    .replace(/[‐-―−﹘﹣－]/g, "-")
    .replace(/\s+/g, " ")
    .replace(/§\s*/g, "§ ")
    .replace(/§ §/g, "§§")
    .trim()
}

/** A quote's pieces: split at each "..." (or "…"), normalized, empty pieces dropped. */
export function quoteParts(quote: string): string[] {
  return normalizeText(quote)
    .split("...")
    .map((part) => part.trim())
    .filter((part) => part.length > 0)
}

/** True when the quote appears in the text. With "...", each piece must appear, in order. */
export function quoteFound(quote: string, text: string): boolean {
  const parts = quoteParts(quote)
  if (parts.length === 0) return false
  const haystack = normalizeText(text)
  let from = 0
  for (const part of parts) {
    const at = haystack.indexOf(part, from)
    if (at < 0) return false
    from = at + part.length
  }
  return true
}

/**
 * Where two texts first differ, as a few words either side. Null when they're
 * the same once normalized. Good enough to see whether a change is real.
 */
export function shortDiff(before: string, after: string, context = 8): string | null {
  const a = normalizeText(before).split(" ")
  const b = normalizeText(after).split(" ")
  if (a.join(" ") === b.join(" ")) return null
  let start = 0
  while (start < a.length && start < b.length && a[start] === b[start]) start += 1
  let endA = a.length
  let endB = b.length
  while (endA > start && endB > start && a[endA - 1] === b[endB - 1]) {
    endA -= 1
    endB -= 1
  }
  const clip = (words: string[]) => {
    const text = words.join(" ")
    return text.length > 300 ? `${text.slice(0, 300)}…` : text
  }
  const lead = a.slice(Math.max(0, start - context), start).join(" ")
  const removed = clip(a.slice(start, endA))
  const added = clip(b.slice(start, endB))
  return [`near: "…${lead}"`, `  - saved: ${removed ? `"${removed}"` : "(nothing)"}`, `  + live:  ${added ? `"${added}"` : "(nothing)"}`].join("\n")
}

// ---------------------------------------------------------------------------
// Cutting one section out of a page

/** The inner HTML of the first element with this id or class (matching nested tags of the same name). */
export function elementHtml(html: string, selector: { id?: string; className?: string; tag?: string }): string | null {
  const attr = selector.id
    ? `\\bid\\s*=\\s*["']${escapeRegExp(selector.id)}["']`
    : selector.className
      ? `\\bclass\\s*=\\s*["'](?:[^"']*\\s)?${escapeRegExp(selector.className)}(?:\\s[^"']*)?["']`
      : ""
  const open = new RegExp(`<(${selector.tag ?? "[a-z][a-z0-9]*"})\\b[^>]*${attr}[^>]*>`, "i").exec(html)
  if (!open) return null
  const tag = open[1].toLowerCase()
  const tags = new RegExp(`<(/?)${tag}\\b[^>]*?(/?)>`, "gi")
  tags.lastIndex = open.index + open[0].length
  let depth = 1
  for (let match = tags.exec(html); match; match = tags.exec(html)) {
    if (match[2] === "/") continue // self-closing
    depth += match[1] === "/" ? -1 : 1
    if (depth === 0) return html.slice(open.index + open[0].length, match.index)
  }
  return html.slice(open.index + open[0].length)
}

function escapeRegExp(text: string): string {
  return text.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")
}

/** A section number as a pattern that accepts "-" or "–" (Maryland prints "§27–501"). */
function dashFlexible(section: string): string {
  return escapeRegExp(section).replace(/-/g, "[-\u2010-\u2015]")
}

/** Text from the first match of `start` up to (not including) the first match of `end` after it. */
export function cutText(text: string, start?: RegExp, end?: RegExp): string | null {
  let from = 0
  if (start) {
    const found = start.exec(text)
    if (!found) return null
    from = found.index
  }
  let to = text.length
  if (end) {
    const rest = text.slice(from + 1)
    const found = end.exec(rest)
    if (found) to = from + 1 + found.index
  }
  return tidyLines(text.slice(from, to))
}

export type SiteRule = {
  /** The site's own name, for the snapshot's front matter. */
  site: string
  /** A short note on the site's terms of use, when it states any. Copied into each snapshot. */
  terms?: string
  /** Set when this isn't the state's own site, so we can switch to an official copy later. */
  mirror?: string
  /** The site often answers a plain fetch with a bot check, or builds the page with JavaScript, so a browser may be needed. */
  needsBrowser?: boolean
  /** The element that holds the law's text. */
  container?: { id?: string; className?: string; tag?: string }
  /** Where the section starts and stops inside that text, worked out from the page's address. */
  start?: (url: URL) => RegExp
  end?: (url: URL) => RegExp
}

/** How to cut the cited section out of each site's pages. Add a site here when a new batch cites one. */
export const SITE_RULES: Record<string, SiteRule> = {
  "leginfo.legislature.ca.gov": {
    site: "California Legislative Information",
    needsBrowser: true,
    container: { id: "codeLawSectionNoHead" },
    start: (url) => new RegExp(`^${escapeRegExp(url.searchParams.get("sectionNum") ?? "")}\\.\\s*$`, "m"),
  },
  "www.law.cornell.edu": {
    site: "Legal Information Institute, Cornell Law School",
    mirror: "law.cornell.edu is a free mirror run by Cornell Law School, not the state's own site",
    terms: "LII links a Terms of use page from every page; we copy only the regulation's text, which is public.",
    container: { className: "statereg-text" },
  },
  "www.capitol.hawaii.gov": {
    site: "Hawaii State Legislature",
    needsBrowser: true,
    container: { className: "WordSection1" },
    // The page adds "Case Notes" (court summaries) after the section; they aren't the law.
    end: () => /^Case Notes$/m,
  },
  "adminrules.idaho.gov": {
    site: "Idaho Office of the Administrative Rules Coordinator",
    // The PDF holds the whole chapter; the label's section number picks the part we cite.
  },
  "www.legislature.mi.gov": {
    site: "Michigan Legislature",
    container: { className: "sectionWrapper" },
  },
  "mgaleg.maryland.gov": {
    site: "Maryland General Assembly",
    container: { id: "mainBody" },
    start: (url) => new RegExp(`^§\\s*${dashFlexible(url.searchParams.get("section") ?? "")}\\.`, "m"),
    end: () => /^Previous\s*Next$/m,
  },
  "archive.legmt.gov": {
    site: "Montana Legislature (Montana Code Annotated archive)",
    terms: "The site says its online code is a research tool; where it differs from the printed code, the printed version wins.",
    container: { className: "section-content" },
  },
  "www.ncleg.gov": {
    site: "North Carolina General Assembly",
    container: { tag: "body" },
  },
  "www.nysenate.gov": {
    site: "New York State Senate",
    needsBrowser: true,
    container: { className: "nys-openleg-result-text" },
  },
  "law.justia.com": {
    site: "Justia",
    mirror: "law.justia.com is a free mirror run by Justia, not the court's own site",
    terms: "Justia links a Terms of Service page from every page; we copy only the court's opinion, which is public.",
    needsBrowser: true,
    container: { id: "opinion" },
  },
  "statutes.capitol.texas.gov": {
    site: "Texas Legislature, Texas Constitution and Statutes",
    // The page is built by JavaScript: a plain fetch gets an empty app shell.
    needsBrowser: true,
    // The page holds the whole chapter; the label's section number picks the part we cite.
  },
  "le.utah.gov": {
    site: "Utah State Legislature",
    container: { id: "secdiv" },
  },
  "law.lis.virginia.gov": {
    site: "Virginia Law, Legislative Information System",
    terms: "The site carries a Commonwealth of Virginia copyright notice; we copy only the statute's text, which is public.",
    container: { id: "va_code" },
  },
  "app.leg.wa.gov": {
    site: "Washington State Legislature",
    terms: "The site links a Disclaimer and a Copyright page; we copy only the statute's text, which is public.",
    container: { id: "contentWrapper" },
  },
}

/** "Tex. Ins. Code § 559.052(a)(2)" → "559.052", the section a label cites. */
export function sectionNumber(label: string): string | null {
  const found = /§\s*([0-9][0-9A-Za-z.:-]*?[0-9A-Za-z])(?=\(|\s|,|$)/.exec(label)
  return found ? found[1] : null
}

/**
 * Pages that hold a whole chapter, so we cut out the one section the label cites.
 * Keyed by site; given the cited section number, return where it starts and stops.
 */
const CHAPTER_CUTS: Record<string, (section: string) => { start: RegExp; end: RegExp }> = {
  "statutes.capitol.texas.gov": (section) => ({
    start: new RegExp(`^Sec\\.\\s+${escapeRegExp(section)}\\.`, "m"),
    end: /^(?:Sec\. \d+\.\d+\.|SUBCHAPTER [A-Z]\.)/m,
  }),
  "adminrules.idaho.gov": (section) => ({
    // The heading is in capitals ("100. USE OF CREDIT FACTORS."); the table of contents isn't.
    start: new RegExp(`^${escapeRegExp(section)}\\.\\s+[A-Z][A-Z ,'’-]*\\.\\s*$`, "m"),
    end: /^\d{3}\.(?:\s|\s*[–-]\s*\d{3}\.)/m,
  }),
}

/** The section an IDAPA label cites: "IDAPA 18.02.01.100.01.b" → "100". */
function idapaSection(label: string): string | null {
  const found = /IDAPA\s+\d+\.\d+\.\d+\.(\d{3})/.exec(label)
  return found ? found[1] : null
}

export type Extracted = { text: string } | { error: string; needsBrowser?: boolean }

/** The cited section's text from a page (HTML, or text already pulled from a PDF). */
export function extractSection(urlText: string, page: string, label: string, isPdfText = false): Extracted {
  const url = new URL(urlText)
  const rule = SITE_RULES[url.host]
  if (!rule) return { error: `no rule for ${url.host} in SITE_RULES (scripts/rating-quotes/law.ts)` }
  if (!isPdfText && looksLikeBotCheck(page)) return { error: "the site sent a bot check instead of the page", needsBrowser: true }
  let text: string
  if (isPdfText) {
    text = reflowPdfText(page)
  } else {
    let html = page
    if (rule.container) {
      const inner = elementHtml(page, rule.container)
      if (inner === null) {
        return {
          error: `couldn't find the law's text on the page (looked for ${JSON.stringify(rule.container)})`,
          needsBrowser: rule.needsBrowser,
        }
      }
      html = inner
    }
    text = htmlToText(html)
  }
  const chapterCut = CHAPTER_CUTS[url.host]
  if (chapterCut) {
    const section = url.host === "adminrules.idaho.gov" ? idapaSection(label) : sectionNumber(label)
    if (!section) return { error: `couldn't read a section number from "${label}"` }
    const { start, end } = chapterCut(section)
    const cut = cutText(text, start, end)
    if (!cut) return { error: `couldn't find section ${section} on the page`, needsBrowser: rule.needsBrowser }
    text = cut
  } else if (rule.start || rule.end) {
    const cut = cutText(text, rule.start?.(url), rule.end?.(url))
    if (!cut) return { error: "couldn't find where the section starts on the page", needsBrowser: rule.needsBrowser }
    text = cut
  }
  if (text.length < 80) return { error: "the page came back nearly empty", needsBrowser: true }
  return { text }
}

/**
 * PDF text breaks every printed line. Join them back into paragraphs: a new
 * one starts at a blank line or a numbered heading or item ("100.", "01.", "a.", "(3)").
 */
export function reflowPdfText(text: string): string {
  const out: string[] = []
  for (const line of tidyLines(text).split("\n")) {
    const startsItem = /^(?:\d{1,3}\.|[a-z]\.|[ivx]+\.|\(\w{1,4}\))\s/.test(line)
    if (line === "" || startsItem || out.length === 0 || out[out.length - 1] === "") out.push(line)
    else out[out.length - 1] = `${out[out.length - 1]} ${line}`
  }
  return tidyLines(out.join("\n"))
}

/** A Cloudflare-style "check your browser" page, or one that only works with JavaScript. */
export function looksLikeBotCheck(html: string): boolean {
  return /Just a moment\.\.\.|Enable JavaScript and cookies to continue|cf-browser-verification|_cf_chl_opt|Sorry, you have been blocked|Attention Required! \| Cloudflare|Please enable JavaScript to view/i.test(html)
}

// ---------------------------------------------------------------------------
// Snapshot files

export type SnapshotMeta = {
  url: string
  title: string
  retrieved: string
  fetchedWith: "fetch" | "browser"
  site: string
  mirror?: string
  sourceTerms?: string
}

const META_KEYS = ["url", "title", "retrieved", "fetchedWith", "site", "mirror", "sourceTerms"] as const

/** A snapshot file: front matter (each value a JSON string, so ":" and "&" in a URL are safe), then the text. */
export function formatSnapshot(meta: SnapshotMeta, body: string): string {
  const lines = ["---"]
  for (const key of META_KEYS) {
    const value = meta[key]
    if (value !== undefined) lines.push(`${key}: ${JSON.stringify(value)}`)
  }
  lines.push("---", "")
  // Blank lines between paragraphs, so the Markdown reads the way the law is laid out.
  const paragraphs = tidyLines(body)
    .split("\n")
    .filter((line) => line.length > 0)
  return `${lines.join("\n")}\n${paragraphs.join("\n\n")}\n`
}

export function parseSnapshot(file: string): { meta: SnapshotMeta; body: string } {
  const found = /^---\n([\s\S]*?)\n---\n([\s\S]*)$/.exec(file.replace(/\r\n?/g, "\n"))
  if (!found) throw new Error("a snapshot starts with front matter between two --- lines")
  const meta: Record<string, string> = {}
  for (const line of found[1].split("\n")) {
    if (!line.trim()) continue
    const pair = /^([A-Za-z]+): (.*)$/.exec(line)
    if (!pair) throw new Error(`front matter line isn't "key: value": ${line}`)
    const value: unknown = JSON.parse(pair[2])
    if (typeof value !== "string") throw new Error(`front matter "${pair[1]}" must be a string`)
    meta[pair[1]] = value
  }
  for (const key of ["url", "title", "retrieved", "fetchedWith", "site"]) {
    if (!meta[key]) throw new Error(`front matter needs "${key}"`)
  }
  if (meta.fetchedWith !== "fetch" && meta.fetchedWith !== "browser") throw new Error('"fetchedWith" must be "fetch" or "browser"')
  if (!/^\d{4}-\d{2}-\d{2}$/.test(meta.retrieved)) throw new Error('"retrieved" must be YYYY-MM-DD')
  return { meta: meta as SnapshotMeta, body: found[2].trim() }
}

/** "Cal. Ins. Code § 1861.02(a)" → "Cal. Ins. Code § 1861.02": the section, without subsections or notes. */
export function sectionTitle(label: string): string {
  if (/^IDAPA /.test(label)) {
    const found = /^IDAPA\s+(\d+\.\d+\.\d+\.\d{3})/.exec(label)
    if (found) return `IDAPA ${found[1]}`
  }
  return label
    .replace(/,\s+[a-z].*$/, "") // ", the list of optional factors"
    .replace(/(?:\([0-9A-Za-z-]+\))+(?:\s*[-–]\s*(?:\([0-9A-Za-z-]+\))+)?$/, "") // "(a)(2)", "(4)-(5)"
    .trim()
}

/** A file name from a title: "Cal. Ins. Code § 1861.02" → "cal-ins-code-1861.02". */
export function snapshotSlug(title: string): string {
  return title
    .toLowerCase()
    .replace(/§/g, " ")
    .replace(/\.(?!\d)/g, " ")
    .replace(/[^a-z0-9.]+/g, "-")
    .replace(/^-+|-+$/g, "")
}

// ---------------------------------------------------------------------------
// What the rules cite

export type Citation = {
  state: string
  factor: string
  /** "source" or "more source 1", for messages. */
  where: string
  label: string
  url: string
  quote: string
}

type RulesFileLike = {
  states: Record<string, Record<string, { source: { label: string; url: string }; quote: string; moreSources?: { label: string; url: string; quote: string }[] } | undefined>>
}

/** Every quote in the rules file, with the law it should be found in. */
export function citations(file: RulesFileLike, onlyState?: string): Citation[] {
  const out: Citation[] = []
  for (const [state, factors] of Object.entries(file.states)) {
    if (onlyState && state !== onlyState) continue
    for (const [factor, rule] of Object.entries(factors)) {
      if (!rule) continue
      out.push({ state, factor, where: "source", label: rule.source.label, url: rule.source.url, quote: rule.quote })
      ;(rule.moreSources ?? []).forEach((more, index) => {
        out.push({ state, factor, where: `more source ${index + 1}`, label: more.label, url: more.url, quote: more.quote })
      })
    }
  }
  return out
}

export type CheckStatus = "OK" | "MISSING" | "NO_SNAPSHOT" | "CHANGED" | "FETCH_FAILED" | "NEEDS_BROWSER"

/** A plain text table: one row per result, then counts. */
export function summaryTable(rows: { status: CheckStatus; state: string; what: string; note?: string }[]): string {
  const header = ["Status", "State", "What", "Note"]
  const body = rows.map((row) => [row.status, row.state, row.what, row.note ?? ""])
  const widths = header.map((title, column) => Math.min(70, Math.max(title.length, ...body.map((cells) => cells[column].length))))
  const line = (cells: string[]) =>
    cells
      .map((cell, column) => (cell.length > widths[column] ? `${cell.slice(0, widths[column] - 1)}…` : cell.padEnd(widths[column])))
      .join("  ")
      .trimEnd()
  const counts = new Map<CheckStatus, number>()
  for (const row of rows) counts.set(row.status, (counts.get(row.status) ?? 0) + 1)
  const totals = [...counts.entries()].map(([status, count]) => `${status}: ${count}`).join(", ")
  return [line(header), widths.map((width) => "-".repeat(width)).join("  "), ...body.map(line), "", `Total ${rows.length}. ${totals}`].join("\n")
}
