"use client"

import { Button } from "@/components/ui/button"
import {
  COMPARISON_EVENT,
  COMPARISON_SNAPSHOT_ERROR,
  comparisonSnapshot,
  comparisonsFromSnapshot,
  writeComparisons,
  type SavedComparison,
} from "@/lib/comparison-tray"
import { formatDollars } from "@/lib/sample-range"
import {
  COVERAGE_PACKAGES,
  regionLabel,
  stateName,
  vehicleLabel,
} from "@/lib/scenario"
import { useCallback, useEffect, useMemo, useRef, useState, useSyncExternalStore, type ReactNode } from "react"

function subscribeComparisons(onStoreChange: () => void) {
  window.addEventListener("storage", onStoreChange)
  window.addEventListener(COMPARISON_EVENT, onStoreChange)
  return () => {
    window.removeEventListener("storage", onStoreChange)
    window.removeEventListener(COMPARISON_EVENT, onStoreChange)
  }
}

function readComparisonSnapshot() {
  return comparisonSnapshot(window.localStorage)
}

export function useComparisonTray() {
  const raw = useSyncExternalStore(subscribeComparisons, readComparisonSnapshot, () => "")
  const items = useMemo(() => comparisonsFromSnapshot(raw), [raw])
  const [writeError, setWriteError] = useState<string | null>(null)
  const replace = useCallback((next: SavedComparison[]) => {
    try {
      writeComparisons(window.localStorage, next)
      window.dispatchEvent(new Event(COMPARISON_EVENT))
      setWriteError(null)
    } catch {
      setWriteError("This browser did not keep the scenario.")
    }
  }, [])
  const readError =
    raw === COMPARISON_SNAPSHOT_ERROR ? "This browser did not open saved scenarios." : null
  return {
    items,
    ready: true,
    error: writeError ?? readError,
    replace,
  }
}

export function ComparisonList({
  items,
  ready,
  error,
  onOpen,
  onRemove,
  headingId,
}: {
  items: SavedComparison[]
  ready: boolean
  error: string | null
  onOpen: (item: SavedComparison) => void
  onRemove: (id: string) => void
  headingId: string
}) {
  return (
    <div className="grid gap-3">
      <div className="grid gap-1">
        <h2 id={headingId} className="text-sm font-medium">
          Saved comparisons
        </h2>
        <p className="text-muted-foreground text-xs leading-snug">
          Kept in this browser only. No account. One driver and one car in each
          scenario. Refresh keeps this list.
        </p>
      </div>
      {error ? <p className="text-sm leading-snug">{error}</p> : null}
      {!ready ? (
        <p className="text-sm leading-snug">Checking this browser for saved scenarios.</p>
      ) : items.length === 0 ? (
        <p className="text-sm leading-snug" data-testid="comparison-empty">
          Nothing saved on this browser yet. Save Molly, then save Jayden, and
          both stay in this list.
        </p>
      ) : (
        <ul className="grid gap-2" aria-label="Saved scenarios">
          {items.map((item) => {
            const coverage =
              COVERAGE_PACKAGES.find((entry) => entry.id === item.scenario.coverage)?.label ??
              item.scenario.coverage
            const name = `${item.label}, ${vehicleLabel(item.scenario)}`
            return (
              <li
                key={item.id}
                className="grid gap-1 rounded-md border border-border px-3 py-2"
                data-testid="saved-scenario"
                data-scenario-label={item.label}
              >
                <p className="text-sm font-medium">{item.label}</p>
                <p className="text-sm leading-snug">
                  {vehicleLabel(item.scenario)}. {stateName(item.scenario.state)},{" "}
                  {regionLabel(item.scenario.region).toLowerCase()}. {coverage}.
                </p>
                <p className="text-muted-foreground text-xs leading-snug">
                  {item.anchorAmount === null
                    ? "No current premium saved with this scenario."
                    : `Visitor anchor ${formatDollars(item.anchorAmount)}. Not a cleared baseline. Stored on this browser only.`}
                </p>
                <div className="flex flex-wrap gap-2 pt-1">
                  <Button
                    type="button"
                    size="sm"
                    onClick={() => onOpen(item)}
                    aria-label={`Open ${name}`}
                  >
                    Open
                  </Button>
                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    onClick={() => onRemove(item.id)}
                    aria-label={`Remove ${name}`}
                  >
                    Remove
                  </Button>
                </div>
              </li>
            )
          })}
        </ul>
      )}
      {ready ? (
        <p className="text-muted-foreground text-xs" aria-live="polite">
          {items.length === 0
            ? "No scenarios saved on this browser."
            : `${items.length} ${items.length === 1 ? "scenario" : "scenarios"} saved on this browser.`}
        </p>
      ) : null}
    </div>
  )
}

export function ComparisonSheet({
  open,
  onClose,
  children,
}: {
  open: boolean
  onClose: () => void
  children: ReactNode
}) {
  const ref = useRef<HTMLDialogElement>(null)

  useEffect(() => {
    const dialog = ref.current
    if (!dialog) return
    if (open && !dialog.open) {
      dialog.showModal()
      dialog.querySelector("button")?.focus()
    }
    if (!open && dialog.open) dialog.close()
  }, [open])

  return (
    <dialog
      ref={ref}
      className="comparison-sheet no-print"
      aria-labelledby="comparison-sheet-heading"
      onClose={onClose}
    >
      <div className="mb-3 flex justify-end">
        <Button type="button" variant="outline" size="sm" onClick={() => ref.current?.close()}>
          Close
        </Button>
      </div>
      {children}
    </dialog>
  )
}
