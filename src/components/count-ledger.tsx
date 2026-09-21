"use client"

import {
  COUNT_KINDS,
  COUNT_LABELS,
  countPayload,
  getCountSnapshot,
  getServerCountSnapshot,
  recordMountedCount,
  subscribeCounts,
} from "@/lib/counts"
import { useEffect, useSyncExternalStore } from "react"

export function CountLedgerPanel() {
  const snap = useSyncExternalStore(subscribeCounts, getCountSnapshot, getServerCountSnapshot)

  useEffect(() => {
    recordMountedCount("trust_page_view")
  }, [])

  return (
    <section aria-labelledby="count-ledger-heading" className="grid gap-3">
      <h2 id="count-ledger-heading" className="text-base font-semibold">
        Counts in this browser
      </h2>
      <p>
        A count payload is one kind. The list below is every payload this page
        records. The tally is how many of those payloads this browser has kept.
        The tally stays in local storage on this browser. It is not sent.
      </p>
      <ul data-testid="count-payloads" className="grid gap-1 font-mono text-xs leading-5">
        {COUNT_KINDS.map((kind) => (
          <li key={kind}>{JSON.stringify(countPayload(kind))}</li>
        ))}
      </ul>
      {snap.failed ? (
        <p data-testid="count-ledger-status">This browser did not keep a count tally.</p>
      ) : snap.ledger === null ? (
        <p data-testid="count-ledger-status">Loading the tally kept in this browser.</p>
      ) : (
        <div className="grid gap-2">
          <table className="w-full text-sm" data-testid="count-ledger">
            <caption className="sr-only">Count tally in this browser</caption>
            <thead>
              <tr className="border-b border-border text-left">
                <th scope="col" className="py-1 font-medium">
                  Kind
                </th>
                <th scope="col" className="py-1 text-right font-medium">
                  Count
                </th>
              </tr>
            </thead>
            <tbody>
              {COUNT_KINDS.map((kind) => (
                <tr key={kind} className="border-b border-border">
                  <th scope="row" className="py-1 text-left font-normal">
                    {COUNT_LABELS[kind]}
                  </th>
                  <td className="py-1 text-right tabular-nums">{snap.ledger?.[kind]}</td>
                </tr>
              ))}
            </tbody>
          </table>
          <p className="text-muted-foreground text-xs leading-snug">Stored tally</p>
          <pre
            data-testid="count-ledger-json"
            className="overflow-x-auto font-mono text-xs leading-5 whitespace-pre-wrap"
          >
            {JSON.stringify(snap.ledger)}
          </pre>
        </div>
      )}
    </section>
  )
}
