/**
 * What page-view analytics is allowed to see: the page's path, nothing more.
 *
 * Share links keep a visitor's choices after the `#`, and older links used the
 * query string (`?share=...`). Both are dropped here, so Vercel Web Analytics
 * only ever records something like `https://notaquote.fyi/compare`.
 */
export function analyticsUrl(url: string): string | null {
  try {
    const parsed = new URL(url)
    return `${parsed.origin}${parsed.pathname}`
  } catch {
    return null
  }
}
