import type { Metadata } from "next"
import { TrustArticle } from "@/components/trust-article"
import { BUNDLE_VERSION, MODEL_VERSION } from "@/lib/copy"
import { formatCatalogDate } from "@/lib/catalog"
import { CATALOG_RETRIEVED_ON, CATALOG_YEAR_MAX, CATALOG_YEAR_MIN } from "@/lib/catalog-meta"
import {
  sourcedStateRules,
  STATE_RULES_VERSION,
  unsourcedStateRules,
} from "@/lib/state-rules"

export const metadata: Metadata = {
  title: "Model version",
}

export default function ModelVersionPage() {
  return (
    <TrustArticle title="Model version">
      <dl className="grid gap-3">
        <div>
          <dt className="font-medium">Model</dt>
          <dd className="font-mono">{MODEL_VERSION}</dd>
        </div>
        <div>
          <dt className="font-medium">Data bundle</dt>
          <dd className="font-mono">{BUNDLE_VERSION}</dd>
        </div>
      </dl>
      <h2 className="text-base font-semibold">Changelog</h2>
      <section aria-labelledby="changelog-state-rules" className="grid gap-2">
        <h3 id="changelog-state-rules" className="font-medium">
          State rules {STATE_RULES_VERSION}
        </h3>
        <p>
          Adds a state_rules table for 50 states and the District of Columbia.{" "}
          {sourcedStateRules().length} rows cite a statute or
          insurance-department page opened on 21 September 2026.{" "}
          {unsourcedStateRules().length} rows have no source URL and no dollar
          minimum. Credit is unreviewed and the factor is 1.00 on every row.
          The reviewer field is unsigned. The sample model is still{" "}
          {MODEL_VERSION}. No premium baseline was added. Standard liability,
          full coverage, and high limits stay 100/300/100 and 250/500/250.
        </p>
      </section>
      <section aria-labelledby="changelog-catalog" className="grid gap-2">
        <h3 id="changelog-catalog" className="font-medium">
          Data bundle {BUNDLE_VERSION}
        </h3>
        <p>
          Adds the vehicle catalog snapshot retrieved{" "}
          {formatCatalogDate(CATALOG_RETRIEVED_ON)}, covering model years{" "}
          {CATALOG_YEAR_MIN} through {CATALOG_YEAR_MAX}. Year, make, model, and
          trim read that snapshot in the browser. Trim confidence is limited or
          unresolved when the NHTSA and FuelEconomy.gov names do not join
          cleanly. An optional VIN is decoded in the browser against NHTSA and
          discarded. The sample model is still {MODEL_VERSION}. No premium
          baseline was added.
        </p>
      </section>
      <section aria-labelledby="changelog-010" className="grid gap-2">
        <h3 id="changelog-010" className="font-medium">
          0.1.0-sample
        </h3>
        <p>
          Adds sample display weights so Molly, Jayden, and Ava move a labeled
          sample range. The baseline is not cleared. There is no rating engine
          and no statutory dollar minimum. The vehicle catalog was not in this
          model entry. The credit factor is locked at 1.00. Trend is not applied.
        </p>
        <p>
          An optional current annual premium can replace the sample baseline for
          the open page. That amount is not stored. A sample display floor holds
          the range above zero when the arithmetic would print zero or a negative
          dollar. That floor is not a premium. Jayden uses the same 7,500–15,000
          mileage band as Molly.
        </p>
      </section>
      <p>
        A later version that changes a weight will add a row here and will keep
        the previous version readable. This page is the public changelog.
      </p>
    </TrustArticle>
  )
}
