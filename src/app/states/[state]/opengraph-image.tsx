import { ogImage, OG_CONTENT_TYPE, OG_SIZE } from "@/components/og-card"
import { SERVER_CATALOG } from "@/lib/agent-catalog"
import { differenceWords, estimateDollars } from "@/lib/format"
import { inSentence, STATE_SLUGS, stateBySlug, stateFigures } from "@/lib/state-pages"

export const size = OG_SIZE
export const contentType = OG_CONTENT_TYPE
export const alt = "Car insurance in one state: the typical yearly price and what adding a 16-year-old costs"
export const dynamicParams = false

export function generateStaticParams() {
  return STATE_SLUGS.map((item) => ({ state: item.slug }))
}

export default async function Image({ params }: { params: Promise<{ state: string }> }) {
  const code = stateBySlug((await params).state)
  if (!code) return new Response("Not found", { status: 404 })
  const f = stateFigures(SERVER_CATALOG, code)
  return ogImage({
    eyebrow: "Car insurance by state",
    title: `Car insurance in ${inSentence(f.code)}`,
    lines: [
      { label: "Typical price today", value: `about ${estimateDollars(f.start.annual)} a year` },
      { label: "Adding a 16-year-old", value: `about ${differenceWords(f.teen.added.increase)}` },
    ],
  })
}
