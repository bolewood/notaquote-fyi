import type { Metadata } from "next"
import Link from "next/link"
import { FactorTables } from "@/components/factor-tables"
import { RecordTrustView } from "@/components/record-trust-view"
import { TrustArticle } from "@/components/trust-article"
import { CATALOG_VERSION } from "@/lib/catalog-meta"
import { DATA_BUNDLE_VERSION, MANIFEST_VERSION, MODEL_VERSION } from "@/lib/copy"
import { FACTOR_EFFECTIVE_DATE, TYPICAL_START_ATTRIBUTION } from "@/lib/factor-engine"
import { formatCatalogDate } from "@/lib/catalog"
import { STATE_RULES_VERSION } from "@/lib/state-rules"
import { STATE_BASELINES_VERSION } from "@/lib/state-baselines"

export const metadata: Metadata = {
  title: "How it works",
}

export default function MethodologyPage() {
  return (
    <TrustArticle title="Here's how we got the numbers">
      <RecordTrustView />
      <p className="text-base leading-7">
        Every number on this site comes from one set of math that runs in your browser. It starts from one price and
        adjusts it for whatever is different: the driver, the car, the coverage, and where the car is kept. Here&apos;s each
        piece, and where it comes from.
      </p>

      <h2 className="text-base font-semibold">1. A starting point</h2>
      <p>
        If you tell us what you pay now, we start from your real number, for your car and your situation. It stays on your
        device.
      </p>
      <p>
        If you don&apos;t, we start from a typical yearly price for your state: what drivers there paid on average for
        liability, collision, and comprehensive coverage in 2023 ({TYPICAL_START_ATTRIBUTION}). We treat that as the price
        for a 40–64-year-old with a clean record, in the suburbs, on an average car, with full coverage and a $1,000
        deductible, and adjust from there. It&apos;s an average across every kind of driver, so starting from it makes the
        range wider.{" "}
        <Link href="/sources#state-baselines" className="link">
          See the figure for every state
        </Link>
        .
      </p>

      <h2 className="text-base font-semibold">2. What changes the price</h2>
      <p>
        Each thing that matters is a multiplier. A 16–18-year-old on their own policy, for example, costs about 2.9 times
        what a 40–64-year-old does. Most of these come from state insurance departments that publish real prices from many
        companies for the same sample drivers, with one thing changed at a time. Where we couldn&apos;t find a public source,
        we say so, use our best estimate, and widen the range.
      </p>
      <p>
        Some multipliers only touch part of the bill. A full-coverage premium pays for two things: damage and injuries you
        cause to others (liability), and fixing your own car (collision and comprehensive). The deductible, the car&apos;s
        age, and a loan or lease only move the second part. Liability limits only move the first.
      </p>

      <h2 className="text-base font-semibold">3. The car</h2>
      <p>
        The Highway Loss Data Institute publishes how each model&apos;s insurance claims compare with the average car. A
        car that costs more to repair moves the &ldquo;fixing your own car&rdquo; part up in full. A car with more claims for
        crashes its drivers cause moves the liability part, but only partly, because insurers do the same. When we
        don&apos;t have a model, we use the average for its kind of car (small SUV, midsize car, and so on) and widen the
        range. That&apos;s the &ldquo;why&rdquo; you see next to each car on the Compare page.
      </p>

      <h2 className="text-base font-semibold">4. A range, not a price</h2>
      <p>
        Two companies can quote the same driver very different prices. So every estimate comes with a range: roughly where
        the middle half of companies would land. The more of a change we had to estimate ourselves, the wider it gets. Real
        quotes can still land outside it.
      </p>

      <h2 className="text-base font-semibold">What we leave out</h2>
      <ul className="list-disc space-y-1 pl-5">
        <li>
          <span className="font-medium">Credit.</span> We don&apos;t ask about credit. Many insurers use it where the law
          allows, so your real quote could move up or down because of it.
        </li>
        <li>
          <span className="font-medium">Gender and marital status.</span> They aren&apos;t inputs. Where the surveys give
          both, we average them.
        </li>
        <li>
          <span className="font-medium">Your exact address and your history with an insurer.</span> We only know your
          state and whether the car is kept in a city, the suburbs, or the country.
        </li>
        <li>
          <span className="font-medium">Discounts we can&apos;t see</span>, like safe-driving apps or paying in full.
        </li>
      </ul>

      <h2 className="text-base font-semibold">Every factor, with its source</h2>
      <p>
        These tables are the actual numbers the math uses, with how sure we are about each one. The full working for each
        is in the{" "}
        <a href="https://github.com/bolewood/notaquote-fyi/blob/main/data/factors/README.md" className="link" rel="noreferrer">
          factors README on GitHub
        </a>
        , and every source is on the{" "}
        <Link href="/sources" className="link">
          Sources
        </Link>{" "}
        page. Spot something wrong?{" "}
        <Link href="/corrections" className="link">
          Tell us
        </Link>
        .
      </p>
      <FactorTables />

      <h2 className="text-base font-semibold">Saving and sharing</h2>
      <p>
        Your choices are kept in this browser so the What-if and Compare pages remember them. Nothing is sent to us. A
        share link holds the choices (and what you pay, only if you tick the box for it), never the prices. Whoever opens
        it gets the numbers worked out fresh with today&apos;s math, and if the math has changed since, the page says so.{" "}
        <Link href="/privacy" className="link">
          More about privacy
        </Link>
        .
      </p>

      <h2 className="text-base font-semibold">Versions</h2>
      <p className="text-muted-foreground">
        Math {MODEL_VERSION}. Factors {DATA_BUNDLE_VERSION}, effective {formatCatalogDate(FACTOR_EFFECTIVE_DATE)}. Typical
        state prices {STATE_BASELINES_VERSION}. State rules {STATE_RULES_VERSION}. Car list {CATALOG_VERSION}. Source list{" "}
        {MANIFEST_VERSION}.{" "}
        <Link href="/model-version" className="link">
          What&apos;s changed
        </Link>
        .
      </p>
    </TrustArticle>
  )
}
