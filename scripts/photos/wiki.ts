/**
 * Reading generations and US model years out of English Wikipedia.
 *
 * Car articles keep one section per generation. A section either has its own
 * infobox (with `model_years`, which by Wikipedia's convention are North
 * American model years) or links to a generation article with {{Main|...}},
 * whose infobox has them. We read both, and record each article's revision so
 * every boundary can be cited and reproduced.
 */
import { api, chunks, getJson } from "./http"

export type Article = { title: string; revision: number; wikitext: string; wikidata: string | null }

type RevisionsResponse = {
  query: {
    pages: {
      title: string
      missing?: boolean
      pageprops?: { wikibase_item?: string }
      revisions?: { revid: number; slots: { main: { content: string } } }[]
    }[]
    redirects?: { from: string; to: string }[]
    normalized?: { from: string; to: string }[]
  }
}

/** Fetch articles (following redirects), keyed by the title asked for. */
export async function fetchArticles(titles: readonly string[]): Promise<Map<string, Article>> {
  const out = new Map<string, Article>()
  for (const group of chunks([...new Set(titles)], 20)) {
    const body = await getJson<RevisionsResponse>(
      api("en.wikipedia.org", {
        action: "query",
        prop: "revisions|pageprops",
        rvprop: "content|ids",
        rvslots: "main",
        titles: group.join("|"),
        redirects: "1",
      }),
    )
    for (const asked of group) {
      let title = body.query.normalized?.find((item) => item.from === asked)?.to ?? asked
      const redirect = body.query.redirects?.find((item) => item.from === title)
      if (redirect) title = redirect.to
      const page = body.query.pages.find((item) => item.title === title)
      const revision = page?.revisions?.[0]
      if (!page || page.missing || !revision) continue
      out.set(asked, {
        title: page.title,
        revision: revision.revid,
        wikitext: revision.slots.main.content,
        wikidata: page.pageprops?.wikibase_item ?? null,
      })
    }
  }
  return out
}

/** Wikitext to plain words: links to their text, templates and tags removed. */
export function plain(text: string): string {
  return text
    .replace(/<ref[^>]*\/>/g, "")
    .replace(/<ref[\s\S]*?<\/ref>/g, "")
    .replace(/<!--[\s\S]*?-->/g, "")
    .replace(/<br\s*\/?>/gi, "; ")
    .replace(/<[^>]+>/g, "")
    .replace(/\[\[(?:[^|\]]*\|)?([^\]]+)\]\]/g, "$1")
    .replace(/\{\{(?:nowrap|nobr|small)\|([^}]*)\}\}/gi, "$1")
    .replace(/\{\{(?:ubl|unbulleted list|plainlist|flatlist)\s*\|/gi, "")
    .replace(/\{\{[^{}]*\}\}/g, "")
    .replace(/'''?/g, "")
    .replace(/&nbsp;|&ndash;/g, (match) => (match === "&nbsp;" ? " " : "–"))
    .replace(/\s+/g, " ")
    .trim()
}

/** An infobox's fields, split only at top-level "|" so nested templates and lists stay whole. */
export function infoboxFields(infobox: string): Map<string, string> {
  const body = infobox.replace(/^\{\{/, "").replace(/\}\}$/, "")
  const parts: string[] = []
  let depth = 0
  let current = ""
  for (let index = 0; index < body.length; index += 1) {
    const pair = body.slice(index, index + 2)
    if (pair === "{{" || pair === "[[") {
      depth += 1
      current += pair
      index += 1
    } else if ((pair === "}}" || pair === "]]") && depth > 0) {
      depth -= 1
      current += pair
      index += 1
    } else if (body[index] === "|" && depth === 0) {
      parts.push(current)
      current = ""
    } else {
      current += body[index]
    }
  }
  parts.push(current)
  const fields = new Map<string, string>()
  for (const part of parts.slice(1)) {
    const equals = part.indexOf("=")
    if (equals < 0) continue
    fields.set(part.slice(0, equals).trim().toLowerCase().replace(/ /g, "_"), part.slice(equals + 1))
  }
  return fields
}

/** The value of one infobox field ("model_years"), as plain words. */
export function infoboxField(infobox: string, field: string): string | null {
  const raw = infoboxFields(infobox).get(field)
  if (raw === undefined) return null
  // List templates ({{ubl|a|b}}, {{plainlist|* a * b}}): one item per line.
  const listed = raw
    .replace(/\{\{\s*(?:ubl|unbulleted list|plainlist|flatlist|bulleted list)\s*\|?/gi, "")
    .replace(/\n\s*[|*]\s*/g, "; ")
    .replace(/\}\}\s*$/, "")
  const value = plain(listed).replace(/^;\s*/, "")
  return value || null
}

/** Every infobox in a piece of wikitext, as raw text (balanced braces). */
export function infoboxes(wikitext: string): string[] {
  const found: string[] = []
  const pattern = /\{\{\s*Infobox[^|}\n]*/gi
  for (let match = pattern.exec(wikitext); match; match = pattern.exec(wikitext)) {
    let depth = 0
    let index = match.index
    for (; index < wikitext.length - 1; index += 1) {
      if (wikitext[index] === "{" && wikitext[index + 1] === "{") {
        depth += 1
        index += 1
      } else if (wikitext[index] === "}" && wikitext[index + 1] === "}") {
        depth -= 1
        index += 1
        if (depth === 0) break
      }
    }
    found.push(wikitext.slice(match.index, index + 1))
  }
  return found
}

export type YearRange = { from: number; to: number | null; note: string | null }

/**
 * US model years from an infobox value. "2018–2024", "2025 – present",
 * "2007–2011 (North America); 2008–2011 (Japan)" (the North American one
 * wins), "2020". Null when there's no year in it.
 */
export function parseYears(value: string | null): YearRange | null {
  if (!value) return null
  const parts = value.split(/;|\n/).map((part) => part.trim()).filter(Boolean)
  const scored = parts
    .map((part) => {
      const match = /((?:19|20)\d\d)\s*(?:[–—-]\s*((?:19|20)\d\d|present))?/.exec(part)
      if (!match) return null
      const note = /\(([^)]+)\)/.exec(part)?.[1] ?? null
      const us = note ? /north america|united states|\bus\b|u\.s\.|usa|canada/i.test(note) : true
      return {
        from: Number(match[1]),
        to: match[2] === undefined ? Number(match[1]) : match[2] === "present" ? null : Number(match[2]),
        note,
        us,
      }
    })
    .filter((item): item is NonNullable<typeof item> => item !== null)
  if (scored.length === 0) return null
  const best = scored.find((item) => item.us && item.note) ?? scored.find((item) => item.us) ?? scored[0]
  return { from: best.from, to: best.to, note: best.note }
}

/** Sections of an article: heading (plain) and body, in order. The lead is "(lead)". */
export function sections(wikitext: string): { heading: string; level: number; body: string }[] {
  const out: { heading: string; level: number; body: string }[] = []
  const pattern = /^(={2,4})\s*(.+?)\s*\1\s*$/gm
  let lastIndex = 0
  let heading = "(lead)"
  let level = 1
  for (let match = pattern.exec(wikitext); match; match = pattern.exec(wikitext)) {
    out.push({ heading, level, body: wikitext.slice(lastIndex, match.index) })
    heading = plain(match[2])
    level = match[1].length
    lastIndex = match.index + match[0].length
  }
  out.push({ heading, level, body: wikitext.slice(lastIndex) })
  return out
}

/** {{Main|Article}} targets in a section (anchors dropped, alternative labels ignored). */
export function mainLinks(body: string): string[] {
  return [...body.matchAll(/\{\{\s*(?:Main|Main article)\s*\|([^}]+)\}\}/gi)].flatMap((match) =>
    match[1]
      .split("|")
      .filter((part) => !part.includes("="))
      .map((part) => part.trim().replace(/_/g, " ")),
  )
}

/** The Commons category an article names ({{Commons category|...}}), if any. */
export function commonsCategory(wikitext: string): string | null {
  const match = /\{\{\s*Commons[ _]category(?:-inline)?\s*\|\s*([^}|]+)/i.exec(wikitext)
  return match ? match[1].trim() : null
}

/**
 * Facelift hints: sentences that mention a facelift or refresh together with
 * a model year. Hints only; a person or the review confirms them.
 */
export function faceliftHints(wikitext: string): { modelYear: number; evidence: string }[] {
  const text = plain(wikitext.replace(/\{\{Infobox[\s\S]*?\n\}\}/gi, " "))
  const hints: { modelYear: number; evidence: string }[] = []
  for (const sentence of text.split(/(?<=\.)\s+/)) {
    if (!/facelift|refresh|mid-cycle|restyl/i.test(sentence)) continue
    const year = /((?:19|20)\d\d) model year/i.exec(sentence)
    if (!year) continue
    hints.push({ modelYear: Number(year[1]), evidence: sentence.slice(0, 220) })
  }
  return hints
}
