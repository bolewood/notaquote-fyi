import type { Metadata } from "next"
import { StateRulesTable } from "@/components/state-rules-table"
import { TrustArticle } from "@/components/trust-article"
import { SOURCE_ROWS } from "@/lib/sources"
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
        The vehicle catalog is a snapshot of NHTSA vPIC and FuelEconomy.gov.
        The sample range still uses arbitrary display weights, documented on
        the methodology page. Those weights are not figures from the sources
        below. A source that is not snapshotted has no figures on the page.
      </p>
      <div className="overflow-x-auto">
        <table className="w-full border-collapse text-left">
          <caption className="sr-only">
            Intended sources and their status in this version
          </caption>
          <thead>
            <tr className="border-b border-border">
              <th scope="col" className="py-2 pr-3 font-medium">
                Source
              </th>
              <th scope="col" className="py-2 pr-3 font-medium">
                Intended use
              </th>
              <th scope="col" className="py-2 font-medium">
                Status
              </th>
            </tr>
          </thead>
          <tbody>
            {SOURCE_ROWS.map((row) => (
              <tr key={row.name} className="border-b border-border align-top">
                <th scope="row" className="py-3 pr-3 font-medium">
                  {row.url ? (
                    <a
                      href={row.url}
                      className="underline underline-offset-4"
                      rel="noreferrer"
                    >
                      {row.name}
                    </a>
                  ) : (
                    row.name
                  )}
                </th>
                <td className="py-3 pr-3">{row.use}</td>
                <td className="py-3">{row.status}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <p>
        Public entry points are listed so a later snapshot has a starting URL.
        Listing a URL is not a claim that the page was reviewed, and it is not
        permission to copy a table.
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
