import { ogImage, OG_CONTENT_TYPE, OG_SIZE } from "@/components/og-card"

export const size = OG_SIZE
export const contentType = OG_CONTENT_TYPE
export const alt = "NotAQuote.FYI guides: teen drivers, cars, and car insurance in your state"

export default function Image() {
  return ogImage({
    eyebrow: "Guides",
    title: "A new teen driver, the right car, and your state",
    subtitle: "Plain answers to the questions families ask most, from public data.",
  })
}
