import type { Metadata } from "next"
import { TrustArticle } from "@/components/trust-article"
import { SOURCE_ROWS } from "@/lib/sources"

export const metadata: Metadata = {
  title: "Sources",
}

export default function SourcesPage() {
  return (
    <TrustArticle title="Sources">
      <p>
        No source below has been snapshotted for this version. Nothing on the
        calculator is a figure from these sources. The sample range uses
        arbitrary display weights, documented on the methodology page. Last
        checked: not checked.
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
    </TrustArticle>
  )
}
