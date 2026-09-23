import type { MetadataRoute } from "next"
import { SITE_ORIGIN } from "@/lib/copy"

const PAGES = [
  "/",
  "/compare",
  "/methodology",
  "/sources",
  "/model-version",
  "/privacy",
  "/disclaimer",
  "/data-licenses",
  "/corrections",
  "/llms.txt",
  "/llms-full.txt",
] as const

export default function sitemap(): MetadataRoute.Sitemap {
  return PAGES.map((path) => ({ url: `${SITE_ORIGIN}${path}` }))
}
