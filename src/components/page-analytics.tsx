"use client"

import { Analytics } from "@vercel/analytics/next"
import { analyticsUrl } from "@/lib/analytics-url"

/**
 * Vercel Web Analytics: cookieless page-view counts. Only the page's path is
 * sent; anything after `?` or `#` (where share links keep choices) is removed
 * first. No custom events, so nothing a visitor types is ever recorded.
 */
export function PageAnalytics() {
  return (
    <Analytics
      beforeSend={(event) => {
        const url = analyticsUrl(event.url)
        return url ? { ...event, url } : null
      }}
    />
  )
}
