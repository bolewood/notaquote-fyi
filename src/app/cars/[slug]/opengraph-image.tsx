import { ogImage, OG_CONTENT_TYPE, OG_SIZE } from "@/components/og-card"
import { SERVER_CATALOG } from "@/lib/agent-catalog"
import { carFigures, carPages } from "@/lib/car-pages"
import { differenceWords, estimateDollars } from "@/lib/format"

export const size = OG_SIZE
export const contentType = OG_CONTENT_TYPE
export const alt = "What one car costs to insure: a typical yearly price and what adding a 16-year-old costs"
export const dynamicParams = false

export function generateStaticParams() {
  return carPages(SERVER_CATALOG).map((page) => ({ slug: page.slug }))
}

export default async function Image({ params }: { params: Promise<{ slug: string }> }) {
  const f = carFigures(SERVER_CATALOG, (await params).slug)
  if (!f) return new Response("Not found", { status: 404 })
  return ogImage({
    eyebrow: "What it costs to insure",
    title: `${f.page.name}`,
    lines: [
      { label: "A typical 45-year-old", value: `about ${estimateDollars(f.adult.likely)} a year` },
      { label: "Adding a 16-year-old", value: `about ${differenceWords(f.teen.increase)}` },
    ],
  })
}
