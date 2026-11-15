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

/**
 * A page's bytes as text, in the page's own character set: the one the server names, else the one
 * a <meta> tag names, else UTF-8, and Windows-1252 when the bytes aren't valid UTF-8 (Nevada's and
 * Oregon's statute pages are Windows-1252 and say so nowhere).
 */
export function decodePage(bytes: Uint8Array, contentType = ""): string {
  const named = (label: string | undefined): string | null => {
    if (!label) return null
    const name = label.trim().toLowerCase()
    // Decoded by hand: Node 20's TextDecoder reads "windows-1252" as plain Latin-1, so curly quotes
    // (0x91-0x94) would come out as control characters. The web treats all three labels as Windows-1252.
    if (["windows-1252", "cp1252", "iso-8859-1", "latin1", "us-ascii", "ascii"].includes(name)) return decodeWindows1252(bytes)
    try {
      return new TextDecoder(name).decode(bytes)
    } catch {
      return null
    }
  }
  const fromHeader = named(/charset\s*=\s*["']?([\w-]+)/i.exec(contentType)?.[1])
  if (fromHeader !== null) return fromHeader
  const head = decodeWindows1252(bytes.subarray(0, 4096))
  const fromMeta = named(/<meta[^>]+charset\s*=\s*["']?([\w-]+)/i.exec(head)?.[1])
  if (fromMeta !== null) return fromMeta
  try {
    return new TextDecoder("utf-8", { fatal: true }).decode(bytes)
  } catch {
    return decodeWindows1252(bytes)
  }
}

/** Windows-1252's characters for bytes 0x80-0x9F (the rest match Latin-1). Unassigned bytes keep their code. */
const WINDOWS_1252_HIGH = [
  0x20ac, 0x81, 0x201a, 0x0192, 0x201e, 0x2026, 0x2020, 0x2021, 0x02c6, 0x2030, 0x0160, 0x2039, 0x0152, 0x8d, 0x017d, 0x8f,
  0x90, 0x2018, 0x2019, 0x201c, 0x201d, 0x2022, 0x2013, 0x2014, 0x02dc, 0x2122, 0x0161, 0x203a, 0x0153, 0x9d, 0x017e, 0x0178,
]

/** Windows-1252 bytes as text, the same on every Node version. */
export function decodeWindows1252(bytes: Uint8Array): string {
  let out = ""
  for (let start = 0; start < bytes.length; start += 8192) {
    const chunk = Array.from(bytes.subarray(start, start + 8192), (byte) => (byte >= 0x80 && byte <= 0x9f ? WINDOWS_1252_HIGH[byte - 0x80] : byte))
    out += String.fromCharCode(...chunk)
  }
  return out
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

/** The most text one "..." may stand for. Longer, and the quote is stitching together separate passages. */
export const MAX_OMITTED_CHARS = 600

/** Words that change what a law means. A "..." may never leave one out. */
export const MEANING_WORDS = ["not", "no", "never", "except", "unless", "without", "notwithstanding", "only", "provided"] as const
const MEANING_PATTERN = new RegExp(`\\b(?:${MEANING_WORDS.join("|")})\\b|n't\\b`, "i")

/** Why "..." can't stand for this omitted text, or null when it can. */
export function omissionProblem(omitted: string): string | null {
  if (omitted.length > MAX_OMITTED_CHARS) return `leaves out ${omitted.length} characters (at most ${MAX_OMITTED_CHARS})`
  const word = MEANING_PATTERN.exec(omitted)
  return word ? `leaves out "${word[0]}"` : null
}

const isWordChar = (char: string | undefined) => char !== undefined && /[\p{L}\p{N}_]/u.test(char)

/** Every place `part` starts in `text`, on word boundaries at both edges ("fair" never matches inside "unfair"). */
function wholeMatches(text: string, part: string, from: number, to: number): number[] {
  const out: number[] = []
  for (let at = text.indexOf(part, from); at >= 0 && at <= to; at = text.indexOf(part, at + 1)) {
    const startsOk = !isWordChar(part[0]) || !isWordChar(text[at - 1])
    const endsOk = !isWordChar(part[part.length - 1]) || !isWordChar(text[at + part.length])
    if (startsOk && endsOk) out.push(at)
  }
  return out
}

/**
 * True when the quote appears in the text, as whole words. With "...", the
 * pieces must appear in order, each gap at most MAX_OMITTED_CHARS long and
 * never leaving out a word like "not", "except", or "only".
 */
export function quoteFound(quote: string, text: string): boolean {
  const parts = quoteParts(quote)
  if (parts.length === 0) return false
  const haystack = normalizeText(text)
  const placeRest = (index: number, from: number): boolean => {
    if (index === parts.length) return true
    const part = parts[index]
    const latest = index === 0 ? haystack.length : from + 1 + MAX_OMITTED_CHARS
    for (const at of wholeMatches(haystack, part, from, latest)) {
      if (index > 0 && omissionProblem(haystack.slice(from, at).trim())) continue
      if (placeRest(index + 1, at + part.length)) return true
    }
    return false
  }
  return placeRest(0, 0)
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
  /**
   * The site's PDFs are laid out in columns (consumer guides, mostly). Read them in reading order
   * instead of keeping the printed layout, which would interleave the columns line by line.
   */
  pdfColumns?: boolean
  /**
   * The site's PDFs print a line number in the margin of every line, plus a running header and
   * footer (Arkansas's acts). These lines are dropped, and the numbers stripped, before the text
   * is joined into paragraphs.
   */
  pdfLineNumbers?: { header: RegExp }
  /**
   * The site's PDF is a scan with no text layer (DC's bulletins). Its saved copy is read by OCR and
   * checked against the page image by hand (fetchedWith "ocr"); live, an empty text layer is
   * NEEDS_BROWSER, not a failure.
   */
  scannedPdf?: boolean
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
  "static.case.law": {
    site: "Caselaw Access Project, Harvard Law School Library",
    mirror: "static.case.law is Harvard Law School Library's scan of the official reporter, not the court's own site",
    terms: "https://case.law/terms/ (effective March 13, 2024): the case data is released under CC0 1.0, with no conditions on reuse. Harvard asks for credit to the Caselaw Access Project.",
    container: { className: "casebody" },
  },
  "statutes.capitol.texas.gov": {
    site: "Texas Legislature, Texas Constitution and Statutes",
    // The page is built by JavaScript: a plain fetch gets an empty app shell.
    needsBrowser: true,
    // The page holds the whole chapter; the label's section number picks the part we cite.
  },
  "www.flsenate.gov": {
    site: "The Florida Senate, Florida Statutes",
    terms: "The page says the information on the system is unverified and that the journals or printed bills of each chamber should be consulted for official purposes.",
    container: { tag: "body" },
    start: (url) => new RegExp(`^${escapeRegExp(url.pathname.split("/").pop() ?? "")} [A-Z]`, "m"),
    end: () => /^History\.—/m,
  },
  "www.ilga.gov": {
    site: "Illinois General Assembly, Illinois Compiled Statutes",
    container: { tag: "body" },
    start: () => /^\(\d+ ILCS /m,
    end: () => /^\(Source:/m,
  },
  "codes.ohio.gov": {
    site: "Ohio Laws and Administrative Rules (Legislative Service Commission)",
    container: { className: "laws-body" },
  },
  "www.azleg.gov": {
    site: "Arizona State Legislature, Arizona Revised Statutes",
    container: { tag: "body" },
  },
  "www.oscn.net": {
    site: "Oklahoma State Courts Network (OSCN), Oklahoma Statutes",
    container: { id: "oscn-content" },
    start: () => /^Cite as:/m,
    end: () => /^Historical Data$/m,
  },
  "difi.az.gov": {
    site: "Arizona Department of Insurance and Financial Institutions",
    pdfColumns: true,
    start: (url) => guideCut(url).start,
    end: (url) => guideCut(url).end,
  },
  "olls.info": {
    // The legislature's 2026 titles page (leg.colorado.gov/agencies/office-legislative-legal-services/2026-crs-titles-download) links here.
    site: "Colorado Office of Legislative Legal Services (Colorado Revised Statutes)",
    // The PDF holds the whole title; the label's section number picks the part we cite.
  },
  // Insurance departments' consumer pages: summaries of the law, cited with "evidence": "summary".
  "www.tdi.texas.gov": {
    site: "Texas Department of Insurance",
    container: { tag: "main" },
    start: () => /^Insurance companies determine premiums and rates by looking at you$/m,
    end: () => /^But it’s not just you$/m,
  },
  "www.oid.ok.gov": {
    site: "Oklahoma Insurance Department",
    container: { tag: "main" },
    start: () => /^Factors Affecting Premiums and Rates$/m,
    end: () => /^Additional Factors Influencing Insurance Costs$/m,
  },
  "oci.georgia.gov": {
    site: "Georgia Office of Commissioner of Insurance and Safety Fire",
    container: { tag: "main" },
    start: () => /^Several Factors Will Affect Risk Rating$/m,
    end: () => /^Ask Your Agent About Discounts$/m,
  },
  "idoi.illinois.gov": {
    site: "Illinois Department of Insurance",
    container: { tag: "main" },
    start: () => /^Factors That May Affect The Premium$/m,
    end: () => /^Discounts That May Be Available$/m,
  },
  "insurance.ohio.gov": {
    site: "Ohio Department of Insurance",
    container: { tag: "main" },
    start: () => /^What factors do companies use to set rates\?$/m,
    end: () => /^About Rate Regulation$/m,
  },
  "www.nj.gov": {
    site: "New Jersey Department of Banking and Insurance",
    pdfColumns: true,
    start: (url) => guideCut(url).start,
    end: (url) => guideCut(url).end,
  },
  "www.myfloridacfo.com": {
    site: "Florida Department of Financial Services",
    pdfColumns: true,
    container: { tag: "main" },
    start: (url) => guideCut(url).start,
    end: (url) => guideCut(url).end,
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
  "admincode.legislature.state.al.us": {
    site: "Alabama Legislative Services Agency, Alabama Administrative Code",
    // The PDF holds the whole chapter; the label's rule number picks the part we cite.
  },
  "arkleg.state.ar.us": {
    site: "Arkansas State Legislature",
    // An act's PDF numbers every line in the margin and repeats a header on each page.
    pdfLineNumbers: { header: /^(?:As Engrossed:.*|\d+\s+\d{8}[A-Z]{3}\d{4}\.[A-Z]{3}\d+|\*[A-Z0-9]+\*.*)$/ },
    // The act holds several sections; the label's section number picks the part we cite.
  },
  "www.cga.ct.gov": {
    site: "Connecticut General Assembly, General Statutes of Connecticut",
    container: { tag: "body" },
    // The page holds the whole chapter; the label's section number picks the part we cite.
  },
  "iga.in.gov": {
    site: "Indiana General Assembly, Indiana Code",
    // The code viewer is built by JavaScript, and the title file behind it only answers a browser.
    needsBrowser: true,
    container: { tag: "body" },
    // The page holds the whole title; the label's section number picks the part we cite.
  },
  "www.legis.iowa.gov": {
    site: "Iowa Legislature, Iowa Code",
  },
  "www.ksrevisor.gov": {
    site: "Kansas Office of Revisor of Statutes",
    container: { className: "ksa" },
    start: () => /^\d+-\d+[a-z]?\. /m,
    end: () => /^Previous \| Next$/m,
  },
  "apps.legislature.ky.gov": {
    site: "Kentucky General Assembly, Kentucky Revised Statutes",
  },
  "www.legis.la.gov": {
    site: "Louisiana State Legislature",
    container: { id: "ctl00_PageBody_divLaw" },
    start: () => /^§\s*\d+(?:\.\d+)?\. /m,
  },
  "www.revisor.mn.gov": {
    site: "Minnesota Office of the Revisor of Statutes",
    container: { id: "xtend" },
  },
  "revisor.mo.gov": {
    site: "Missouri Revisor of Statutes",
    container: { className: "norm", tag: "div" },
  },
  "www.leg.state.nv.us": {
    site: "Nevada Legislature, Nevada Revised Statutes",
    container: { tag: "body" },
    // The page holds the whole chapter; the label's section number picks the part we cite.
  },
  "www.oregonlegislature.gov": {
    site: "Oregon State Legislature, Oregon Revised Statutes",
    container: { tag: "body" },
    // The page holds the whole chapter; the label's section number picks the part we cite.
  },
  "disb.dc.gov": {
    site: "District of Columbia Department of Insurance, Securities and Banking",
    scannedPdf: true,
  },
  "capitol.tn.gov": {
    site: "Tennessee General Assembly",
    // A public chapter (session law) holds several sections; the label's section number picks the part we cite.
  },
  "doi.sc.gov": {
    site: "South Carolina Department of Insurance",
    pdfColumns: true,
    start: (url) => guideCut(url).start,
    end: (url) => guideCut(url).end,
  },
  "insurance.arkansas.gov": {
    site: "Arkansas Insurance Department",
    pdfColumns: true,
    start: (url) => guideCut(url).start,
    end: (url) => guideCut(url).end,
  },
  "www.scstatehouse.gov": {
    site: "South Carolina Legislature, South Carolina Code of Laws",
    container: { tag: "body" },
    // The page holds the whole chapter; the label's section number picks the part we cite.
  },
}

/**
 * Consumer guides run many pages; we keep only the part a rule cites. Keyed by host and path.
 * A guide that isn't listed here is kept whole.
 */
const GUIDE_CUTS: Record<string, { start: RegExp; end: RegExp }> = {
  "difi.az.gov/sites/default/files/2026-08/2025_Auto_Premium_Comparison.pdf": {
    start: /^NOTES TO THE HYPOTHETICALS/m,
    end: /^ABBREVIATIONS USED IN THIS PUBLICATION/m,
  },
  "www.nj.gov/dobi/division_consumers/pdf/autoshopguide2026.pdf": {
    start: /^What Affects the Cost of Auto Insurance\?/m,
    end: /^Check If You Are Eligible for Discounts/m,
  },
  "www.nj.gov/dobi/division_consumers/pdf/insurescore.pdf": {
    start: /^What about those individuals for whom a score cannot be/m,
    end: /^How to Protect or Improve Your Credit History/m,
  },
  "www.myfloridacfo.com/docs-sf/consumer-services-libraries/consumerservices-documents/understanding-coverage/consumer-guides/english---automobile-insurance-toolkit.pdf": {
    start: /^Underwriting Factors That Affect Your Insurance Policy Premium/m,
    end: /^Other Factors Affecting/m,
  },
  "doi.sc.gov/DocumentCenter/View/9508/Brochure-Auto-Shoppers-Guide-2016": {
    // The guide's headings run into their paragraphs once the PDF's lines are joined.
    start: /Education In South Carolina\b/,
    end: /(?<=have higher insurance credit scores\.)/,
  },
  "insurance.arkansas.gov/documents/understanding-how-insurers-use-credit-information-brochure/": {
    start: /^8\. Is my premium based entirely on my insurance credit score\?/m,
    end: /^9\. /m,
  },
  "www.myfloridacfo.com/division/consumers/understanding-insurance/personal-automobile-insurance-overview": {
    start: /^Ask for car insurance discounts/m,
    end: /^Request your CLUE Report/m,
  },
}

function guideCut(url: URL): { start: RegExp; end: RegExp } {
  return GUIDE_CUTS[`${url.host}${url.pathname}`] ?? { start: /^/, end: /$(?![\s\S])/ }
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
  "olls.info": (section) => coloradoCut(section),
  "admincode.legislature.state.al.us": (rule) => ({
    // The heading ends with a period ("482-1-127-.06 Prohibited Procedures."); the table of contents line doesn't.
    start: new RegExp(`^${escapeRegExp(rule)}\\s+[A-Z][^\\n]*\\.\\s*$`, "m"),
    end: /(?<=\n)\d+-\d+-\d+-\.\d+\s+[A-Z][^\n]*\.[ \t]*(?=\n|$)/,
  }),
  "capitol.tn.gov": (section) => ({
    start: new RegExp(`^SECTION ${escapeRegExp(section)}\\.`, "m"),
    end: /(?<=\n)SECTION \d+\./,
  }),
  "arkleg.state.ar.us": (section) => ({
    start: new RegExp(`^${escapeRegExp(section)}\\.\\s+[A-Z]`, "m"),
    end: /(?<=\n)(?:\d+-\d+-\d+\.\s+[A-Z]|SECTION \d+\.)/,
  }),
  // Chapter pages that open with a table of contents: a heading there is followed by the next
  // heading, while the section itself is followed by its text.
  "www.cga.ct.gov": (section) => headingCut(`Sec\\. ${escapeRegExp(section)}\\. `, "Sec\\. ", /(?<=\n)(?:Sec\. \d+[a-z]*-\d+[a-z]*\. |\(Return to Chapter$)/m),
  "www.leg.state.nv.us": (section) => headingCut(`NRS ${escapeRegExp(section)} `, "NRS ", /(?<=\n)NRS \d+[A-Z]?\.\d+ /),
  "www.oregonlegislature.gov": (section) => headingCut(`${escapeRegExp(section)} `, "\\d+\\.\\d+ ", /(?<=\n)\d+\.\d+ [A-Z]/),
  "www.scstatehouse.gov": (section) => headingCut(`SECTION ${escapeRegExp(section)}\\. `, "SECTION ", /(?<=\n)SECTION \d+-\d+-\d+\. /),
  "iga.in.gov": (section) => headingCut(`IC ${escapeRegExp(section)}(?![\\d.-])`, "IC ", /(?<=\n)IC \d+(?:\.\d+)?-\d+(?:\.\d+)?-\d+(?:\.\d+)?-\d+(?:\.\d+)?(?![\d.-])/),
  "adminrules.idaho.gov": (section) => ({
    // The heading is in capitals ("100. USE OF CREDIT FACTORS."); the table of contents isn't.
    start: new RegExp(`^${escapeRegExp(section)}\\.\\s+[A-Z][A-Z ,'’-]*\\.\\s*$`, "m"),
    end: /^\d{3}\.(?:\s|\s*[–-]\s*\d{3}\.)/m,
  }),
}

/** A Colorado section starts a paragraph with its number and a heading ("10-4-616. Disclosure of credit reports."). */
function coloradoCut(section: string): { start: RegExp; end: RegExp } {
  return {
    start: new RegExp(`^${escapeRegExp(section)}\\.\\s+[A-Z]`, "m"),
    // The next section's heading, or the "ANNOTATION" block of court-case notes that follows some
    // sections (not the statute's text, so we leave it out). The lookbehind keeps the search, which
    // starts one character into this section's own number, from matching the rest of that number ("0-4-616.").
    end: /(?<=\n)(?:\d+-\d+(?:\.\d+)?-\d+(?:\.\d+)?\.\s+[A-Z]|ANNOTATION\b)/,
  }
}

/**
 * A section that starts with its heading (`heading`, a pattern), skipping a table-of-contents line
 * with the same words: there the next line is another heading (`nextHeading`), not the section's text.
 * (So a one-paragraph section printed on its heading's line can't be told from its contents line.
 * Every section cited so far runs past its first paragraph.)
 */
function headingCut(heading: string, nextHeading: string, end: RegExp): { start: RegExp; end: RegExp } {
  return { start: new RegExp(`^${heading}[^\\n]*\\n+(?!\\n|${nextHeading})`, "m"), end }
}

/** The section of an act a label cites: "2004 Tenn. Pub. Acts ch. 527, § 3(5)" → "3". */
function actSection(label: string): string | null {
  const found = /§\s*(\d+)/.exec(label)
  return found ? found[1] : null
}

/** The rule an Alabama label cites: "Ala. Admin. Code r. 482-1-127-.06(3)" → "482-1-127-.06". */
function alabamaRule(label: string): string | null {
  const found = /\br\.\s*(\d+-\d+-\d+-\.\d+)/.exec(label)
  return found ? found[1] : null
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
  // Only a real JavaScript shell (or a bot check, above) means "open it in a browser". Any other
  // page we can't cut is a fatal problem: the site's layout moved, or the link points somewhere else.
  // Only on sites known to build pages with JavaScript: elsewhere a thin page with a script is more
  // likely a "page not found" served as 200, which must fail.
  const shell = !isPdfText && rule.needsBrowser === true && looksLikeJsShell(page)
  const shellNote = shell ? "the page is a JavaScript shell; " : ""
  let text: string
  if (isPdfText) {
    text = reflowPdfText(rule.pdfLineNumbers ? stripPdfLineNumbers(page, rule.pdfLineNumbers.header) : page)
  } else {
    let html = page
    if (rule.container) {
      const inner = elementHtml(page, rule.container)
      if (inner === null) {
        return {
          error: `${shellNote}couldn't find the law's text on the page (looked for ${JSON.stringify(rule.container)})`,
          needsBrowser: shell,
        }
      }
      html = inner
    }
    text = htmlToText(html)
  }
  const chapterCut = CHAPTER_CUTS[url.host]
  if (chapterCut) {
    const section =
      url.host === "adminrules.idaho.gov"
        ? idapaSection(label)
        : url.host === "admincode.legislature.state.al.us"
          ? alabamaRule(label)
          : url.host === "capitol.tn.gov"
            ? actSection(label)
            : sectionNumber(label)
    if (!section) return { error: `couldn't read a section number from "${label}"` }
    const { start, end } = chapterCut(section)
    const cut = cutText(text, start, end)
    if (!cut) return { error: `${shellNote}couldn't find section ${section} on the page`, needsBrowser: shell }
    text = cut
  } else if (rule.start || rule.end) {
    const cut = cutText(text, rule.start?.(url), rule.end?.(url))
    if (!cut) return { error: `${shellNote}couldn't find where the section starts on the page`, needsBrowser: shell }
    text = cut
  }
  if (text.length < 80 && isPdfText && rule.scannedPdf) {
    return { error: "a scanned PDF with no text layer: compare the saved (OCR) copy with the page by hand", needsBrowser: true }
  }
  if (text.length < 80) return { error: "the page came back nearly empty", needsBrowser: shell }
  return { text }
}

/**
 * A PDF (kept in its printed layout) whose lines carry a margin number: drop the number from each
 * line, and drop the running header and footer lines. A page break may still split a paragraph,
 * which doesn't matter to a quote: line breaks count as spaces.
 */
export function stripPdfLineNumbers(text: string, header: RegExp): string {
  return text
    .replace(/\r\n?/g, "\n")
    .replace(/\f/g, "\n")
    .split("\n")
    .map((line) => line.trim())
    .filter((line) => !header.test(line))
    .map((line) => line.replace(/^\d{1,2}(?:\s+|$)/, ""))
    .join("\n")
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

/**
 * A page that's built by JavaScript: it has scripts and almost no text of its own (Texas's
 * statutes site sends about 1,400 characters of menus and headings to a plain fetch).
 */
export function looksLikeJsShell(html: string): boolean {
  return /<script\b/i.test(html) && htmlToText(html).length < 3000
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
  /** "ocr": a scanned PDF, read by OCR and checked against the page image by hand. */
  fetchedWith: "fetch" | "browser" | "ocr"
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
  if (!["fetch", "browser", "ocr"].includes(meta.fetchedWith)) throw new Error('"fetchedWith" must be "fetch", "browser", or "ocr"')
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

/**
 * What a fetch's answer means, before we read it as law.
 * - "ok": read the page.
 * - "needs-browser": a bot check (any 403 or 429, or a challenge page). Not a dead link; check by hand.
 * - "retry": a server error (5xx). Try again with a pause, then give up as "dead".
 * - "dead": the page is gone or refused (404, 410, any other 4xx). The rule's link needs fixing.
 */
export type FetchOutcome = "ok" | "needs-browser" | "retry" | "dead"

export function classifyResponse(status: number, body = ""): FetchOutcome {
  if (looksLikeBotCheck(body) && status >= 400) return "needs-browser"
  if (status === 403 || status === 429) return "needs-browser"
  if (status >= 500) return "retry"
  if (status >= 400) return "dead"
  return "ok"
}

/** How many times a network error or a 5xx is retried, and the pause before each try. */
export const FETCH_RETRIES = 3
export function retryDelayMs(retry: number): number {
  return 2000 * 2 ** (retry - 1) // 2 s, 4 s, 8 s
}

/**
 * Why a live fetch failed: the HTTP status, or the network error's code (from Node's fetch), plus
 * whether the site sent a bot check.
 */
export type FetchFailure = { error: string; status?: number; errorCode?: string; needsBrowser?: boolean }

/**
 * A single page we know fails a plain fetch in one specific way but opens in a browser. Each
 * exception names the exact failure it excuses, when someone last opened the page in a browser,
 * and when it expires. After that date the failure is fatal again, so the page can't go
 * unchecked forever: open it in a browser, re-save it if it changed, and move both dates.
 */
export type BrowserException = {
  reason: string
  /** YYYY-MM-DD: the day someone last opened the page in a browser and found the cited text. */
  lastVerified: string
  /** YYYY-MM-DD: the last day this exception applies. */
  expires: string
  /** The one failure it excuses: an HTTP status, or a network error code. */
  when: { status: number } | { errorCode: string }
}

/** Exact page URLs (without a #fragment) only, never a whole site: any other failure on the same site stays fatal. */
export const BROWSER_EXCEPTIONS: Record<string, BrowserException> = {
  "https://www.ilga.gov/legislation/ilcs/documents/021501570K20.htm": {
    reason: "the Illinois General Assembly's server sends an incomplete certificate chain, which Node's fetch rejects; browsers complete the chain and show the page",
    lastVerified: "2026-11-15",
    expires: "2027-02-15",
    when: { errorCode: "UNABLE_TO_VERIFY_LEAF_SIGNATURE" },
  },
  "https://www.cga.ct.gov/current/pub/chap_701.htm": {
    reason: "the Connecticut General Assembly's server sends an incomplete certificate chain, which Node's fetch rejects; browsers (and curl) complete the chain and show the page",
    lastVerified: "2026-11-15",
    expires: "2027-02-15",
    when: { errorCode: "UNABLE_TO_VERIFY_LEAF_SIGNATURE" },
  },
  "https://insurance.ohio.gov/consumers/automobile/automobile-insurance-guide": {
    reason: "the Ohio Department of Insurance answers our checker's user agent with a 404 page (its PDF copy of the guide does the same); a browser gets the guide",
    lastVerified: "2026-11-15",
    expires: "2027-02-15",
    when: { status: 404 },
  },
}

/**
 * What a failed live fetch counts as. A bot check needs a browser. A failure that an exact-URL
 * exception names, before it expires, needs a browser too. Everything else is FETCH_FAILED,
 * which is fatal: a dead link (404, 410), a server that keeps failing, a DNS or network error.
 */
export function fetchFailureStatus(
  url: string,
  failure: FetchFailure,
  today: string,
  exceptions: Record<string, BrowserException> = BROWSER_EXCEPTIONS,
): { status: "NEEDS_BROWSER" | "FETCH_FAILED"; note: string } {
  if (failure.needsBrowser) return { status: "NEEDS_BROWSER", note: failure.error }
  // A #fragment never reaches the server, so the page is the URL without it.
  const exception = exceptions[url.split("#")[0]]
  const matches =
    exception !== undefined &&
    ("status" in exception.when ? failure.status === exception.when.status : failure.errorCode === exception.when.errorCode)
  if (!exception || !matches) return { status: "FETCH_FAILED", note: failure.error }
  if (today > exception.expires) {
    return {
      status: "FETCH_FAILED",
      note: `browser exception expired ${exception.expires}: open the page in a browser, re-save it if it changed, and renew the exception in BROWSER_EXCEPTIONS (${failure.error})`,
    }
  }
  return {
    status: "NEEDS_BROWSER",
    note: `browser exception until ${exception.expires}: ${exception.reason} (last opened in a browser ${exception.lastVerified}; ${failure.error})`,
  }
}

/** Results that fail the check. Live, a dead link or a site that keeps failing counts: otherwise it would quietly stop being checked. */
export function fatalStatuses(live: boolean): CheckStatus[] {
  return live ? ["MISSING", "CHANGED", "FETCH_FAILED"] : ["MISSING", "NO_SNAPSHOT"]
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
