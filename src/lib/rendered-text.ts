/**
 * A page's visible text, for measuring how much of it is its own: the HTML
 * with scripts (structured data) and tags removed, and every dollar amount
 * masked, so a page can't pass on its numbers alone.
 */

export function visibleText(html: string): string {
  return html
    .replace(/<script[\s\S]*?<\/script>/g, " ")
    .replace(/<[^>]+>/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&#x27;|&#39;|&apos;/g, "'")
    .replace(/&quot;/g, '"')
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/\s+/g, " ")
    .trim()
}

/** "$1,760", "+$1,160", "−$90" all become "$N". */
export function maskDollars(text: string): string {
  return text.replace(/[+−-]?\$[\d,]+(\.\d+)?/g, "$N")
}

/**
 * The HTML without elements marked `data-shared`: text every page of a kind
 * shows on purpose (a coverage's helper text, a fixed explanation), which
 * shouldn't count for or against how much a page is its own. Marked in the
 * markup, so the measure follows the page and there's no phrase list to
 * keep in step.
 */
export function withoutShared(html: string): string {
  let out = html
  for (;;) {
    const open = /<([a-zA-Z][a-zA-Z0-9]*)\b[^>]*\sdata-shared(?:=["'][^"']*["'])?[^>]*>/.exec(out)
    if (!open) return out
    const tag = open[1]
    const pattern = new RegExp(`<${tag}\\b[^>]*>|</${tag}>`, "g")
    pattern.lastIndex = open.index + open[0].length
    let depth = 1
    let end = out.length
    for (let match = pattern.exec(out); match; match = pattern.exec(out)) {
      depth += match[0].startsWith("</") ? -1 : 1
      if (depth === 0) {
        end = match.index + match[0].length
        break
      }
    }
    out = `${out.slice(0, open.index)} ${out.slice(end)}`
  }
}
