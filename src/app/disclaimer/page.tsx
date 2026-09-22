import type { Metadata } from "next"
import Link from "next/link"
import { RecordTrustView } from "@/components/record-trust-view"
import { TrustArticle } from "@/components/trust-article"
import { DISCLAIMER, PUBLISHER } from "@/lib/copy"

export const metadata: Metadata = {
  title: "Not a quote",
}

export default function DisclaimerPage() {
  return (
    <TrustArticle title="This is not a quote" lead={DISCLAIMER} closingDisclaimer={false}>
      <RecordTrustView />
      <h2>What the numbers are</h2>
      <p>
        Every dollar figure here is a ballpark worked out from public data: a typical price for your state (or what you tell
        us you pay), adjusted for the driver, the car, the coverage, and where the car is kept. Real quotes can land well
        above or below it. Every insurance company prices things its own way, and they use things we don&apos;t ask about,
        like your credit and your exact address. <Link href="/methodology">Here&apos;s how we got the numbers</Link>.
      </p>

      <h2>What the coverage choices mean</h2>
      <ul className="bullets">
        <li>
          <strong>State minimum</strong> is the least liability coverage your state&apos;s law allows, as we found it on the
          date shown on the <Link href="/sources#state-rules">Sources</Link> page. It&apos;s a floor, not a suggestion.
        </li>
        <li>
          <strong>Liability only</strong> pays for damage you cause to others, up to $100,000/$300,000/$100,000 (per
          person / per crash / property). It doesn&apos;t fix your own car.
        </li>
        <li>
          <strong>Full coverage</strong> adds collision and comprehensive, which fix or replace your own car after a crash,
          theft, or storm.
        </li>
        <li>
          <strong>Full coverage, higher limits</strong> is full coverage with more liability protection, up to
          $250,000/$500,000/$250,000.
        </li>
      </ul>
      <p>We don&apos;t push anyone toward more or less coverage. That&apos;s your call. Try both on the <Link href="/">What-if page</Link> to see the trade-off.</p>

      <h2>Who we are</h2>
      <p>
        {PUBLISHER} publishes NotAQuote.FYI as a free, open-source tool. We&apos;re not an insurance company, agent, or
        broker, and we don&apos;t sell leads or ads. Spot something wrong?{" "}
        <Link href="/corrections">Tell us</Link>.
      </p>
    </TrustArticle>
  )
}
