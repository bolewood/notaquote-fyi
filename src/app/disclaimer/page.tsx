import type { Metadata } from "next"
import { TrustArticle } from "@/components/trust-article"
import {
  DISCLAIMER,
  PUBLISHER,
  STATE_MINIMUM_COUNSEL_LABEL,
  STATE_MINIMUM_COUNSEL_NOTICE,
} from "@/lib/copy"

export const metadata: Metadata = {
  title: "Disclaimer",
}

export default function DisclaimerPage() {
  return (
    <TrustArticle title="Disclaimer" closingDisclaimer={false}>
      <p className="text-base leading-7">{DISCLAIMER}</p>
      <p>
        With no current premium entered, the dollars are a labeled sample. The
        baseline is not cleared. When a current annual premium is entered, the
        factor engine uses that amount as the base for that scenario only. Those
        figures are still a planning range. They are not a premium from an
        insurer, and they are not an offer of coverage.
      </p>
      <p>
        Package names on the calculator are assumptions with the limits written
        next to them. A state-minimum dollar amount is shown only when that
        state’s row has a source URL. A row with no source URL says the sourced
        table has no figure yet. Standard liability stays 100/300/100. Full
        coverage stays 100/300/100 plus comprehensive and collision. High limits
        stay 250/500/250 plus comprehensive and collision.
      </p>
      <p>
        <span className="font-medium">{STATE_MINIMUM_COUNSEL_LABEL}</span>{" "}
        {STATE_MINIMUM_COUNSEL_NOTICE}
      </p>
      <p>
        {PUBLISHER} publishes this educational tool. This page does not provide a
        street address, a phone number, or an email address. Counsel has not
        signed this wording for a public launch.
      </p>
    </TrustArticle>
  )
}
