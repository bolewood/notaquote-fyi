import type { Metadata } from "next"
import { RecordTrustView } from "@/components/record-trust-view"
import { TrustArticle } from "@/components/trust-article"
import { formatCatalogDate } from "@/lib/catalog"
import { DATA_BUNDLE_VERSION, MANIFEST_VERSION } from "@/lib/copy"
import { STATE_BASELINE_ATTRIBUTION } from "@/lib/state-baselines"
import { STATE_RULES_VERSION } from "@/lib/state-rules"
import { GITHUB_REPO_URL } from "@/lib/suggest-fix"
import {
  CATALOG_RETRIEVED_ON,
  CATALOG_TERMS,
  CATALOG_VERSION,
  FUEL_ECONOMY_CATALOG_URL,
  NHTSA_CATALOG_URL,
} from "@/lib/catalog-meta"

export const metadata: Metadata = {
  title: "Data licenses",
}

export default function DataLicensesPage() {
  return (
    <TrustArticle title="Data licenses">
      <RecordTrustView />
      <p>
        This project is open source. The code is free to use under the{" "}
        <a href={`${GITHUB_REPO_URL}/blob/main/LICENSE`} className="underline underline-offset-4">
          MIT license
        </a>
        . The data we put together ourselves, like the factors, the state rule
        values, and our research notes, is free to reuse under{" "}
        <a
          href={`${GITHUB_REPO_URL}/blob/main/DATA-LICENSE.md`}
          className="underline underline-offset-4"
        >
          CC BY 4.0
        </a>
        , as long as you give credit. The outside sources below keep their own
        terms.
      </p>
      <p>
        The factor bundle is {DATA_BUNDLE_VERSION}. The source manifest is{" "}
        {MANIFEST_VERSION}. The vehicle catalog bundle is {CATALOG_VERSION},
        retrieved {formatCatalogDate(CATALOG_RETRIEVED_ON)}. The state-rules table
        is {STATE_RULES_VERSION}. It cites public statute and insurance-department
        pages. It is not a premium baseline. Rows without a source URL have no
        dollar minimum. There is no cleared dollar baseline.
      </p>
      <p>{CATALOG_TERMS}</p>
      <p>
        Source URLs:{" "}
        <a href={NHTSA_CATALOG_URL} className="underline underline-offset-4">
          NHTSA vPIC
        </a>{" "}
        and{" "}
        <a href={FUEL_ECONOMY_CATALOG_URL} className="underline underline-offset-4">
          FuelEconomy.gov vehicles.csv
        </a>
        .
      </p>
      <p>
        The factor bundle is original planning arithmetic. It was not derived
        from a rate filing, a loss table, or a published premium average. The
        labeled sample on the opening screen uses a separate set of display
        weights. Those weights are not the factor engine.
      </p>
      <p>
        We use one number per state from NAIC&rsquo;s 2022/2023 Auto Insurance
        Database Report: the 2023 combined average premium, plus the liability
        average and average expenditure from the same year. Numbers like these
        are facts, and the project owner approved using them for this
        non-commercial project, with credit. Wherever one appears, it&rsquo;s
        labeled &ldquo;{STATE_BASELINE_ATTRIBUTION}.&rdquo; We don&rsquo;t copy
        the report&rsquo;s text or tables, and the report itself isn&rsquo;t in
        this repository. HLDI, SERFF, and publisher premium tables aren&rsquo;t
        here either. IIHS/HLDI is a citation link. The BLS price index is
        recorded next to the state figures but not applied.
      </p>
      <p>
        IIHS/HLDI material is not copied. Nothing on this site is a
        redistribution of a restricted report.
      </p>
    </TrustArticle>
  )
}
