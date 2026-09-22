"use client"

import {
  COUNT_KINDS,
  COUNT_LABELS,
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
        The tallies in this browser
      </h2>
      <p>
        This is everything we count, and the counts so far on this device. Nobody but you can see them. Each entry is just
        a kind of action, like <code className="font-mono text-xs">{`{"kind":"csv_download"}`}</code>, with no choices or
        amounts attached.
      </p>
      {snap.failed ? (
        <p data-testid="count-ledger-status">This browser isn&apos;t keeping tallies.</p>
      ) : snap.ledger === null ? (
        <p data-testid="count-ledger-status">Loading…</p>
      ) : (
        <table className="w-full text-sm" data-testid="count-ledger">
          <caption className="sr-only">Tallies kept in this browser</caption>
          <thead>
            <tr className="border-b border-border text-left">
              <th scope="col" className="py-1 font-medium">
                What
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
      )}
    </section>
  )
}
