import { jsonLdText, type JsonLd } from "@/lib/site-meta"

/** Structured data for search engines and AI assistants. Data, not a script that runs. */
export function JsonLdScript({ data }: { data: JsonLd | JsonLd[] }) {
  return <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: jsonLdText(data) }} />
}
