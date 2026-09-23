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
