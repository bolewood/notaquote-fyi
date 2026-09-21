import type { Metadata } from "next"
import { TrustArticle } from "@/components/trust-article"
import { DISCLAIMER, PUBLISHER } from "@/lib/copy"

export const metadata: Metadata = {
  title: "Disclaimer",
}

export default function DisclaimerPage() {
  return (
    <TrustArticle title="Disclaimer" closingDisclaimer={false}>
      <p className="text-base leading-7">{DISCLAIMER}</p>
      <p>
        The dollars on the calculator are a sample range. The baseline is not
        cleared. They are not a premium from an insurer, and they are not an
        offer of coverage.
      </p>
      <p>
        Package names on the calculator are assumptions with the limits written
        next to them. State-minimum dollar amounts are not shown, because the
        sourced state-rules table is not in this version.
      </p>
      <p>
        {PUBLISHER} publishes this educational tool. This page does not provide a
        street address, a phone number, or an email address. Counsel has not
        signed this wording for a public launch.
      </p>
    </TrustArticle>
  )
}
