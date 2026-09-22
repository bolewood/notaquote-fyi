import type { Metadata } from "next"
import { RecordTrustView } from "@/components/record-trust-view"
import { TrustArticle } from "@/components/trust-article"
import { DATA_BUNDLE_VERSION, MANIFEST_VERSION, MODEL_VERSION } from "@/lib/copy"
import { formatCatalogDate } from "@/lib/catalog"
import {
  CATALOG_RETRIEVED_ON,
  CATALOG_VERSION,
  CATALOG_YEAR_MAX,
  CATALOG_YEAR_MIN,
} from "@/lib/catalog-meta"
import {
  fullySourcedStateRules,
  sourcedStateRules,
  STATE_RULES_VERSION,
} from "@/lib/state-rules"
import { STATE_BASELINE_ATTRIBUTION, STATE_BASELINES_VERSION } from "@/lib/state-baselines"

export const metadata: Metadata = {
  title: "Model version",
}

export default function ModelVersionPage() {
  return (
    <TrustArticle title="Model version">
      <RecordTrustView />
      <dl className="grid gap-3">
        <div>
          <dt className="font-medium">Model</dt>
          <dd className="font-mono">{MODEL_VERSION}</dd>
        </div>
        <div>
          <dt className="font-medium">Data bundle</dt>
          <dd className="font-mono">{DATA_BUNDLE_VERSION}</dd>
        </div>
        <div>
          <dt className="font-medium">Manifest</dt>
          <dd className="font-mono">{MANIFEST_VERSION}</dd>
        </div>
        <div>
          <dt className="font-medium">Catalog</dt>
          <dd className="font-mono">{CATALOG_VERSION}</dd>
        </div>
      </dl>
      <h2 className="text-base font-semibold">Changelog</h2>
      <section aria-labelledby="changelog-state-data" className="grid gap-2">
        <h3 id="changelog-state-data" className="font-medium">
          State rules {STATE_RULES_VERSION} and state baselines {STATE_BASELINES_VERSION}
        </h3>
        <p>
          Every state and DC now has a minimum-coverage row with at least one
          source link and its own check date ({sourcedStateRules().length} rows;{" "}
          {fullySourcedStateRules().length} with all three liability figures).
          Where we couldn&rsquo;t confirm something, the row says so instead of
          guessing. The table now shows medical payments coverage, marks
          &ldquo;choice&rdquo; no-fault states as your choice, and lists changes
          already passed into law with their start dates.
        </p>
        <p>
          Adds a typical yearly premium for each state: NAIC&rsquo;s 2023 combined
          average premium (liability, collision, and comprehensive). The project
          owner approved using these per-state figures, with credit.{" "}
          {STATE_BASELINE_ATTRIBUTION}. The calculator doesn&rsquo;t use them yet,
          and the model and factor bundle are unchanged. Source manifest{" "}
          {MANIFEST_VERSION} records the change.
        </p>
      </section>
      <section aria-labelledby="changelog-020" className="grid gap-2">
        <h3 id="changelog-020" className="font-medium">
          0.2.0
        </h3>
        <p>
          Adds the factor engine and source manifest manifest-2026-09-21. Data
          bundle {DATA_BUNDLE_VERSION}. The formula is midpoint = base ×
          geography × driver × coverage × vehicle × trend × lawful sensitivity.
          The general base is not cleared, so the engine emits no dollar range
          until a current annual premium is entered for that scenario. Trend is
          not applied. Credit stays locked at 1.00. A thin factor or a weak trim
          widens the range. The opening screen still shows the labeled sample
          from 0.1.0-sample. Those sample weights are not this model. No premium
          figure from NAIC, HLDI, SERFF, or a publisher was added. (NAIC
          per-state figures were added later, in state baselines{" "}
          {STATE_BASELINES_VERSION}. See the newest entry.)
        </p>
      </section>
      <section aria-labelledby="changelog-comparisons" className="grid gap-2">
        <h3 id="changelog-comparisons" className="font-medium">
          Still {MODEL_VERSION}
        </h3>
        <p>
          Saved comparisons, share links, and the print worksheet do not change
          the factors. A saved optional premium stays in this browser. A share
          link records model {MODEL_VERSION} and data bundle {DATA_BUNDLE_VERSION}.
          It does not freeze a dollar result. Opening a link that names another
          model version says so, and this page recomputes on {MODEL_VERSION}.
        </p>
      </section>
      <section aria-labelledby="changelog-state-rules" className="grid gap-2">
        <h3 id="changelog-state-rules" className="font-medium">
          State rules state-rules-2026-09-21
        </h3>
        <p>
          Adds a state_rules table for 50 states and the District of Columbia. 6
          rows cite a statute or insurance-department page opened on 21 September
          2026. 45 rows have no source URL and no dollar minimum. Credit is
          unreviewed and the factor is 1.00 on every row. California marks
          uninsured and underinsured motorist coverage required unless a named
          insured deletes it in writing. Texas marks personal injury protection
          and uninsured and underinsured motorist coverage required unless a
          named insured rejects it in writing. The sample model at that point was
          0.1.0-sample. No premium baseline was added. Standard liability, full
          coverage, and high limits stay 100/300/100 and 250/500/250.
        </p>
      </section>
      <section aria-labelledby="changelog-catalog" className="grid gap-2">
        <h3 id="changelog-catalog" className="font-medium">
          Catalog {CATALOG_VERSION}
        </h3>
        <p>
          Adds the vehicle catalog snapshot retrieved{" "}
          {formatCatalogDate(CATALOG_RETRIEVED_ON)}, covering model years{" "}
          {CATALOG_YEAR_MIN} through {CATALOG_YEAR_MAX}. Year, make, model, and
          trim read that snapshot in the browser. Trim confidence is limited or
          unresolved when the NHTSA and FuelEconomy.gov names do not join
          cleanly. An optional VIN is decoded in the browser against NHTSA and
          discarded. The sample model at that point was 0.1.0-sample. No premium
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
