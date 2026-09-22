"use client"

import { recordCount } from "@/lib/counts"
import { Link2 } from "lucide-react"
import { useState } from "react"

/**
 * Copy a share link. The link holds choices, never prices. What someone pays
 * now goes in only if they tick the box (and the box only appears when there
 * is a premium to share).
 */
export function ShareBox({
  buildPath,
  premiumAvailable,
  what,
}: {
  buildPath: (includePremium: boolean) => string
  premiumAvailable: boolean
  /** What the link opens, e.g. "this what-if" or "this list". */
  what: string
}) {
  const [includePremium, setIncludePremium] = useState(false)
  const [url, setUrl] = useState<string | null>(null)
  const [status, setStatus] = useState<string | null>(null)

  function copy() {
    recordCount("share_link_copy")
    const next = new URL(buildPath(premiumAvailable && includePremium), window.location.origin).toString()
    setUrl(next)
    const clipboard = navigator.clipboard
    if (!clipboard?.writeText) {
      setStatus("Copy the link below.")
      return
    }
    void clipboard.writeText(next).then(
      () => setStatus(`Link copied. Anyone who opens it sees ${what}, worked out fresh.`),
      () => setStatus("Copy the link below."),
    )
  }

  return (
    <div className="grid gap-2">
      <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
        <button type="button" className="btn" onClick={copy} data-testid="copy-share-link">
          <Link2 className="size-4" />
          Copy a share link
        </button>
        {premiumAvailable ? (
          <label className="flex cursor-pointer items-center gap-2 text-sm">
            <input
              type="checkbox"
              className="size-4 accent-[var(--primary)]"
              checked={includePremium}
              onChange={(event) => {
                setIncludePremium(event.target.checked)
                setUrl(null)
                setStatus(null)
              }}
            />
            Include what I pay now
          </label>
        ) : null}
      </div>
      {status ? (
        <p className="text-sm" role="status" data-testid="share-status">
          {status}
        </p>
      ) : null}
      {url ? (
        <p className="rounded-lg bg-muted px-3 py-2 font-mono text-xs leading-snug break-all" data-testid="share-url">
          {url}
        </p>
      ) : (
        <p className="text-xs text-muted-foreground">
          The link holds your choices, not any prices.
          {premiumAvailable ? " What you pay stays out unless you tick the box." : ""}
        </p>
      )}
    </div>
  )
}
