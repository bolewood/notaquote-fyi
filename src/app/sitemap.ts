import type { MetadataRoute } from "next"
import { SERVER_CATALOG } from "@/lib/agent-catalog"
import { sitemapEntries } from "@/lib/sitemap-entries"

export default function sitemap(): MetadataRoute.Sitemap {
  return sitemapEntries(SERVER_CATALOG)
}
