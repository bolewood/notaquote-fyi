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
      <section aria-labelledby="changelog-one-model" className="grid gap-2">
        <h3 id="changelog-one-model" className="font-medium">
          One set of math, what-ifs, and comparing cars
        </h3>
        <p>
          The separate sample figures are gone. Every dollar on the site now comes from the factor engine, starting from
          what you pay (if you tell us) or a typical price for your state. The home page answers &ldquo;what if I changed
          one thing?&rdquo;, and the new Compare page prices up to 15 cars for the same driver, with sorting, stars, a
          spreadsheet download, and share links that never carry prices.
        </p>
      </section>
      <section aria-labelledby="changelog-state-data" className="grid gap-2">
        <h3 id="changelog-state-data" className="font-medium">
          State rules {STATE_RULES_VERSION} and typical state prices {STATE_BASELINES_VERSION}
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
          average premium (liability, collision, and comprehensive), used with credit.{" "}
          {STATE_BASELINE_ATTRIBUTION}. The calculator now starts from them when
          you don&rsquo;t enter what you pay. Source manifest{" "}
          {MANIFEST_VERSION} records the change.
        </p>
      </section>
      <section aria-labelledby="changelog-020" className="grid gap-2">
        <h3 id="changelog-020" className="font-medium">
          0.2.0
        </h3>
        <p>
          The first version of the factor engine: the one set of math every number now comes from. At first it only
          worked from a premium you entered; the typical state prices came later (see above).
        </p>
      </section>
      <section aria-labelledby="changelog-comparisons" className="grid gap-2">
        <h3 id="changelog-comparisons" className="font-medium">
          Share links and saving
        </h3>
        <p>
          Share links record the math version ({MODEL_VERSION}) and the data version ({DATA_BUNDLE_VERSION}), never a
          price. If you open a link made with older math, the page says so and works the numbers out with today&apos;s.
        </p>
      </section>
      <section aria-labelledby="changelog-state-rules" className="grid gap-2">
        <h3 id="changelog-state-rules" className="font-medium">
          State rules state-rules-2026-09-21
        </h3>
        <p>
          The first table of state minimums, for a handful of states. Every state and DC has its own sourced row now.
        </p>
      </section>
      <section aria-labelledby="changelog-catalog" className="grid gap-2">
        <h3 id="changelog-catalog" className="font-medium">
          Car list {CATALOG_VERSION}
        </h3>
        <p>
          A list of cars from NHTSA and FuelEconomy.gov, retrieved {formatCatalogDate(CATALOG_RETRIEVED_ON)}, covering
          model years {CATALOG_YEAR_MIN} through {CATALOG_YEAR_MAX}. An optional VIN is looked up by your browser with
          NHTSA and not kept.
        </p>
      </section>
      <section aria-labelledby="changelog-010" className="grid gap-2">
        <h3 id="changelog-010" className="font-medium">
          0.1.0-sample
        </h3>
        <p>
          A first prototype with made-up sample numbers, before any sourced data. It&apos;s gone; nothing on the site
          uses it now.
        </p>
      </section>
      <p>
        Every change to the math or the data adds an entry here. This page is the public changelog.
      </p>
    </TrustArticle>
  )
}
