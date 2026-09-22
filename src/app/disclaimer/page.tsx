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
    <TrustArticle title="This is not a quote" closingDisclaimer={false}>
      <RecordTrustView />
      <p className="text-base leading-7">{DISCLAIMER}</p>
      <h2 className="text-base font-semibold">What the numbers are</h2>
      <p>
        Every dollar figure on this site is a ballpark worked out from public data: a typical price for your state (or what
        you tell us you pay now), adjusted for the driver, the car, the coverage, and where the car is kept. Real quotes can
        land well above or below it, because every insurance company prices things its own way, and they use things we
        don&apos;t ask about, like your credit and your exact address.{" "}
        <Link href="/methodology" className="link">
          Here&apos;s how we got the numbers
        </Link>
        .
      </p>
      <h2 className="text-base font-semibold">What coverage means here</h2>
      <p>
        &ldquo;State minimum&rdquo; uses the liability limits in your state&apos;s law, as we found them on the date shown on
        the{" "}
        <Link href="/sources" className="link">
          Sources
        </Link>{" "}
        page. It&apos;s the least a policy can have there, not a suggestion. &ldquo;Liability only&rdquo; means 100/300/100
        limits. &ldquo;Full coverage&rdquo; adds collision and comprehensive, which pay to fix your own car. We don&apos;t push
        anyone toward more or less coverage; that&apos;s your call.
      </p>
      <h2 className="text-base font-semibold">Who we are</h2>
      <p>
        {PUBLISHER} publishes NotAQuote.FYI as a free, open-source tool. We&apos;re not an insurance company, agent, or
        broker, we don&apos;t sell leads, and we never pass your info to anyone. Spot something wrong?{" "}
        <Link href="/corrections" className="link">
          Tell us
        </Link>
        .
      </p>
    </TrustArticle>
  )
}
