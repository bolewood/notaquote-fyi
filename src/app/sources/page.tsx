import type { Metadata } from "next"
import { RecordTrustView } from "@/components/record-trust-view"
import { StateBaselinesTable } from "@/components/state-baselines-table"
import { StateRulesTable } from "@/components/state-rules-table"
import { TrustArticle } from "@/components/trust-article"
import { formatCatalogDate } from "@/lib/catalog"
import {
  citationLabel,
  derivedFieldLabel,
  MANIFEST_VERSION,
  NAIC_PARAPHRASE,
  SOURCE_MANIFEST,
} from "@/lib/source-manifest"
import {
  formatVerifiedDate,
  fullySourcedStateRules,
  sourcedStateRules,
  STATE_RULES,
  STATE_RULES_CHECKED_ON,
  STATE_RULES_VERSION,
} from "@/lib/state-rules"

export const metadata: Metadata = {
  title: "Sources",
}

export default function SourcesPage() {
  return (
    <TrustArticle title="Sources">
      <RecordTrustView />
      <p>
        Manifest {MANIFEST_VERSION}. Each row names the source, the URL, the
        owner, the license note, how the file was reached, how often it is
        refreshed, when it was last checked, and which fields were derived. A
        row with no derived fields contributed no figures to the bundle.
      </p>
      <p>{NAIC_PARAPHRASE}</p>
      <div className="grid gap-4">
        {SOURCE_MANIFEST.map((row) => (
          <section
            key={row.id}
            id={`manifest-${row.id}`}
            className="grid min-w-0 gap-2 border-b border-border pb-4 break-words"
            data-testid="manifest-row"
          >
            <h2 className="text-sm font-semibold break-words">
              {row.url ? (
                <a href={row.url} className="underline underline-offset-4" rel="noreferrer">
                  {citationLabel(row)}
                </a>
              ) : (
                citationLabel(row)
              )}
            </h2>
            <dl className="grid gap-2">
              <div className="min-w-0">
                <dt className="font-medium">License note</dt>
                <dd className="break-words" data-testid="manifest-license">
                  {row.licenseNote}
                </dd>
              </div>
              <div>
                <dt className="font-medium">Owner</dt>
                <dd>{row.owner}</dd>
              </div>
              <div>
                <dt className="font-medium">Access</dt>
                <dd>{row.accessMethod}</dd>
              </div>
              <div>
                <dt className="font-medium">Refresh</dt>
                <dd>{row.refreshCadence}</dd>
              </div>
              <div>
                <dt className="font-medium">Last checked</dt>
                <dd>{formatCatalogDate(row.lastChecked)}</dd>
              </div>
              <div>
                <dt className="font-medium">Derived fields</dt>
                <dd>{derivedFieldLabel(row)}</dd>
              </div>
            </dl>
          </section>
        ))}
      </div>
      <p>
        From NAIC&rsquo;s auto insurance report we use only the per-state 2023
        numbers, with credit, and not its text or tables. The report itself is
        not in this repository.
      </p>
      <h2 id="state-baselines" className="text-base font-semibold">
        Typical premium by state
      </h2>
      <StateBaselinesTable />
      <h2 id="state-rules" className="text-base font-semibold">
        State minimums {STATE_RULES_VERSION}
      </h2>
      <p>
        {sourcedStateRules().length} of {STATE_RULES.length} rows link to a
        statute or government page. The newest check was on{" "}
        {formatVerifiedDate(STATE_RULES_CHECKED_ON)}, and each row shows its own
        date. {fullySourcedStateRules().length} rows have all three liability
        figures. Where we couldn&rsquo;t confirm something, the cell says
        &ldquo;Not confirmed yet&rdquo; and the state&rsquo;s notes say why.
        These are legal minimums, not a price and not coverage advice. We
        don&rsquo;t ask about credit, so it plays no part here.
      </p>
      <StateRulesTable />
    </TrustArticle>
  )
}
