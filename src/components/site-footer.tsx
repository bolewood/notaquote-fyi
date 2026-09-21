import Link from "next/link"
import { CATALOG_VERSION } from "@/lib/catalog-meta"
import { DATA_BUNDLE_VERSION, MODEL_VERSION, PUBLISHER } from "@/lib/copy"
import { STATE_RULES_VERSION } from "@/lib/state-rules"

export function SiteFooter() {
  return (
    <footer className="mt-auto border-t border-border">
      <div className="mx-auto grid w-full max-w-6xl gap-2 px-4 py-3 text-sm lg:px-6">
        <nav aria-label="Footer" className="flex flex-wrap gap-x-4 gap-y-1">
          <Link href="/disclaimer" className="focus-visible:ring-ring rounded-sm focus-visible:ring-3">
            Disclaimer
          </Link>
          <Link
            href="/data-licenses"
            className="focus-visible:ring-ring rounded-sm focus-visible:ring-3"
          >
            Data licenses
          </Link>
          <Link
            href="/model-version"
            className="focus-visible:ring-ring rounded-sm focus-visible:ring-3"
          >
            Model version {MODEL_VERSION}
          </Link>
          <Link
            href="/corrections"
            className="focus-visible:ring-ring rounded-sm focus-visible:ring-3"
          >
            Corrections
          </Link>
        </nav>
        <p>{PUBLISHER}</p>
        <p className="text-muted-foreground">
          With no current premium entered, the dollars are a labeled sample. The
          factor engine does not price an uncleared baseline. Saved comparisons
          stay in this browser. Data bundle{" "}
          {DATA_BUNDLE_VERSION}. Catalog {CATALOG_VERSION}. State rules{" "}
          {STATE_RULES_VERSION}.
        </p>
      </div>
    </footer>
  )
}
