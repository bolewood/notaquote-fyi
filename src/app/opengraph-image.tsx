import { ogImage, OG_CONTENT_TYPE, OG_SIZE } from "@/components/og-card"

export const size = OG_SIZE
export const contentType = OG_CONTENT_TYPE
export const alt = "NotAQuote.FYI: what a new car, a teen driver, or a move would do to your car insurance"

export default function Image() {
  return ogImage({
    eyebrow: "Free and open source",
    title: "What would a new car, a teen driver, or a move do to your car insurance?",
    subtitle: "Change one thing and see roughly what you'd pay, worked out from public data. Nothing to sign up for.",
  })
}
