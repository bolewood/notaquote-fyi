import type { Metadata } from "next"
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
  sourcedStateRules,
  STATE_RULES_VERSION,
  unsourcedStateRules,
} from "@/lib/state-rules"

export const metadata: Metadata = {
  title: "Sources",
}

export default function SourcesPage() {
  return (
    <TrustArticle title="Sources">
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
        A link is not permission to copy a table. The two auto-database rows say
        not cleared and have no figures. No PDF from those publications is in
        this repository.
      </p>
      <h2 id="state-rules" className="text-base font-semibold">
        State rules {STATE_RULES_VERSION}
      </h2>
      <p>
        {sourcedStateRules().length} rows cite a statute or insurance-department
        page opened on 21 September 2026. {unsourcedStateRules().length} rows
        have no source URL. A row with no source URL does not show a dollar
        minimum. The words in a sourced cell are the amounts on the page that
        was opened. They are not a premium, and they are not coverage advice.
        Credit is unreviewed on every row, and the factor is locked at 1.00.
        The reviewer column is unsigned.
      </p>
      <StateRulesTable />
    </TrustArticle>
  )
}
