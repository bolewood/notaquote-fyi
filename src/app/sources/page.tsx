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
      <div className="overflow-x-auto">
        <table className="w-full min-w-[64rem] border-collapse text-left text-sm">
          <caption className="sr-only">Source manifest {MANIFEST_VERSION}</caption>
          <thead>
            <tr className="border-b border-border">
              <th scope="col" className="py-2 pr-3 font-medium">
                Source
              </th>
              <th scope="col" className="py-2 pr-3 font-medium">
                Owner
              </th>
              <th scope="col" className="py-2 pr-3 font-medium">
                License note
              </th>
              <th scope="col" className="py-2 pr-3 font-medium">
                Access
              </th>
              <th scope="col" className="py-2 pr-3 font-medium">
                Refresh
              </th>
              <th scope="col" className="py-2 pr-3 font-medium">
                Last checked
              </th>
              <th scope="col" className="py-2 font-medium">
                Derived fields
              </th>
            </tr>
          </thead>
          <tbody>
            {SOURCE_MANIFEST.map((row) => (
              <tr key={row.id} className="border-b border-border align-top">
                <th scope="row" className="py-3 pr-3 font-medium">
                  {row.url ? (
                    <a
                      href={row.url}
                      className="underline underline-offset-4"
                      rel="noreferrer"
                    >
                      {citationLabel(row)}
                    </a>
                  ) : (
                    citationLabel(row)
                  )}
                </th>
                <td className="py-3 pr-3">{row.owner}</td>
                <td className="py-3 pr-3">{row.licenseNote}</td>
                <td className="py-3 pr-3">{row.accessMethod}</td>
                <td className="py-3 pr-3">{row.refreshCadence}</td>
                <td className="py-3 pr-3">{formatCatalogDate(row.lastChecked)}</td>
                <td className="py-3">{derivedFieldLabel(row)}</td>
              </tr>
            ))}
          </tbody>
        </table>
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
