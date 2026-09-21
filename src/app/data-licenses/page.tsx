import type { Metadata } from "next"
import { TrustArticle } from "@/components/trust-article"
import { formatCatalogDate } from "@/lib/catalog"
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
        The vehicle catalog bundle is {CATALOG_VERSION}, retrieved{" "}
        {formatCatalogDate(CATALOG_RETRIEVED_ON)}. It is not a premium baseline.
        There is still no state-rules table and no cleared dollar baseline.
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
        Sample display weights in the calculator are original illustrative
        numbers. They were not derived from a rate filing, a loss table, or a
        published premium average.
      </p>
      <p>
        NAIC, HLDI, SERFF, and publisher premium tables are not in this
        repository.
      </p>
      <p>
        IIHS/HLDI material is not copied. Nothing on this site is a
        redistribution of a restricted report.
      </p>
    </TrustArticle>
  )
}
