import type { Metadata } from "next"
import { TrustArticle } from "@/components/trust-article"

export const metadata: Metadata = {
  title: "Data licenses",
}

export default function DataLicensesPage() {
  return (
    <TrustArticle title="Data licenses">
      <p>
        This version does not ship a vehicle catalog, a state-rules table, or a
        premium baseline. There is no data bundle to license yet. The model
        version page names the bundle as “none”.
      </p>
      <p>
        Sample display weights in the calculator are original illustrative
        numbers. They were not derived from a rate filing, a loss table, or a
        published premium average.
      </p>
      <p>
        NAIC, HLDI, SERFF, and publisher premium tables are not in this
        repository. A later snapshot of NHTSA or FuelEconomy.gov data would be
        stored with its own license note, source URL, and version. That snapshot
        is not here.
      </p>
      <p>
        IIHS/HLDI material is not copied. Nothing on this site is a
        redistribution of a restricted report.
      </p>
    </TrustArticle>
  )
}
