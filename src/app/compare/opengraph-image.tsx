import { ogImage, OG_CONTENT_TYPE, OG_SIZE } from "@/components/og-card"

export const size = OG_SIZE
export const contentType = OG_CONTENT_TYPE
export const alt = "Compare cars on NotAQuote.FYI: up to 15 cars priced for the same driver"

export default function Image() {
  return ogImage({
    eyebrow: "Compare cars",
    title: "Which car costs the least to insure?",
    subtitle: "Put up to 15 cars side by side for the same driver, like a new 16-year-old. Sort them, star the favorites, take the list with you.",
  })
}
