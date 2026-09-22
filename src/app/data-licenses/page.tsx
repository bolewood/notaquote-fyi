import type { Metadata } from "next"
import Link from "next/link"
import { RecordTrustView } from "@/components/record-trust-view"
import { TrustArticle } from "@/components/trust-article"
import { DATA_UPDATED, longDate } from "@/lib/copy"
import { STATE_BASELINE_ATTRIBUTION } from "@/lib/state-baselines"
import { STATE_RULES_CHECKED_ON } from "@/lib/state-rules"
import { GITHUB_REPO_URL } from "@/lib/suggest-fix"
import { CATALOG_RETRIEVED_ON, FUEL_ECONOMY_CATALOG_URL, NHTSA_CATALOG_URL } from "@/lib/catalog-meta"

export const metadata: Metadata = {
  title: "Data licenses",
  description: "What you can reuse, and on what terms: MIT for the code, CC BY 4.0 for the data we compile.",
}

export default function DataLicensesPage() {
  return (
    <TrustArticle
      title="Data licenses"
      lead="This project is open source, and you're welcome to reuse it. Here's what you can take, and whose terms apply."
    >
      <RecordTrustView />

      <h2>What we made</h2>
      <ul className="bullets">
        <li>
          <strong>The code</strong> is free to use under the{" "}
          <a href={`${GITHUB_REPO_URL}/blob/main/LICENSE`} rel="noreferrer">
            MIT license
          </a>
          .
        </li>
        <li>
          <strong>The data we put together</strong>, like the adjustments, the state rules, and our research notes, is free
          to reuse under{" "}
          <a href={`${GITHUB_REPO_URL}/blob/main/DATA-LICENSE.md`} rel="noreferrer">
            CC BY 4.0
          </a>
          . Use it for anything; just give credit.
        </li>
      </ul>
      <p>
        The outside sources below keep their own terms. The adjustments and the typical state prices were last updated{" "}
        {DATA_UPDATED}; the state rules were last checked {longDate(STATE_RULES_CHECKED_ON)}; and the list of cars was last
        pulled {longDate(CATALOG_RETRIEVED_ON)}.
      </p>

      <h2>The list of cars</h2>
      <p>
        It comes from two U.S. government datasets, both public:{" "}
        <a href={NHTSA_CATALOG_URL} rel="noreferrer">
          the National Highway Traffic Safety Administration&apos;s vehicle listing
        </a>{" "}
        (model names, as carmakers report them) and{" "}
        <a href={FUEL_ECONOMY_CATALOG_URL} rel="noreferrer">
          FuelEconomy.gov&apos;s vehicle file
        </a>{" "}
        (versions, size class, and whether a car is gas, hybrid, or electric). We keep only passenger cars, trucks, and
        SUVs, and only the fields we need. We store no VINs and no
        fuel-economy figures.
      </p>

      <h2>State rules</h2>
      <p>Each state&apos;s minimums come from public statutes and insurance-department pages, each one cited.</p>

      <h2>Typical price by state</h2>
      <p>
        We use three numbers per state from the National Association of Insurance Commissioners&apos; 2022/2023 Auto
        Insurance Database Report (the 2023 full-coverage average, the liability average, and the average spent per
        insured car), as facts, with credit. Wherever one appears, it&apos;s labeled &ldquo;
        {STATE_BASELINE_ATTRIBUTION}.&rdquo; We don&apos;t copy the report&apos;s text or tables, and the report itself
        isn&apos;t in this project. To bring a 2023 figure up to today, we use the Bureau of Labor Statistics&apos; price
        index for car insurance, which is public domain.
      </p>

      <h2>Car claims</h2>
      <p>
        We keep the Highway Loss Data Institute&apos;s published results for the car models we price, with credit and a
        link to the Insurance Institute for Highway Safety (IIHS). We&apos;ve asked IIHS for permission to use this data
        and are waiting to hear back. If they say no, we&apos;ll take it out.
      </p>

      <h2>Everything else</h2>
      <p>
        The adjustments are worked out from the public sources on the <Link href="/sources">Sources</Link> page. Where we
        couldn&apos;t find a source, the adjustment says it&apos;s our estimate.
      </p>
    </TrustArticle>
  )
}
