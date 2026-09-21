import type { Metadata } from "next"
import { CorrectionsForm } from "@/components/corrections-form"
import { TrustArticle } from "@/components/trust-article"
import { correctionsQueueLive } from "@/lib/corrections"

export const metadata: Metadata = {
  title: "Corrections",
}

export const dynamic = "force-dynamic"

export default function CorrectionsPage() {
  const live = correctionsQueueLive()

  return (
    <TrustArticle title="Corrections">
      <p>
        This form files a structured correction about a state rule, a source, a
        vehicle mapping, or a display. It asks for a state, a page, a source
        URL, and one category.
      </p>
      <p>
        It does not ask for a name, an email address, a phone number, a
        carrier, a premium, or a written note. It is not a place to send a
        document.
      </p>
      <CorrectionsForm live={live} />
    </TrustArticle>
  )
}
