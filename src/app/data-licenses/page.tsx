import type { Metadata } from "next"
import { TrustArticle } from "@/components/trust-article"
import { formatCatalogDate } from "@/lib/catalog"
import { DATA_BUNDLE_VERSION, MANIFEST_VERSION } from "@/lib/copy"
import { STATE_RULES_VERSION } from "@/lib/state-rules"
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
        NAIC, HLDI, SERFF, and publisher premium tables are not in this
        repository. The NAIC rows in the manifest say not cleared and store no
        figures. IIHS/HLDI is a citation link. BLS CPI is not applied.
      </p>
      <p>
        IIHS/HLDI material is not copied. Nothing on this site is a
        redistribution of a restricted report.
      </p>
    </TrustArticle>
  )
}
